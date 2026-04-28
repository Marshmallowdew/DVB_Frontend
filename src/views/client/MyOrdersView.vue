<script setup>
import { ref, onMounted, computed } from 'vue'
import { ordersApi } from '@/api/services' 

const orders = ref([])
const loading = ref(true)
const error = ref('')

const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const itemsPerPage = ref(10)

const copiedPinId = ref(null)

const fetchOrders = async (page = 1) => {
  loading.value = true
  error.value = ''
  
  try {
    // Передаем параметр page в API запрос
    const response = await ordersApi.getMyOrders({ page })
    
    // Проверяем, есть ли пагинация в ответе от DRF
    if (response.data && response.data.results !== undefined) {
      orders.value = response.data.results
      totalItems.value = response.data.count
      
      // Рассчитываем количество страниц
      totalPages.value = Math.ceil(response.data.count / itemsPerPage.value)
      currentPage.value = page
    } else {
      // Фолбэк, если пагинация отключена на бэкенде
      orders.value = response.data
      totalItems.value = response.data.length
      totalPages.value = 1
      currentPage.value = 1
    }
  } catch (err) {
    error.value = 'Не удалось загрузить историю записей'
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchOrders(1))

const handleCancel = async (orderId) => {
  if (!confirm('Вы уверены, что хотите отменить эту запись?')) return

  try {
    await ordersApi.cancelOrder(orderId)
    await fetchOrders(currentPage.value)
  } catch (err) {
    console.error(err)
    alert(err.response?.data?.error || 'Не удалось отменить запись. Возможно, она уже в работе.')
  }
}

const copyToClipboard = async (pin, orderId) => {
  if (!pin) return
  try {
    await navigator.clipboard.writeText(pin)
    copiedPinId.value = orderId
    setTimeout(() => {
      if (copiedPinId.value === orderId) {
        copiedPinId.value = null
      }
    }, 2000)
  } catch (err) {
    console.error('Ошибка копирования: ', err)
  }
}

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    fetchOrders(page)
    // Скроллим наверх списка
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const visiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
})

