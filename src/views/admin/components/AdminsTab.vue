<script setup>
import { ref, onMounted } from 'vue'
import { usersApi } from '@/api/services'
import Modal from '@/components/Modal.vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  branches: {
    type: Array,
    default: () => []
  }
})

const authStore = useAuthStore()
const adminsList = ref([])
const loading = ref(true)

const showModal = ref(false)
const isEditing = ref(false)
const currentEditId = ref(null)

const adminForm = ref({
  phone: '',
  email: '',
  firstName: '',
  lastName: '',
  middleName: '',
  branchId: ''
})

const fetchAdmins = async () => {
  if (authStore.user?.role !== 'main_admin') return
  
  loading.value = true
  try {
    const response = await usersApi.getAdmins()
    adminsList.value = response.data
  } catch (error) {
    console.error('Ошибка загрузки админов:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAdmins()
})

const handleCreateAdmin = () => {
  isEditing.value = false
  currentEditId.value = null
  adminForm.value = { 
    phone: '', email: '', firstName: '', lastName: '', middleName: '', branchId: '' 
  }
  showModal.value = true
}

const handleEditAdmin = (admin) => {
  isEditing.value = true
  currentEditId.value = admin.id
  
  const currentBranch = admin.branch ? admin.branch.id : (admin.branch_id || '')
  
  adminForm.value = {
    phone: admin.phone_number || '',
    email: admin.email || '',
    firstName: admin.first_name || '',
    lastName: admin.last_name || '',
    middleName: admin.middle_name || '',
    branchId: currentBranch ? Number(currentBranch) : ''
  }
  
  showModal.value = true
}

const submitAdmin = async () => {
  if (!adminForm.value.phone || !adminForm.value.email || !adminForm.value.firstName || !adminForm.value.lastName || !adminForm.value.branchId) {
    return alert('Заполните все обязательные поля (Телефон, Email, Имя, Фамилия, Филиал)')
  }

  const selectedBranchId = Number(adminForm.value.branchId)
  
  const existingAdminInBranch = adminsList.value.find(admin => {
    const adminBranchId = admin.branch?.id || admin.branch_id || admin.branch
    return Number(adminBranchId) === selectedBranchId && admin.id !== currentEditId.value
  })

  if (existingAdminInBranch) {
    return alert(`Ошибка: У выбранного филиала уже есть администратор. Выберите другой филиал!`)
  }

  let cleanedPhone = adminForm.value.phone.replace(/\D/g, '')
  if (cleanedPhone.length === 11 && cleanedPhone.startsWith('8')) {
    cleanedPhone = '7' + cleanedPhone.slice(1)
  } else if (cleanedPhone.length === 10) {
    cleanedPhone = '7' + cleanedPhone
  }
  const finalPhone = '+' + cleanedPhone

  if (finalPhone.length !== 12) {
    return alert('Пожалуйста, введите корректный номер телефона из 10 цифр')
  }

  try {
    const payload = {
      phone_number: finalPhone,
      email: adminForm.value.email, 
      first_name: adminForm.value.firstName,
      last_name: adminForm.value.lastName,
      middle_name: adminForm.value.middleName,
      branch: selectedBranchId,
    }

    if (isEditing.value) {
      await usersApi.updateAdmin(currentEditId.value, payload)
      alert('Администратор успешно обновлен!')
    } else {
      await usersApi.createAdmin(payload)
      alert('Администратор успешно создан!')
    }
    
    fetchAdmins()
    showModal.value = false
  } catch (error) {
    console.error('Ошибка:', error.response?.data || error)
    const backendMessage = error.response?.data?.email 
      ? error.response.data.email[0] 
      : 'Проверьте правильность данных'
    alert(`Ошибка: ${backendMessage}`)
  }
}

const handleDeleteAdmin = async (id) => {
  if (confirm('Вы уверены, что хотите удалить этого администратора?')) {
    try {
      await usersApi.deleteAdmin(id)
      fetchAdmins()
    } catch (error) {
      alert('Ошибка при удалении администратора')
    }
  }
}
</script>

<template>
  <div class="admins-tab">
    <div v-if="loading" style="margin: 20px 0;">Загрузка администраторов...</div>
    
    <div v-else>
      <button @click="handleCreateAdmin" class="btn-create" style="margin-bottom: 20px;">
        + Создать администратора
      </button>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Email</th>
              <th>Номер телефона</th>
              <th>Филиал</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="admin in adminsList" :key="admin.id">
              <!-- Выводим ФИО вместо ID -->
              <td>
                <strong>{{ admin.last_name || '—' }} {{ admin.first_name || '' }} {{ admin.middle_name ? admin.middle_name[0] + '.' : '' }}</strong>
              </td>
              <td>{{ admin.email || '—' }}</td>
              <td>{{ admin.phone_number }}</td>
              <td>{{ admin.branch?.name || admin.branch_name || 'Не назначен' }}</td>
              <td class="actions-cell">
                <button @click="handleEditAdmin(admin)" class="btn-action">Изменить</button>
                <button @click="handleDeleteAdmin(admin.id)" class="btn-cancel">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Модалка: Создание/Редактирование Админа -->
    <Modal 
      :show="showModal" 
      :title="isEditing ? 'Редактировать администратора' : 'Создать администратора'" 
      @close="showModal = false" 
      @submit="submitAdmin"
    >
      <div class="form-group">
        <label>Фамилия *</label>
        <input v-model="adminForm.lastName" type="text" placeholder="Фамилия" required>
      </div>

      <div class="form-group" style="margin-top: 15px;">
        <label>Имя *</label>
        <input v-model="adminForm.firstName" type="text" placeholder="Имя" required>
      </div>

      <div class="form-group" style="margin-top: 15px;">
        <label>Отчество (необязательно)</label>
        <input v-model="adminForm.middleName" type="text" placeholder="Отчество">
      </div>

      <div class="form-group" style="margin-top: 15px;">
        <label>Email (Логин) *</label>
        <input v-model="adminForm.email" type="email" placeholder="почта@mail.ru" required>
      </div>

      <div class="form-group" style="margin-top: 15px;">
        <label>Номер телефона *</label>
        <input v-model="adminForm.phone" type="text" placeholder="Номер телефона" required>
      </div>

      <div class="form-group" style="margin-top: 15px;">
        <label>Привязка к филиалу *</label>
        <select v-model="adminForm.branchId" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
          <option value="" disabled>Выберите филиал...</option>
          <option v-for="b in branches" :key="b.id" :value="b.id">
            {{ b.name }} ({{ b.address }})
          </option>
        </select>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.btn-create { background: #42b983; color: white; border: none; padding: 12px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 15px; }
.btn-create:hover { background: #3aa876; }
.btn-action { background: #17a2b8; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 5px;}
.btn-cancel { background: transparent; border: 1px solid #dc3545; color: #dc3545; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;}
.btn-cancel:hover { background: #dc3545; color: white; }
.table-responsive { overflow-x: auto; }
.admin-table { width: 100%; border-collapse: collapse; text-align: left; }
.admin-table th { background: #2c3e50; color: white; padding: 12px; }
.admin-table td { padding: 12px; border-bottom: 1px solid #eee; }
.actions-cell { display: flex; gap: 8px; align-items: center; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 14px; color: #555; }
.form-group input[type="text"], .form-group input[type="password"] { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
</style>
