<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { servicesApi, mechanicsApi, ordersApi, carsApi } from '@/api/services'
import { useAuthStore } from '@/stores/auth'
import { carsDatabase } from '@/utils/carsData' 

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Состояние услуги
const selectedService = ref(null)
const mechanics = ref([])
const loading = ref(true)
const submitting = ref(false)
const error = ref('')

// Даты и время
const dates = ref([])
const selectedDate = ref(null) 
const availableSlots = ref([])
const selectedSlot = ref(null)
const loadingSlots = ref(false)

// Состояние модального окна успеха
const showSuccessModal = ref(false)

const showErrorModal = ref(false)
const errorMessage = ref('')

const closeErrorModal = () => {
  showErrorModal.value = false
  errorMessage.value = ''
}

// ЛОГИКА АВТОМОБИЛЕЙ
const selectedCarId = ref(null)
const isCarDropdownOpen = ref(false)
const isAddingNewCar = ref(false)

const newCarForm = ref({
  brand: '',
  model: '',
  number: '',
  vin: ''
})

const form = ref({
  mechanic: '', 
  client_comment: ''
})

// --- ЛОГИКА AUTOCOMPLETE ДЛЯ МАРОК И МОДЕЛЕЙ ---
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
  const currentBrand = newCarForm.value.brand
  const models = carsDatabase[currentBrand] || []
  
  const query = modelQuery.value.toLowerCase()
  if (!query) return models
  return models.filter(model => model.toLowerCase().includes(query))
})

const selectBrand = (brand) => {
  newCarForm.value.brand = brand
  brandQuery.value = brand
  newCarForm.value.model = ''
  modelQuery.value = ''
  isBrandDropdownOpen.value = false
}

const selectModel = (model) => {
  newCarForm.value.model = model
  modelQuery.value = model
  isModelDropdownOpen.value = false
}

const closeDropdowns = (e) => {
  if (autocompleteRef.value && !autocompleteRef.value.contains(e.target)) {
    isBrandDropdownOpen.value = false
    isModelDropdownOpen.value = false
  }
}

const userCars = computed(() => {
  return authStore.user?.cars || []
})

watch(userCars, (newCars) => {
  if (newCars.length > 0 && !selectedCarId.value) {
    selectedCarId.value = newCars[0].id
    isAddingNewCar.value = false
  } else if (newCars.length === 0) {
    isAddingNewCar.value = true
  }
}, { immediate: true })

const loadUserCars = async () => {
  try {
    const response = await carsApi.getUserCars()
    if (authStore.user) {
      authStore.user.cars = response.data.results || response.data
    }
  } catch (error) {
    console.error('Ошибка загрузки машин:', error)
  }
}

const selectedCarDetails = computed(() => {
  if (!selectedCarId.value) return null
  return userCars.value.find(car => car.id === selectedCarId.value)
})

const selectCar = (carId) => {
  selectedCarId.value = carId
  isCarDropdownOpen.value = false
  isAddingNewCar.value = false
}

const saveNewCar = async () => {
  if (!newCarForm.value.brand || !newCarForm.value.model) {
    errorMessage.value = 'Заполните марку и модель'
    showErrorModal.value = true
    return
  }
  
  try {
    const payload = {
      brand: newCarForm.value.brand,
      model: newCarForm.value.model,
      number: newCarForm.value.number,
      vin_number: newCarForm.value.vin
    }
    const response = await carsApi.addCar(payload)
    const newlyCreatedCar = response.data
    
    if (authStore.user) {
      if (!authStore.user.cars) authStore.user.cars = []
      authStore.user.cars.push(newlyCreatedCar)
    }
    
    selectedCarId.value = newlyCreatedCar.id
    newCarForm.value = { brand: '', model: '', number: '', vin: '' }
    brandQuery.value = ''
    modelQuery.value = ''
    
    isAddingNewCar.value = false
    isCarDropdownOpen.value = false

  } catch (error) {
    console.error('Ошибка добавления авто:', error)
    errorMessage.value = error.response?.data?.error || 'Не удалось добавить автомобиль. Проверьте правильность введенных данных.'
    showErrorModal.value = true
  }
}

