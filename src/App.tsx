import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import AuthGate from '@/components/AuthGate';
import ErrorBoundary from '@/components/ErrorBoundary';
import DashboardPage from '@/pages/DashboardPage';
import CalendarPage from '@/pages/CalendarPage';
import LogPage from '@/pages/LogPage';
import TrendsPage from '@/pages/TrendsPage';
import GoalsPage from '@/pages/GoalsPage';
import ExercisesPage from '@/pages/ExercisesPage';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="route-enter">
      <Routes location={location}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/log" element={<LogPage />} />
        <Route path="/trends" element={<TrendsPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthGate>
        <BrowserRouter>
          <Layout>
            <AnimatedRoutes />
          </Layout>
        </BrowserRouter>
      </AuthGate>
    </ErrorBoundary>
  );
}
