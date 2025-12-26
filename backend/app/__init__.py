import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

from .config import config

db = SQLAlchemy()


def create_app(config_name: str = None) -> Flask:
    """Application factory."""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    # Check if we have a built frontend to serve
    static_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
    has_static = os.path.exists(static_folder)

    app = Flask(__name__, static_folder=static_folder if has_static else None)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

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
        return {'status': 'healthy', 'environment': config_name}

    # Serve frontend static files in production
    if has_static:
        @app.route('/')
        def serve_index():
            return send_from_directory(static_folder, 'index.html')

        @app.route('/<path:path>')
        def serve_static(path):
            # Try to serve the file, fall back to index.html for SPA routing
            if os.path.exists(os.path.join(static_folder, path)):
                return send_from_directory(static_folder, path)
            return send_from_directory(static_folder, 'index.html')

    # Create tables (skip if they already exist)
    with app.app_context():
        try:
            db.create_all()
        except Exception:
            pass  # Tables already exist

    return app
