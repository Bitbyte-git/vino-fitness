import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Clean up any legacy localStorage tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    try {
      const response = await authService.getMe();
      setUser(response.data.data.user);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    const response = await authService.login(credentials);
    const { user: userData } = response.data.data;
    
    // Purge tokens from localStorage completely (handled via HttpOnly cookies)
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
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const register = async (data) => {
    const response = await authService.register(data);
    const { user: userData } = response.data.data;
    
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
