<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/api/client' 

const isOpen = ref(false)
const notifications = ref([])
const authStore = useAuthStore()
let socket = null
let reconnectTimeout = null 
let isComponentMounted = false

const wrapperRef = ref(null)

const hasUnread = computed(() => {
  return notifications.value.some(n => !n.is_read)
})

const handleClickOutside = (event) => {
  if (isOpen.value && wrapperRef.value && !wrapperRef.value.contains(event.target)) {
    isOpen.value = false;
  }
}

const fetchHistory = async () => {
  try {
    const res = await apiClient.get('notifications/')
    notifications.value = res.data.results || res.data 
  } catch (error) {
    console.error("Ошибка загрузки истории уведомлений:", error)
  }
}

const connectWebSocket = () => {
  if (!isComponentMounted) return

  const wsUrl = `ws://localhost:8000/ws/notifications/?token=${authStore.token}`
  socket = new WebSocket(wsUrl)

  socket.onopen = () => {
    console.log("✅ WebSocket успешно подключен!")
  }

  socket.onmessage = (event) => {
    console.log(" Новое уведомление:", event.data)
    const data = JSON.parse(event.data)
    if (data.type === 'notification' || data.message) {
      notifications.value.unshift({
        id: data.id || data.notification_id || Date.now(),
        message: data.message,
        is_read: false,
        created_at: data.created_at || new Date().toISOString()
      })
      if (notifications.value.length > 10) notifications.value.pop()
    }
  }

  socket.onclose = (e) => {
    console.warn("❌ WebSocket отключен. Код:", e.code)
    if (isComponentMounted && authStore.token) {
      reconnectTimeout = setTimeout(() => {
        console.log("🔄 Пробуем переподключиться...")
        connectWebSocket()
      }, 5000)
    }
  }
}

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value && hasUnread.value) {
    try {
      await apiClient.patch('notifications/mark_all_as_read/')
      notifications.value.forEach(n => n.is_read = true)
    } catch (error) {
      console.error("Ошибка при прочтении уведомлений:", error)
    }
  }
}

const initNotifications = async () => {
  if (!authStore.token) return
  
  // Если сокет уже работает - не подключаемся дважды
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }
  
  await fetchHistory()
  connectWebSocket()
}

onMounted(() => {
  isComponentMounted = true
  if (authStore.token && authStore.user) {
    initNotifications()
  }
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  isComponentMounted = false
  if (reconnectTimeout) clearTimeout(reconnectTimeout)
  if (socket) {
    socket.onclose = null 
    socket.close()
  }
  document.removeEventListener('click', handleClickOutside)
})

watch(
  () => authStore.user,
  (newUser) => {
    if (newUser && authStore.token) {
      initNotifications()
    } else if (!newUser) {
      if (socket) {
        socket.onclose = null
        socket.close()
      }
      notifications.value = []
    }
  },
  { immediate: true }
)
</script>


<template>
  <div class="notification-wrapper" ref="wrapperRef">
  
  <div class="icon-container notification-btn" @click="toggleDropdown">
    <img src="@/assets/bell.jpg" alt="Уведомления" class="bell-image" />
    <span v-if="hasUnread" class="red-dot"></span>
  </div>

  <div class="dropdown-menu" v-if="isOpen"> 
    <div class="dropdown-header">Уведомления</div>
    <div v-if="notifications.length === 0" class="empty-state">Нет новых уведомлений</div>
    <div class="notif-list">
      <div 
        v-for="notif in notifications" 
        :key="notif.id" 
        class="notif-item"
        :class="{ 'unread': !notif.is_read }"
      >
        <p>{{ notif.message }}</p>
        <small class="notif-time">{{ new Date(notif.created_at).toLocaleString('ru-RU') }}</small>
      </div>
    </div>
    </div>
  </div>
</template>


<style scoped>
.notification-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.notification-btn {
  background: transparent !important; 
  background-color: transparent !important;
  border: none !important;
  outline: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 50%;
  position: relative;
  transition: all 0.2s ease;
  box-shadow: none;
}

.notification-btn:hover {
  background-color: var(--primary-light) !important;
  transform: translateY(-1px);
}

/* Иконка колокольчика */
.bell-image {
  width: 24px;
  height: 24px;
  object-fit: contain;
  display: block;
  mix-blend-mode: multiply; 
}

.red-dot {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 10px;
  height: 10px;
  background-color: #ef4444; 
  border-radius: 50%;
  z-index: 2;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 10px); 
  
  left: 50%;
  transform: translateX(-50%);
  
  width: 320px;
  max-width: calc(100vw - 40px);
  background: var(--bg-white);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  z-index: 1000;
  overflow: hidden;
  border: 1px solid var(--border-color);
  
  transform-origin: top center;
  animation: dropdownFadeInCenter 0.2s ease-out forwards;
}

@keyframes dropdownFadeInCenter {
  from { opacity: 0; transform: translateX(-50%) scaleY(0.95); }
  to { opacity: 1; transform: translateX(-50%) scaleY(1); }
}

.dropdown-menu::before {
  content: '';
  position: absolute;
  top: -15px;
  left: 0;
  width: 100%;
  height: 15px;
  background: transparent;
}

.dropdown-header {
  padding: 15px 20px;
  font-weight: 700;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-white);
  color: var(--text-main);
  border-radius: 12px 12px 0 0;
}

.notif-list {
  max-height: 350px;
  overflow-y: auto;
}

.notif-list::-webkit-scrollbar { width: 6px; }
.notif-list::-webkit-scrollbar-track { background: transparent; }
.notif-list::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }

.notif-item {
  padding: 15px 20px;
  border-bottom: 1px solid var(--bg-body);
  font-size: 14px;
  color: var(--text-main);
  transition: background 0.2s;
  cursor: pointer;
}

.notif-item:last-child {
  border-bottom: none;
}

.notif-item:hover {
  background-color: var(--bg-body);
}

.notif-item.unread {
  background-color: var(--primary-light);
  color: var(--text-main);
}

.notif-item p {
  margin: 0 0 6px 0;
  line-height: 1.4;
}

.notif-time {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.empty-state {
  padding: 30px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

@media (max-width: 768px) {
  .dropdown-menu {
    left: auto !important;
    right: -10px !important; 
    transform: none !important; 
    
    width: 90vw !important;
    max-width: 350px;
    
    transform-origin: top right !important;
  }
}

@media (max-width: 480px) {
  .dropdown-menu {
    position: fixed;
    top: 70px;
    left: 50% !important;
    right: auto !important;
    transform: translateX(-50%) !important;
    width: 95vw !important;
    max-width: 100% !important;
    z-index: 1050;
  }

  .dropdown-menu::before {
    display: none;
  }
}
</style>