"""
Customer Model

Represents a customer in the analytics dashboard. Customers are segmented by
business size (enterprise, mid-market, SMB) and tracked through their lifecycle
from acquisition to potential churn.

Key Metrics Tracked:
- Lifetime Value (LTV): Total revenue attributed to this customer
- Status: Current relationship state (active, at-risk, churned)
- Acquisition: When and how the customer was acquired

Relationships:
- Transactions: All purchase transactions made by this customer
- Pipelines: Sales opportunities associated with this customer
"""

from app import db


class Customer(db.Model):
    """
    Customer entity representing a B2B customer account.

    Customers are the core entity for customer analytics, cohort analysis,
    and churn prediction features of the dashboard.

    Attributes:
        id: Unique identifier
        name: Contact name at the customer
        company: Company/organization name
        industry: Business sector (Technology, Healthcare, Finance, etc.)
        segment: Customer tier - 'enterprise', 'mid-market', or 'smb'
        acquisition_date: When the customer first converted
        acquisition_channel: How they were acquired (Direct Sales, Referral, etc.)
        lifetime_value: Total revenue from this customer to date
        status: Current state - 'active', 'at-risk', or 'churned'
        region: Geographic region (North America, Europe, etc.)
    """
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

    # Relationships - enable bidirectional navigation between related entities
    transactions = db.relationship('Transaction', back_populates='customer')
    pipelines = db.relationship('Pipeline', back_populates='customer')

    def to_dict(self) -> dict:
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