const generateDates = () => {
  const result = []
  const today = new Date()
  const daysOfWeek = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']
  
  for (let i = 0; i < 5; i++) {
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

const onNativeDateSelect = async (event) => {
  const chosenIsoDate = event.target.value
  if (!chosenIsoDate) return

  const d = new Date(chosenIsoDate)
  const daysOfWeek = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']
  const exists = dates.value.find(item => item.iso === chosenIsoDate)
  if (!exists) {
    dates.value[4] = {
      iso: chosenIsoDate,
      day: d.getDate(),
      dayOfWeek: daysOfWeek[d.getDay()],
      isWeekend: d.getDay() === 0 || d.getDay() === 6
    }
  }
  await selectDate(chosenIsoDate)
}

const openNativeCalendar = () => {
  const picker = document.getElementById('hidden-datepicker')
  if (picker) {
    if (picker.showPicker) picker.showPicker()
    else picker.focus()
  }
}

onMounted(async () => {
  document.addEventListener('click', closeDropdowns)
  
  const serviceId = route.query.service
  if (!serviceId) {
    router.push('/')
    return
  }

  generateDates()
  
  if (authStore.isAuthenticated) {
    loadUserCars()
  } else {
    isAddingNewCar.value = true
  }

  try {
    const serviceRes = await servicesApi.getById(serviceId)
    selectedService.value = serviceRes.data
    
    const mechanicsRes = await mechanicsApi.getByBranch(selectedService.value.branch)
    mechanics.value = mechanicsRes.data

    if (dates.value && dates.value.length > 0) {
      await selectDate(dates.value[0].iso)
    }
    
  } catch (err) {
    console.error(err)
    error.value = 'Ошибка загрузки данных для записи'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeDropdowns)
})

const selectDate = async (isoDate) => {
  selectedDate.value = isoDate
  selectedSlot.value = null
  availableSlots.value = [] 
  loadingSlots.value = true
  
  try {
    const res = await ordersApi.getAvailableSlots(selectedService.value.id, isoDate)
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

const selectedDateTimeFormatted = computed(() => {
  if (!selectedDate.value || !selectedSlot.value) return ''
  const d = new Date(selectedDate.value)
  const options = { day: 'numeric', month: 'long' }
  return `${d.toLocaleDateString('ru-RU', options)}, ${selectedSlot.value}`
})

const submitBooking = async () => {
  if (!selectedDate.value || !selectedSlot.value) {
    alert('Пожалуйста, выберите дату и время!')
    return
  }

  let finalCarData = {}
  
  if (isAddingNewCar.value) {
    if (!newCarForm.value.brand || !newCarForm.value.model) {
      alert('Пожалуйста, заполните марку и модель автомобиля!')
      return
    }
    finalCarData = {
      car_brand: newCarForm.value.brand,
      car_model: newCarForm.value.model,
      car_number: newCarForm.value.number,
      car_vin: newCarForm.value.vin
    }
  } else if (selectedCarDetails.value) {
    finalCarData = {
      car_id: selectedCarDetails.value.id,
      car_brand: selectedCarDetails.value.brand,
      car_model: selectedCarDetails.value.model,
      car_number: selectedCarDetails.value.number,
      car_vin: selectedCarDetails.value.vin_number || ''
    }
  } else {
    alert('Пожалуйста, выберите или добавьте автомобиль!')
    return
  }

  submitting.value = true
  error.value = ''
  
  try {
    const appointmentTimeIso = new Date(`${selectedDate.value}T${selectedSlot.value}:00`).toISOString()

    const payload = {
      branch: selectedService.value.branch,
      service: selectedService.value.id,
      mechanic: form.value.mechanic || null,
      appointment_time: appointmentTimeIso,
      client_comment: form.value.client_comment,
      ...finalCarData 
    }

    await ordersApi.createOrder(payload)
    
    showSuccessModal.value = true

  } catch (err) {
    error.value = err.response?.data ? JSON.stringify(err.response.data) : 'Ошибка при создании записи'
  } finally {
    submitting.value = false
  }
}

// Функция закрытия модалки и перехода к записям
const closeSuccessModal = () => {
  showSuccessModal.value = false
  router.push('/my-orders')
}

const allowedCarLetters = {
  'A': 'А', 'B': 'В', 'E': 'Е', 'K': 'К', 'M': 'М', 'H': 'Н',
  'O': 'О', 'P': 'Р', 'C': 'С', 'T': 'Т', 'Y': 'У', 'X': 'Х',
  'А': 'А', 'В': 'В', 'Е': 'Е', 'К': 'К', 'М': 'М', 'Н': 'Н',
  'О': 'О', 'Р': 'Р', 'С': 'С', 'Т': 'Т', 'У': 'У', 'Х': 'Х'
}

const onCarNumberInput = (event) => {
  const val = event.target.value.toUpperCase()
  let result = ''
  
  const pattern = ['L', 'D', 'D', 'D', 'L', 'L', 'D', 'D', 'D']
  let patternIndex = 0

  for (let i = 0; i < val.length && patternIndex < 9; i++) {
    const char = val[i]
    const isDigit = /[0-9]/.test(char)
    const mappedLetter = allowedCarLetters[char]

    if (pattern[patternIndex] === 'L') {
      if (mappedLetter) { 
        result += mappedLetter
        patternIndex++
      }
    } else if (pattern[patternIndex] === 'D') {
      if (isDigit) { 
        result += char
        patternIndex++
      }
    }
  }

  newCarForm.value.number = result 
  event.target.value = result
}
</script>

<template>
  <div class="booking-container">
    
    <div v-if="loading" class="loading-state">Загрузка данных...</div>
    <div v-else-if="error" class="alert error">{{ error }}</div>
    
    <div v-else-if="selectedService" class="booking-grid">
      
      <div class="booking-form-wrapper">
        <h2 class="page-title">Оформление записи</h2>
        
        <form @submit.prevent="submitBooking" class="booking-form">
          
          <div class="datetime-picker">
            <h3>Дата и время</h3>
            <div class="dates-container">
              <div 
                v-for="d in dates" :key="d.iso"
                @click="selectDate(d.iso)"
                :class="['date-item', { active: selectedDate === d.iso }]"
              >
                <span class="day-of-week" :class="{ weekend: d.isWeekend }">{{ d.dayOfWeek }}</span>
                <span class="day-number">{{ d.day }}</span>
              </div>
              
              <div class="date-item calendar-btn" @click="openNativeCalendar">
                <span class="calendar-icon">📅</span>
                <span class="day-of-week calendar-text" style="margin-bottom:0;">Другая</span>
                <input type="date" id="hidden-datepicker" class="hidden-native-date" :min="minDate" @change="onNativeDateSelect">
              </div>
            </div>

            <div class="slots-container">
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

          <div class="car-selector-section">
            <h3>Автомобиль</h3>

            <div v-if="isAddingNewCar" class="add-car-box animate-fade">
              <div class="box-header">
                <h4>Добавление автомобиля</h4>
                <button 
                  v-if="userCars.length > 0" 
                  type="button" 
                  class="btn-close-form" 
                  @click="isAddingNewCar = false; isCarDropdownOpen = false"
                >✕ Отмена</button>
              </div>
              
              <div class="form-row" ref="autocompleteRef">
                <!-- ПОЛЕ МАРКИ С AUTOCOMPLETE -->
                <div class="form-group autocomplete-group">
                  <label>Марка *</label>
                  <div class="input-wrapper">
                    <input 
                      v-model="brandQuery" 
                      @focus="isBrandDropdownOpen = true; isModelDropdownOpen = false"
                      @input="isBrandDropdownOpen = true"
                      type="text" 
                      required
                      autocomplete="off"
                    >
                    <button v-if="brandQuery" type="button" class="clear-btn" @click="selectBrand('')">✕</button>
                  </div>
                  <ul v-show="isBrandDropdownOpen" class="autocomplete-list shadow-dropdown">
                    <li v-if="filteredBrands.length === 0" class="empty-item">Марка не найдена</li>
                    <li 
                      v-for="brand in filteredBrands" 
                      :key="brand" 
                      @click="selectBrand(brand)"
                    >
                      {{ brand }}
                    </li>
                  </ul>
                </div>

                <!-- ПОЛЕ МОДЕЛИ С AUTOCOMPLETE -->
                <div class="form-group autocomplete-group">
                  <label>Модель *</label>
                  <div class="input-wrapper">
                    <input 
                      v-model="modelQuery" 
                      @focus="isModelDropdownOpen = true; isBrandDropdownOpen = false"
                      @input="isModelDropdownOpen = true"
                      type="text" 
                      required
                      autocomplete="off"
                      :disabled="!newCarForm.brand" 
                      :title="!newCarForm.brand ? 'Сначала выберите марку' : ''"
                    >
                    <button v-if="modelQuery" type="button" class="clear-btn" @click="selectModel('')">✕</button>
                  </div>
                  <ul v-show="isModelDropdownOpen" class="autocomplete-list shadow-dropdown">
                    <li v-if="!newCarForm.brand" class="empty-item">Сначала выберите марку</li>
                    <li v-else-if="filteredModels.length === 0" class="empty-item">Модель не найдена</li>
                    <li 
                      v-for="model in filteredModels" 
                      :key="model" 
                      @click="selectModel(model)"
                    >
                      {{ model }}
                    </li>
                  </ul>
                </div>
              </div>

              <div class="form-group">
                <label>Гос. номер</label>
                <input v-model="newCarForm.number"
                @input="onCarNumberInput"
                type="text"
                maxlength="9">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <button type="button" class="btn-save-car" @click="saveNewCar">Сохранить и выбрать</button>
              </div>
            </div>

            <div v-else class="custom-select-wrapper">
              <div 
                class="selected-car-card" 
                :class="{ 'dropdown-open': isCarDropdownOpen }"
                @click="isCarDropdownOpen = !isCarDropdownOpen"
              >
                <div class="car-info-center">
                  <span class="car-title">{{ selectedCarDetails?.brand }} {{ selectedCarDetails?.model }}</span>
                  <span v-if="selectedCarDetails?.number" class="car-plate">{{ selectedCarDetails.number }}</span>
                </div>
                <div class="more-icon">
                  <span></span><span></span><span></span>
                </div>
              </div>

              <div v-if="isCarDropdownOpen" class="car-dropdown animate-slide-down">
                <div 
                  v-for="car in userCars" 
                  :key="car.id" 
                  class="dropdown-item"
                  :class="{ active: selectedCarId === car.id }"
                  @click="selectCar(car.id)"
                >
                  <div class="car-info-center">
                    <span class="car-title">{{ car.brand }} {{ car.model }}</span>
                    <span v-if="car.number" class="car-plate">{{ car.number }}</span>
                  </div>
                </div>

                <div class="dropdown-item add-action" @click="isAddingNewCar = true; isCarDropdownOpen = false">
                  <span>+ Добавить автомобиль</span>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group" style="margin-top: 25px;">
            <label>Комментарий к записи</label>
            <textarea v-model="form.client_comment" rows="3" placeholder="Опишите проблему подробнее..."></textarea>
          </div>

          <button type="submit" class="submit-btn" :disabled="submitting || !selectedSlot || (!selectedCarId && !isAddingNewCar)">
            {{ submitting ? 'Оформление...' : (selectedSlot ? `Подтвердить запись на ${selectedDateTimeFormatted}` : 'Выберите время') }}
          </button>
        </form>
      </div>

      <div class="service-summary">
        <h3>Детали услуги</h3>
        <div class="summary-item"><span>Услуга</span><strong>{{ selectedService.name }}</strong></div>
        <div class="summary-item"><span>Филиал</span><strong>{{ selectedService.branch_name || 'Не указан' }}</strong></div>
        <div class="summary-item"><span>Стоимость</span><strong>от {{ selectedService.price }} ₽</strong></div>
        <div class="summary-item"><span>Длительность</span><strong>~{{ selectedService.duration_minutes }} мин</strong></div>
      </div>

    </div>

    <!-- МОДАЛЬНОЕ ОКНО УСПЕШНОЙ ЗАПИСИ -->
    <div v-if="showSuccessModal" class="modal-overlay" @click="closeSuccessModal">
      <div class="modal-content" @click.stop>
        <h3 class="modal-title">Вы успешно записаны!</h3>
        <p class="modal-text">Мы ждем вас <strong>{{ selectedDateTimeFormatted }}</strong> на услугу "{{ selectedService?.name }}".</p>
        <button class="modal-btn" @click="closeSuccessModal">Отлично, перейти к записям</button>
      </div>
    </div>

    <!-- Модальное окно ошибки -->
    <div v-if="showErrorModal" class="modal-overlay" @click.self="closeErrorModal">
      <div class="modal-content error-modal">
        <h3>Ошибка</h3>
        <p>{{ errorMessage }}</p>
        <button @click="closeErrorModal" class="btn-primary">Понятно</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ОСНОВНОЙ КОНТЕЙНЕР */
.booking-container { 
  max-width: 1200px; 
  margin: 0 auto; 
  padding: 30px 20px; 
  box-sizing: border-box;
}

.page-title { 
  color: var(--text-main); 
  margin-bottom: 25px; 
  font-size: 28px; 
  font-weight: 800;
  text-align: center;
}

.booking-grid { 
  display: flex; 
  flex-direction: column-reverse; 
  align-items: center;
  gap: 30px; 
  width: 100%;
}

.booking-form-wrapper {
  width: 100%;
  max-width: 650px;
}

.service-summary { 
  width: 100%;
  max-width: 650px;
}

@media (min-width: 1050px) { 
  .booking-grid { 
    display: grid;
    grid-template-columns: 1fr 650px 1fr;
    gap: 40px;
    align-items: flex-start;
  } 
  
  .booking-form-wrapper { 
    grid-column: 2; 
    max-width: 100%;
  } 

  .service-summary { 
    grid-column: 3; 
    position: sticky; 
    top: 100px; 
    max-width: 320px;
    margin-top: 90px; 
  } 
}

.booking-form { 
  background: var(--bg-white); 
  padding: 25px; 
  border-radius: 16px; 
  border: 1px solid var(--border-color); 
  box-shadow: 0 4px 20px rgba(0,0,0,0.02); 
  width: 100%;
  box-sizing: border-box;
}

@media (min-width: 600px) {
  .booking-form { padding: 35px; }
}

h3 { margin-top: 0; margin-bottom: 20px; color: var(--text-main); font-size: 20px; font-weight: 700;}

.dates-container { 
  display: flex;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin-bottom: 20px;
}

.date-item { 
  flex: 1;
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  height: 75px; 
  border-radius: 12px; 
  cursor: pointer; 
  background: var(--bg-body); 
  border: 2px solid transparent; 
  transition: all 0.2s ease; 
}
.date-item:hover { border-color: var(--primary-light); background: var(--bg-white); box-shadow: 0 4px 10px rgba(0,0,0,0.05);}
.date-item.active { background: var(--primary); border-color: var(--primary); color: white; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(16, 185, 129, 0.25);}

.day-of-week { font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase; }
.day-of-week.weekend { color: #ef4444; }
.date-item.active .day-of-week, .date-item.active .day-number { color: white; }
.day-number { font-size: 20px; font-weight: 800; color: var(--text-main); }

/* Кнопка календаря */
.calendar-btn { background: var(--bg-white); border: 2px dashed var(--border-color); position: relative; overflow: hidden; }
.calendar-btn:hover { border-color: var(--primary); border-style: solid; }
.calendar-icon { font-size: 18px; margin-bottom: 2px; }
.hidden-native-date { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

.slots-container { background: var(--bg-body); padding: 15px; border-radius: 12px; }
@media (min-width: 600px) { .slots-container { padding: 20px; } }

.slots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(75px, 1fr)); gap: 10px; }
.slot-item { padding: 12px 5px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 15px; font-weight: 600; color: var(--text-main); cursor: pointer; transition: 0.2s; background: var(--bg-white); text-align: center;}
.slot-item:hover { border-color: var(--primary); color: var(--primary); }
.slot-item.active { background: var(--primary); color: white; border-color: var(--primary); box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);}

.form-group { margin-bottom: 18px; width: 100%; }
.form-row { display: flex; flex-direction: column; gap: 15px; } 
@media (min-width: 500px) { .form-row { flex-direction: row; } } 

label { display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;}
input, textarea { width: 100%; box-sizing: border-box; padding: 14px 16px; border: 1px solid var(--border-color); border-radius: 10px; font-family: inherit; font-size: 15px; background: var(--bg-body); transition: 0.2s; color: var(--text-main);}
input:focus, textarea:focus { outline: none; border-color: var(--primary); background: var(--bg-white); box-shadow: 0 0 0 4px var(--primary-light); }
input::placeholder, textarea::placeholder { color: #9ca3af; }

.autocomplete-group { position: relative; width: 100%; }
.input-wrapper { position: relative; display: flex; align-items: center; width: 100%;}
.input-wrapper input { padding-right: 35px; width: 100%;}
.input-wrapper input:disabled { background-color: #f3f4f6; cursor: not-allowed; opacity: 0.7;}
.clear-btn { position: absolute; right: 10px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 5px; }
.clear-btn:hover { color: var(--text-main); }
.autocomplete-list { position: absolute; top: 100%; left: 0; width: 100%; max-height: 200px; overflow-y: auto; background: var(--bg-white); border: 1px solid var(--border-color); border-radius: 8px; margin-top: 5px; padding: 5px 0; list-style: none; z-index: 100; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
.autocomplete-list::-webkit-scrollbar { width: 6px; }
.autocomplete-list::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 8px; }
.autocomplete-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
.autocomplete-list li { padding: 12px 16px; cursor: pointer; color: var(--text-main); transition: 0.2s; font-size: 14px; }
.autocomplete-list li:hover { background: var(--primary-light); color: var(--primary); }
.empty-item { color: var(--text-muted) !important; cursor: default !important; background: transparent !important; }

.submit-btn { width: 100%; padding: 18px; background: var(--primary); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 25px; transition: 0.2s; }
.submit-btn:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 6px 15px rgba(16, 185, 129, 0.25);}
.submit-btn:disabled { background: #a7f3d0; cursor: not-allowed; }

.service-summary { background: var(--primary-light); padding: 25px; border-radius: 16px; border: 1px solid #d1fae5; width: 100%; box-sizing: border-box;}
.service-summary h3 { font-size: 18px; border-bottom: 1px solid #a7f3d0; padding-bottom: 15px; margin-bottom: 20px; color: var(--primary-hover); }
.summary-item { display: flex; flex-direction: column; margin-bottom: 15px; }
.summary-item span { color: var(--primary-hover); font-size: 12px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;}
.summary-item strong { color: var(--text-main); font-size: 16px; line-height: 1.4;}

/* АВТОМОБИЛЬ */
.car-selector-section { margin-top: 30px; position: relative; width: 100%;}
.selected-car-card { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: var(--bg-white); border: 2px solid var(--border-color); border-radius: 12px; cursor: pointer; transition: 0.2s; }
.selected-car-card:hover, .selected-car-card.dropdown-open { border-color: var(--primary); background: var(--primary-light); }
.car-info-center { display: flex; flex-direction: column; align-items: flex-start; width: 100%; }
.car-title { font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 4px; }
.car-plate { font-size: 13px; color: var(--text-muted); border: 1px solid var(--border-color); padding: 2px 8px; border-radius: 4px; background: var(--bg-white);}
.car-dropdown { position: absolute; top: calc(100% + 5px); left: 0; width: 100%; background: var(--bg-white); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 10; overflow: hidden; }
.dropdown-item { padding: 16px; cursor: pointer; border-bottom: 1px solid var(--bg-body); transition: 0.2s; }
.dropdown-item:hover, .dropdown-item.active { background: var(--primary-light); }
.dropdown-item.add-action { text-align: center; color: var(--primary); font-weight: 600; }
.add-car-box { background: var(--bg-white); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; width: 100%; box-sizing: border-box;}
.btn-save-car { width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }

/* Иконка многоточия справа */
.more-icon { display: flex; gap: 3px; position: absolute; right: 20px; top: 50%; transform: translateY(-50%); }
.more-icon span { display: block; width: 6px; height: 6px; background-color: var(--text-muted); border-radius: 50%; transition: background-color 0.2s; }
.selected-car-card:hover .more-icon span, .selected-car-card.dropdown-open .more-icon span { background-color: var(--primary); }

/* Анимации */
.animate-slide-down { animation: slideDown 0.2s ease-out; transform-origin: top center; }
@keyframes slideDown { from { opacity: 0; transform: scaleY(0.95); } to { opacity: 1; transform: scaleY(1); } }
.animate-fade { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.box-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.box-header h4 { margin: 0; color: var(--text-main); font-size: 16px; }
.btn-close-form { background: none; border: none; color: #ef4444; cursor: pointer; font-weight: 600; font-size: 13px; padding: 0;}
.btn-close-form:hover { text-decoration: underline; }

/* МОДАЛЬНЫЕ ОКНА */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); animation: fadeIn 0.3s ease; padding: 20px; box-sizing: border-box;}
.modal-content { background: var(--bg-white); padding: 35px 30px; border-radius: 20px; text-align: center; max-width: 400px; width: 100%; box-sizing: border-box; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15); animation: slideUp 0.3s ease-out; }
.modal-title { margin-top: 0; margin-bottom: 10px; font-size: 22px; font-weight: 800; color: var(--text-main); }
.modal-text { color: var(--text-muted); font-size: 15px; line-height: 1.5; margin-bottom: 25px; }
.modal-text strong { color: var(--text-main); }
.modal-btn { width: 100%; padding: 15px; background: var(--primary); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; transition: 0.2s; }
.modal-btn:hover { background: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 6px 15px rgba(16, 185, 129, 0.25); }

.error-modal h3 { color: #d32f2f; margin-bottom: 10px; }
.error-modal p { color: #555; margin-bottom: 20px; line-height: 1.4; }
.btn-primary { background: #2c3e50; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.3s; }
.btn-primary:hover { background: #1a252f; }

@keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
</style>