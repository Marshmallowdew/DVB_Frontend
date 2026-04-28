<script setup>
import { ref, onMounted } from 'vue'
import { branchesApi, departmentsApi } from '@/api/services'
import Modal from '@/components/Modal.vue'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'

const emit = defineEmits(['branch-updated'])

const loading = ref(true)
const branchesList = ref([])

const modals = ref({ branch: false })

const isEditing = ref(false)
const currentEditId = ref(null)
const existingDepartments = ref([])

const branchForm = ref({ 
  name: '', 
  address: '', 
  phone1: '',
  phone2: '',
  opening_time: '09:00',
  closing_time: '20:00',
  selectedCategories: [] 
})

const baseCategories = [
  { name: 'ТО', icon: 'maintenance' }, 
  { name: 'Шиномонтаж', icon: 'tires' },
  { name: 'Ремонт', icon: 'repair' }, 
  { name: 'Кузовной ремонт', icon: 'body_repair' },
  { name: 'Мойка', icon: 'wash' }, 
  { name: 'Детейлинг', icon: 'detailing' },
  { name: 'Диагностика', icon: 'diagnostic' },
  { name: 'Дополнительно', icon: 'additional' }
]

const { isDeleteModalOpen, deleteConfig, confirmDelete, closeDeleteModal, executeDelete } = useDeleteConfirm()

const fetchBranches = async () => {
  loading.value = true
  try {
    const response = await branchesApi.getAll()
    branchesList.value = response.data
    emit('branch-updated') 
  } catch (error) {
    console.error('Ошибка загрузки филиалов:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchBranches()
})

const handleCreateBranch = () => {
  isEditing.value = false
  currentEditId.value = null
  existingDepartments.value = []
  branchForm.value = { 
    name: '', 
    address: '', 
    phone1: '', 
    phone2: '', 
    opening_time: '09:00',
    closing_time: '20:00', 
    selectedCategories: [] 
  }
  modals.value.branch = true
}

const formatTimeForInput = (timeStr) => {
  if (!timeStr) return '09:00'
  return timeStr.substring(0, 5)
}

const handleEditBranch = async (branch) => {
  isEditing.value = true
  currentEditId.value = branch.id
  
  branchForm.value = { 
    name: branch.name, 
    address: branch.address, 
    phone1: branch.phone_number || '', 
    phone2: branch.phone_number_2 || '', 
    opening_time: formatTimeForInput(branch.opening_time),
    closing_time: formatTimeForInput(branch.closing_time),
    selectedCategories: []
  }
  
  // Загружаем уже существующие отделы для филиала
  try {
    const response = await departmentsApi.getByBranch(branch.id)
    // Сохраняем массив имен существующих отделов
    existingDepartments.value = response.data.map(d => d.name)
    
    // Автоматически ставим галочки на существующих отделах
    branchForm.value.selectedCategories = baseCategories.filter(cat => 
      existingDepartments.value.includes(cat.name)
    )
  } catch (e) {
    existingDepartments.value = []
  }
  
  modals.value.branch = true
}

const formatPhone = (phoneStr) => {
  if (!phoneStr) return ''
  let cleaned = phoneStr.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('8')) {
    cleaned = '7' + cleaned.slice(1)
  } else if (cleaned.length === 10) {
    cleaned = '7' + cleaned
  }
  return '+' + cleaned
}