const formatDate = (isoString) => {
  const date = new Date(isoString)
  return date.toLocaleString('ru-RU', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

const getStatusClass = (status) => {
  const map = {
    pending: 'status-pending',
    confirmed: 'status-confirmed',
    in_progress: 'status-progress',
    completed: 'status-completed',
    cancelled: 'status-cancelled'
  }
  return map[status] || ''
}
</script>

<template>
  <div class="orders-container">
    <h2>Мои записи на сервис</h2>

    <div v-if="loading && orders.length === 0" class="loading">Загрузка истории...</div>
    <div v-else-if="error" class="alert error">{{ error }}</div>
    
    <div v-else-if="orders.length === 0" class="empty-state">
      <p>У вас пока нет ни одной записи.</p>
      <RouterLink to="/" class="btn-primary">Посмотреть услуги</RouterLink>
    </div>

    <div v-else>
      <div class="orders-list" :class="{ 'is-loading': loading }">
        <div v-for="order in orders" :key="order.id" class="order-card">
          
          <div class="order-header">
            <div class="header-left">
              <span class="order-id">{{ order.service?.name }}</span>
            </div>
            
            <span class="order-status" :class="getStatusClass(order.status)">
              {{ order.status_display }}
            </span>
          </div>

          <div class="order-body">
            <div class="info-block">
              <p><strong>Услуга:</strong> {{ order.service?.name || 'Услуга удалена' }}</p>
              <p><strong>Дата визита:</strong> {{ formatDate(order.appointment_time) }}</p>
              <p><strong>Автомобиль:</strong> {{ order.car_brand }} {{ order.car_model }} ({{ order.car_number || 'без номера' }})</p>
            </div>
            
            <div class="info-block">
              <p><strong>Филиал:</strong> {{ order.branch_name }}</p>
              <p><strong>Мастер:</strong> {{ order.mechanic?.full_name || 'Не назначен' }}</p>
              <p v-if="order.admin_comment" class="admin-comment">
                <strong>Ответ сервиса:</strong> {{ order.admin_comment }}
              </p>

              <div v-if="order.linking_pin" class="pin-block" @click="copyToClipboard(order.linking_pin, order.id)">
                <div class="pin-label">PIN-код заказа:</div>
                <div class="pin-code-wrapper">
                  <span class="pin-code">{{ order.linking_pin }}</span>
                  <span class="copy-icon" v-if="copiedPinId !== order.id"></span>
                  <span class="copy-success" v-else>Скопировано!</span>
                </div>
              </div>

            </div>
          </div>

          <div class="order-footer" v-if="['pending', 'confirmed'].includes(order.status)">
            <button @click="handleCancel(order.id)" class="btn-cancel" :disabled="loading">
              Отменить запись
            </button>
          </div>
        </div>
      </div>

      <!-- БЛОК ПАГИНАЦИИ -->
      <div v-if="totalPages > 1" class="pagination">
        <button 
          class="page-btn" 
          :disabled="currentPage === 1 || loading" 
          @click="goToPage(currentPage - 1)"
        >
          &laquo; Назад
        </button>

        <div class="page-numbers">
          <button 
            v-for="page in visiblePages" 
            :key="page" 
            class="page-num-btn" 
            :class="{ active: page === currentPage }"
            :disabled="loading"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </div>

        <button 
          class="page-btn" 
          :disabled="currentPage === totalPages || loading" 
          @click="goToPage(currentPage + 1)"
        >
          Вперед &raquo;
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.orders-container { max-width: 900px; margin: 0 auto; padding-bottom: 40px;}
h2 { color: #2c3e50; margin-bottom: 25px;}

.loading { text-align: center; padding: 40px; color: #666; font-size: 16px;}
.is-loading { opacity: 0.6; pointer-events: none; transition: opacity 0.2s;}

.empty-state { text-align: center; padding: 50px 20px; background: #f8f9fa; border-radius: 12px; border: 1px dashed #cbd5e1;}
.empty-state p { margin-bottom: 20px; color: #475569;}
.btn-primary { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; transition: 0.2s;}
.btn-primary:hover { background: #059669; transform: translateY(-2px);}

.orders-list { display: flex; flex-direction: column; gap: 20px; margin-top: 20px; }
.order-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.03); transition: 0.2s;}
.order-card:hover { border-color: #cbd5e1; box-shadow: 0 6px 20px rgba(0,0,0,0.06);}

.order-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.header-left { display: flex; align-items: center; gap: 15px; flex-wrap: wrap;}
.order-id { font-weight: 700; color: #1e293b; font-size: 16px;}

/* КОМПАКТНЫЙ PIN-БЭЙДЖ */
.pin-badge { display: flex; align-items: center; gap: 6px; background: #e2e8f0; border-radius: 6px; padding: 4px 10px; cursor: pointer; transition: 0.2s; user-select: none; }
.pin-badge:hover { background: #cbd5e1; }
.pin-text { font-size: 13px; color: #475569; }
.pin-text strong { color: #0f172a; font-family: monospace; font-size: 14px; letter-spacing: 1px;}
.copy-icon { font-size: 12px; opacity: 0.7;}
.copy-success { font-size: 12px; color: #10b981; font-weight: bold;}

.order-status { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;}
.status-pending { background: #fef9c3; color: #b45309; }
.status-confirmed { background: #d1fae5; color: #047857; }
.status-progress { background: #dbeafe; color: #1d4ed8; }
.status-completed { background: #f1f5f9; color: #475569; }
.status-cancelled { background: #fee2e2; color: #b91c1c; }

.order-body { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; padding: 24px; }
@media (max-width: 650px) { .order-body { grid-template-columns: 1fr; gap: 20px; } }
.info-block { display: flex; flex-direction: column; gap: 10px;}
.order-body p { margin: 0; font-size: 14px; color: #475569; line-height: 1.5;}
.order-body strong { color: #1e293b; }

.admin-comment { margin-top: 5px; padding: 12px; background: #fef9c3; border-left: 4px solid #f59e0b; font-size: 13px; border-radius: 0 8px 8px 0;}

.order-footer { padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: right; background: #f8fafc; }
.btn-cancel { background: transparent; border: 1px solid #fca5a5; color: #ef4444; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: 0.2s; }
.btn-cancel:hover:not(:disabled) { background: #fee2e2; }
.btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

/* ПАГИНАЦИЯ */
.pagination { display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 30px; padding: 20px 0; }
.page-numbers { display: flex; gap: 8px; }
.page-btn, .page-num-btn { background: white; border: 1px solid #cbd5e1; color: #334155; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; transition: 0.2s; }
.page-num-btn { padding: 8px 12px; min-width: 40px; }
.page-btn:hover:not(:disabled), .page-num-btn:hover:not(:disabled) { background: #f1f5f9; border-color: #94a3b8; }
.page-btn:disabled { color: #94a3b8; background: #f8fafc; cursor: not-allowed; }
.page-num-btn.active { background: #10b981; color: white; border-color: #10b981; pointer-events: none; }

.pin-block {
  margin-top: 10px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pin-block:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  transform: translateY(-1px);
}
.pin-label {
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.pin-code-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pin-code {
  font-family: 'Courier New', Courier, monospace;
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 2px;
}
.copy-icon {
  font-size: 16px;
  opacity: 0.6;
}
.pin-block:hover .copy-icon {
  opacity: 1;
}
.copy-success {
  font-size: 12px;
  color: #10b981;
  font-weight: 700;
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>