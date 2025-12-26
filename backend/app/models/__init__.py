"""
Database Models Package

This package contains all SQLAlchemy ORM models for the analytics dashboard.
Models map to PostgreSQL tables and define the data schema.

Entity Relationships:
- Customer has many Transactions and Pipeline opportunities
- Product has many Transactions
- SalesRep has many Transactions and Pipeline opportunities
- Transaction links Customer, Product, and SalesRep
- Pipeline represents sales opportunities (potential Transactions)

Table Overview:
- products: Product catalog with pricing
- customers: Customer accounts with segmentation and LTV
- sales_reps: Sales team members with quota assignments
- transactions: Completed sales/orders
- pipeline: Active sales opportunities by stage
- daily_metrics: Pre-aggregated metrics for performance (optional)
"""

from .product import Product
from .customer import Customer
from .sales_rep import SalesRep
from .transaction import Transaction
from .pipeline import Pipeline
from .daily_metric import DailyMetric

__all__ = [
    'Product',
    'Customer',
    'SalesRep',
    'Transaction',
    'Pipeline',
    'DailyMetric',
]
