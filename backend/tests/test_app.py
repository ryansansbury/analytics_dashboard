"""The application factory's guards: what it refuses to start on, what it
refuses to answer, and what it keeps out of a response.

Each test builds its own small app on SQLite. None of them read the seeded
fixture, so they run in a second.
"""

from __future__ import annotations

import pytest
from werkzeug.datastructures import MultiDict
from werkzeug.middleware.proxy_fix import ProxyFix

from app import analytics, create_app
from app.config import DEV_SECRET, ProductionConfig, TestingConfig, missing
from app.ml import registry


def settings(base=TestingConfig, **over):
    """A config class with a few settings changed."""
    return type("Settings", (base,), over)


def sqlite(path) -> str:
    return f"sqlite:///{path}"


@pytest.fixture()
def small_app(tmp_path):
    return create_app(settings(SQLALCHEMY_DATABASE_URI=sqlite(tmp_path / "small.db")))


@pytest.fixture()
def small(small_app):
    return small_app.test_client()


class TestStartUp:
    def test_production_names_what_it_is_missing(self):
        bare = settings(ProductionConfig, SECRET_KEY=None, SQLALCHEMY_DATABASE_URI=None)
        assert missing(bare) == ["SECRET_KEY", "DATABASE_URL"]
        with pytest.raises(RuntimeError, match="SECRET_KEY and DATABASE_URL"):
            create_app(bare)

    def test_production_refuses_the_development_secret(self):
        placeholder = settings(ProductionConfig, SECRET_KEY=DEV_SECRET, SQLALCHEMY_DATABASE_URI="sqlite://")
        assert missing(placeholder) == ["SECRET_KEY"]
        with pytest.raises(RuntimeError, match="SECRET_KEY"):
            create_app(placeholder)

    def test_production_starts_when_both_are_set(self, tmp_path):
        ready = settings(ProductionConfig, SECRET_KEY="a-real-secret",
                         SQLALCHEMY_DATABASE_URI=sqlite(tmp_path / "p.db"))
        assert missing(ready) == []
        assert create_app(ready).config["DEBUG"] is False

    def test_development_and_testing_need_nothing(self):
        assert missing(TestingConfig) == []

    def test_an_unknown_config_name_is_refused_by_name(self):
        with pytest.raises(RuntimeError, match="staging"):
            create_app("staging")


class TestWhoIsTrusted:
    def test_forwarded_headers_are_ignored_by_default(self, small_app):
        assert not isinstance(small_app.wsgi_app, ProxyFix)

    def test_forwarded_headers_are_trusted_for_the_hops_named(self, tmp_path):
        behind = create_app(settings(PROXY_HOPS=1, SQLALCHEMY_DATABASE_URI=sqlite(tmp_path / "h.db")))
        assert isinstance(behind.wsgi_app, ProxyFix)

    def test_no_other_origin_may_read_the_api_by_default(self, small):
        response = small.get("/api/health", headers={"Origin": "https://elsewhere.example"})
        assert response.status_code == 200
        assert "Access-Control-Allow-Origin" not in response.headers

    def test_only_a_named_origin_may_read_the_api(self, tmp_path):
        named = create_app(settings(CORS_ORIGINS=["https://app.example"],
                                    SQLALCHEMY_DATABASE_URI=sqlite(tmp_path / "c.db"))).test_client()
        allowed = named.get("/api/health", headers={"Origin": "https://app.example"})
        assert allowed.headers.get("Access-Control-Allow-Origin") == "https://app.example"
        other = named.get("/api/health", headers={"Origin": "https://elsewhere.example"})
        assert "Access-Control-Allow-Origin" not in other.headers


