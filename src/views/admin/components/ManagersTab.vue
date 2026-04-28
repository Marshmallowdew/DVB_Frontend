<script setup>
import { ref, onMounted, watch } from 'vue'
import { usersApi, departmentsApi } from '@/api/services'
import Modal from '@/components/Modal.vue'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'

const props = defineProps({
  branchId: { type: [Number, String], required: true }
})

const loading = ref(true)
const managersList = ref([])
const activeDepartments = ref([])
const modals = ref({ manager: false, delete: false })

// Состояния редактирования
const isEditing = ref(false)
const currentEditId = ref(null)

// Основные и опциональные поля
const newManagerPhone = ref('')
const newManagerPassword = ref('')
const newManagerFirstName = ref('')
const newManagerLastName = ref('')
const newManagerMiddleName = ref('')
const newManagerEmail = ref('')
const selectedDepartments = ref([])

const { isDeleteModalOpen, deleteConfig, confirmDelete, closeDeleteModal, executeDelete } = useDeleteConfirm()

const fetchData = async () => {
  if (!props.branchId) return
  loading.value = true
  try {
    const [manRes, depRes] = await Promise.all([
      usersApi.getManagers(props.branchId),
      departmentsApi.getByBranch(props.branchId)
    ])
    managersList.value = manRes.data
    activeDepartments.value = depRes.data
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

watch(() => props.branchId, fetchData)
onMounted(fetchData)

const resetForm = () => {
  newManagerPhone.value = ''
  newManagerEmail.value = ''
  newManagerPassword.value = ''
  newManagerFirstName.value = ''
  newManagerLastName.value = ''
  newManagerMiddleName.value = ''
  selectedDepartments.value = []
}

const handleCreateManager = () => {
  isEditing.value = false
  currentEditId.value = null
  resetForm()
  modals.value.manager = true
}

const handleEditManager = (manager) => {
  isEditing.value = true
  currentEditId.value = manager.id
  
  newManagerPhone.value = manager.phone_number || ''
  newManagerEmail.value = manager.email || ''
  newManagerPassword.value = '' 
  newManagerFirstName.value = manager.first_name || ''
  newManagerLastName.value = manager.last_name || ''
  newManagerMiddleName.value = manager.middle_name || ''
  selectedDepartments.value = manager.departments ? [...manager.departments] : []
  
  modals.value.manager = true
}

const submitManager = async () => {
  // Добавляем проверку новых обязательных полей
  if (!newManagerPhone.value || !newManagerEmail.value || !newManagerFirstName.value || !newManagerLastName.value || selectedDepartments.value.length === 0) {
    return alert('Заполните Email, Телефон, Имя, Фамилию и выберите хотя бы 1 отдел')
  }

  if (!isEditing.value && !newManagerPassword.value) {
    return alert('Заполните пароль')
  }

  let cleanedPhone = newManagerPhone.value.replace(/\D/g, '')
  
  if (cleanedPhone.length === 11 && cleanedPhone.startsWith('8')) {
    cleanedPhone = '7' + cleanedPhone.slice(1)
  } else if (cleanedPhone.length === 10) {
    cleanedPhone = '7' + cleanedPhone
  }

  const finalPhone = '+' + cleanedPhone

  if (finalPhone.length !== 12 || !finalPhone.startsWith('+7')) {
    return alert('Пожалуйста, введите корректный номер телефона (например, +79001234567 или 89001234567)')
  }

  try {
    const payload = {
      phone_number: finalPhone,
      email: newManagerEmail.value,
      first_name: newManagerFirstName.value,
      last_name: newManagerLastName.value,
      middle_name: newManagerMiddleName.value,
      branch: props.branchId,
      departments: selectedDepartments.value
    }

    if (newManagerPassword.value) {
      payload.password = newManagerPassword.value
    }

    if (isEditing.value) {
      await usersApi.updateManager(currentEditId.value, payload)
      alert('Менеджер успешно обновлен!')
    } else {
      await usersApi.createManager(payload)
      alert('Менеджер успешно создан!')
    }
    
    resetForm()
    fetchData()
    modals.value.manager = false
  } catch (error) {
    console.error(error)
    const backendMsg = error.response?.data 
      ? Object.values(error.response.data).flat().join('\n') 
      : ''
    
    alert(isEditing.value ? `Ошибка обновления менеджера\n${backendMsg}` : `Ошибка создания менеджера\n${backendMsg}`)
  }
}

const handleDeleteManager = (id) => {
  confirmDelete(
    id, 
    'Лишить этого пользователя прав менеджера филиала?', 
    async (targetId) => {
      await usersApi.deleteAdmin(targetId) 
      await fetchData()
    }
  )
}

const getDepName = (id) => {
  const dep = activeDepartments.value.find(d => Number(d.id) === Number(id))
  return dep ? dep.name : `ID: ${id}`
}
</script>

<template>
  <div>
    <button @click="handleCreateManager" class="btn-create" style="margin-bottom: 20px;">+ Добавить менеджера</button>

    <div v-if="loading">Загрузка...</div>

    <div v-else class="table-responsive">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Email</th>
            <th>Телефон</th>
            <th>Отделы</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="manager in managersList" :key="manager.id">
            <td><strong>{{ manager.last_name || '—' }} {{ manager.first_name || '' }} {{ manager.middle_name ? manager.middle_name[0] + '.' : '' }}</strong></td>
            <td>{{ manager.email || '—' }}</td>
            <td>{{ manager.phone_number }}</td>
            <td>
              <span v-if="manager.departments && manager.departments.length > 0">
                <span v-for="d in manager.departments" :key="d" class="badge">
                  {{ getDepName(d) }}
                </span>
              </span>
              <span v-else style="color: #999; font-size: 13px;">Не указаны</span>
            </td>
            <td class="actions-cell">
              <button @click="handleEditManager(manager)" class="btn-action">Изменить</button>
              <button @click="handleDeleteManager(manager.id)" class="btn-cancel">Удалить</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Модалка создания/редактирования менеджера -->
    <Modal 
      :show="modals.manager" 
      :title="isEditing ? 'Редактировать менеджера' : 'Новый менеджер'" 
      @close="modals.manager = false" 
      @submit="submitManager"
    >
      <div class="form-group">
        <label>Фамилия *</label>
        <input v-model="newManagerLastName" type="text" placeholder="Фамилия" required>
      </div>
      <div class="form-group" style="margin-top: 15px;">
        <label>Имя *</label>
        <input v-model="newManagerFirstName" type="text" placeholder="Имя" required>
      </div>
      <div class="form-group" style="margin-top: 15px;">
        <label>Отчество (опционально)</label>
        <input v-model="newManagerMiddleName" type="text" placeholder="Отчество">
      </div>
      <div class="form-group" style="margin-top: 15px;">
        <label>Email (логин) *</label>
        <input v-model="newManagerEmail" type="email" placeholder="почта@mail.ru" required>
      </div>
      <div class="form-group">
        <label>Телефон (логин) *</label>
        <input v-model="newManagerPhone" type="text" placeholder="Введите номер">
      </div>
      <div class="form-group">
        <label>Пароль *</label>
        <input 
          v-model="newManagerPassword" 
          type="password" 
          :placeholder="isEditing ? 'Оставьте пустым, чтобы не менять' : 'Пароль'"
        >
      </div>
      <div class="form-group">
        <label>Доступ к отделам *</label>
        <div v-for="dep in activeDepartments" :key="dep.id" style="margin-top: 5px;">
          <label style="font-weight: normal; cursor: pointer;">
            <input type="checkbox" :value="dep.id" v-model="selectedDepartments" style="width: auto; margin-right: 10px;">
            {{ dep.name }}
          </label>
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
.btn-action { background: #17a2b8; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;}
.btn-cancel { background: transparent; border: 1px solid #dc3545; color: #dc3545; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;}
.btn-cancel:hover { background: #dc3545; color: white; }
.badge { background: #eee; padding: 3px 8px; border-radius: 10px; margin-right: 5px; font-size: 12px; }
.table-responsive { overflow-x: auto; }
.admin-table { width: 100%; border-collapse: collapse; text-align: left; }
.admin-table th { background: #2c3e50; color: white; padding: 12px; }
.admin-table td { padding: 12px; border-bottom: 1px solid #eee; }
.actions-cell { display: flex; gap: 8px; align-items: center; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 14px; color: #555; }
.form-group input[type="text"], .form-group input[type="password"], .form-group input[type="email"] { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
</style>