<template>
  <div class="admin-dashboard">
    <div v-if="!isUserLoaded">
      <p>Загрузка данных пользователя...</p>
    </div>

    <div v-else>
      <h2>
        <span v-if="isMainAdmin">Панель управления (Главный администратор)</span>
        <span v-else>Панель управления филиалом</span>
      </h2>

      <div class="tabs">
        <button :class="{ active: activeTab === 'orders' }" @click="activeTab = 'orders'">Заказ-наряды</button>
        <button :class="{ active: activeTab === 'mechanics' }" @click="activeTab = 'mechanics'">Мастера</button>
        <button v-if="isMainAdmin" :class="{ active: activeTab === 'admins' }" @click="activeTab = 'admins'">Админы</button>
        <button v-if="canManageDepartments" :class="{ active: activeTab === 'departments' }" @click="activeTab = 'departments'">Отделы</button>
        <button v-if="canManageManagers" :class="{ active: activeTab === 'managers' }" @click="activeTab = 'managers'">Менеджеры</button>
        <button v-if="isMainAdmin" :class="{ active: activeTab === 'branches' }" @click="activeTab = 'branches'">Филиалы</button>
        <button v-if="!isManager" :class="{ active: activeTab === 'boxes' }" @click="activeTab = 'boxes'">Боксы</button>
        <button :class="{ active: activeTab === 'statistics' }" @click="activeTab = 'statistics'">Статистика</button>
      </div>

      <!-- ПАНЕЛЬ ФИЛЬТРОВ -->
      <div v-if="activeTab === 'statistics' || (isMainAdmin && !['branches', 'admins'].includes(activeTab))" class="filters-panel">
        
        <!-- Выбор филиала -->
        <div class="filter-group" v-if="isMainAdmin && !['branches', 'admins'].includes(activeTab)">
          <label>Выбор филиала:</label>
          <select v-model="filterBranch">
            <option v-if="activeTab === 'statistics' || activeTab === 'orders'" value="">Все филиалы</option>
            <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>

        <!-- Выбор диапазона дат (Только для Статистики) -->
        <div class="filter-group date-range-group" v-if="activeTab === 'statistics'">
          
          <div class="date-input-wrapper">
            <label>С:</label>
            <input type="text" readonly :value="formatDateRu(dateStart)" @click="$refs.startPicker.showPicker()" placeholder="ДД.ММ.ГГГГ">
            <input type="date" ref="startPicker" v-model="dateStart" :max="dateEnd || todayDate" class="hidden-date-picker">
          </div>

          <div class="date-input-wrapper">
            <label>По:</label>
            <input type="text" readonly :value="formatDateRu(dateEnd)" @click="$refs.endPicker.showPicker()" placeholder="ДД.ММ.ГГГГ">
            <input type="date" ref="endPicker" v-model="dateEnd" :min="dateStart" :max="todayDate" class="hidden-date-picker">
          </div>

          <button 
            v-if="dateStart || dateEnd" 
            class="btn-clear-dates" 
            @click="clearDates"
            title="Сбросить даты"
          >
            Сбросить
          </button>
        </div>
      </div>

      <!-- ГЛОБАЛЬНЫЕ ВКЛАДКИ -->
      <div class="tab-content" v-if="activeTab === 'branches' && isMainAdmin">
        <BranchesTab @branch-updated="fetchBranches" />
      </div>

      <div class="tab-content" v-else-if="activeTab === 'admins' && isMainAdmin">
        <AdminsTab :branches="branches" />
      </div>

      <!-- ВКЛАДКА СТАТИСТИКИ -->
      <div class="tab-content" v-else-if="activeTab === 'statistics'">
        <StatisticsTab 
          :key="`${filterBranch}-${dateStart}-${dateEnd}`"
          :branch-id="isMainAdmin ? (filterBranch || null) : currentBranchId" 
          :date-start="dateStart"
          :date-end="dateEnd"
          :is-main-admin="isMainAdmin" 
        />
      </div>
      
      <div class="tab-content" v-else-if="activeTab === 'orders'">
        <OrdersTab 
          :branch-id="isMainAdmin ? (filterBranch || null) : currentBranchId" 
        />
      </div>

      <div class="tab-content" v-else-if="currentBranchId">
        <MechanicsTab v-if="activeTab === 'mechanics'" :branch-id="currentBranchId" />
        <DepartmentsTab v-if="activeTab === 'departments'" :branch-id="currentBranchId" />
        <ManagersTab v-if="activeTab === 'managers'" :branch-id="currentBranchId" />
        <BoxesTab v-if="activeTab === 'boxes' && !loading" :branch-id="currentBranchId" />
      </div>

      <div v-else style="color: red; margin-top: 20px;">
        Для просмотра этой вкладки необходимо выбрать филиал.
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { branchesApi } from '@/api/services'
import { apiClient } from '@/api/client' 
import { useAuthStore } from '@/stores/auth'

