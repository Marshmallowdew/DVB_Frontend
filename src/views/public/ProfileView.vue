<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authApi, carsApi, ordersApi } from '@/api/services'
import { carsDatabase } from '@/utils/carsData'

const authStore = useAuthStore()

// --- 1. ФОРМА ПРОФИЛЯ ---
const form = ref({
  first_name: '',
  last_name: '',
  phone_number: ''
})
const profileLoading = ref(false)
const profileMessage = ref('')
const profileIsError = ref(false)

// --- 2. ЛОГИКА АВТОМОБИЛЕЙ ---
const cars = ref([])
const showCarForm = ref(false)
const editingCarId = ref(null) 
const newCar = ref({
  brand: '',
  model: '',
  number: '',
  vin_number: ''
})

const brandQuery = ref('')
const modelQuery = ref('')
const isBrandDropdownOpen = ref(false)
const isModelDropdownOpen = ref(false)
const autocompleteRef = ref(null)

const filteredBrands = computed(() => {
  const query = brandQuery.value.trim().toLowerCase()
  const allBrands = Object.keys(carsDatabase)
  if (!query) return allBrands
  
  return allBrands.filter(brand => brand.toLowerCase().includes(query))
})

const filteredModels = computed(() => {
  const currentBrandInput = newCar.value.brand.trim().toLowerCase()
  
  const originalBrandKey = Object.keys(carsDatabase).find(
    b => b.toLowerCase() === currentBrandInput
  )
  
  const models = originalBrandKey ? carsDatabase[originalBrandKey] : []
  
  const query = modelQuery.value.trim().toLowerCase()
  if (!query) return models
  
  return models.filter(model => model.toLowerCase().includes(query))
})

const handlePhoneInput = (e) => {
  let val = e.target.value.replace(/[^\d+]/g, '')
  
  if (!val) {
    form.value.phone_number = ''
    return
  }

  val = val.replace(/(?!^\+)\+/g, '')

  if (!val.startsWith('+')) {
    val = '+' + val
  }

  form.value.phone_number = val
  e.target.value = val
}

const selectBrand = (brand) => {
  newCar.value.brand = brand
  brandQuery.value = brand
  newCar.value.model = ''
  modelQuery.value = ''
  isBrandDropdownOpen.value = false
}

const selectModel = (model) => {
  newCar.value.model = model
  modelQuery.value = model
  isModelDropdownOpen.value = false
}

// Слежение за ручным вводом
watch(brandQuery, (newVal) => {
  newCar.value.brand = newVal.trim()
  newCar.value.model = ''
  modelQuery.value = ''
})

watch(modelQuery, (newVal) => {
  newCar.value.model = newVal.trim()
})

const closeDropdowns = (e) => {
  if (autocompleteRef.value && !autocompleteRef.value.contains(e.target)) {
    isBrandDropdownOpen.value = false
    isModelDropdownOpen.value = false
  }
}

// --- 3. ФОРМА ПРИВЯЗКИ ЗАКАЗОВ ---
const linkPhone = ref('')
const linkPin = ref('')
const linkLoading = ref(false)
const linkMessage = ref('')
const linkIsError = ref(false)
const showLinkForm = ref(false) 

const loadCars = async () => {
  try {
    const response = await carsApi.getUserCars()
    cars.value = response.data.results || response.data 
  } catch (error) {
    console.error('Ошибка загрузки авто:', error)
  }
}

onMounted(() => {
  document.addEventListener('click', closeDropdowns)
  if (authStore.user) {
    loadCars()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeDropdowns)
})

const submitProfile = async () => {
  profileLoading.value = true
  profileMessage.value = ''
  
  const payload = {}
  if (form.value.first_name) payload.first_name = form.value.first_name
  if (form.value.last_name) payload.last_name = form.value.last_name
  if (form.value.phone_number && form.value.phone_number !== authStore.user.phone_number) {
    payload.phone_number = form.value.phone_number
  }
  
  if (Object.keys(payload).length === 0) {
    profileIsError.value = false
    profileMessage.value = 'Нет изменений для сохранения'
    profileLoading.value = false
    return
  }

  try {
    await authApi.updateProfile(payload)
    await authStore.fetchProfile() 
    profileIsError.value = false
    profileMessage.value = 'Профиль успешно обновлен!'
    form.value.first_name = ''
    form.value.last_name = ''
    form.value.phone_number = ''
  } catch (err) {
    profileIsError.value = true
    profileMessage.value = err.response?.data?.phone_number?.[0] || 'Ошибка при сохранении'
  } finally {
    profileLoading.value = false
  }
}

const openCarFormForAdd = () => {
  editingCarId.value = null
  newCar.value = { brand: '', model: '', number: '', vin_number: '' }
  brandQuery.value = ''
  modelQuery.value = ''
  showCarForm.value = true
}

