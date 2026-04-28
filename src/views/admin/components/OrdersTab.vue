<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { ordersApi, branchesApi, servicesApi } from '@/api/services'
import Modal from '@/components/Modal.vue'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import { carsDatabase } from '@/utils/carsData'

const props = defineProps({
  branchId: { type: [Number, String], default: null } 
})

const loading = ref(true)
const orders = ref([])
const filterStatus = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')
const searchQuery = ref('')
const sortBy = ref('-appointment_time')
let searchTimeout = null

const modals = ref({ comment: false, delete: false, create: false })
const commentForm = ref({ text: '', orderId: null })

const { isDeleteModalOpen, deleteConfig, confirmDelete, closeDeleteModal, executeDelete } = useDeleteConfirm()

const createForm = ref({
  client_first_name: '', phone_number: '', branch: props.branchId || '', service: '',
  car_number: '', car_vin: '', client_comment: ''
})

const dates = ref([])
const selectedDate = ref(null)
const availableSlots = ref([])
const selectedSlot = ref(null)
const loadingSlots = ref(false)

const branchesList = ref([])
const servicesList = ref([])

const availableServices = computed(() => {
  if (!createForm.value.branch) return []
  return servicesList.value.filter(s => s.branch === createForm.value.branch || s.branch_id === createForm.value.branch)
})

watch(() => createForm.value.branch, () => {
  createForm.value.service = ''
  selectedDate.value = null
  selectedSlot.value = null
  availableSlots.value = []
})

watch(() => createForm.value.service, async (newServiceId) => {
  selectedSlot.value = null
  if (newServiceId && selectedDate.value) {
    await loadSlotsForDate(selectedDate.value)
  } else {
    availableSlots.value = []
  }
})

// --- AUTOCOMPLETE ---
const brandQuery = ref('')
const modelQuery = ref('')
const isBrandDropdownOpen = ref(false)
const isModelDropdownOpen = ref(false)
const autocompleteRef = ref(null)

const filteredBrands = computed(() => {
  const query = brandQuery.value.toLowerCase()
  const allBrands = Object.keys(carsDatabase)
  if (!query) return allBrands
  return allBrands.filter(brand => brand.toLowerCase().includes(query))
})

const filteredModels = computed(() => {
  const models = carsDatabase[brandQuery.value] || []
  const query = modelQuery.value.toLowerCase()
  if (!query) return models
  return models.filter(model => model.toLowerCase().includes(query))
})

const selectBrand = (brand) => {
  brandQuery.value = brand
  modelQuery.value = ''
  isBrandDropdownOpen.value = false
}

const selectModel = (model) => {
  modelQuery.value = model
  isModelDropdownOpen.value = false
}

const closeDropdowns = (e) => {
  if (autocompleteRef.value && !autocompleteRef.value.contains(e.target)) {
    isBrandDropdownOpen.value = false
    isModelDropdownOpen.value = false
  }
}

// --- ДАТЫ И СЛОТЫ ---
const generateDates = () => {
  const result = []
  const today = new Date()
  const daysOfWeek = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']
  
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const isoDate = d.toISOString().split('T')[0]
    result.push({
      iso: isoDate,
      day: d.getDate(),
      dayOfWeek: daysOfWeek[d.getDay()],
      isWeekend: d.getDay() === 0 || d.getDay() === 6
    })
  }
  dates.value = result
}

const minDate = computed(() => new Date().toISOString().split('T')[0])

// Кастомный выбор даты из календаря
const customDate = ref('')
watch(customDate, async (newVal) => {
  if (!newVal) return
  const d = new Date(newVal)
  const daysOfWeek = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']
  
  // Проверяем, есть ли эта дата уже в массиве
  const exists = dates.value.find(item => item.iso === newVal)
  
  if (!exists) {
    // Добавляем новую дату в самое начало списка
    dates.value.unshift({
      iso: newVal,
      day: d.getDate(),
      dayOfWeek: daysOfWeek[d.getDay()],
      isWeekend: d.getDay() === 0 || d.getDay() === 6
    })
  }
  await selectDate(newVal)
  
  // Скроллим список слотов дат в самое начало
  setTimeout(() => {
    const scrollContainer = document.querySelector('.dates-scroll')
    if (scrollContainer) scrollContainer.scrollLeft = 0
  }, 50)
})