import OrdersTab from './components/OrdersTab.vue'
import DepartmentsTab from './components/DepartmentsTab.vue'
import MechanicsTab from './components/MechanicsTab.vue'
import ManagersTab from './components/ManagersTab.vue'
import BranchesTab from './components/BranchesTab.vue'
import AdminsTab from './components/AdminsTab.vue'
import BoxesTab from './components/BoxesTab.vue'
import StatisticsTab from './components/StatisticsTab.vue'

const notifications = ref([])
const authStore = useAuthStore()
let socket = null 

const activeTab = ref(localStorage.getItem('adminActiveTab') || 'orders')
const branches = ref([])
const filterBranch = ref('')
const loading = ref(false)

const isUserLoaded = computed(() => !!authStore.user)

const userRole = computed(() => {
  return authStore.user?.role ? authStore.user.role.toLowerCase() : ''
})

const isMainAdmin = computed(() => userRole.value === 'main_admin' || userRole.value === 'mainadmin')
const isBranchAdmin = computed(() => userRole.value === 'branch_admin' || userRole.value === 'branchadmin')
const isManager = computed(() => userRole.value === 'manager')

const canManageDepartments = computed(() => !isManager.value)
const canManageManagers = computed(() => isMainAdmin.value || isBranchAdmin.value)

// --- ЛОГИКА ФИЛЬТРАЦИИ ПО ДАТАМ ---
const todayDate = new Date().toISOString().split('T')[0]
const dateStart = ref('')
const dateEnd = ref('')

const clearDates = () => {
  dateStart.value = ''
  dateEnd.value = ''
}

const formatDateRu = (dateStr) => {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

const currentBranchId = computed(() => {
  if (isMainAdmin.value) {
    return filterBranch.value || null
  }
  const u = authStore.user
  if (!u) return null
  return u.branch?.id || u.branchid || u.branch || u.adminprofile?.branch?.id || null
})

const fetchBranches = async () => {
  if (!isMainAdmin.value) return
  
  try {
    const response = await branchesApi.getAll()
    branches.value = response.data
    if (branches.value.length > 0 && !filterBranch.value) {
      filterBranch.value = branches.value[0].id
    }
  } catch (error) {
    console.error('Ошибка загрузки филиалов', error)
  }
}

onMounted(async () => {
  if (isMainAdmin.value) {
    fetchBranches()
  }

  if (!authStore.user) return

  try {
    const res = await apiClient.get('notifications/')
    notifications.value = res.data.results || res.data 

    const wsUrl = `ws://localhost:8000/ws/notifications/?token=${authStore.token}`
    socket = new WebSocket(wsUrl)

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      notifications.value.unshift(data)
    }
  } catch (err) {
    console.error('Ошибка при загрузке уведомлений или подключении к WS:', err)
  }
})

onUnmounted(() => {
  if (socket) socket.close()
})

watch(() => authStore.user, (newUser) => {
  if (newUser && (newUser.role === 'mainadmin' || newUser.role === 'main_admin')) {
    fetchBranches()
  }
}, { immediate: true })

watch(activeTab, (newVal) => {
  localStorage.setItem('adminActiveTab', newVal)
})
</script>

<style scoped>
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 1px solid #ccc;
  padding-bottom: 10px;
}
.tabs button {
  padding: 8px 16px;
  border: none;
  background: #f0f0f0;
  cursor: pointer;
  border-radius: 4px;
  transition: 0.2s;
  font-weight: 500;
}
.tabs button:hover {
  background: #e2e8f0;
}
.tabs button.active {
  background: #007bff;
  color: white;
}

/* Панель фильтров */
.filters-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  background: #f8f9fa;
  padding: 15px 20px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.filter-group {
  display: flex;
  align-items: center;
}

.filter-group label {
  margin-right: 10px;
  font-weight: 600;
  font-size: 14px;
  color: #495057;
}

.filter-group select {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #ced4da;
  outline: none;
}

/* Фильтр дат */
.date-range-group {
  display: flex;
  align-items: center;
  gap: 15px;
}

.date-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.date-input-wrapper label {
  margin-right: 8px;
}

.date-input-wrapper input[type="text"] {
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-family: inherit;
  color: #495057;
  outline: none;
  transition: border-color 0.2s;
  width: 100px;
  text-align: center;
  cursor: pointer;
  background-color: white;
}

.date-input-wrapper input[type="text"]:focus,
.date-input-wrapper input[type="text"]:hover {
  border-color: #007bff;
}

.hidden-date-picker {
  position: absolute;
  top: 0;
  left: 30px;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.btn-clear-dates {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 13px;
  text-decoration: underline;
  padding: 0;
  margin-left: 5px;
  font-weight: 500;
}

.btn-clear-dates:hover {
  color: #b91c1c;
}
</style>