const editCar = (car) => {
  editingCarId.value = car.id
  newCar.value = { 
    brand: car.brand, model: car.model, 
    number: car.number || '', vin_number: car.vin_number || '' 
  }
  brandQuery.value = car.brand
  modelQuery.value = car.model
  showCarForm.value = true
  
  setTimeout(() => {
    document.querySelector('.add-car-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 100)
}

const cancelCarForm = () => {
  showCarForm.value = false
  editingCarId.value = null
  newCar.value = { brand: '', model: '', number: '', vin_number: '' }
  brandQuery.value = ''
  modelQuery.value = ''
}

const saveCar = async () => {
  if (!newCar.value.brand || !newCar.value.model) {
    alert('Заполните марку и модель автомобиля')
    return
  }
  try {
    if (editingCarId.value) {
      const response = await carsApi.updateCar(editingCarId.value, newCar.value)
      const index = cars.value.findIndex(c => c.id === editingCarId.value)
      if (index !== -1) cars.value[index] = response.data
    } else {
      const response = await carsApi.addCar(newCar.value)
      cars.value.push(response.data)
    }
    cancelCarForm()
  } catch (error) {
    console.error('Ошибка сохранения авто:', error)
    alert('Не удалось сохранить автомобиль на сервере')
  }
}

const removeCar = async (id) => {
  if (!confirm('Удалить этот автомобиль?')) return
  try {
    await carsApi.deleteCar(id)
    cars.value = cars.value.filter(car => car.id !== id)
    if (editingCarId.value === id) cancelCarForm()
  } catch (error) {
    console.error('Ошибка удаления авто:', error)
    alert('Не удалось удалить автомобиль')
  }
}

// Отправка формы привязки заказов
const linkOrders = async () => {
  if (!linkPhone.value || !linkPin.value) {
    linkIsError.value = true
    linkMessage.value = 'Заполните оба поля'
    return
  }

  linkLoading.value = true
  linkMessage.value = ''
  
  try {
    const res = await ordersApi.linkAccount({
      phone_number: linkPhone.value,
      pin_code: linkPin.value
    })
    
    linkIsError.value = false
    linkMessage.value = res.data.message || 'Заказы успешно привязаны!'
    
    linkPhone.value = ''
    linkPin.value = ''
    
    await loadCars()
    await authStore.fetchProfile()
    
    setTimeout(() => {
      showLinkForm.value = false
      linkMessage.value = ''
    }, 3000)

  } catch (err) {
    linkIsError.value = true
    linkMessage.value = err.response?.data?.error || 'Ошибка при привязке заказов'
  } finally {
    linkLoading.value = false
  }
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

  newCar.value.number = result 
  event.target.value = result
}
</script>

<template>
  <div class="profile-container">
    <h2>Настройки профиля</h2>

    <div v-if="profileMessage" class="alert" :class="{ error: profileIsError, success: !profileIsError }">
      {{ profileMessage }}
    </div>

    <!-- 1. ФОРМА ПРОФИЛЯ -->
    <form @submit.prevent="submitProfile" class="profile-form">
      <h4>Контактная информация</h4>
      
      <div class="form-group">
        <Label>Email (Логин)</label>
        <input 
          type="text" 
          :value="authStore.user?.email" 
          readonly 
          class="readonly-input"
          title="Email нельзя изменить, он используется для входа"
        >
      </div>

      <div class="form-group">
        <Label>Имя</label>
        <input 
          v-model="form.first_name" 
          type="text" 
          :placeholder="authStore.user?.first_name || 'Не указано'"
        >
      </div>
      
      <div class="form-group">
        <Label>Фамилия</label>
        <input 
          v-model="form.last_name" 
          type="text" 
          :placeholder="authStore.user?.last_name || 'Не указано'"
        >
      </div>
      
      <div class="form-group">
        <Label>Номер телефона</label>
         <input 
          :value="form.phone_number" 
          @input="handlePhoneInput" 
          type="tel" 
          :placeholder="authStore.user?.phone_number ? '+' + authStore.user.phone_number.replace(/^\+/, '') : 'Введите номер телефона'"
        >
      </div>

      <button 
        type="submit" 
        class="submit-btn" 
        :disabled="profileLoading || (!form.first_name && !form.last_name && !form.phone_number)"
      >
        {{ profileLoading ? 'Сохранение...' : 'Сохранить изменения' }}
      </button>
    </form>

    <!-- 2. РАЗДЕЛ АВТОМОБИЛЕЙ -->
    <div class="cars-section">
      <h4>Мои автомобили</h4>
      
      <div v-if="cars.length > 0" class="cars-list">
        <div v-for="car in cars" :key="car.id" class="car-card" :class="{ 'editing-card': editingCarId === car.id }">
          <div class="car-info">
            <strong>{{ car.brand }} {{ car.model }}</strong>
            <div class="car-details">
              <span v-if="car.number" class="car-tag number-plate">{{ car.number }}</span>
              <span v-if="car.vin_number" class="car-tag">VIN: {{ car.vin_number }}</span>
            </div>
          </div>
          <div class="car-actions">
            <!-- КНОПКА РЕДАКТИРОВАНИЯ -->
            <button type="button" class="btn-action btn-edit" @click="editCar(car)" title="Редактировать">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <!-- КНОПКА УДАЛЕНИЯ -->
            <button type="button" class="btn-action btn-delete" @click="removeCar(car.id)" title="Удалить">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <p>У вас пока нет добавленных автомобилей.</p>
      </div>

      <!-- КНОПКА ДОБАВЛЕНИЯ НОВОГО АВТО -->
      <button v-if="!showCarForm" type="button" class="add-car-btn" @click="openCarFormForAdd">
        + Добавить автомобиль
      </button>

      <!-- ФОРМА АВТОМОБИЛЯ С АВТОКОМПЛИТОМ -->
      <div v-if="showCarForm" class="add-car-form animate-fade" ref="autocompleteRef">
        <div class="form-header">
          <h5>{{ editingCarId ? 'Редактирование автомобиля' : 'Новый автомобиль' }}</h5>
          <button type="button" class="close-form-btn" @click="cancelCarForm">✕</button>
        </div>
        
        <div class="form-row">
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
              <li v-if="filteredBrands.length === 0 && brandQuery" class="empty-item">Нажмите Сохранить, чтобы использовать введенную марку</li>
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
                :disabled="!newCar.brand" 
                :title="!newCar.brand ? 'Сначала выберите марку' : ''"
              >
              <button v-if="modelQuery" type="button" class="clear-btn" @click="selectModel('')">✕</button>
            </div>
            <ul v-show="isModelDropdownOpen" class="autocomplete-list shadow-dropdown">
              <li v-if="!newCar.brand" class="empty-item">Сначала выберите марку</li>
              <li v-else-if="filteredModels.length === 0 && modelQuery" class="empty-item">Нажмите Сохранить, чтобы использовать введенную модель</li>
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
          <Label>Гос. номер (опционально)</label>
          <input 
            v-model="newCar.number" 
            @input="onCarNumberInput"
            type="text" 
            maxlength="9"
          >
        </div>

        <div class="form-group">
          <Label>VIN-номер (опционально)</label>
          <input v-model="newCar.vin_number" type="text" placeholder="Укажите VIN-код">
        </div>
        
        <div class="form-actions">
          <button type="button" class="submit-btn" @click="saveCar">
            {{ editingCarId ? 'Сохранить изменения' : 'Сохранить автомобиль' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 3. РАЗДЕЛ ПРИВЯЗКИ СТАРЫХ ЗАКАЗОВ -->
    <div class="link-orders-section">
      <div class="link-header" @click="showLinkForm = !showLinkForm">
        <div class="link-title-group">
          <h4>Привязать старые заказы</h4>
          <span class="badge-new">NEW</span>
        </div>
        <span class="toggle-icon">{{ showLinkForm ? '▲' : '▼' }}</span>
      </div>
      
      <div v-if="showLinkForm" class="link-orders-form animate-fade">
        <p class="help-text">
          Если вы оформляли заказы по телефону или в сервисе, вы можете привязать их к этому аккаунту с помощью PIN-кода с заказ-наряда.
        </p>

        <div v-if="linkMessage" class="alert small-alert" :class="{ error: linkIsError, success: !linkIsError }">
          {{ linkMessage }}
        </div>

        <div class="form-row">
          <div class="form-group">
            <Label>Номер телефона (указанный в заказе)</label>
            <input 
              v-model="linkPhone" 
              type="tel" 
              placeholder="+7 (___) ___-__-__"
            >
          </div>
          
          <div class="form-group">
            <Label>PIN-код с чека</label>
            <input 
              v-model="linkPin" 
              type="text" 
              placeholder="6-значный код"
              maxlength="6"
            >
          </div>
        </div>

        <button 
          type="button" 
          class="link-btn" 
          @click="linkOrders"
          :disabled="linkLoading || !linkPhone || !linkPin"
        >
          {{ linkLoading ? 'Проверка...' : 'Привязать заказы' }}
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.profile-container { max-width: 600px; margin: 0 auto; padding: 40px 20px; color: var(--text-main); }
h2 { margin-bottom: 30px; font-weight: 800; font-size: 24px;}
h4 { margin-top: 0; margin-bottom: 20px; font-size: 18px; color: var(--primary-hover); border-bottom: 1px solid var(--border-color); padding-bottom: 10px;}

.alert { padding: 15px 20px; border-radius: 8px; margin-bottom: 25px; font-weight: 600;}
.alert.error { background-color: #fee2e2; color: #b91c1c; border: 1px solid #f87171;}
.alert.success { background-color: #d1fae5; color: #047857; border: 1px solid #34d399;}
.small-alert { padding: 10px 15px; font-size: 14px; margin-bottom: 15px; }

.profile-form, .cars-section, .link-orders-section { 
  background: var(--bg-white); 
  padding: 30px; 
  border-radius: 16px; 
  border: 1px solid var(--border-color); 
  box-shadow: 0 4px 15px rgba(0,0,0,0.02);
  margin-bottom: 30px;
}

.form-group { margin-bottom: 20px; width: 100%;}
.form-row { display: flex; flex-direction: column; gap: 15px; } 
@media (min-width: 500px) { .form-row { flex-direction: row; } } 

label { display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;}
input { width: 100%; padding: 12px 16px; border: 1px solid var(--border-color); border-radius: 10px; font-family: inherit; font-size: 15px; background: var(--bg-body); transition: 0.2s; color: var(--text-main); box-sizing: border-box;}
input:focus { outline: none; border-color: var(--primary); background: var(--bg-white); box-shadow: 0 0 0 3px var(--primary-light); }
input.readonly-input { background: #f3f4f6; color: #6b7280; cursor: not-allowed; border-color: #e5e7eb;}
input.readonly-input:focus { box-shadow: none; border-color: #e5e7eb; }

/* AUTOCOMPLETE СТИЛИ */
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


.submit-btn { width: 100%; padding: 14px; background: var(--primary); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: 0.2s; margin-top: 10px;}
.submit-btn:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);}
.submit-btn:disabled { background: #a7f3d0; cursor: not-allowed; }

/* МАШИНЫ */
.cars-list { display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;}
.car-card { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 12px; transition: 0.2s;}
.car-card:hover { border-color: #cbd5e1; }
.car-card.editing-card { border-color: var(--primary); background: var(--primary-light); }
.car-info strong { display: block; font-size: 16px; margin-bottom: 6px; }
.car-details { display: flex; gap: 10px; flex-wrap: wrap; }
.car-tag { font-size: 12px; color: var(--text-muted); background: var(--bg-white); padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border-color);}
.number-plate { border: 1px solid var(--text-muted); color: var(--text-main); font-weight: 600; letter-spacing: 1px;}
.car-actions { display: flex; gap: 8px; }
.btn-action { background: var(--bg-white); border: 1px solid var(--border-color); padding: 8px; border-radius: 8px; cursor: pointer; color: var(--text-muted); transition: 0.2s; display: flex; align-items: center; justify-content: center;}
.btn-edit:hover { border-color: var(--primary); color: var(--primary); }
.btn-delete:hover { border-color: #ef4444; color: #ef4444; }

.empty-state { text-align: center; padding: 20px; color: var(--text-muted); font-size: 15px; background: var(--bg-body); border-radius: 12px; margin-bottom: 20px;}

.add-car-btn { width: 100%; padding: 14px; background: transparent; color: var(--primary); border: 2px dashed #a7f3d0; border-radius: 10px; font-weight: 600; cursor: pointer; transition: 0.2s;}
.add-car-btn:hover { background: var(--primary-light); border-color: var(--primary); }

.add-car-form { background: var(--primary-light); padding: 20px; border-radius: 12px; border: 1px solid #d1fae5; }
.form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.form-header h5 { margin: 0; font-size: 16px; color: var(--primary-hover); }
.close-form-btn { background: none; border: none; color: var(--text-muted); font-size: 16px; cursor: pointer; }
.close-form-btn:hover { color: #ef4444; }

/* ПРИВЯЗКА ЗАКАЗОВ */
.link-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.link-title-group { display: flex; align-items: center; gap: 10px; }
.link-title-group h4 { margin: 0; border: none; padding: 0; color: var(--text-main);}
.badge-new { background: var(--primary); color: white; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.5px;}
.toggle-icon { color: var(--text-muted); font-size: 12px; }

.link-orders-form { margin-top: 20px; padding-top: 20px; border-top: 1px dashed var(--border-color); }
.help-text { font-size: 14px; color: var(--text-muted); line-height: 1.5; margin-bottom: 20px; }
.link-btn { width: 100%; padding: 14px; background: var(--text-main); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: 0.2s; }
.link-btn:hover:not(:disabled) { background: #1f2937; }
.link-btn:disabled { background: #9ca3af; cursor: not-allowed; }

.animate-fade { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>