const selectDate = async (isoDate) => {
  selectedDate.value = isoDate
  selectedSlot.value = null
  if (createForm.value.service) {
    await loadSlotsForDate(isoDate)
  }
}

const loadSlotsForDate = async (isoDate) => {
  availableSlots.value = [] 
  loadingSlots.value = true
  try {
    const res = await ordersApi.getAvailableSlots(createForm.value.service, isoDate)
    availableSlots.value = res.data.slots || []
  } catch (err) {
    availableSlots.value = []
  } finally {
    loadingSlots.value = false
  }
}

const selectSlot = (slot) => {
  selectedSlot.value = slot
}

// --- ОСНОВНАЯ ЛОГИКА ---
const fetchOrders = async () => {
  loading.value = true
  try {
    let query = `?ordering=${sortBy.value}`
    if (props.branchId) query += `&branch=${props.branchId}`
    if (filterStatus.value) query += `&status=${filterStatus.value}`
    if (searchQuery.value) query += `&search=${encodeURIComponent(searchQuery.value)}`
    
    const response = await ordersApi.getAllOrders(query)
    let result = response.data.results || response.data
    
    if (filterDateFrom.value || filterDateTo.value) {
      result = result.filter(o => {
        const orderDateStr = o.appointment_time.substring(0, 10) 
        const fromMatch = filterDateFrom.value ? orderDateStr >= filterDateFrom.value : true
        const toMatch = filterDateTo.value ? orderDateStr <= filterDateTo.value : true
        return fromMatch && toMatch
      })
    }
    orders.value = result
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const fetchFormData = async () => {
  try {
    if (branchesApi) branchesList.value = (await branchesApi.getAll()).data.results || (await branchesApi.getAll()).data
    if (servicesApi) servicesList.value = (await servicesApi.getAll()).data.results || (await servicesApi.getAll()).data
  } catch (err) {
    console.error('Ошибка загрузки данных для формы', err)
  }
}

watch(() => props.branchId, fetchOrders)
watch([filterStatus, filterDateFrom, filterDateTo, sortBy], fetchOrders)
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { fetchOrders() }, 1000)
})

onMounted(() => {
  document.addEventListener('click', closeDropdowns)
  generateDates()
  fetchOrders()
  fetchFormData()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeDropdowns)
})

const resetFilters = () => {
  filterStatus.value = ''; filterDateFrom.value = ''; filterDateTo.value = ''; searchQuery.value = ''; sortBy.value = '-appointment_time'
}

const formatPhoneNumber = (order) => {
  let phone = order.client_phone || order.phone_number
  if (!phone) return 'Телефон не указан'
  
  if (!phone.startsWith('+')) {
    phone = '+' + phone
  }
  return phone
}

const formatClientName = (order) => {
  // 1. Если клиент зарегистрирован
  if (order.client) {
    const last = order.client_last_name || ''
    const first = order.client_first_name || ''
    const full = `${last} ${first}`.trim()
    return full || order.client_email || 'Имя не указано'
  }
  //2. если гость
  if (order.client_comment && order.client_comment.includes('Имя клиента:')) {
    const lines = order.client_comment.split('\n')
    const nameLine = lines.find(line => line.startsWith('Имя клиента:'))
    if (nameLine) {
      return nameLine.replace('Имя клиента:', '').trim()
    }
  }
  
  return 'Гость'
}

const changeStatus = async (order, newStatus) => {
  try {
    await ordersApi.updateOrder(order.id, { status: newStatus })
    order.status = newStatus
  } catch (error) {
    alert('Ошибка обновления статуса')
  }
}

const openModalComment = (order) => {
  commentForm.value.text = order.admin_comment || ''
  commentForm.value.orderId = order.id
  modals.value.comment = true
}

