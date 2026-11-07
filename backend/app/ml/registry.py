"""Model registry.

Training runs on first use and the result is cached for the process lifetime.
The dataset is a fixed synthetic corpus, so retraining per request would burn
CPU to produce the identical model.

Every accessor can return None. That is deliberate: when the data cannot
support a fit, callers must say the model is unavailable rather than fall back
to invented numbers. The whole point of this module is that a reader can trust
a reported metric came from a real evaluation.
"""

from __future__ import annotations

import logging
import threading

from . import churn as churn_mod
from . import revenue as revenue_mod
from .features import churn_training_frame, monthly_revenue

log = logging.getLogger(__name__)

_lock = threading.Lock()
_churn_model = None
_churn_error: str | None = None
_revenue_forecast = None
_revenue_error: str | None = None
_trained = False


def _train_all() -> None:
    global _churn_model, _revenue_forecast, _churn_error, _revenue_error, _trained

    try:
        _churn_model = churn_mod.train(churn_training_frame())
        _churn_error = None
    except Exception as exc:  # noqa: BLE001 - surfaced to the caller verbatim
        _churn_model, _churn_error = None, str(exc)
        log.warning("churn model unavailable: %s", exc)

    try:
        _revenue_forecast = revenue_mod.train(monthly_revenue())
        _revenue_error = None
    except Exception as exc:  # noqa: BLE001
        _revenue_forecast, _revenue_error = None, str(exc)
        log.warning("revenue model unavailable: %s", exc)

    _trained = True


def _ensure() -> None:
    if _trained:
        return
    with _lock:
        if not _trained:
            _train_all()


def get_churn_model():
    _ensure()
    return _churn_model


def get_churn_error() -> str | None:
    _ensure()
    return _churn_error


def get_revenue_forecast(horizon: int = 6):
    """Cached forecast, refit only when a longer horizon is requested."""
    _ensure()
    global _revenue_forecast
    if _revenue_forecast is None:
        return None
    if len(_revenue_forecast.predictions) < horizon:
        try:
            _revenue_forecast = revenue_mod.train(monthly_revenue(), horizon=horizon)
        except Exception as exc:  # noqa: BLE001
            log.warning("forecast refit failed: %s", exc)
            return None
    return _revenue_forecast


def get_revenue_error() -> str | None:
    _ensure()
    return _revenue_error


def reset() -> None:
    """Drop cached models. Used by tests and after a reseed."""
    global _churn_model, _revenue_forecast, _churn_error, _revenue_error, _trained
    with _lock:
        _churn_model = None
        _revenue_forecast = None
        _churn_error = None
        _revenue_error = None
        _trained = False
