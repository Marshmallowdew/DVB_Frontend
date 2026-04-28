<template>
  <div class="statistics-tab">
    <div v-if="loading" class="loading">Загрузка статистики...</div>
    
    <div v-else-if="stats" class="stats-container">
      <div class="summary-cards-row">
        <div class="summary-card">
          <h3>Всего заказ-нарядов</h3>
          <p class="stat-number">{{ stats.total_orders || 0 }}</p>
        </div>
        <div class="summary-card">
          <h3>Средний чек</h3>
          <p class="stat-number">{{ stats.average_check || 0 }} ₽</p>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-box">
          <h4>Топ услуг</h4>
          <Bar v-if="servicesChartData" :data="servicesChartData" :options="chartOptions" />
          <p v-else class="no-data">Нет данных за этот период</p>
        </div>

        <div class="chart-box">
          <h4>Пиковые часы записей</h4>
          <Line v-if="timesChartData" :data="timesChartData" :options="chartOptions" />
          <p v-else class="no-data">Нет данных за этот период</p>
        </div>
      </div>
    </div>
    
    <div v-else class="loading">
      Нет данных для отображения
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { apiClient } from '@/api/client'
import { Bar, Line } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement)

const props = defineProps({
  branchId: {
    type: [Number, String],
    default: null
  },
  isMainAdmin: {
    type: Boolean,
    default: false
  },
  dateStart: {
    type: String,
    default: ''
  },
  dateEnd: {
    type: String,
    default: ''
  }
})

const loading = ref(false)
const stats = ref(null)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
}

const servicesChartData = computed(() => {
  if (!stats.value?.popular_services?.length) return null
  return {
    labels: stats.value.popular_services.map(s => s.service__name),
    datasets: [{
      label: 'Количество записей',
      backgroundColor: '#4CAF50',
      data: stats.value.popular_services.map(s => s.count)
    }]
  }
})

const timesChartData = computed(() => {
  if (!stats.value?.popular_times?.length) return null
  return {
    labels: stats.value.popular_times.map(t => `${t.hour}:00`),
    datasets: [{
      label: 'Количество записей',
      backgroundColor: '#2196F3',
      borderColor: '#2196F3',
      data: stats.value.popular_times.map(t => t.count)
    }]
  }
})

const loadStatistics = async () => {
  loading.value = true
  try {
    const params = {}
    
    if (props.branchId) {
      params.branch_id = props.branchId
    }
    
    if (props.dateStart) {
      params.start_date = props.dateStart 
    }
    
    if (props.dateEnd) {
      params.end_date = props.dateEnd 
    }
    
    console.log('Отправляем запрос с параметрами:', params)
    
    const response = await apiClient.get('statistics/', { params })
    stats.value = response.data
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStatistics()
})

watch(
  () => [props.branchId, props.dateStart, props.dateEnd], 
  (newValues, oldValues) => {
    console.log('Даты изменились! Новые значения:', newValues)
    loadStatistics()
  }
)
</script>

<style scoped>
.statistics-tab { padding: 20px 0; }
.summary-cards-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}
.summary-card {
  flex: 1;
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #e9ecef;
}
.summary-card h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #495057;
}
.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #2196F3;
  margin: 0;
}
.charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
}
@media (min-width: 768px) {
  .charts-grid { grid-template-columns: 1fr 1fr; }
}
.chart-box {
  background: white;
  border: 1px solid #e9ecef;
  padding: 20px;
  border-radius: 8px;
  height: 350px;
  position: relative;
}
.chart-box h4 { 
  text-align: center; 
  margin-top: 0;
  margin-bottom: 15px; 
  color: #343a40;
}
.no-data { 
  text-align: center; 
  color: #adb5bd; 
  margin-top: 100px; 
  font-size: 14px;
}
.loading {
  text-align: center;
  padding: 50px;
  color: #6c757d;
  font-size: 18px;
}
</style>