const submitComment = async () => {
  try {
    await ordersApi.updateOrder(commentForm.value.orderId, { admin_comment: commentForm.value.text })
    fetchOrders()
    modals.value.comment = false
  } catch (error) {
    alert('Ошибка сохранения комментария')
  }
}

const submitCreateOrder = async () => {
  if (!brandQuery.value || !modelQuery.value) {
    alert('Пожалуйста, выберите марку и модель автомобиля.')
    return
  }
  
  if (!selectedDate.value || !selectedSlot.value) {
    alert('Пожалуйста, выберите дату и время визита.')
    return
  }

  try {
    const appointmentTimeIso = new Date(`${selectedDate.value}T${selectedSlot.value}:00`).toISOString()

    const payload = { 
      ...createForm.value,
      car_brand: brandQuery.value,
      car_model: modelQuery.value,
      appointment_time: appointmentTimeIso,
      mechanic: null 
    }
    
    await ordersApi.createOrder(payload)
    alert('Заказ успешно создан!')
    modals.value.create = false
    
    createForm.value = { client_first_name: '', phone_number: '', branch: props.branchId || '', service: '', car_number: '', car_vin: '', client_comment: '' }
    brandQuery.value = ''
    modelQuery.value = ''
    selectedDate.value = null
    selectedSlot.value = null
    customDate.value = ''
    fetchOrders()
  } catch (error) {
    alert(error.response?.data ? JSON.stringify(error.response.data) : 'Ошибка при создании заказа')
  }
}

const handleDeleteOrder = (id) => {
  confirmDelete(id, 'Вы действительно хотите удалить эту запись клиента?', async (targetId) => {
    await ordersApi.deleteOrder(targetId)
    await fetchOrders()
  })
}

const formatDate = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const allowedCarLetters = { 'A': 'А', 'B': 'В', 'E': 'Е', 'K': 'К', 'M': 'М', 'H': 'Н', 'O': 'О', 'P': 'Р', 'C': 'С', 'T': 'Т', 'Y': 'У', 'X': 'Х', 'А': 'А', 'В': 'В', 'Е': 'Е', 'К': 'К', 'М': 'М', 'Н': 'Н', 'О': 'О', 'Р': 'Р', 'С': 'С', 'Т': 'Т', 'У': 'У', 'Х': 'Х' }
const onCarNumberInput = (event) => {
  const val = event.target.value.toUpperCase()
  let result = ''; const pattern = ['L', 'D', 'D', 'D', 'L', 'L', 'D', 'D', 'D']; let patternIndex = 0
  for (let i = 0; i < val.length && patternIndex < 9; i++) {
    const char = val[i]; const isDigit = /[0-9]/.test(char); const mappedLetter = allowedCarLetters[char]
    if (pattern[patternIndex] === 'L') { if (mappedLetter) { result += mappedLetter; patternIndex++ } } 
    else if (pattern[patternIndex] === 'D') { if (isDigit) { result += char; patternIndex++ } }
  }
  createForm.value.car_number = result; event.target.value = result
}
</script>

