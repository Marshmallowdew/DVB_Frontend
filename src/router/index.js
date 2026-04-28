import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // --- Доступны всем ---
    {
      path: '/',
      name: 'home',
      component: () => import('../views/public/HomeView.vue')
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/public/LoginView.vue'),
      meta: { requiresGuest: true } 
    },
    
    // --- Клиенты (авторизованные, но без админских прав) ---
    {
      path: '/my-orders',
      name: 'myOrders',
      component: () => import('../views/client/MyOrdersView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/book',
      name: 'booking',
      component: () => import('../views/client/BookingView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/public/ProfileView.vue'),
      meta: { requiresAuth: true }
    },

    // --- Админы филиалов и Главный админ ---
    {
      path: '/admin',
      name: 'adminDashboard',
      component: () => import('../views/admin/DashboardView.vue'),
      meta: { 
        requiresAuth: true, 
        allowedRoles: ['main_admin', 'branch_admin'] 
      }
    },

    // --- Менеджеры ---
    {
      path: '/manager',
      name: 'managerDashboard',
      component: () => import('../views/admin/DashboardView.vue'), 
      meta: { 
        requiresAuth: true, 
        allowedRoles: ['manager'] 
      }
    }
  ]
})

// Navigation Guard (Защита маршрутов)
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // 1. Восстановление сессии после перезагрузки страницы
  if (!authStore.user && localStorage.getItem('access_token')) {
     try {
         await authStore.fetchProfile() 
     } catch (e) {
         console.error('Ошибка проверки юзера при перезагрузке', e)
     }
  }

  // 2. Проверка, авторизован ли пользователь
  const isAuthenticated = !!localStorage.getItem('access_token') 
  const userRole = authStore.user?.role || 'client'

  // 3. Логика перенаправлений
  if (to.meta.requiresAuth && !isAuthenticated) {
    // Пытается зайти на закрытую страницу без авторизации
    return next({ name: 'login' })
  } 
  
  if (to.meta.requiresGuest && isAuthenticated) {
    // Авторизованный пытается зайти на страницу Логина
    return next({ name: 'home' })
  }

  // 4. Проверка ролей (Ролевая модель)
  if (to.meta.allowedRoles && to.meta.allowedRoles.length > 0) {
    // Если роль пользователя НЕ в списке разрешенных для этого маршрута
    if (!to.meta.allowedRoles.includes(userRole)) {
      
      // Перенаправляем его туда, куда ему положено
      if (userRole === 'manager') {
        return next({ name: 'managerDashboard' })
      } else if (['main_admin', 'branch_admin'].includes(userRole)) {
        return next({ name: 'adminDashboard' })
      } else {
        // Обычные клиенты идут в профиль или на главную
        return next({ name: 'profile' })
      }
    }
  }

  // 5. Если все проверки пройдены, пускаем на маршрут
  next()
})

export default router
