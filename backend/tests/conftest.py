"""Shared fixtures.

The dataset is generated once per test session and reused. Seeding is the
expensive part, and every test reads without mutating, so regenerating per test
would multiply the runtime for no isolation benefit.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta
from urllib.parse import urlparse

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import db  # noqa: E402
from app.models import Customer, Pipeline, Product, SalesRep, StageChange, Transaction  # noqa: E402

# Small enough to seed quickly, large enough for a stratified split to be
# meaningful and for both models to train.
TEST_CUSTOMERS = 600
TEST_TRANSACTIONS = 14000


@pytest.fixture(scope="session")
def app(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("db") / "test.db"
    application = Flask(__name__)
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    application.config["TESTING"] = True
    db.init_app(application)

    # Every blueprint, registered before the first request, because Flask
    # refuses a registration after the app has served one. Endpoints that
    # group with Postgres's date_trunc can't run here; the newer ones group
    # in pandas and can.
    from app.routes import customers, dashboard, forecasting, operations, revenue

    for module in (dashboard, revenue, customers, operations, forecasting):
        application.register_blueprint(module.bp)

    with application.app_context():
        db.create_all()
        _seed()

    return application


def _seed() -> None:
    import importlib.util

    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    spec = importlib.util.spec_from_file_location(
        "seed_data", os.path.join(here, "data", "seed_data.py")
    )
    seed = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(seed)

    seed.START_DATE = datetime.now() - timedelta(days=730)
    seed.END_DATE = datetime.now()
    seed.NUM_CUSTOMERS = TEST_CUSTOMERS
    seed.NUM_TRANSACTIONS = TEST_TRANSACTIONS

    # The same path reseed.py takes, so the fixture data has every table the
    # application reads, stage history included.
    data = seed.generate_all()
    for model, key in ((Product, "products"), (SalesRep, "sales_reps"), (Customer, "customers"),
                       (Transaction, "transactions"), (Pipeline, "pipeline"), (StageChange, "stage_changes")):
        db.session.bulk_insert_mappings(model, data[key])
    db.session.commit()


@pytest.fixture(scope="session")
def ctx(app):
    with app.app_context():
        yield


@pytest.fixture(scope="session")
def customers_frame(ctx):
    """The churn model's training table: features at a past cutoff, labelled by what came after."""
    from app.ml.features import churn_training_frame

    return churn_training_frame()


@pytest.fixture(scope="session")
def revenue_frame(ctx):
    from app.ml.features import monthly_revenue

    return monthly_revenue()


@pytest.fixture(scope="session")
def churn_model(customers_frame):
    from app.ml import churn

    return churn.train(customers_frame)


@pytest.fixture(scope="session")
def revenue_forecast(revenue_frame):
    from app.ml import revenue

    return revenue.train(revenue_frame)


@pytest.fixture()
def client(app):
    return app.test_client()


# ---------------------------------------------------------------------------
# Postgres-backed fixtures
#
# Most endpoints use `date_trunc`, which SQLite does not implement, so the
# cross-endpoint consistency suite cannot run on the SQLite fixture above. It
# runs against a real Postgres and skips cleanly when none is reachable, so a
# contributor without one still gets a green unit run.
#
# Point TEST_DATABASE_URL at any throwaway database. CI supplies a service
# container; locally the compose file's Postgres will do.
# ---------------------------------------------------------------------------

PG_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5455/analytics_dashboard_test",
)


def _refuse_non_test_database(url: str) -> None:
    """Abort rather than drop a database that was not named as disposable.

    `pg_app` calls `drop_all()`. On 2026-08-09 this suite was run with
    TEST_DATABASE_URL pointed at the development database, and it silently
    destroyed the real dataset and replaced it with the small fixture set. The
    snapshot built from it went to production before anyone noticed, because
    every test passed: the fixture data is perfectly valid, just not the data
    anybody meant to publish.

    A destructive fixture must not rely on the operator having aimed carefully.
    The database name has to opt in.
    """
    name = urlparse(url).path.lstrip("/")
    if not name:
        return
    permitted = name.endswith(("_test", "_tests")) or name.startswith("test_") or name == "test"
    if not permitted:
        pytest.exit(
            f"\nRefusing to run destructive fixtures against database '{name}'.\n"
            f"pg_app drops every table. Point TEST_DATABASE_URL at a database whose\n"
            f"name ends in '_test', for example '{name}_test'.\n",
            returncode=2,
        )


@pytest.fixture(scope="session")
def pg_app():
    sqlalchemy = pytest.importorskip("sqlalchemy")
    _refuse_non_test_database(PG_URL)
    try:
        engine = sqlalchemy.create_engine(PG_URL)
        with engine.connect():
            pass
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"no Postgres at {PG_URL}: {exc}")

    application = Flask(__name__)
    application.config["SQLALCHEMY_DATABASE_URI"] = PG_URL
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    application.config["TESTING"] = True
    db.init_app(application)

    from app.routes import customers, dashboard, forecasting, operations, revenue

    for module in (dashboard, revenue, customers, operations, forecasting):
        application.register_blueprint(module.bp)

    with application.app_context():
        db.drop_all()
        db.create_all()
        _seed()

    return application


@pytest.fixture(scope="session")
def pg_ctx(pg_app):
    with pg_app.app_context():
        yield


@pytest.fixture()
def pg_client(pg_app):
    return pg_app.test_client()
