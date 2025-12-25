from app import db


class DailyMetric(db.Model):
    """Daily metrics time-series model."""
    __tablename__ = 'daily_metrics'

    id = db.Column(db.Integer, primary_key=True)
    metric_date = db.Column(db.Date, nullable=False, index=True)
    metric_name = db.Column(db.String(100), nullable=False)
    metric_value = db.Column(db.Numeric(15, 4))
    dimension = db.Column(db.String(100))  # optional grouping dimension

    __table_args__ = (
        db.UniqueConstraint('metric_date', 'metric_name', 'dimension', name='uix_daily_metrics'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'metricDate': self.metric_date.isoformat() if self.metric_date else None,
            'metricName': self.metric_name,
            'metricValue': float(self.metric_value) if self.metric_value else 0,
            'dimension': self.dimension,
        }
