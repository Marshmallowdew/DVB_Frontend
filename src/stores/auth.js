import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '../api/services';
import axios from 'axios'; 

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const token = ref(localStorage.getItem('access_token') || null);
  const refreshToken = ref(localStorage.getItem('refresh_token') || null);

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'branch_admin' || user.value?.role === 'main_admin');
  const isStaff = computed(() => isAdmin.value || user.value?.role === 'manager');

  async function requestOtp(email) {
    try {
      const response = await axios.post('/api/users/auth/request-otp/', { email });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async function verifyOtp(email, otpCode) {
    try {
      const response = await axios.post('/api/users/auth/verify-otp/', { 
        email: email, 
        otp: otpCode 
      });
      
      const { access, refresh, is_new_user } = response.data;

      // 1. Сохраняем токены в localStorage
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      
      // 2. Делаем Pinia реактивной
      token.value = access;
      refreshToken.value = refresh;
      
      // 3. Загружаем профиль
      await fetchProfile();
      
      return is_new_user;
      
    } catch (error) {
      throw error;
    }
  }

  async function fetchProfile() {
    if (!token.value) return;
    try {
      const response = await authApi.getProfile();
      user.value = response.data;
    } catch (error) {
      console.error("Ошибка загрузки профиля:", error);
    }
  }

  function logout() {
    user.value = null;
    token.value = null;
    refreshToken.value = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  // Вспомогательная функция для обновления токенов из interceptor'a
  function updateTokens(newAccess, newRefresh) {
    token.value = newAccess;
    localStorage.setItem('access_token', newAccess);
    
    if (newRefresh) {
      refreshToken.value = newRefresh;
      localStorage.setItem('refresh_token', newRefresh);
    }
  }

  return { 
    user, token, refreshToken, isAuthenticated, isAdmin, isStaff, 
    requestOtp, verifyOtp, logout, fetchProfile, updateTokens 
  };
});