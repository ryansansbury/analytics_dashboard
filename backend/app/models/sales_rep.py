from app import db


class SalesRep(db.Model):
    """Sales representative model."""
    __tablename__ = 'sales_reps'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    team = db.Column(db.String(100))
    region = db.Column(db.String(50))
    quota = db.Column(db.Numeric(12, 2))
    hire_date = db.Column(db.Date)

    # Relationships
    transactions = db.relationship('Transaction', back_populates='sales_rep')
    pipelines = db.relationship('Pipeline', back_populates='sales_rep')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'team': self.team,
            'region': self.region,
            'quota': float(self.quota) if self.quota else 0,
            'hireDate': self.hire_date.isoformat() if self.hire_date else None,
        }