<template>
  <div>
    <!-- ФИЛЬТРЫ И ТАБЛИЦА -->
    <div class="filters-panel" style="display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 20px;">
      <div class="filter-group" style="flex: 1; min-width: 250px;">
        <label>Поиск</label>
        <input type="text" v-model="searchQuery" placeholder="Поиск..." style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      </div>
      <div class="filter-group"><label>Статус</label><select v-model="filterStatus" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;"><option value="">Все</option><option value="pending">Ожидает</option><option value="confirmed">Подтвержден</option><option value="in_progress">В работе</option><option value="completed">Завершен</option><option value="cancelled">Отменен</option></select></div>
      <div class="filter-group"><label>Дата с</label><input type="date" v-model="filterDateFrom" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;"></div>
      <div class="filter-group"><label>Дата по</label><input type="date" v-model="filterDateTo" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;"></div>
      <div class="filter-group"><label>Сортировка</label><select v-model="sortBy" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;"><option value="-appointment_time">Сначала новые</option><option value="appointment_time">Сначала старые</option><option value="-created_at">Недавно созданные</option></select></div>
      
      <button @click="resetFilters" class="btn-clear" style="padding: 8px 15px;">Сбросить</button>
      <button @click="modals.create = true" style="padding: 8px 15px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">+ Создать запись</button>
    </div>

    <div v-if="loading" style="margin: 20px 0;">Загрузка...</div>
    <div v-else-if="orders.length === 0" style="text-align: center; padding: 30px; color: #888;">Заказов не найдено.</div>

    <div v-else class="table-responsive">
      <table class="admin-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 10px; border-bottom: 2px solid #eee;">ID / Время</th>
            <th style="text-align: left; padding: 10px; border-bottom: 2px solid #eee;">Клиент / Авто</th>
            <th style="text-align: left; padding: 10px; border-bottom: 2px solid #eee;">Услуга / Мастер</th>
            <th style="text-align: left; padding: 10px; border-bottom: 2px solid #eee;">Статус</th>
            <th style="text-align: left; padding: 10px; border-bottom: 2px solid #eee;">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id" style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">
              <strong>#{{ order.id }}</strong><br>{{ formatDate(order.appointment_time) }}<br>
              <span v-if="order.linking_pin" style="font-size: 12px; color: #10b981; font-weight: bold;">PIN: {{ order.linking_pin }}</span>
            </td>
            <td style="padding: 10px;">
              <div style="font-weight: bold; font-size: 14px;">{{ formatClientName(order) }}</div>
              <div style="color: #666; font-size: 13px; margin-bottom: 5px;">{{ formatPhoneNumber(order) }}</div>
              <div style="background: #f1f5f9; padding: 3px 6px; border-radius: 4px; display: inline-block; font-size: 12px;">
                {{ order.car_brand }} {{ order.car_model }} <span v-if="order.car_number">| {{ order.car_number }}</span>
              </div>
            </td>
            <td style="padding: 10px;">{{ order.service?.name }}<br><small style="color: #64748b;">{{ order.mechanic?.fullname || order.mechanic?.first_name || 'Не назначен' }}</small></td>
            <td style="padding: 10px;"><select :value="order.status" @change="changeStatus(order, $event.target.value)" style="padding: 5px; border-radius: 4px;"><option value="pending">Ожидает</option><option value="confirmed">Подтвержден</option><option value="in_progress">В работе</option><option value="completed">Завершен</option><option value="cancelled">Отменен</option></select></td>
            <td style="padding: 10px; display: flex; gap: 5px;">
              <button @click="openModalComment(order)" style="padding: 5px 10px; cursor: pointer; border: 1px solid #ccc; background: white; border-radius: 4px;">Коммент.</button>
              <button @click="handleDeleteOrder(order.id)" style="padding: 5px 10px; cursor: pointer; border: 1px solid #fca5a5; color: red; background: white; border-radius: 4px;">Удалить</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Modal :show="modals.comment" title="Комментарий администратора" @close="modals.comment = false" @submit="submitComment">
      <div style="margin-bottom: 15px;"><label style="display: block; margin-bottom: 5px;">Комментарий к заказу</label><input v-model="commentForm.text" type="text" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;"></div>
    </Modal>

    <Modal :show="isDeleteModalOpen" title="Подтверждение удаления" @close="closeDeleteModal" @submit="executeDelete">
      <div style="padding: 10px 0;"><p style="font-size: 16px; margin-bottom: 20px; color: #333;">{{ deleteConfig.message }}</p></div>
    </Modal>

    <!-- МОДАЛКА СОЗДАНИЯ -->
    <Modal :show="modals.create" title="Новая запись" @close="modals.create = false">
      <form id="create-order-form" @submit.prevent="submitCreateOrder" class="create-order-form">
        
        <div class="form-full-width" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <label>Имя клиента *</label>
            <input v-model="createForm.client_first_name" type="text" required> 
          </div>
          <div>
            <label>Телефон клиента *</label>
            <input v-model="createForm.phone_number" type="text" required>
          </div>
        </div>

        <div>
          <label>Филиал *</label>
          <select v-model="createForm.branch" required>
            <option value="" disabled>Выберите филиал</option>
            <option v-for="b in branchesList" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>

        <div>
          <label>Услуга *</label>
          <select v-model="createForm.service" :disabled="!createForm.branch" required>
            <option value="" disabled>{{ createForm.branch ? 'Выберите услугу' : 'Сначала выберите филиал' }}</option>
            <option v-for="s in availableServices" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>

        <!-- ВЫБОР ДАТЫ И СЛОТОВ -->
        <div class="form-full-width datetime-picker">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label style="margin-bottom: 0;">Дата визита *</label>
            <!-- КАЛЕНДАРЬ -->
            <div class="custom-calendar-wrapper" :class="{'disabled-state': !createForm.service}">
              <span class="calendar-icon-small">📅</span>
              <input 
                type="date" 
                v-model="customDate" 
                :min="minDate" 
                :disabled="!createForm.service"
                class="native-date-input"
                title="Выбрать другую дату"
              >
            </div>
          </div>
          
          <div class="dates-scroll" :class="{'disabled-state': !createForm.service}">
            <div 
              v-for="d in dates" :key="d.iso"
              @click="createForm.service && selectDate(d.iso)"
              :class="['date-item', { active: selectedDate === d.iso }]"
            >
              <span class="day-of-week" :class="{ weekend: d.isWeekend }">{{ d.dayOfWeek }}</span>
              <span class="day-number">{{ d.day }}</span>
            </div>
          </div>
          <div v-if="!createForm.service" class="slots-msg" style="color: #64748b; font-size: 13px;">Сначала выберите услугу.</div>

          <label v-if="selectedDate" style="margin-top: 15px;">Время *</label>
          <div v-if="selectedDate" class="slots-container">
            <div v-if="loadingSlots" class="slots-msg">Ищем свободное время...</div>
            <div v-else-if="availableSlots.length === 0" class="slots-msg error-text">
              На выбранную дату нет свободного времени.
            </div>
            <div v-else class="slots-grid">
              <div 
                v-for="slot in availableSlots" :key="slot"
                @click="selectSlot(slot)"
                :class="['slot-item', { active: selectedSlot === slot }]"
              >
                {{ slot }}
              </div>
            </div>
          </div>
        </div>

        <!-- AUTOCOMPLETE ДЛЯ МАШИН В АДМИНКЕ -->
        <div class="form-full-width autocomplete-container" ref="autocompleteRef">
          <div class="autocomplete-group">
            <label>Марка авто *</label>
            <div class="input-relative">
              <input v-model="brandQuery" @focus="isBrandDropdownOpen = true; isModelDropdownOpen = false" @input="isBrandDropdownOpen = true" type="text" required autocomplete="off" placeholder="Начните вводить...">
              <ul v-show="isBrandDropdownOpen" class="autocomplete-list shadow-dropdown">
                <li v-for="brand in filteredBrands" :key="brand" @click="selectBrand(brand)">{{ brand }}</li>
                <li v-if="filteredBrands.length === 0" class="empty-item">Ничего не найдено</li>
              </ul>
            </div>
          </div>

          <div class="autocomplete-group">
            <label>Модель авто *</label>
            <div class="input-relative">
              <input v-model="modelQuery" @focus="isModelDropdownOpen = true; isBrandDropdownOpen = false" @input="isModelDropdownOpen = true" type="text" required autocomplete="off" :disabled="!brandQuery" placeholder="Модель">
              <ul v-show="isModelDropdownOpen" class="autocomplete-list shadow-dropdown">
                <li v-for="model in filteredModels" :key="model" @click="selectModel(model)">{{ model }}</li>
                <li v-if="filteredModels.length === 0 && brandQuery" class="empty-item">Ничего не найдено</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <label>Гос. номер</label>
          <input v-model="createForm.car_number" @input="onCarNumberInput" maxlength="9" type="text">
        </div>

        <div>
          <label>VIN-код</label>
          <input v-model="createForm.car_vin" type="text" placeholder="17 символов">
        </div>

        <div class="form-full-width submit-action">
          <button type="submit" class="btn-submit-order" :disabled="!selectedSlot">
            {{ selectedSlot ? 'Создать запись' : 'Выберите время' }}
          </button>
        </div>
      </form>
    </Modal>

  </div>
