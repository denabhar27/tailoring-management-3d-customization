
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  profile_picture?: string;
}

interface AuthContextType {
  user: User | null;
  role: string | null;
  isLoading: boolean;
  login: (token: string, userRole: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    
    const checkAuthState = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userRole = await AsyncStorage.getItem('userRole');
        
        if (token && userRole) {
          setRole(userRole);
          
        }
      } catch (error) {
        console.error('Error checking auth state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthState();
  }, []);

  const login = async (token: string, userRole: string, userData: User) => {
    try {
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userRole', userRole);
      setUser(userData);
      setRole(userRole);
    } catch (error) {
      console.error('Error saving auth data:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userRole');
      setUser(null);
      setRole(null);
    } catch (error) {
      console.error('Error removing auth data:', error);
      throw error;
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value = {
    user,
    role,
    isLoading,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};