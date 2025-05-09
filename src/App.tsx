import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AuthForm } from './components/auth/AuthForm';
import { Header } from './components/layout/Header';
import { ServiceList } from './components/services/ServiceList';
import { AppointmentCalendar } from './components/appointments/AppointmentCalendar';
import { ClientList } from './components/clients/ClientList';
import { ProductList } from './components/products/ProductList';
import { CategoryList } from './components/categories/CategoryList';
import { Reports } from './components/reports/ReportsManagement';
import { UserManagement } from './components/users/UserManagement';
import { OrderList } from './components/orders/OrderList';
import { CashRegisterPage } from './components/cash-register/CashRegisterPage';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { ImportPage } from './components/import/ImportPage';
import { LoyaltyPage } from './components/loyalty/LoyaltyPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { Toaster } from 'react-hot-toast';
import { BusinessSettingsPage } from './components/settings/BusinessSettingsPage';

function PrivateRoute({ children, allowedRoles = ['client', 'barber', 'admin'] }: { 
  children: React.ReactNode;
  allowedRoles?: Array<'client' | 'barber' | 'admin'>;
}) {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/appointments" />;
  }

  return <>{children}</>;
}

function App() {
  const { user, profile } = useAuth();

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {user && <Header />}
        <Routes>
          <Route path="/login" element={!user ? <AuthForm /> : <Navigate to="/" />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <DashboardPage />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/appointments"
            element={
              <PrivateRoute>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <AppointmentCalendar />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <CategoryList />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/services"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <ServiceList />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <PrivateRoute allowedRoles={['admin', 'barber']}>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <ClientList />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/products"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <ProductList />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <PrivateRoute>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <OrderList />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/cash-register"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <CashRegisterPage />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/time-settings"
            element={
              <PrivateRoute allowedRoles={['admin', 'barber']}>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <BusinessSettingsPage />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/import"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <ImportPage />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <Reports />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/users"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <UserManagement />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/loyalty"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <LoyaltyPage />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <SettingsPage />
                  </div>
                </main>
              </PrivateRoute>
            }
          />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;