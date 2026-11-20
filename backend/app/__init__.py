"""
Analytics Dashboard - Flask Application Factory

This module contains the Flask application factory that creates and configures
the web application. It follows the Flask application factory pattern to support
multiple configurations (development, production, testing).

Architecture Overview:
- Flask backend serves both the REST API and static frontend assets
- SQLAlchemy ORM for database operations (PostgreSQL in production)
- No cross-origin readers unless CORS_ORIGINS names them
- Blueprints organize routes by domain (dashboard, revenue, customers, etc.)

Key Components:
- /api/* routes: RESTful API endpoints for dashboard data
- Static file serving: Built React frontend served in production
- Database: Auto-creates tables on startup if they don't exist
"""

import logging
import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import safe_join

from .config import config, missing

log = logging.getLogger(__name__)

# What the compiled interface needs and nothing more: its own scripts, styles
# (the charts set inline ones), images, and API. The static demo ships under the
# same policy.
CONTENT_SECURITY_POLICY = (
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; "
    "frame-ancestors 'self'"
)

# Global SQLAlchemy instance - initialized with app in create_app()
db = SQLAlchemy()


def create_app(config_name: str = None) -> Flask:
    """
    Application factory for creating Flask app instances.

    This factory pattern allows creating multiple app instances with different
    configurations, which is essential for testing and running different
    environments (dev/staging/production).

    Args:
        config_name: Configuration to use ('development', 'production', 'testing').
                    Defaults to FLASK_ENV environment variable or 'development'.

                    A config object works too, which is how the tests build one.

    Returns:
        Configured Flask application instance ready to serve requests.

    Raises:
        RuntimeError: the config needs a setting that isn't there. Production
                    refuses to start on a placeholder secret or without a
                    database address.

    Example:
        app = create_app('development')
        app.run(port=5001)
    """
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    if isinstance(config_name, str):
        if config_name not in config:
            raise RuntimeError(f"FLASK_ENV is {config_name!r}. It can be one of: {', '.join(sorted(config))}.")
        settings = config[config_name]
    else:
        settings, config_name = config_name, getattr(config_name, 'NAME', 'custom')
    absent = missing(settings)
    if absent:
        raise RuntimeError(f"The {config_name} config can't start without {' and '.join(absent)}.")

    # Check if we have a built frontend to serve. A config can name another
    # folder, which is how the tests serve one they made.
    static_folder = getattr(settings, 'STATIC_FOLDER', None) or os.path.join(
        os.path.dirname(os.path.dirname(__file__)), 'static')
    has_static = os.path.exists(static_folder)

    app = Flask(__name__, static_folder=static_folder if has_static else None)
    app.config.from_object(settings)

    # X-Forwarded headers are believed only when PROXY_HOPS says how many
    # proxies sit in front (Railway and Heroku put one there). With none in
    # front, any client could write those headers itself.
    hops = app.config['PROXY_HOPS']
    if hops:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=hops, x_proto=hops, x_host=hops, x_prefix=hops)

    # Initialize extensions
    db.init_app(app)
    if app.config['CORS_ORIGINS']:
        CORS(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}})

    from . import analytics

    @app.before_request
    def check_query():
        """Answer 400 to dates no view should have to defend against."""
        if not request.path.startswith('/api/'):
            return None
        problem = analytics.query_problem(request.args)
        if problem:
            return jsonify({'error': problem}), 400
        return None

    @app.after_request
    def security_headers(response):
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('Referrer-Policy', 'no-referrer')
        response.headers.setdefault('Content-Security-Policy', CONTENT_SECURITY_POLICY)
        return response

    # Register blueprints
    from .routes import dashboard, revenue, customers, operations, forecasting

    app.register_blueprint(dashboard.bp)
    app.register_blueprint(revenue.bp)
    app.register_blueprint(customers.bp)
    app.register_blueprint(operations.bp)
    app.register_blueprint(forecasting.bp)

    # Health check endpoint
    @app.route('/api/health')
    def health():
        """Liveness plus data readiness.

        Reporting row counts and data freshness here is deliberate. Every
        endpoint degrades gracefully on an empty database and returns 200 with
        empty results, which is correct behaviour but indistinguishable from a
        broken deployment when you are looking at a blank dashboard. This says
        which one it is in a single request.
        """
        payload = {'status': 'healthy', 'environment': config_name}

        try:
            from datetime import date
            from .models import Customer, Pipeline, Transaction

            counts = {
                'customers': db.session.query(Customer).count(),
                'transactions': db.session.query(Transaction).count(),
                'pipeline': db.session.query(Pipeline).count(),
            }
            latest = db.session.query(db.func.max(Transaction.transaction_date)).scalar()
            seeded = counts['transactions'] > 0

            payload['data'] = {
                'seeded': seeded,
                'counts': counts,
                'latestTransaction': latest.isoformat() if latest else None,
                'ageInDays': (date.today() - latest).days if latest else None,
            }
            if not seeded:
                payload['status'] = 'degraded'
                payload['hint'] = 'Database is empty. Run: python reseed.py'
        except Exception:  # noqa: BLE001 - logged in full, answered in general
            # A database error's text can hold the connection address and the
            # query, so it goes to the log and never into the response.
            log.exception('health check could not read the tables')
            payload['status'] = 'degraded'
            payload['data'] = {'error': 'the tables could not be read'}
            payload['hint'] = 'Tables may be missing. Run: python reseed.py'

        return payload

    # Seeding is a deliberate, local operation. It used to be exposed as an
    # unauthenticated GET at /api/seed-database, which meant anyone who found
    # the URL could wipe and regenerate the entire dataset, and a stack trace
    # came back on failure. Use `python reseed.py` instead.
    #
    # If you ever need it over HTTP, gate it behind a token and make it POST.

    # Serve frontend static files in production
    if has_static:
        @app.route('/')
        def serve_index():
            return send_from_directory(static_folder, 'index.html')

        @app.route('/<path:path>')
        def serve_static(path):
            # Try to serve the file, fall back to index.html for SPA routing.
            # safe_join answers None for a path that climbs out of the folder,
            # so a request can't learn which files exist anywhere else.
            target = safe_join(static_folder, path)
            if target and os.path.isfile(target):
                return send_from_directory(static_folder, path)
            return send_from_directory(static_folder, 'index.html')

    # Ensure tables exist. Creating them is safe and idempotent; populating them
    # is not, and does not belong in an application factory.
    #
    # This block used to also auto-reseed whenever the newest transaction was
    # more than a week old, by calling seed_database(). That produced infinite
    # recursion: seed_database() itself calls create_app(), which reached this
    # block, found the database still empty, and called seed_database() again.
    # Each level opened its own SQLAlchemy engine, so the recursion terminated
    # only by exhausting the server's connections — meaning the app could never
    # cold-start against an empty database, and a shared Postgres instance would
    # be knocked over in the attempt. The bare `except Exception: pass` around
    # it hid the failure completely.
    #
    # Seeding is now a deliberate operation: `python reseed.py`.
    with app.app_context():
        try:
            db.create_all()
        except Exception:  # noqa: BLE001 - tables already exist is the normal case
            pass

    return app
