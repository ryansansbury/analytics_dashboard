"""Churn classification.

A gradient-boosted classifier over RFM, tenure, refund rate, and account
attributes. Metrics reported by the API come from a stratified holdout split
that the model never sees during fitting. Nothing here is hardcoded.

Why gradient boosting: the useful structure is non-linear (recency matters
enormously past a threshold and barely at all before it) and interacts with
segment. A linear model underfits that, and a single tree overfits it.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict, field

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .features import CATEGORICAL_FEATURES, NUMERIC_FEATURES

RANDOM_STATE = 42
TEST_SIZE = 0.25


@dataclass
class ChurnMetrics:
    """Holdout performance. Every number is measured, not asserted."""

    roc_auc: float
    average_precision: float
    accuracy: float
    precision: float
    recall: float
    f1: float
    brier: float
    n_train: int
    n_test: int
    positive_rate: float
    threshold: float
    feature_importance: dict = field(default_factory=dict)
    #: The day the training features describe, when the frame recorded one.
    cutoff: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def _build_pipeline() -> Pipeline:
    pre = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
        ]
    )
    clf = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=3,
        subsample=0.9,
        random_state=RANDOM_STATE,
    )
    return Pipeline([("pre", pre), ("clf", clf)])


class ChurnModel:
    """Fitted churn classifier plus the evidence for its own scoreboard."""

    def __init__(self, pipeline: Pipeline, metrics: ChurnMetrics):
        self.pipeline = pipeline
        self.metrics = metrics

    def predict_proba(self, frame: pd.DataFrame) -> np.ndarray:
        features = frame[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
        return self.pipeline.predict_proba(features)[:, 1]


def _feature_importance(pipeline: Pipeline, top_n: int = 8) -> dict:
    """Gain-based importance, mapped back to readable names."""
    pre = pipeline.named_steps["pre"]
    clf = pipeline.named_steps["clf"]
    try:
        names = list(pre.get_feature_names_out())
    except Exception:
        return {}
    importances = getattr(clf, "feature_importances_", None)
    if importances is None or len(names) != len(importances):
        return {}
    pairs = sorted(zip(names, importances), key=lambda kv: kv[1], reverse=True)
    return {
        name.split("__", 1)[-1]: round(float(weight), 4)
        for name, weight in pairs[:top_n]
        if weight > 0
    }


def train(frame: pd.DataFrame, threshold: float = 0.5) -> ChurnModel:
    """Fit on a stratified split and measure on the held-out quarter.

    Raises ValueError when the data cannot support a supervised fit, which is
    the correct outcome for a single-class or near-empty table. Callers surface
    that as an unavailable model rather than inventing numbers.
    """
    required = set(NUMERIC_FEATURES + CATEGORICAL_FEATURES + ["churned"])
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"feature frame missing columns: {sorted(missing)}")

    y = frame["churned"].to_numpy()
    if len(frame) < 100:
        raise ValueError(f"not enough customers to train: {len(frame)}")
    if len(np.unique(y)) < 2:
        raise ValueError("training data contains a single class")

    X = frame[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )

    pipeline = _build_pipeline()
    pipeline.fit(X_train, y_train)

    proba = pipeline.predict_proba(X_test)[:, 1]
    pred = (proba >= threshold).astype(int)

    metrics = ChurnMetrics(
        roc_auc=round(float(roc_auc_score(y_test, proba)), 4),
        average_precision=round(float(average_precision_score(y_test, proba)), 4),
        accuracy=round(float(accuracy_score(y_test, pred)), 4),
        precision=round(float(precision_score(y_test, pred, zero_division=0)), 4),
        recall=round(float(recall_score(y_test, pred, zero_division=0)), 4),
        f1=round(float(f1_score(y_test, pred, zero_division=0)), 4),
        brier=round(float(brier_score_loss(y_test, proba)), 4),
        n_train=int(len(X_train)),
        n_test=int(len(X_test)),
        positive_rate=round(float(y.mean()), 4),
        threshold=threshold,
        feature_importance=_feature_importance(pipeline),
        cutoff=frame.attrs["cutoff"].isoformat() if frame.attrs.get("cutoff") else None,
    )
    return ChurnModel(pipeline, metrics)
