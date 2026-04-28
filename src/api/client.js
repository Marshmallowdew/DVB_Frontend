import axios from 'axios';
import { useAuthStore } from '@/stores/auth'; 
import router from '@/router'; 

export const apiClient = axios.create({
  baseURL: '/api/', 
  headers: {
    'Content-Type': 'application/json',
  },
});


let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Перехватчик Request: Добавляем access токен
apiClient.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore();
    const token = authStore.token || localStorage.getItem('access_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Перехватчик Response: Ловим 401
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response && 
      error.response.status === 401 && 
      !originalRequest._retry &&
      !originalRequest.url.includes('users/login') && 
      !originalRequest.url.includes('verify-otp') && 
      !originalRequest.url.includes('token/refresh')
    ) {
      
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return apiClient(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const authStore = useAuthStore();
        const currentRefreshToken = authStore.refreshToken || localStorage.getItem('refresh_token');

        if (!currentRefreshToken) {
          throw new Error("No refresh token available");
        }

        // ОТПРАВЛЯЕМ REFRESH ТОКЕН В ТЕЛЕ ЗАПРОСА
        const response = await axios.post('/api/token/refresh/', {
          refresh: currentRefreshToken
        });

        const newAccessToken = response.data.access;
        // SimpleJWT при ROTATE_REFRESH_TOKENS=True возвращает и новый refresh токен
        const newRefreshToken = response.data.refresh || currentRefreshToken;
        
        // Обновляем оба токена в сторе
        authStore.updateTokens(newAccessToken, newRefreshToken);
        
        originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;
        processQueue(null, newAccessToken);
        
        return apiClient(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Очищаем данные при протухшем рефреше
        const authStore = useAuthStore();
        authStore.logout(); 
        router.push('/login'); 
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);