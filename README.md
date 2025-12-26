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
- **Sales Pipeline** - Funnel visualization of opportunity stages from Lead to Closed Won
- **Top Products** - Sortable table of best-performing products

### Revenue Analytics
- Detailed revenue breakdowns and trend analysis
- Period-over-period comparisons
- Category and segment performance tracking

### Customer Intelligence
- Customer segmentation and lifecycle analysis
- Revenue attribution by customer segment
- Customer health metrics

### Operations
- Operational performance metrics
- Sales team performance tracking
- Process efficiency analytics

### ML-Powered Forecasting
- **Revenue Predictions** - 6-month forward projections using time series analysis
- **Churn Risk Scoring** - ML-identified at-risk customers with actionable recommendations
- **Seasonality Analysis** - Historical pattern detection for planning
- **Model Performance Metrics** - MAPE, R² Score, RMSE tracking

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

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
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

# Run the development server
python run.py
```

#### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## API Endpoints

### Dashboard
- `GET /api/dashboard/summary` - KPI summary with change percentages
- `GET /api/dashboard/pipeline` - Sales pipeline stages

### Revenue
- `GET /api/revenue/trends` - Revenue time series data
- `GET /api/revenue/by-category` - Revenue breakdown by category
- `GET /api/revenue/top-products` - Top performing products

### Customers
- `GET /api/customers/segments` - Customer segmentation data
- `GET /api/customers/list` - Paginated customer list

### Forecasting
- `GET /api/forecasting/revenue` - ML revenue predictions
- `GET /api/forecasting/churn-risk` - At-risk customer predictions
- `GET /api/forecasting/seasonality` - Seasonal patterns

## Project Structure

```
analytics_dashboard/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── cards/        # KPI and chart cards
│   │   │   ├── charts/       # Chart components (Area, Bar, Pie, Funnel)
│   │   │   ├── common/       # Shared components
│   │   │   ├── layout/       # Layout components (Header, Sidebar)
│   │   │   └── tables/       # Data table components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   ├── services/         # API client
│   │   ├── types/            # TypeScript definitions
│   │   └── utils/            # Utility functions
│   └── package.json
├── backend/                  # Flask backend API
│   ├── app/
│   │   ├── models/           # SQLAlchemy models
│   │   └── routes/           # API route handlers
│   ├── requirements.txt
│   └── run.py
├── docker-compose.yml
└── README.md
```

## Environment Variables

### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `SECRET_KEY` | Flask secret key | - |
| `FLASK_ENV` | Environment mode | `development` |

### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:5000` |

## License

This project is open source and available under the [MIT License](LICENSE).