class TestResponses:
    def test_every_response_carries_the_security_headers(self, small):
        headers = small.get("/api/health").headers
        assert headers["X-Content-Type-Options"] == "nosniff"
        assert headers["Referrer-Policy"] == "no-referrer"
        policy = headers["Content-Security-Policy"]
        assert "default-src 'none'" in policy and "script-src 'self'" in policy
        assert "unsafe-eval" not in policy

    def test_a_health_failure_keeps_the_database_address_out_of_the_answer(self, tmp_path):
        address = sqlite(tmp_path / "no-such-folder" / "secret-name.db")
        broken = create_app(settings(SQLALCHEMY_DATABASE_URI=address)).test_client()
        response = broken.get("/api/health")
        body = response.get_data(as_text=True)
        assert response.get_json()["status"] == "degraded"
        assert "secret-name" not in body and "sqlite" not in body.lower()


class TestQueryChecks:
    @pytest.mark.parametrize("query", [
        "start_date=yesterday",
        "end_date=2026-13-45",
        "start_date=2026-01-01'%20OR%201=1",
        "start_date=0001-01-01",
        "end_date=9999-12-31",
        "start_date=2000-01-01&end_date=2026-01-01",
        "start_date=2001-01-01",
    ])
    def test_a_bad_window_is_a_400_with_a_reason(self, small, query):
        response = small.get(f"/api/revenue/trends?{query}")
        assert response.status_code == 400
        assert response.get_json()["error"]

    def test_a_good_window_passes(self, small):
        assert small.get("/api/health?start_date=2026-01-01&end_date=2026-06-30").status_code == 200

    def test_the_check_reads_dates_alone(self):
        assert analytics.query_problem(MultiDict({"granularity": "month", "limit": "5"})) is None
        assert analytics.query_problem(MultiDict({"start_date": "", "end_date": ""})) is None

    @pytest.mark.parametrize("given,expected", [("5", 5), ("0", 1), ("-3", 1), ("100000", 100), ("many", 10), (None, 10)])
    def test_a_count_stays_inside_its_bounds(self, given, expected):
        args = MultiDict({} if given is None else {"limit": given})
        assert analytics.int_arg(args, "limit", 10, 1, 100) == expected


class TestStaticFiles:
    @pytest.fixture()
    def served(self, tmp_path):
        folder = tmp_path / "static"
        folder.mkdir()
        (folder / "index.html").write_text("the interface")
        (folder / "app.js").write_text("the script")
        (tmp_path / "outside.txt").write_text("not for serving")
        return create_app(settings(STATIC_FOLDER=str(folder),
                                   SQLALCHEMY_DATABASE_URI=sqlite(tmp_path / "s.db"))).test_client()

    def test_a_file_is_served_and_a_route_falls_back_to_the_interface(self, served):
        assert served.get("/app.js").get_data(as_text=True) == "the script"
        assert served.get("/customers").get_data(as_text=True) == "the interface"

    def test_a_path_that_climbs_out_answers_like_any_unknown_route(self, served):
        """A file outside the folder and a file that doesn't exist get the same
        answer, so a request can't learn which is which."""
        outside = served.get("/../outside.txt")
        nothing = served.get("/../no-such-file.txt")
        assert "not for serving" not in outside.get_data(as_text=True)
        assert (outside.status_code, outside.get_data()) == (nothing.status_code, nothing.get_data())


class TestModelErrors:
    def test_a_training_crash_is_answered_in_general(self, monkeypatch):
        def crash():
            raise RuntimeError("could not connect to postgresql://user:hunter2@db.internal/analytics")

        monkeypatch.setattr(registry, "churn_training_frame", crash)
        monkeypatch.setattr(registry, "monthly_revenue", crash)
        registry.reset()
        try:
            assert registry.get_churn_error() == registry.FAILED
            assert registry.get_revenue_error() == registry.FAILED
            assert "hunter2" not in registry.FAILED
        finally:
            registry.reset()

    def test_the_models_own_refusal_is_passed_on(self, monkeypatch):
        def refuse():
            raise ValueError("not enough customers to train: 12")

        monkeypatch.setattr(registry, "churn_training_frame", refuse)
        monkeypatch.setattr(registry, "monthly_revenue", refuse)
        registry.reset()
        try:
            assert registry.get_churn_error() == "not enough customers to train: 12"
        finally:
            registry.reset()
