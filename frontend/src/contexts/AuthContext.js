import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("nephro_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const checkAuth = async () => {
    try {
      const { data } = await axios.get(`${API}/auth/me`, {
        headers: getAuthHeaders(),
      });
      setUser(data);
    } catch {
      setUser(null);
      localStorage.removeItem("nephro_token");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (mr_id, password) => {
    const { data } = await axios.post(`${API}/auth/login`, { mr_id, password });
    if (data.token) localStorage.setItem("nephro_token", data.token);
    setUser(data);
    return data;
  };

  const register = async (formData) => {
    const { data } = await axios.post(`${API}/auth/register`, formData);
    if (data.token) localStorage.setItem("nephro_token", data.token);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { headers: getAuthHeaders() });
    } catch {}
    localStorage.removeItem("nephro_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function apiCall(method, url, data = null, extraHeaders = {}) {
  const token = localStorage.getItem("nephro_token");
  const headers = token ? { Authorization: `Bearer ${token}`, ...extraHeaders } : extraHeaders;
  return axios({ method, url: `${API}${url}`, data, headers, withCredentials: true });
}
