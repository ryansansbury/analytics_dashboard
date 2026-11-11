from datetime import datetime
from app import db


class Pipeline(db.Model):
    """Pipeline opportunity model."""
    __tablename__ = 'pipeline'

    id = db.Column(db.Integer, primary_key=True)
    opportunity_name = db.Column(db.String(255))
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'))
    sales_rep_id = db.Column(db.Integer, db.ForeignKey('sales_reps.id'))
    stage = db.Column(db.String(50), index=True)  # lead, qualified, proposal, negotiation, closed-won, closed-lost
    amount = db.Column(db.Numeric(12, 2))
    probability = db.Column(db.Integer)  # 0-100
    expected_close_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # The day the deal was won or lost. Null while it's still open.
    closed_at = db.Column(db.Date, index=True)

    # Relationships
    customer = db.relationship('Customer', back_populates='pipelines')
    sales_rep = db.relationship('SalesRep', back_populates='pipelines')
    stage_changes = db.relationship('StageChange', back_populates='opportunity',
                                    order_by='StageChange.entered_on', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'opportunityName': self.opportunity_name,
            'customerId': self.customer_id,
            'customerName': self.customer.company if self.customer else None,
            'salesRepId': self.sales_rep_id,
            'salesRepName': self.sales_rep.name if self.sales_rep else None,
            'stage': self.stage,
            'amount': float(self.amount) if self.amount else 0,
            'probability': self.probability,
            'expectedCloseDate': self.expected_close_date.isoformat() if self.expected_close_date else None,
        }
