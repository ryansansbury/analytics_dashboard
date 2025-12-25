from datetime import datetime
from app import db


class Transaction(db.Model):
    """Transaction model."""
    __tablename__ = 'transactions'

    id = db.Column(db.Integer, primary_key=True)
    transaction_date = db.Column(db.Date, nullable=False, index=True)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), index=True)
    sales_rep_id = db.Column(db.Integer, db.ForeignKey('sales_reps.id'))
    region = db.Column(db.String(50))
    channel = db.Column(db.String(50))  # direct, online, partner
    status = db.Column(db.String(20))   # completed, pending, refunded
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    product = db.relationship('Product', back_populates='transactions')
    customer = db.relationship('Customer', back_populates='transactions')
    sales_rep = db.relationship('SalesRep', back_populates='transactions')

    def to_dict(self):
        return {
            'id': self.id,
            'transactionDate': self.transaction_date.isoformat() if self.transaction_date else None,
            'amount': float(self.amount) if self.amount else 0,
            'quantity': self.quantity,
            'productId': self.product_id,
            'customerId': self.customer_id,
            'salesRepId': self.sales_rep_id,
            'region': self.region,
            'channel': self.channel,
            'status': self.status,
        }
