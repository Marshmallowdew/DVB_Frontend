<script setup>
import { ref, onMounted, watch } from 'vue'
import { departmentsApi, servicesApi } from '@/api/services'
import Modal from '@/components/Modal.vue'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'

// Получаем ID филиала из DashboardView
const props = defineProps({
  branchId: {
    type: [Number, String],
    required: true
  }
})

const loading = ref(true)
const departmentsList = ref([])
const servicesList = ref([])

const modals = ref({ department: false, service: false, delete: false })
const isEditingService = ref(false)
const currentServiceId = ref(null)

const { isDeleteModalOpen, deleteConfig, confirmDelete, closeDeleteModal, executeDelete } = useDeleteConfirm()

const branchForm = ref({ name: '' })
const serviceForm = ref({ 
  name: '', 
  price: '', 
  duration_minutes: 60,
  department: null 
})

// Загрузка данных
const fetchData = async () => {
  if (!props.branchId) return
  loading.value = true
  try {
    const [depRes, servRes] = await Promise.all([
      departmentsApi.getByBranch(props.branchId),
      servicesApi.getAll(props.branchId)
    ])
    departmentsList.value = depRes.data
    servicesList.value = servRes.data
  } catch (error) {
    console.error('Ошибка загрузки', error)
  } finally {
    loading.value = false
  }
}

// Следим за изменением филиала (если главный админ переключил)
watch(() => props.branchId, fetchData)
onMounted(fetchData)

// Фильтрация услуг
const getServicesForDepartment = (departmentId) => {
  if (!servicesList.value) return [];
  
  return servicesList.value.filter(service => {
    const sId = service.department_id || 
               (typeof service.department === 'object' && service.department !== null ? service.department.id : service.department);
               
    return String(sId) === String(departmentId);
  });
}

// Модалки
const openModalDepartment = () => {
  branchForm.value.name = ''
  modals.value.department = true
}

const openModalCreateService = (departmentId) => {
  isEditingService.value = false
  currentServiceId.value = null
  serviceForm.value = { name: '', price: '', duration_minutes: 60, department: departmentId }
  modals.value.service = true
}

const openModalEditService = (service) => {
  isEditingService.value = true
  currentServiceId.value = service.id
  
  const depId = typeof service.department === 'object' && service.department !== null 
    ? service.department.id 
    : service.department;

  console.log("Редактируем услугу:", service);

  serviceForm.value = { 
    name: service.name, 
    price: service.price, 
    duration_minutes: Number(service.duration_minutes) || 60, 
    department: depId 
  }
  modals.value.service = true
}

const closeModal = (type) => {
  modals.value[type] = false
}

// Действия Отделы
const submitDepartment = async () => {
  if (!branchForm.value.name) return alert('Введите название отдела')
  try {
    await departmentsApi.createDepartment({
      name: branchForm.value.name,
      branch: props.branchId
    })
    await fetchData()
    closeModal('department')
  } catch (error) { alert('Ошибка создания отдела') }
}

const handleDeleteDepartment = (id) => {
  confirmDelete(id, 'Вы уверены, что хотите удалить этот отдел? Все услуги внутри него также могут быть удалены.', async (targetId) => {
    await departmentsApi.deleteDepartment(targetId)
    await fetchData()
  })
}

// Действия Услуги
const submitService = async () => {
  if (!serviceForm.value.name || !serviceForm.value.price) return alert('Заполните все поля');
  
  try {
    if (isEditingService.value) { 
      await servicesApi.updateService(currentServiceId.value, {
        name: serviceForm.value.name,
        price: parseFloat(serviceForm.value.price),
        duration_minutes: parseInt(serviceForm.value.duration_minutes),
        department: Number(serviceForm.value.department),
      });
    } else {
      const branchId = props.branchId;
      if (!branchId) return alert('Филиал не выбран');
      
      await servicesApi.createService({
        name: serviceForm.value.name,
        price: parseFloat(serviceForm.value.price),
        duration_minutes: 60,
        branch: branchId,
        department: Number(serviceForm.value.department)
      });
    }
    
    await fetchData(); 
    closeModal('service');
  } catch (error) {
    console.error(error);
    alert('Ошибка при сохранении услуги');
  }
};


const handleCreateService = (departmentId) => {
  isEditingService.value = false;
  currentServiceId.value = null;
  serviceForm.value = {
    name: '',
    price: '',
    department: departmentId
  };
  openModal('service');
};

const handleDeleteService = (id) => {
  confirmDelete(id, 'Вы уверены, что хотите удалить эту услугу? Это действие нельзя отменить.', async (targetId) => {
    await servicesApi.deleteService(targetId)
    await fetchData()
  })
}
</script>

<template>
  <div v-if="loading" style="margin: 20px 0;">Загрузка...</div>
  
  <div v-else>
    <button @click="openModalDepartment" class="btn-create" style="margin-bottom: 20px;">
      + Добавить отдел
    </button>

    <div v-if="departmentsList.length === 0" style="text-align: center; padding: 30px; color: #888; background: #f9f9f9; border-radius: 8px;">
      В этом филиале пока нет отделов.
    </div>

    <div class="departments-container">
      <div v-for="dep in departmentsList" :key="dep.id" class="department-block">
        <div class="department-header">
          <h3>{{ dep.name }}</h3>
          <button @click="handleDeleteDepartment(dep.id)" class="btn-cancel" style="font-size: 12px;">🗑 Удалить отдел</button>
        </div>
        
        <div class="department-body">
          <table v-if="getServicesForDepartment(dep.id).length > 0" class="admin-table" style="margin-bottom: 15px;">
            <thead>
              <tr>
                <th>Название услуги</th>
                <th>Цена (₽)</th>
                <th>Время</th>
                <th style="width: 150px;">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="service in getServicesForDepartment(dep.id)" :key="service.id">
                <td><strong>{{ service.name }}</strong></td>
                <td>{{ service.price }} ₽</td>
                <td>{{ service.duration_minutes }} мин</td>
                <td class="actions-cell">
                  <button @click="openModalEditService(service)" class="btn-action">Изменить</button>
                  <button @click="handleDeleteService(service.id)" class="btn-cancel">Удалить</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else style="color: #999; font-size: 14px; margin-top: 0; margin-bottom: 15px;">В этом отделе пока нет услуг.</p>
          <button @click="openModalCreateService(dep.id)" class="btn-create" style="font-size: 13px; padding: 8px 15px; background-color: #2c3e50;">+ Добавить услугу</button>
        </div>
      </div>
    </div>

    <!-- Модалки -->
    <Modal :show="modals.department" title="Новый отдел" @close="closeModal('department')" @submit="submitDepartment">
      <div class="form-group">
        <label>Название отдела</label>
        <input v-model="branchForm.name" type="text" placeholder="Например: Шиномонтаж">
      </div>
    </Modal>

    <Modal :show="modals.service" :title="isEditingService ? 'Редактировать услугу' : 'Новая услуга'" @close="closeModal('service')" @submit="submitService">
      <div class="form-group">
        <label>Название услуги</label>
        <input v-model="serviceForm.name" type="text" placeholder="Например: Замена масла">
      </div>
      
      <div class="form-group">
        <label>Длительность (в минутах)</label>
        <input v-model="serviceForm.duration_minutes" type="number" min="5" step="5" placeholder="60">
      </div>

      <div class="form-group">
        <label>Цена (₽)</label>
        <input v-model="serviceForm.price" type="number" placeholder="1000">
      </div>
    </Modal>
    <Modal 
      :show="isDeleteModalOpen" 
      title="Подтверждение удаления" 
      submitText="Удалить"
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