</template>

<style scoped>
.create-order-form { display: grid; grid-template-columns: 1fr; gap: 15px; text-align: left; margin-top: 10px; max-height: 70vh; overflow-y: auto; padding-right: 5px; }
.create-order-form::-webkit-scrollbar { width: 6px; }
.create-order-form::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
@media (min-width: 600px) { .create-order-form { grid-template-columns: 1fr 1fr; } }
.form-full-width { grid-column: 1 / -1; }
.autocomplete-container { display: grid; grid-template-columns: 1fr; gap: 15px; }
@media (min-width: 600px) { .autocomplete-container { grid-template-columns: 1fr 1fr; } }

.create-order-form label { display: block; font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 6px; }
.create-order-form input, .create-order-form select { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; background-color: #fff; }
.create-order-form input:disabled, .create-order-form select:disabled { background-color: #f1f5f9; cursor: not-allowed; }

.autocomplete-group { position: relative; }
.input-relative { position: relative; }
.autocomplete-list { position: absolute; top: 100%; left: 0; width: 100%; max-height: 180px; overflow-y: auto; background: white; border: 1px solid #cbd5e1; border-radius: 6px; margin-top: 4px; padding: 0; list-style: none; z-index: 1000; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.autocomplete-list li { padding: 10px 15px; cursor: pointer; transition: 0.2s; font-size: 14px; color: #334155; }
.autocomplete-list li:hover { background: #f8fafc; color: #10b981; }
.empty-item { color: #94a3b8 !important; cursor: default !important; background: transparent !important; }

.datetime-picker { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
.dates-scroll { display: flex; overflow-x: auto; gap: 10px; padding-bottom: 8px; scrollbar-width: none; }
.dates-scroll::-webkit-scrollbar { display: none; }
.disabled-state { opacity: 0.5; pointer-events: none; }
.date-item { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 60px; height: 70px; border-radius: 8px; cursor: pointer; background: white; border: 1px solid #cbd5e1; transition: 0.2s; flex-shrink: 0; }
.date-item:hover { border-color: #10b981; }
.date-item.active { background: #10b981; border-color: #10b981; color: white; }
.day-of-week { font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 2px; text-transform: uppercase; }
.day-of-week.weekend { color: #ef4444; }
.date-item.active .day-of-week, .date-item.active .day-number { color: white; }
.day-number { font-size: 20px; font-weight: 800; color: #1e293b; }
.calendar-btn { border: 1px dashed #cbd5e1; position: relative; overflow: hidden; }
.calendar-icon { font-size: 18px; margin-bottom: 2px; }
.hidden-native-date { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

.slots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 8px; }
.slot-item { padding: 10px 5px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; font-weight: 600; color: #1e293b; cursor: pointer; transition: 0.2s; background: white; text-align: center; }
.slot-item:hover { border-color: #10b981; color: #10b981; }
.slot-item.active { background: #10b981; color: white; border-color: #10b981; }
.error-text { color: #ef4444; font-size: 13px; font-weight: 600;}

/* КНОПКА ОТПРАВКИ */
.submit-action { margin-top: 10px; text-align: right; }
.btn-submit-order { padding: 12px 24px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer; transition: 0.2s; width: 100%; }
.btn-submit-order:hover:not(:disabled) { background: #059669; }
.btn-submit-order:disabled { background: #a7f3d0; cursor: not-allowed; }

.custom-calendar-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 8px;
  overflow: hidden;
  cursor: pointer;
}

.custom-calendar-wrapper:hover:not(.disabled-state) {
  border-color: #10b981;
}

.calendar-icon-small {
  font-size: 14px;
  margin-right: 5px;
  pointer-events: none;
}

/* Делаем input прозрачным, но кликабельным поверх иконки */
.native-date-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  box-sizing: border-box;
}

.native-date-input::-webkit-calendar-picker-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  cursor: pointer;
}
</style>