const submitBranch = async () => {
  if (!branchForm.value.name || !branchForm.value.address || !branchForm.value.phone1) {
    return alert('Заполните название, адрес и хотя бы один номер телефона!')
  }

  if (!branchForm.value.opening_time || !branchForm.value.closing_time) {
    return alert('Укажите время работы филиала!')
  }

  // Форматируем номера
  const formattedPhone1 = formatPhone(branchForm.value.phone1)
  if (formattedPhone1.length !== 12) {
    return alert('Первый номер телефона введен некорректно')
  }

  let formattedPhone2 = ''
  if (branchForm.value.phone2) {
    formattedPhone2 = formatPhone(branchForm.value.phone2)
    if (formattedPhone2.length !== 12) {
      return alert('Второй номер телефона введен некорректно')
    }
  }

  try {
    const payload = {
      name: branchForm.value.name,
      address: branchForm.value.address,
      phone_number: formattedPhone1,
      phone_number_2: formattedPhone2 || null, 
      opening_time: branchForm.value.opening_time,
      closing_time: branchForm.value.closing_time
    }

    if (isEditing.value) {
      await branchesApi.updateBranch(currentEditId.value, payload)

      // Фильтруем категории: оставляем только те, которых еще нет в existingDepartments
      const newCategories = branchForm.value.selectedCategories.filter(
        cat => !existingDepartments.value.includes(cat.name)
      )
      
      // Создаем новые отделы
      if (newCategories.length > 0) {
        const promises = newCategories.map(cat =>
          departmentsApi.createDepartment({ name: cat.name, icon: cat.icon, branch: currentEditId.value })
        )
        await Promise.all(promises)
      }

      alert('Филиал успешно обновлен!')
    } else {
      const response = await branchesApi.createBranch(payload)
      const newBranchId = response.data.id

      if (branchForm.value.selectedCategories.length > 0) {
        const promises = branchForm.value.selectedCategories.map(cat => {
          return departmentsApi.createDepartment({ name: cat.name, icon: cat.icon, branch: newBranchId })
        })
        await Promise.all(promises)
      }
      alert('Филиал успешно создан!')
    }

    branchForm.value = { name: '', address: '', phone1: '', phone2: '', opening_time: '09:00', closing_time: '20:00', selectedCategories: [] }
    fetchBranches()
    modals.value.branch = false
  } catch (error) { 
    console.error(error)
    alert(isEditing.value ? 'Ошибка обновления' : 'Ошибка создания') 
  }
}

const handleDeleteBranch = (id) => {
  confirmDelete(
    id, 
    'Вы уверены, что хотите удалить этот филиал? Внимание: это также удалит все отделы, услуги, механиков и заказы, связанные с этим филиалом! Действие необратимо.', 
    async (targetId) => {
      await branchesApi.deleteBranch(targetId)
      await fetchBranches()
    }
  )
}
</script>

