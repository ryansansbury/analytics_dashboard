# Analytics Dashboard

A full-stack business intelligence dashboard featuring real-time KPI tracking, interactive data visualizations, and ML-powered revenue forecasting. Built with React 19, Flask, and PostgreSQL.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white)

## Features

### Executive Dashboard
- **KPI Cards** - Track key metrics including Total Revenue, Customers, Average Order Value, Conversion Rate, Pipeline Value, and Growth Rate
- **Revenue Trends** - Interactive area charts with configurable granularity (daily, weekly, monthly)
- **Category Distribution** - Donut charts showing revenue breakdown by product category
- **Sales Pipeline** - Funnel visualization with pipeline percentage per stage
- **Top Products** - Sortable table of best-performing products

### Revenue Analytics
- Detailed revenue breakdowns by category and region
- Period-over-period comparisons with change percentages
- Top products performance table
- Interactive bar and area charts with date range filtering

### Customer Intelligence
- **Segmentation** - Customer distribution across enterprise, mid-market, and SMB tiers
- **Cohort Retention** - 12-month retention analysis with heatmap visualization
- **At-Risk Customers** - Identify customers showing signs of potential churn
- **Lifetime Value Distribution** - LTV analysis across customer base

### Operations
- **Sales Pipeline** - Full funnel visualization from Lead to Closed Won
- **Sales Team Performance** - Quota attainment tracking (top 5 exceeding, bottom 5 developing)
- **Deal Cycle Time** - Average days per pipeline stage
- **Stage Conversion Rates** - Stage-to-stage conversion analysis

### ML-Powered Forecasting
- **Revenue Predictions** - 6-month forward projections with confidence intervals
- **Churn Risk Scoring** - At-risk customers with actionable recommendations
- **Seasonality Analysis** - Monthly seasonality index for planning
- **Model Performance Metrics** - Accuracy tracking and forecast confidence

### Global Features
- **Date Range Filtering** - Preset ranges (Last 7 days, 30 days, 90 days, YTD, Last Year) or custom dates
- **Data Export** - Export dashboard data as CSV, JSON, or PDF
- **Light/Dark Mode** - Toggle between themes (defaults to light mode)
- **Responsive Design** - Works on desktop and tablet screens

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for fast development and optimized builds
- **TailwindCSS 4** for utility-first styling
- **Recharts** for responsive data visualizations
- **TanStack Query** for server state management
- **React Router 7** for client-side routing
- **Lucide React** for icons

### Backend
- **Flask 3.0** REST API
- **SQLAlchemy** ORM with PostgreSQL
- **NumPy & Pandas** for data processing
- **scikit-learn** for ML forecasting models
- **Gunicorn** production server

### Infrastructure
- **Docker Compose** for local development
- **PostgreSQL 15** database

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/analytics_dashboard.git
cd analytics_dashboard

# Start all services
docker-compose up -d

# Access the application at http://localhost:5001
```

### Local Development

#### Backend
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run the development server (runs on http://localhost:5001)
python run.py
```

#### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production (outputs to dist/, copied to backend/static/)
npm run build
```

#### Production Deployment
The Flask backend serves both the API and the built frontend static files. After building the frontend, copy the `dist/` contents to `backend/static/`:

```bash
# Build frontend and copy to backend
cd frontend && npm run build
cp -r dist/* ../backend/static/
```

## API Endpoints

All endpoints support `start_date` and `end_date` query parameters (YYYY-MM-DD format).

### Dashboard
- `GET /api/dashboard/summary` - Complete dashboard data (KPIs, trends, categories, pipeline)
- `GET /api/dashboard/kpis` - KPI values with change percentages

### Revenue
- `GET /api/revenue/trends` - Revenue time series (supports `granularity`: day/week/month)
- `GET /api/revenue/by-category` - Revenue breakdown by product category
- `GET /api/revenue/by-region` - Revenue breakdown by geographic region
- `GET /api/revenue/by-channel` - Revenue breakdown by sales channel
- `GET /api/revenue/top-products` - Top performing products (supports `limit`)

### Customers
- `GET /api/customers/overview` - Customer KPIs (total, new, churned, at-risk)
- `GET /api/customers/segments` - Customer segmentation distribution
- `GET /api/customers/cohorts` - 12-month cohort retention data
- `GET /api/customers/lifetime-value` - LTV distribution by range
- `GET /api/customers/acquisition` - Customer acquisition by channel over time
- `GET /api/customers/at-risk` - At-risk customer list (supports `limit`)

### Operations
- `GET /api/operations/pipeline` - Sales pipeline by stage
- `GET /api/operations/pipeline-kpis` - Pipeline KPIs (value, cycle time, win rate)
- `GET /api/operations/sales-performance` - Sales rep quota attainment
- `GET /api/operations/conversion-rates` - Stage-to-stage conversion rates
- `GET /api/operations/cycle-time` - Average days per pipeline stage
- `GET /api/operations/opportunities` - Pipeline opportunities (supports `stage`, `limit`)

### Forecasting
- `GET /api/forecasting/revenue` - Revenue forecast with confidence intervals
- `GET /api/forecasting/pipeline` - Weighted pipeline forecast
- `GET /api/forecasting/churn-risk` - At-risk customers with recommendations
- `GET /api/forecasting/seasonality` - Monthly seasonality indices
- `GET /api/forecasting/kpis` - Forecasting KPIs (predicted revenue, accuracy)
- `GET /api/forecasting/model-performance` - ML model accuracy metrics
- `GET /api/forecasting/revenue-at-risk` - Revenue at risk by category

## Project Structure

```
analytics_dashboard/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── cards/        # KPI and chart card wrappers
│   │   │   ├── charts/       # Chart components (Area, Bar, Pie, Funnel)
│   │   │   ├── common/       # Shared components (ErrorBoundary, Loading)
│   │   │   ├── layout/       # Layout components (Header, Sidebar, Layout)
│   │   │   └── tables/       # Data table components
│   │   ├── hooks/            # Custom React hooks (useApi, useFilters)
│   │   ├── pages/            # Page components (Dashboard, Revenue, etc.)
│   │   ├── services/         # API client layer
│   │   ├── types/            # TypeScript type definitions
│   │   └── utils/            # Utilities (formatters, export)
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # Flask backend API
│   ├── app/
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── routes/           # API route handlers by domain
│   │   ├── __init__.py       # Application factory
│   │   └── config.py         # Environment configurations
│   ├── data/
│   │   └── seed_data.py      # Synthetic data generator
│   ├── static/               # Built frontend assets (production)
│   ├── requirements.txt
│   └── run.py                # Application entry point
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## Environment Variables

### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `SECRET_KEY` | Flask secret key for sessions | Required |
| `FLASK_ENV` | Environment mode | `development` |

### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `/api` (relative) |

## Database Schema

The application uses 6 main tables:

- **products** - Product catalog (name, category, pricing)
- **customers** - Customer accounts (segment, LTV, status, acquisition)
- **sales_reps** - Sales team (name, team, region, quota)
- **transactions** - Completed orders linking customers, products, and reps
- **pipeline** - Active sales opportunities with stage tracking
- **daily_metrics** - Pre-aggregated daily metrics (optional)

## License

This project is open source and available under the [MIT License](LICENSE).

