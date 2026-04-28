import { apiClient } from './client';

export const authApi = {
  register: (phone_number) => apiClient.post('users/register/', { phone_number }),
  login: (phone_number, password) => apiClient.post('users/login/', { phone_number, password }),
  getProfile: () => apiClient.get('users/profile/'),
  updateProfile: (data) => apiClient.patch('users/profile/', data),
};

export const servicesApi = {
  getAll: (branchId = '') => apiClient.get(`services/${branchId ? `?branch=${branchId}` : ''}`),
  getById: (id) => apiClient.get(`services/${id}/`),
  createService: (data) => apiClient.post('services/', data),
  updateService: (id, data) => apiClient.patch(`services/${id}/`, data),
  deleteService: (id) => apiClient.delete(`services/${id}/`),
};

export const ordersApi = {
 getMyOrders: (params = {}) => apiClient.get('orders/', { params }),
  createOrder: (data) => apiClient.post('orders/', data),
  // cancelOrder: (id) => apiClient.patch(`orders/${id}/`, { status: 'cancelled' }),
  cancelOrder: (id) => apiClient.post(`orders/${id}/cancel/`),
  getAllOrders: (filters = '') => apiClient.get(`orders/${filters}`),
  updateOrder: (id, data) => apiClient.patch(`orders/${id}/`, data),
  deleteOrder: (id) => apiClient.delete(`orders/${id}/`),
  linkAccount: (data) => apiClient.post('orders/link-account/', data),
  getAvailableSlots(serviceId, date) {
    return apiClient.get(`/orders/available-slots/?service_id=${serviceId}&date=${date}`)
  }
};

export const mechanicsApi = {
  getByBranch: (branchId) => apiClient.get(`mechanics/?branch=${branchId}`),
  createMechanic: (data) => apiClient.post('mechanics/', data),
  updateMechanic: (id, data) => apiClient.patch(`mechanics/${id}/`, data),
  deleteMechanic: (id) => apiClient.delete(`mechanics/${id}/`),
};

export const branchesApi = {
  getAll: () => apiClient.get('branches/'),
  createBranch: (data) => apiClient.post('branches/', data),
  deleteBranch: (id) => apiClient.delete(`branches/${id}/`),
  updateBranch: (id, data) => apiClient.patch(`branches/${id}/`, data),
};

export const departmentsApi = {
  getByBranch: (branchId = '') => apiClient.get(branchId ? `departments/?branch=${branchId}` : 'departments/'),
  updateDepartment: (id, data) => apiClient.patch(`departments/${id}/`, data),
  createDepartment: (data) => apiClient.post('departments/', data),
  deleteDepartment: (id) => apiClient.delete(`departments/${id}/`)
};

export const usersApi = {
  getAdmins: () => apiClient.get('users/?role=branch_admin'), 
  createAdmin: (data) => apiClient.post('admins/', data), 
  updateAdmin: (id, data) => apiClient.patch(`users/${id}/`, data),
  deleteAdmin: (id) => apiClient.delete(`users/${id}/`),
  getMainAdminContact: () => apiClient.get('users/main-admin-contact/'),

  createManager: (data) => apiClient.post('managers/', data),
  updateManager: (id, data) => apiClient.patch(`managers/${id}/`, data),
  getManagers: (branchId = '') => apiClient.get(branchId ? `managers/?branch=${branchId}` : 'managers/'),
  deleteManager: (id) => apiClient.delete(`managers/${id}/`),
};

export const boxesApi = {
  getAll: (branchId) => {
    const query = branchId ? `?branch=${branchId}` : ''
    return apiClient.get(`boxes/${query}`)
  },
  createBox: (data) => apiClient.post('boxes/', data),
  deleteBox: (id) => apiClient.delete(`boxes/${id}/`),
  updateBox: (id, data) => apiClient.patch(`boxes/${id}/`, data), 
}

export const carsApi = {
  getUserCars: () => apiClient.get('cars/'),
  addCar: (data) => apiClient.post('cars/', data),
  updateCar: (id, data) => apiClient.put(`cars/${id}/`, data),
  deleteCar: (id) => apiClient.delete(`cars/${id}/`)
}