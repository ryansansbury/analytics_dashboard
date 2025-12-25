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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

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
