<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { departmentsApi, servicesApi } from '@/api/services'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const departmentsList = ref([])
const allServicesForBranch = ref([])

const selectedBranchId = ref(null)
const selectedDepartmentId = ref(null)
const loadingDeps = ref(false)
const errorMessage = ref('') 

const iconMap = {
  'ТО': 'maintenance',
  'Ремонт': 'repair',
  'Кузовной ремонт': 'bodyrepair',
  'Мойка': 'wash',
  'Диагностика': 'diagnostic',
  'Детейлинг': 'detailing',
  'Шиномонтаж': 'tires',
  'Дополнительно': 'additional'
}

const images = import.meta.glob('@/assets/icons/*.png', { eager: true, import: 'default' })

const getDepartmentIcon = (depName) => {
  const iconName = iconMap[depName]
  if (iconName) {
    const path = `/src/assets/icons/${iconName}.png`
    if (images[path]) return images[path]
  }
  return images['/src/assets/icons/default.png'] || ''
}

// Функция загрузки отделов и услуг
const loadBranchData = async (branchId) => {
  if (!branchId) return
  
  selectedBranchId.value = branchId
  selectedDepartmentId.value = null 
  loadingDeps.value = true
  errorMessage.value = ''
  
  try {
    const [depRes, servRes] = await Promise.all([
      departmentsApi.getByBranch(branchId),
      servicesApi.getAll(branchId)
    ])
    departmentsList.value = depRes.data
    allServicesForBranch.value = servRes.data
  } catch (error) {
    console.error('Ошибка загрузки данных филиала', error)
  } finally {
    loadingDeps.value = false
  }
}


watch(
  () => route.query.branch, 
  (newBranchId) => {
    // Явно преобразуем в число/строку и проверяем наличие
    if (newBranchId) {
      loadBranchData(newBranchId)
    } else {
      errorMessage.value = 'Пожалуйста, выберите город и филиал в верхнем меню'
      selectedBranchId.value = null
      departmentsList.value = []
      allServicesForBranch.value = []
      selectedDepartmentId.value = null
    }
  },
  { immediate: true } 
)

const selectDepartment = (depId) => {
  selectedDepartmentId.value = depId
}

const currentDepartmentServices = computed(() => {
  if (!selectedDepartmentId.value) return []
  return allServicesForBranch.value.filter(service => {
    const sId = service.department_id || (service.department?.id || service.department);
    return String(sId) === String(selectedDepartmentId.value)
  })
})

const bookAppointment = (service) => {
  router.push({ 
    path: '/book',
    query: { service: service.id } 
  }) 
}
</script>
<template>
  <div class="booking-container">
    <h1 class="page-title">Онлайн-запись</h1>

    <div v-if="!selectedBranchId || errorMessage" class="welcome-banner animate-fade-in">
      <div class="welcome-content">
        <h2 class="welcome-title">Добро пожаловать в наш автосервис!</h2>
        <p class="welcome-subtitle"></p>
        
        <div class="hint-arrow">
          <span>Выберите филиал наверху</span>
        </div>
      </div>
      
      <div class="welcome-image-wrapper">
        <img src="@/assets/service.webp" alt="Наш автосервис" class="welcome-image" />
      </div>
    </div>

    <div v-else>
      <!--  Выбор отдела -->
      <div class="step-section animate-fade-in">
        <h2 class="step-title">1. Выберите отдел</h2>
        
        <div v-if="loadingDeps" class="loading">Загрузка отделов...</div>
        <div v-else-if="departmentsList.length === 0" class="empty-state">
          В этом филиале пока нет доступных отделов.
        </div>
        
        <div v-else class="grid-departments">
          <div 
            v-for="dep in departmentsList" 
            :key="dep.id"
            @click="selectDepartment(dep.id)"
            :class="['card department-card', { active: selectedDepartmentId === dep.id }]"
          >
            <h3 class="dep-title">{{ dep.name }}</h3>
            <img :src="getDepartmentIcon(dep.name)" :alt="dep.name" class="dept-icon" />
          </div>
        </div>
      </div>

      <!-- Выбор услуги -->
      <div v-if="selectedDepartmentId" class="step-section animate-fade-in">
        <h2 class="step-title">2. Выберите услугу</h2>
        
        <div v-if="currentDepartmentServices.length === 0" class="empty-state">
          В этом отделе пока нет доступных услуг.
        </div>
        
        <div v-else class="services-list">
          <div v-for="service in currentDepartmentServices" :key="service.id" class="service-item">
            <div class="service-info">
              <h4>{{ service.name }}</h4>
              <span class="service-duration">🕒 {{ service.duration_minutes || 60 }} мин.</span>
            </div>
            <div class="service-action">
              <span class="service-price">{{ service.price }} ₽</span>
              <button @click="bookAppointment(service)" class="btn-book">Выбрать</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.booking-container { max-width: 1000px; margin: 0 auto; padding: 20px 0; }
