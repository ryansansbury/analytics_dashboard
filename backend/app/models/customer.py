from app import db


class Customer(db.Model):
    """Customer model."""
    __tablename__ = 'customers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    company = db.Column(db.String(255))
    industry = db.Column(db.String(100))
    segment = db.Column(db.String(50))  # enterprise, mid-market, smb
    acquisition_date = db.Column(db.Date)
    acquisition_channel = db.Column(db.String(50))
    lifetime_value = db.Column(db.Numeric(12, 2))
    status = db.Column(db.String(20))  # active, churned, at-risk
    region = db.Column(db.String(50))

    # Relationships
    transactions = db.relationship('Transaction', back_populates='customer')
    pipelines = db.relationship('Pipeline', back_populates='customer')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'company': self.company,
            'industry': self.industry,
            'segment': self.segment,
            'acquisitionDate': self.acquisition_date.isoformat() if self.acquisition_date else None,
            'acquisitionChannel': self.acquisition_channel,
            'lifetimeValue': float(self.lifetime_value) if self.lifetime_value else 0,
            'status': self.status,
            'region': self.region,
        }