<template>
  <div>
    <!-- Кнопка создания -->
    <button @click="handleCreateBranch" class="btn-create" style="margin-bottom: 20px;">
      + Добавить филиал
    </button>

    <!-- Таблица -->
    <div v-if="loading">Загрузка...</div>
    <div v-else class="table-responsive">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Город</th>
            <th>Адрес</th>
            <th>Режим работы</th>
            <th>Контакты</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="branch in branchesList" :key="branch.id">
            <td><strong>{{ branch.name }}</strong></td>
            <td>{{ branch.address }}</td>
            <td>
              <span class="badge-time">
                {{ formatTimeForInput(branch.opening_time) }} - {{ formatTimeForInput(branch.closing_time) }}
              </span>
            </td>
            <td>
              <div>{{ branch.phone_number }}</div>
              <div v-if="branch.phone_number_2" style="color: #666; font-size: 0.9em;">
                {{ branch.phone_number_2 }}
              </div>
            </td>
            <td class="actions-cell">
              <button @click="handleEditBranch(branch)" class="btn-action">Изменить</button>
              <button @click="handleDeleteBranch(branch.id)" class="btn-cancel">Удалить</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Модалка создания/редактирования филиала -->
    <Modal 
      :show="modals.branch" 
      :title="isEditing ? 'Редактировать филиал' : 'Новый филиал'" 
      @close="modals.branch = false" 
      @submit="submitBranch"
    >
      <div class="form-group">
        <label>Город *</label>
        <input v-model="branchForm.name" type="text" placeholder="Город">
      </div>
      
      <div class="form-group" style="margin-top: 15px;">
        <label>Адрес *</label>
        <input v-model="branchForm.address" type="text" placeholder="Улица, дом">
      </div>

      <!-- ВРЕМЯ РАБОТЫ -->
      <div style="display: flex; gap: 15px; margin-top: 15px;">
        <div class="form-group" style="flex: 1;">
          <label>Время открытия *</label>
          <input v-model="branchForm.opening_time" type="time" required>
        </div>
        
        <div class="form-group" style="flex: 1;">
          <label>Время закрытия *</label>
          <input v-model="branchForm.closing_time" type="time" required>
        </div>
      </div>

      <div class="form-group" style="margin-top: 15px;">
        <label>Контактный телефон 1 *</label>
        <input v-model="branchForm.phone1" type="text" placeholder="+79.........">
      </div>
      
      <div class="form-group" style="margin-top: 15px;">
        <label>Контактный телефон 2 (необязательно)</label>
        <input v-model="branchForm.phone2" type="text" placeholder="Доп. номер">
      </div>

      <!-- Чекбоксы для отделов (Отображаются всегда) -->
      <div class="form-group" style="margin-top: 20px;">
        <label>Отделы</label>
        <p class="helper-text">
          <template v-if="isEditing">Отмеченные галочкой отделы уже есть в этом филиале. Вы можете добавить новые.</template>
          <template v-else>Выберите отделы, которые будут автоматически созданы для этого филиала.</template>
        </p>
        <div class="categories-grid">
          <div v-for="(cat, index) in baseCategories" :key="index" class="checkbox-wrapper">
            <input 
              type="checkbox" 
              :id="'cat-' + index" 
              :value="cat" 
              v-model="branchForm.selectedCategories"
              :disabled="isEditing && existingDepartments.includes(cat.name)"
            >
            <label 
              :for="'cat-' + index" 
              class="checkbox-label"
              :class="{ 'label-disabled': isEditing && existingDepartments.includes(cat.name) }"
            >
              {{ cat.name }}
            </label>
          </div>
        </div>
      </div>
    </Modal>

    <Modal 
      :show="isDeleteModalOpen" 
      :title="Подтверждение" 
      @close="closeDeleteModal" 
      @submit="executeDelete"
    >
      <div style="padding: 10px 0;">
        <p style="font-size: 16px; margin-bottom: 20px; color: #333;">
          {{ deleteConfig.message }}
        </p>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.btn-create { background: #42b983; color: white; border: none; padding: 12px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 15px; }
.btn-create:hover { background: #3aa876; }
.btn-action { background: #17a2b8; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 5px;}
.btn-cancel { background: transparent; border: 1px solid #dc3545; color: #dc3545; padding: 5px 10px; border-radius: 4px; cursor: pointer; }
.btn-cancel:hover { background: #dc3545; color: white; }

.table-responsive { overflow-x: auto; }
.admin-table { width: 100%; border-collapse: collapse; text-align: left; }
.admin-table th { background: #2c3e50; color: white; padding: 12px; }
.admin-table td { padding: 12px; border-bottom: 1px solid #eee; }
.actions-cell { display: flex; gap: 8px; align-items: center; }

/* Плашка со временем */
.badge-time { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: 500; font-size: 13px; color: #334155; border: 1px solid #e2e8f0; }

/* Формы */
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 14px; color: #555; }
.form-group input[type="text"],
.form-group input[type="time"] { 
  width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; 
}

/* Чекбоксы */
.helper-text { font-size: 12px; color: #777; margin-top: -3px; margin-bottom: 10px; }
.categories-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f9f9f9; padding: 15px; border-radius: 6px; border: 1px solid #eaeaea;}
.checkbox-wrapper { display: flex; align-items: center; }
.checkbox-wrapper input[type="checkbox"] { margin-right: 8px; width: 16px; height: 16px; cursor: pointer; }
.checkbox-label { font-weight: normal !important; margin-bottom: 0 !important; cursor: pointer; font-size: 14px !important; color: #333 !important;}
.label-disabled { color: #9ca3af !important; cursor: not-allowed; }
.badge-exists { font-size: 10px; color: #059669; background: #d1fae5; padding: 2px 6px; border-radius: 4px; margin-left: 6px; vertical-align: middle;}
</style>