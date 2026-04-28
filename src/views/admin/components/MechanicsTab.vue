<script setup>
import { ref, onMounted, watch } from 'vue'
import { mechanicsApi, departmentsApi } from '@/api/services'
import Modal from '@/components/Modal.vue'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'

const props = defineProps({
  branchId: { type: [Number, String], required: true }
})

const loading = ref(true)
const mechanicsList = ref([])
const modals = ref({ mechanic: false, delete: false })
const isEditing = ref(false)
const currentEditId = ref(null)

const departmentsList = ref([])

const fetchDepartments = async () => {
  if (!props.branchId) return
  try {
    const res = await departmentsApi.getByBranch(props.branchId)
    departmentsList.value = res.data
  } catch (e) {
    console.error('Ошибка загрузки отделов', e)
  }
}

const mechanicForm = ref({
  first_name: '', 
  last_name: '', 
  departments: [], 
  experience_years: 0
})

const { isDeleteModalOpen, deleteConfig, confirmDelete, closeDeleteModal, executeDelete } = useDeleteConfirm()

// Загрузка мастеров
const fetchMechanics = async () => {
  if (!props.branchId) return
  loading.value = true
  try {
    const response = await mechanicsApi.getByBranch(props.branchId)
    mechanicsList.value = response.data
  } catch (error) {
    console.error('Ошибка загрузки мастеров:', error)
  } finally {
    loading.value = false
  }
}

watch(() => props.branchId, () => {
  fetchMechanics()
  fetchDepartments()
})

onMounted(() => {
  fetchMechanics()
  fetchDepartments() 
})

// Открытие модалки на создание
const openModalCreate = () => {
  isEditing.value = false
  currentEditId.value = null
  mechanicForm.value = { 
    first_name: '', 
    last_name: '', 
    departments: [], 
    experience_years: 0 
  }
  modals.value.mechanic = true
}

// Открытие модалки на редактирование
const openModalEdit = (mech) => {
  isEditing.value = true
  currentEditId.value = mech.id
  mechanicForm.value = {
    first_name: mech.first_name || mech.firstname || mech.fullname || '',
    last_name: mech.last_name || mech.lastname || '',
    departments: mech.departments || [],
    experience_years: mech.experience_years || mech.experienceyears || 0
  }
  modals.value.mechanic = true
}

// Отправка формы (создание или обновление)
const submitMechanic = async () => {
  if (!mechanicForm.value.first_name) return alert('Введите имя мастера')
  
  try {
    const payload = {
      first_name: mechanicForm.value.first_name, 
      last_name: mechanicForm.value.last_name || '',
      experience_years: parseInt(mechanicForm.value.experience_years) || 0,
      departments: mechanicForm.value.departments || [] 
    }

    if (isEditing.value) {
      await mechanicsApi.updateMechanic(currentEditId.value, payload)
      alert('Мастер успешно обновлен')
    } else {
      // Убедитесь, что branchId передается
      const branchToAssign = props.branchId || currentBranchId.value
      
      if (!branchToAssign) {
         return alert('Ошибка: не выбран филиал')
      }
      
      payload.branch = branchToAssign 
      payload.isactive = true
      
      await mechanicsApi.createMechanic(payload)
      alert('Мастер успешно создан')
    }

    fetchMechanics()
    modals.value.mechanic = false
  } catch (error) {
    console.error(error.response?.data || error)
    alert(error.response?.data?.detail || 'Ошибка при сохранении мастера')
  }
}


// Удаление
const handleDeleteMechanic = (id) => {
  confirmDelete(id, 'Удалить этого мастера из базы?', async (targetId) => {
    await mechanicsApi.deleteMechanic(targetId)
    await fetchMechanics()
  })
}
</script>

<template>
  <div>
    <button @click="openModalCreate" class="btn-create" style="margin-bottom: 20px;">+ Добавить мастера</button>

    <div v-if="loading">Загрузка...</div>
    
    <div v-else class="table-responsive">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Имя</th>
            <th>Фамилия</th>
            <th>Опыт работы (в годах)</th>
            <th>Специализация (Отделы)</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="mech in mechanicsList" :key="mech.id">
            <td><strong>{{ mech.first_name || mech.firstname || mech.fullname || 'Не указано' }}</strong></td>
            <td><strong>{{ mech.last_name || mech.lastname || 'Не указано' }}</strong></td>
            <td>{{ mech.experience_years ?? mech.experienceyears ?? 0 }}</td>
            <td>
              <span v-if="mech.department_names && mech.department_names.length > 0">
                {{ mech.department_names.join(', ') }}
              </span>
              <span v-else style="color: gray; font-size: 13px;">Универсал</span>
            </td>
            <td class="actions-cell">
              <button @click="openModalEdit(mech)" class="btn-action">Изменить</button>
              <button @click="handleDeleteMechanic(mech.id)" class="btn-cancel">Удалить</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Модальное окно создания/редактирования мастера -->
    <Modal :show="modals.mechanic" :title="isEditing ? 'Редактировать мастера' : 'Новый мастер'" @close="modals.mechanic = false" @submit="submitMechanic">
      <div class="form-group">
        <label>Имя</label>
        <input v-model="mechanicForm.first_name" type="text" placeholder="Имя">
      </div>
      
      <div class="form-group">
        <label>Фамилия</label>
        <input v-model="mechanicForm.last_name" type="text" placeholder="Фамилия">
      </div>
      
      <div class="form-group">
        <label>Отделы (Специализация)</label>
        <div v-if="departmentsList.length === 0" style="color:#d9534f; font-size: 13px; margin-bottom: 5px;">
          Сначала создайте отделы в этом филиале.
        </div>
        <!-- Сетка чекбоксов с отделами -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
          <label 
            v-for="dep in departmentsList" 
            :key="dep.id"
            style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: normal; font-size: 14px;"
          >
            <input 
              type="checkbox" 
              :value="dep.id" 
              v-model="mechanicForm.departments"
              style="width: 18px; height: 18px; cursor: pointer;"
            >
            {{ dep.name }}
          </label>
        </div>
      </div>
      
      <div class="form-group" style="margin-top: 15px;">
        <label>Опыт работы (в годах)</label>
        <input v-model="mechanicForm.experience_years" type="number" min="0">
      </div>
    </Modal>

    <!-- Модальное окно подтверждения удаления -->
    <Modal 
      :show="isDeleteModalOpen" 
      title="Подтверждение удаления" 
      @close="closeDeleteModal" 
      @submit="executeDelete"
    >
      <div style="padding: 10px 0;">
        <p style="font-size: 16px; margin-bottom: 20px; color: #333;">
          {{ deleteConfig?.message || 'Вы уверены?' }}
        </p>
      </div>
    </Modal>
  </div>
</template>
