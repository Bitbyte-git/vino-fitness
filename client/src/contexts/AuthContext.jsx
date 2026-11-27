import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services';
import { setAuthToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Purge any residual tokens from localStorage completely
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    try {
      const response = await authService.getMe();
      const userData = response.data?.data?.user;
      setUser(userData || null);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    const response = await authService.login(credentials);
    const { user: userData, accessToken } = response.data.data;
    
    // Store in-memory only; purge tokens from localStorage completely
    if (accessToken) {
      setAuthToken(accessToken);
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(userData);
    
    return userData;
  };

  const logout = async () => {
    window.dispatchEvent(new Event('pulsefit:auth-stopping'));
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setAuthToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const register = async (data) => {
    const response = await authService.register(data);
    const { user: userData, accessToken } = response.data.data;
    
    if (accessToken) {
      setAuthToken(accessToken);
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(userData);
    
    return userData;
  };

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