.page-title { text-align: center; color: var(--text-main); margin-bottom: 40px; font-weight: 800;}
.step-section { margin-bottom: 50px; }
.step-title { font-size: 22px; color: var(--text-main); margin-bottom: 20px; font-weight: 700; }

.grid-departments { 
  display: grid; 
  grid-template-columns: repeat(auto-fit, minmax(180px, 250px)); 
  justify-content: center; 
  gap: 20px; 
}
.department-card {
  background: var(--bg-white);
  border: 2px solid transparent;
  border-radius: 16px;
  padding: 25px 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
.department-card:hover {
  border-color: var(--primary-light);
  transform: translateY(-4px);
  box-shadow: 0 10px 25px rgba(16, 185, 129, 0.1);
}
.department-card.active { 
  border-color: var(--primary); 
  background: var(--primary-light); 
}
.dep-title { margin: 0 0 15px 0; color: var(--text-main); font-size: 15px; font-weight: 600; height: 40px; display: flex; align-items: center;}
.dept-icon { width: 70px; height: 70px; object-fit: contain; transition: 0.3s; }
.department-card:hover .dept-icon { transform: scale(1.08); }

.services-list { display: flex; flex-direction: column; gap: 15px; }
.service-item {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--bg-white); padding: 20px 25px; border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03); border: 1px solid var(--border-color);
  transition: 0.2s;
}
.service-item:hover { border-color: var(--primary); }
.service-info h4 { margin: 0 0 8px 0; font-size: 17px; color: var(--text-main); }
.service-duration { color: var(--text-muted); font-size: 18px; background: var(--bg-body); padding: 4px 8px; border-radius: 6px;}
.service-action { display: flex; align-items: center; gap: 20px; }
.service-price { font-size: 20px; font-weight: 800; color: var(--text-main); }
.btn-book { background: var(--primary); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; cursor: pointer; transition: 0.2s; }
.btn-book:hover { background: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); }

.empty-state { text-align: center; padding: 40px; background: var(--bg-white); border-radius: 12px; color: var(--text-muted); border: 1px dashed var(--border-color);}

.home-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 20px;
}

.welcome-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
  background: var(--bg-white);
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
  border: 1px solid var(--border-color);
}

.welcome-content {
  flex: 1;
  max-width: 500px;
}

.welcome-title {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-main);
  margin: 0 0 15px 0;
  line-height: 1.3;
}

.welcome-subtitle {
  font-size: 16px;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 25px;
}

.hint-arrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--primary);
  font-weight: 600;
  font-size: 15px;
  background: var(--primary-light);
  padding: 10px 18px;
  border-radius: 12px;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.welcome-image-wrapper {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.welcome-image {
  width: 100%;
  max-width: 450px;
  height: auto;
  border-radius: 16px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
  object-fit: cover;
  transform: rotate(-1deg);
  transition: transform 0.3s ease;
}

.welcome-image:hover {
  transform: rotate(0deg) scale(1.02);
}

/* Адаптация под мобильные телефоны */
@media (max-width: 768px) {
  .welcome-banner {
    flex-direction: column-reverse;
    padding: 25px 20px;
    gap: 30px;
    text-align: center;
  }
  
  .welcome-title {
    font-size: 24px;
  }
  
  .welcome-image {
    transform: rotate(0);
    max-width: 100%;
  }
}

@media (max-width: 600px) {
  .service-item { flex-direction: column; align-items: flex-start; gap: 15px; padding: 15px;}
  .service-action { width: 100%; justify-content: space-between; }
  .grid-departments { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .department-card { padding: 15px 10px; }
  .dept-icon { width: 50px; height: 50px; }
  .dep-title { font-size: 13px; height: auto; margin-bottom: 10px; }
}
</style>