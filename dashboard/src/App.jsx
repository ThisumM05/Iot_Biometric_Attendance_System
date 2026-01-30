import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider } from "@/components/theme-provider"
import GlobalLoader from './components/GlobalLoader';
import { Toaster } from 'react-hot-toast';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const AttendanceLogs = lazy(() => import('./pages/AttendanceLogs'));
const StudentProfile = lazy(() => import('./pages/StudentProfile'));
const Students = lazy(() => import('./pages/Students'));
const BulkImport = lazy(() => import('./pages/BulkImport'));
const Classes = lazy(() => import('./pages/Classes'));
const Notifications = lazy(() => import('./pages/Notifications'));
const EditProfile = lazy(() => import('./pages/EditProfile'));

// Artificial delay for demonstration purposes (Optional - remove in production)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const withDelay = (importFunc, delayTime = 1000) => {
  return React.lazy(async () => {
    await delay(delayTime);
    return importFunc();
  });
};

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="dashboard-theme">
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Suspense fallback={<GlobalLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Home />} />
                <Route path="attendance" element={<AttendanceLogs />} />
                <Route path="students" element={<Students />} />
                <Route path="students/:id" element={<StudentProfile />} />
                <Route path="students/:id/edit" element={<EditProfile />} />
                <Route path="bulk-import" element={<BulkImport />} />
                <Route path="classes" element={<Classes />} />
                <Route path="notifications" element={<Notifications />} />
              </Route>
            </Routes>
          </Suspense>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
