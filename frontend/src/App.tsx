/**
 * Analytics Dashboard - Main Application Entry Point
 *
 * This is the root component that sets up the application infrastructure:
 * - React Query for server state management and data fetching
 * - React Router for client-side navigation
 * - Global filter context for date range selection
 * - Error boundary for graceful error handling
 *
 * Application Structure:
 * - /             : Executive Dashboard (KPIs, revenue trends, pipeline)
 * - /revenue      : Detailed revenue analytics
 * - /customers    : Customer analytics and cohort analysis
 * - /operations   : Sales pipeline and team performance
 * - /forecasting  : Predictive analytics and churn risk
 *
 * All pages share a common Layout with sidebar navigation and header controls.
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FilterProvider } from './hooks/useFilters';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { Revenue } from './pages/Revenue';
import { Customers } from './pages/Customers';
import { Operations } from './pages/Operations';
import { Forecasting } from './pages/Forecasting';

/**
 * React Query client configuration
 *
 * Settings optimized for dashboard use case:
 * - retry: 1 - Only retry failed requests once to avoid slow page loads
 * - refetchOnWindowFocus: false - Don't refetch when user returns to tab
 * - staleTime: 5 minutes - Cache data for 5 min before considering it stale
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

/**
 * Root application component
 *
 * Wraps the entire app in required providers (top to bottom):
 * 1. ErrorBoundary - Catches React errors, shows fallback UI
 * 2. QueryClientProvider - Enables React Query hooks throughout app
 * 3. FilterProvider - Provides global date range filter state
 * 4. BrowserRouter - Enables client-side routing
 */
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <FilterProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="revenue" element={<Revenue />} />
                <Route path="customers" element={<Customers />} />
                <Route path="operations" element={<Operations />} />
                <Route path="forecasting" element={<Forecasting />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </FilterProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
