from app import db


class Product(db.Model):
    """Product model."""
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100))
    unit_price = db.Column(db.Numeric(10, 2))
    cost = db.Column(db.Numeric(10, 2))
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    transactions = db.relationship('Transaction', back_populates='product')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'unitPrice': float(self.unit_price) if self.unit_price else 0,
            'cost': float(self.cost) if self.cost else 0,
            'isActive': self.is_active,
        }
