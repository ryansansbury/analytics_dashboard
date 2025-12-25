# Enterprise Analytics Dashboard

A production-grade, full-stack analytics dashboard demonstrating enterprise BI capabilities.

## Tech Stack

### Frontend
- **React 18** + Vite + TypeScript
- **Recharts** for data visualization
- **TailwindCSS** for styling
- **React Query** for data fetching

### Backend
- **Flask** with SQLAlchemy ORM
- **PostgreSQL** database
- **scikit-learn** for ML forecasting

### DevOps
- **Docker** + Docker Compose
- Configured for easy deployment

## Features

- **Executive Dashboard**: High-level KPIs, revenue trends, pipeline snapshot
- **Revenue Analytics**: Trends, category breakdown, regional performance
- **Customer Analytics**: Segments, cohorts, LTV distribution, churn risk
- **Operations**: Sales pipeline funnel, rep performance, deal metrics
- **Forecasting**: ML-powered revenue predictions, scenario modeling

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.12+
- PostgreSQL 15+ (or Docker)

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/analytics-dashboard.git
cd analytics-dashboard

# Start all services
docker-compose up -d

# Seed the database with sample data
docker-compose exec backend python data/seed_data.py

# Access the app
open http://localhost:3000
```

### Option 2: Local Development

```bash
# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create database
createdb analytics_dashboard

# Run backend
python run.py

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

## Project Structure

```
analytics_dashboard/
├── frontend/                # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API client
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   └── ...
├── backend/                 # Flask API
│   ├── app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   └── utils/          # Helpers
│   ├── data/               # Data seeding
│   └── ...
├── docker-compose.yml
└── README.md
```

## API Endpoints

### Dashboard
- `GET /api/dashboard/summary` - Executive overview
- `GET /api/dashboard/kpis` - Top-level KPIs

### Revenue
- `GET /api/revenue/trends` - Revenue over time
- `GET /api/revenue/by-category` - Category breakdown
- `GET /api/revenue/by-region` - Regional breakdown
- `GET /api/revenue/top-products` - Best sellers

### Customers
- `GET /api/customers/overview` - Customer counts
- `GET /api/customers/segments` - Segment breakdown
- `GET /api/customers/cohorts` - Retention cohorts
- `GET /api/customers/at-risk` - At-risk customers

### Operations
- `GET /api/operations/pipeline` - Sales pipeline
- `GET /api/operations/sales-performance` - Rep metrics
- `GET /api/operations/conversion-rates` - Stage conversions

### Forecasting
- `GET /api/forecasting/revenue` - Revenue forecast
- `GET /api/forecasting/pipeline` - Pipeline forecast
- `GET /api/forecasting/churn-risk` - Churn predictions

## Sample Data

The seed script generates realistic business data:
- **2,000+ customers** across enterprise, mid-market, and SMB segments
- **55,000+ transactions** over 2 years with seasonality patterns
- **120 products** across 8 categories
- **25 sales reps** across 5 regions
- **500+ pipeline opportunities**

## License

MIT
