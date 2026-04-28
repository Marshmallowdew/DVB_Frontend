import { ref } from 'vue'

export function useDeleteConfirm() {
  const isDeleteModalOpen = ref(false)
  const deleteConfig = ref({
    id: null,
    message: '',
    action: null
  })

  const confirmDelete = (id, message, actionCallback) => {
    deleteConfig.value = {
      id,
      message,
      action: actionCallback
    }
    isDeleteModalOpen.value = true
  }

  const closeDeleteModal = () => {
    isDeleteModalOpen.value = false
  }

  const executeDelete = async () => {
    if (!deleteConfig.value.action) return
    
    try {
      await deleteConfig.value.action(deleteConfig.value.id)
      closeDeleteModal()
    } catch (error) {
      console.error('Ошибка при удалении:', error)
      alert('Не удалось удалить элемент')
    }
  }

  return {
    isDeleteModalOpen,
    deleteConfig,
    confirmDelete,
    closeDeleteModal,
    executeDelete
  }
}
