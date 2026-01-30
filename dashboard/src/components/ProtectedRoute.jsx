import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import apiService from '@/utils/apiService';
import GlobalLoader from './GlobalLoader';

const ProtectedRoute = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const localAuth = localStorage.getItem('isAuthenticated') === 'true';

        if (!token || !localAuth) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        // Verify token with backend
        const response = await apiService.verifyToken();
        
        if (response.success) {
          setIsAuthenticated(true);
        } else {
          // Token is invalid, clear auth data
          apiService.clearAuth();
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        // If verification fails, clear auth data
        apiService.clearAuth();
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  if (isLoading) {
    return <GlobalLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;