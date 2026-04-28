<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useAuthStore } from './stores/auth'
import { branchesApi, usersApi } from '@/api/services' 
import NotificationBell from './views/client/NotificationBell.vue'
import { useRouter, useRoute } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const branches = ref([])
const isCityMenuOpen = ref(false)
const hoverCity = ref(null)

const isMobileMenuOpen = ref(false)
const navRef = ref(null)

// Почта администратора. 
const adminEmail = ref('')

const savedBranchId = ref(localStorage.getItem('selectedBranchId') || null)

// Состояние модального окна выхода
const isLogoutModalOpen = ref(false)

const selectedBranchId = computed(() => {
  return route.query.branch || localStorage.getItem('selectedBranchId') || null
})

const handleClickOutside = (event) => {
  if (isMobileMenuOpen.value && navRef.value && !navRef.value.contains(event.target)) {
    isMobileMenuOpen.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)

  fetchSystemSettings()
  
  const savedBranchId = localStorage.getItem('selectedBranchId')
  if (!route.query.branch && savedBranchId) {
    router.replace({ query: { ...route.query, branch: savedBranchId } })
  }

  if (authStore.isAuthenticated) authStore.fetchProfile()
  try {
    const res = await branchesApi.getAll()
    branches.value = res.data
  } catch (err) {
    console.error('Ошибка загрузки филиалов', err)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

const fetchSystemSettings = async () => {
  try {
    const res = await usersApi.getMainAdminContact()
    if (res.data && res.data.email) {
      adminEmail.value = res.data.email
    }
  } catch (err) {
    console.error('Ошибка загрузки контактов админа', err)
    adminEmail.value = 'admin@carservice.ru'
  }
}

const groupedBranches = computed(() => {
  const groups = {}
  branches.value.forEach(b => {
    let city = b.name.trim()
    city = city.charAt(0).toUpperCase() + city.slice(1)

    let street = b.address.trim()
    if (street) street = street.charAt(0).toUpperCase() + street.slice(1)

    if (!groups[city]) groups[city] = []
    groups[city].push({ ...b, parsedStreet: street })
  })
  return groups
})

const selectBranch = (branchId) => {
  isCityMenuOpen.value = false
  localStorage.setItem('selectedBranchId', branchId)
  savedBranchId.value = branchId
  router.push({ path: '/', query: { branch: branchId } })
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

// ЛОГИКА ВЫХОДА ИЗ АККАУНТА
const handleLogoutClick = () => {
  isMobileMenuOpen.value = false
  isLogoutModalOpen.value = true
}

const confirmLogout = () => {
  authStore.logout()
  isLogoutModalOpen.value = false
}

const cancelLogout = () => {
  isLogoutModalOpen.value = false
}

const currentBranch = computed(() => {
  const branchId = route.query.branch || savedBranchId.value
  if (!branchId) return null
  return branches.value.find(b => String(b.id) === String(branchId))
})

watch(
  () => route.query.branch,
  (newBranchId) => {
    if (newBranchId) {
      localStorage.setItem('selectedBranchId', newBranchId)
      savedBranchId.value = newBranchId
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="app-wrapper">
    <header class="navbar">
      
      <div class="navbar-left">
        <div class="logo">
          <RouterLink :to="{ path: '/', query: savedBranchId ? { branch: savedBranchId } : {} }">
            <span class="logo-accent">Car</span>Service
          </RouterLink>
        </div>
        
        <div class="dropdown-container" @mouseleave="isCityMenuOpen = false; hoverCity = null">
          <button class="nav-btn city-btn" @mouseenter="isCityMenuOpen = true">
            <img src="@/assets/location.jpg" alt="Локация" class="icon-location-img" /> 
            <span class="city-text">
              {{ currentBranch ? currentBranch.name : 'Выберите город' }}
            </span>
          </button>

          <ul class="dropdown-menu city-list" v-show="isCityMenuOpen">
            <li 
              v-for="(cityBranches, city) in groupedBranches" :key="city"
              @mouseenter="hoverCity = city"
              :class="['city-item', { active: hoverCity === city }]"
            >
              <div class="city-name">{{ city }} <span class="arrow">›</span></div>
              <ul class="submenu branch-list" v-if="hoverCity === city">
                <li v-for="branch in cityBranches" :key="branch.id" @click.stop="selectBranch(branch.id)">
                  <div class="branch-address">{{ branch.parsedStreet }}</div>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
      
      <!-- ПРАВАЯ ЧАСТЬ -->
      <nav class="nav-links" ref="navRef">
        
        <div v-if="authStore.isAuthenticated" class="bell-desktop-container">
          <NotificationBell class="bell-component" />
        </div>

        <button class="mobile-menu-btn" @click.stop="isMobileMenuOpen = !isMobileMenuOpen">
          <span class="hamburger"></span>
        </button>

        <div :class="['desktop-links', { 'mobile-open': isMobileMenuOpen }]">
          <RouterLink :to="{ path: '/', query: savedBranchId ? { branch: savedBranchId } : {} }" @click="closeMobileMenu">
            Услуги
          </RouterLink>
          
          <RouterLink v-if="!authStore.isAuthenticated" to="/login" class="btn btn-primary" @click="closeMobileMenu">
            Войти
          </RouterLink>

          <template v-else>
            <RouterLink v-if="authStore.isStaff" to="/admin" @click="closeMobileMenu">Панель</RouterLink>
            <RouterLink v-else to="/my-orders" @click="closeMobileMenu">Мои записи</RouterLink>
            
            <div class="user-actions">
              <RouterLink to="/profile" class="user-profile-link" @click="closeMobileMenu">
                {{ authStore.user?.first_name || 'Профиль' }}
              </RouterLink>
              <button @click="handleLogoutClick" class="btn btn-outline">Выйти</button>
            </div>
          </template>
        </div>
      </nav>
    </header>

    <main class="container">
      <RouterView :key="$route.fullPath" />
    </main>

    <footer class="footer">
      <div class="footer-content">
        <div class="footer-brand">
          <h3><span class="logo-accent">Car</span>Service</h3>
          <p>Профессиональное обслуживание вашего автомобиля с гарантией качества.</p>
        </div>
        
        <div class="footer-contacts">
          <h4>Контакты</h4>
          <div v-if="currentBranch">
            <p>📍 {{ currentBranch.name }}, {{ currentBranch.address }}</p>
            <p>📞 {{ currentBranch.phone_number }}</p>
            <p v-if="currentBranch.phone_number_2">📞 {{ currentBranch.phone_number_2 }}</p>
            <p v-if="adminEmail">✉️ {{ adminEmail }}</p>
          </div>
          <div v-else>
            <p>Выберите город в верхнем меню, чтобы увидеть контакты вашего филиала.</p>
            <p v-if="adminEmail">✉️ Поддержка: {{ adminEmail }}</p>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        &copy; 2026 CarService. Все права защищены.
      </div>
    </footer>

    <!-- МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ ВЫХОДА -->
    <div v-if="isLogoutModalOpen" class="modal-overlay" @click="cancelLogout">
      <div class="modal-content" @click.stop>
        <h3 class="modal-title">Выход из аккаунта</h3>
        <p class="modal-text">Вы уверены, что хотите выйти из своего профиля?</p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="cancelLogout">Отмена</button>
          <button class="btn btn-danger" @click="confirmLogout">Да, выйти</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
:root {
  --primary: #10b981; 
  --primary-hover: #059669;
  --primary-light: #ecfdf5;
  --text-main: #374151;
  --text-muted: #6b7280;
  --bg-body: #f8fafc;
  --bg-white: #ffffff;
  --border-color: #e5e7eb;
}

body {
  background-color: var(--bg-body);
  color: var(--text-main);
  font-family: 'Inter', -apple-system, sans-serif;
  margin: 0; padding: 0;
  overflow-x: hidden;
}

.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
}

.navbar {
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  padding: 1rem 2rem; 
  background-color: var(--bg-white);
  box-shadow: 0 2px 10px rgba(0,0,0,0.05); 
  position: sticky; 
  top: 0; 
  z-index: 1000;
  width: 100%;
  box-sizing: border-box;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.logo a { font-size: 1.5rem; font-weight: 800; color: var(--text-main); text-decoration: none; }
.logo-accent { color: var(--primary); }

.nav-links { 
  display: flex; 
  align-items: center; 
  position: relative; 
  gap: 1.5rem; 
}

.bell-desktop-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.desktop-links { display: flex; align-items: center; gap: 1.5rem; font-weight: 500;}
.desktop-links a { color: var(--text-main); text-decoration: none; transition: color 0.2s; white-space: nowrap;}
.desktop-links a:hover { color: var(--primary); }

.mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px;
}

.hamburger {
  display: block;
  width: 24px;
  height: 2px;
  background-color: var(--text-main);
  position: relative;
  transition: 0.2s;
}

.hamburger::before, .hamburger::after {
  content: '';
  position: absolute;
  left: 0;
  width: 24px;
  height: 2px;
  background-color: var(--text-main);
  transition: 0.2s;
}

.hamburger::before { top: -8px; }
.hamburger::after { top: 8px; }

.btn { padding: 0.5rem 1rem; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; white-space: nowrap;}
.btn-primary { background: var(--primary); color: white !important; }
.btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
.btn-outline { background: transparent; border: 1px solid var(--border-color); color: var(--text-main) !important; }
.btn-outline:hover { background: var(--bg-body); border-color: var(--text-muted); }
.btn-danger { background: #ef4444; color: white !important; }
.btn-danger:hover { background: #dc2626; transform: translateY(-1px); }

.dropdown-container { position: relative; height: 100%; display: flex; align-items: center; }

.city-btn { 
  background: transparent;
  color: var(--text-main); 
  border: none; 
  font-size: 15px; 
  font-weight: 600; 
  cursor: pointer; 
  display: flex; 
  align-items: center; 
  gap: 8px; 
  padding: 8px 12px; 
  transition: 0.2s;
  white-space: nowrap;
}

.icon-location-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.city-text { position: relative; }
.city-text::after {
  content: ''; position: absolute; bottom: -4px; left: 0; width: 100%; height: 2px;
  background-color: #374151; border-radius: 2px; transition: all 0.3s ease;
}

.city-btn:hover { color: var(--primary); }
.city-btn:hover .city-text::after {
  transform: translateY(2px); background-color: var(--primary-hover);
}

.dropdown-menu { 
  position: absolute; top: 100%; left: 0; margin-top: 5px; 
  background: var(--bg-white); border: 1px solid var(--border-color); border-radius: 12px; 
  width: 220px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); padding: 8px 0; 
  list-style: none; z-index: 1000;
}
.dropdown-menu::before {
  content: ''; position: absolute; top: -15px; left: 0; width: 100%; height: 15px; background: transparent;
}

.city-item { position: relative; }
.city-name { padding: 12px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: var(--text-main); transition: 0.2s; font-weight: 500;}
.city-item:hover > .city-name, .city-item.active > .city-name { background: var(--primary-light); color: var(--primary); }

.submenu { 
  position: absolute; top: -8px; left: 100%; margin-left: 5px; 
  background: var(--bg-white); border: 1px solid var(--border-color); border-radius: 12px; 
  min-width: 240px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); list-style: none; padding: 8px 0; 
}
.submenu::before { content: ''; position: absolute; top: 0; left: -15px; width: 15px; height: 100%; background: transparent; }
.submenu li { padding: 12px 20px; cursor: pointer; color: var(--text-main); transition: 0.2s; }
.submenu li:hover { background: var(--bg-body); color: var(--primary); }

.user-actions { display: flex; align-items: center; gap: 1rem; padding-left: 1.5rem; border-left: 1px solid var(--border-color); }
.user-profile-link { color: var(--primary) !important; font-weight: 700; white-space: nowrap;}

.container { padding: 2rem; max-width: 1200px; margin: 0 auto; flex: 1; width: 100%; box-sizing: border-box;}

.footer { background: var(--bg-white); border-top: 1px solid var(--border-color); padding: 3rem 2rem 1.5rem; margin-top: 3rem; width: 100%; box-sizing: border-box;}
.footer-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 2rem; }
.footer-brand h3 { margin: 0 0 10px 0; font-size: 1.5rem; color: var(--text-main); }
.footer-brand p { color: var(--text-muted); max-width: 300px; line-height: 1.5; margin: 0;}
.footer-contacts h4 { margin: 0 0 15px 0; color: var(--text-main); }
.footer-contacts p { margin: 5px 0; color: var(--text-muted); font-size: 14px; }
.footer-bottom { text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color); max-width: 1200px; margin-left: auto; margin-right: auto;}

/* --- СТИЛИ ДЛЯ МОДАЛЬНОГО ОКНА ВЫХОДА --- */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.3s ease;
}

.modal-content {
  background: var(--bg-white);
  padding: 30px;
  border-radius: 16px;
  text-align: center;
  max-width: 350px;
  width: 90%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.3s ease-out;
}

.modal-title { margin-top: 0; margin-bottom: 10px; font-size: 20px; font-weight: 800; color: var(--text-main); }
.modal-text { color: var(--text-muted); font-size: 15px; margin-bottom: 25px; }

.modal-actions { display: flex; gap: 12px; justify-content: center; }
.modal-actions .btn { flex: 1; padding: 12px; font-size: 15px;}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

/* --- МОБИЛЬНАЯ АДАПТАЦИЯ --- */
@media (max-width: 850px) {
  .navbar { flex-direction: row; padding: 0.5rem 15px; }
  .navbar-left { width: auto; gap: 8px; }
  .logo a { font-size: 1.2rem; }
  .city-btn { padding: 4px 6px; font-size: 14px; }
  .nav-links { gap: 0.5rem; }
  .mobile-menu-btn { display: block; position: static; }

  .desktop-links { 
    display: none;
    flex-direction: column;
    position: absolute;
    top: 50px;
    right: 15px; 
    background: var(--bg-white);
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 220px;
    padding: 1rem;
    gap: 1rem;
    z-index: 1000;
  }
  .desktop-links.mobile-open { display: flex; }
  
  .user-actions { 
    padding-left: 0; 
    border-left: none; 
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-top: 5px;
    border-top: 1px solid var(--border-color);
    padding-top: 1rem;
  }
  
  .dropdown-menu { width: 90vw; max-width: 300px; top: 100%; left: 50%; transform: translateX(-50%); }
  .submenu { position: relative; left: 0; top: 0; width: 100%; min-width: 100%; box-shadow: none; background: var(--bg-body); margin-top: 5px; }
  .container { padding: 0 15px 1rem; }
  .footer-content { flex-direction: column; text-align: center; align-items: center;}
}
</style>