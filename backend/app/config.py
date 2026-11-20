"""Settings, read from the process's variables once at import.

Development and testing run with no variables set. Production refuses to start
without the ones in `ProductionConfig.REQUIRED`, because a placeholder secret or
a missing database address is a mistake better found at start-up than in use.
"""

import os
from dotenv import load_dotenv

load_dotenv()

#: The development placeholder. Production never falls back to it.
DEV_SECRET = 'dev-secret-key-change-in-production'


def _origins(value):
    """A comma-separated list of origins as a list, with blanks dropped."""
    return [item.strip() for item in (value or '').split(',') if item.strip()]


def _hops(value):
    """How many proxies sit in front of the app. Anything but a whole number is none."""
    try:
        return max(0, int(value or 0))
    except ValueError:
        return 0


class Config:
    """Base configuration."""
    SECRET_KEY = os.getenv('SECRET_KEY', DEV_SECRET)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }
    #: Other origins allowed to read the API from a browser. Empty by default:
    #: the dev server proxies /api and production serves both from one origin,
    #: so no cross-origin reader exists unless one is named here.
    CORS_ORIGINS = _origins(os.getenv('CORS_ORIGINS'))
    #: Proxies in front of the app whose X-Forwarded headers are trusted. Zero
    #: by default, since trusting them with no proxy in front lets any client
    #: set its own address, scheme, and host.
    PROXY_HOPS = _hops(os.getenv('PROXY_HOPS'))
    #: Settings a config can't start without.
    REQUIRED = ()


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'postgresql://localhost/analytics_dashboard'
    )


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    SECRET_KEY = os.getenv('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    REQUIRED = ('SECRET_KEY', 'SQLALCHEMY_DATABASE_URI')

    # Handle Heroku-style postgres:// URLs
    if SQLALCHEMY_DATABASE_URI and SQLALCHEMY_DATABASE_URI.startswith('postgres://'):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace(
            'postgres://', 'postgresql://', 1
        )


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig,
}

#: The variable that supplies each required setting, for the start-up message.
VARIABLES = {'SECRET_KEY': 'SECRET_KEY', 'SQLALCHEMY_DATABASE_URI': 'DATABASE_URL'}


def missing(settings) -> list:
    """Names of the variables a config needs and doesn't have.

    A secret equal to the development placeholder counts as missing.
    """
    out = []
    for name in getattr(settings, 'REQUIRED', ()):
        value = getattr(settings, name, None)
        if not value or value == DEV_SECRET:
            out.append(VARIABLES.get(name, name))
    return out
