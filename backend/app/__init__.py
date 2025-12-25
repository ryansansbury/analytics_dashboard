import os
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

from .config import config

db = SQLAlchemy()


def create_app(config_name: str = None) -> Flask:
    """Application factory."""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    app = Flask(__name__)
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

    # Create tables
    with app.app_context():
        db.create_all()

    return app
