<script setup>
import { ref, onMounted, watch } from 'vue'
import { boxesApi, departmentsApi } from '@/api/services'
import Modal from '@/components/Modal.vue'

const props = defineProps({
  branchId: {
    type: [Number, String],
    default: null
  }
})

const boxesList = ref([])
const activeDepartments = ref([])
const loading = ref(true)

const showModal = ref(false)
const isEditing = ref(false)
const currentEditId = ref(null)

const boxForm = ref({
  name: '',
  selectedDepartments: []
})

// --- МЕТОДЫ ЗАГРУЗКИ ---
const fetchBoxes = async () => {
  if (!props.branchId) return 
  
  loading.value = true
  try {
    const response = await boxesApi.getAll(props.branchId)
    boxesList.value = response.data
  } catch (error) {
    console.error('Ошибка загрузки боксов:', error)
  } finally {
    loading.value = false
  }
}

const fetchDepartments = async () => {
  if (!props.branchId) return 

  try {
    const response = await departmentsApi.getByBranch(props.branchId)
    activeDepartments.value = response.data
  } catch (error) {
    console.error('Ошибка загрузки отделов:', error)
  }
}

onMounted(() => {
  if (props.branchId) {
    fetchBoxes()
    fetchDepartments()
  }
})

watch(() => props.branchId, (newBranchId) => {
  if (newBranchId) {
    fetchBoxes()
    fetchDepartments()
  }
}, { immediate: true }) 

// --- МЕТОДЫ УПРАВЛЕНИЯ БОКСАМИ ---
const handleCreateBox = () => {
  isEditing.value = false
  currentEditId.value = null
  boxForm.value = { name: '', selectedDepartments: [] }
  showModal.value = true
}

const handleEditBox = (box) => {
  isEditing.value = true
  currentEditId.value = box.id
  
  boxForm.value = {
    name: box.name,
    selectedDepartments: box.departments || [] 
  }
  
  showModal.value = true
}

const submitBox = async () => {
  if (!boxForm.value.name) return alert('Введите название бокса')
  if (boxForm.value.selectedDepartments.length === 0) return alert('Выберите хотя бы один отдел')

  if (!props.branchId) {
      return alert('Ошибка: Не выбран филиал')
  }

  try {
    const payload = {
      name: boxForm.value.name,
      branch: parseInt(props.branchId),
      departments: boxForm.value.selectedDepartments,
      is_active: true
    }
    
    if (isEditing.value) {
      await boxesApi.updateBox(currentEditId.value, payload)
      alert('Бокс успешно обновлен!')
    } else {
      await boxesApi.createBox(payload)
      alert('Бокс успешно создан!')
    }
    
    fetchBoxes()
    showModal.value = false
  } catch (error) {
    console.error(isEditing.value ? 'Ошибка обновления бокса:' : 'Ошибка создания бокса:', error)
    alert(isEditing.value ? 'Не удалось обновить бокс' : 'Не удалось создать бокс')
  }
}

const handleDeleteBox = async (id) => {
  if (confirm('Вы уверены, что хотите удалить этот бокс?')) {
    try {
      await boxesApi.deleteBox(id)
      fetchBoxes()
    } catch (error) {
      alert('Ошибка при удалении бокса')
    }
  }
}
</script>

<template>
  <div class="boxes-tab">
    <div v-if="loading" style="margin: 20px 0;">Загрузка боксов...</div>
    
    <div v-else>
      <button @click="handleCreateBox" class="btn-create" style="margin-bottom: 20px;">
        + Создать бокс
      </button>
      
      <div v-if="boxesList.length === 0" class="empty-state">
        <p style="text-align: center; color: #888; padding: 30px; background: #f9f9f9; border-radius: 8px;">
          Боксы еще не созданы. Боксы необходимы для расчета расписания записи.
        </p>
      </div>

      <div v-else class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Название / Номер</th>
              <th>Привязанные отделы</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="box in boxesList" :key="box.id">
              <td><strong>{{ box.name }}</strong></td>
              <td>
                <span v-if="!box.department_names || box.department_names.length === 0" style="color: #999;">Нет отделов</span>
                <span v-else v-for="(deptName, index) in box.department_names" :key="index" class="badge">
                  {{ deptName }}
                </span>
              </td>
              <td>{{ box.is_active ? 'Активен' : 'Отключен' }}</td>
              <td class="actions-cell">
                <button @click="handleEditBox(box)" class="btn-action">Изменить</button>
                <button @click="handleDeleteBox(box.id)" class="btn-cancel">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Модалка: Создание/Редактирование Бокса -->
    <Modal 
      :show="showModal" 
      :title="isEditing ? 'Редактировать бокс' : 'Создать новый бокс'" 
      @close="showModal = false" 
      @submit="submitBox"
    >
      <div class="form-group">
        <label>Название бокса (например, "Мойка 1" или "Подъемник 3")</label>
        <input v-model="boxForm.name" type="text" placeholder="Введите название..." required>
      </div>
      
      <div class="form-group" style="margin-top: 15px;">
        <label>К каким отделам относится этот бокс?</label>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
          <label 
            v-for="dep in activeDepartments" 
            :key="dep.id"
            style="display: flex; align-items: center; gap: 10px; font-weight: normal; cursor: pointer; font-size: 14px;"
          >
            <input 
              type="checkbox" 
              :value="dep.id" 
              v-model="boxForm.selectedDepartments"
              style="width: 18px; height: 18px;"
            >
            {{ dep.name }}
          </label>
        </div>
        <p v-if="activeDepartments.length === 0" style="color: #e74c3c; font-size: 13px; margin-top: 5px;">
          Сначала создайте отделы, чтобы привязать к ним боксы!
        </p>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.btn-create { background: #42b983; color: white; border: none; padding: 12px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 15px; }
.btn-create:hover { background: #3aa876; }
.btn-action { background: #17a2b8; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.btn-cancel { background: transparent; border: 1px solid #dc3545; color: #dc3545; padding: 5px 10px; border-radius: 4px; cursor: pointer; }
.btn-cancel:hover { background: #dc3545; color: white; }
.badge { background: #eee; padding: 3px 8px; border-radius: 10px; margin-right: 5px; font-size: 12px; }
.table-responsive { overflow-x: auto; }
.admin-table { width: 100%; border-collapse: collapse; text-align: left; }
.admin-table th { background: #2c3e50; color: white; padding: 12px; }
.admin-table td { padding: 12px; border-bottom: 1px solid #eee; }
.actions-cell { display: flex; gap: 8px; align-items: center; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 14px; color: #555; }
.form-group input[type="text"] { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
</style>