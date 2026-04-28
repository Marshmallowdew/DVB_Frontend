<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// Состояния
const email = ref('')
const otpCode = ref('')

const isCodeSent = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Таймер
const countdown = ref(0)
let timerInterval = null

// Функция запуска таймера
const startTimer = () => {
  countdown.value = 60
  if (timerInterval) clearInterval(timerInterval)
  
  timerInterval = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timerInterval)
    }
  }, 1000)
}

// Очищаем интервал при уходе со страницы, чтобы не было утечек памяти
onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

const handleSubmit = async () => {
  if (!isCodeSent.value) {
    await handleRequestOtp()
  } else {
    await handleVerifyOtp()
  }
}

// Отправка кода
const handleRequestOtp = async () => {
  if (!email.value.includes('@')) {
    errorMessage.value = 'Пожалуйста, введите корректный Email'
    return
  }

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Вызываем метод из Store
    await authStore.requestOtp(email.value)
    
    successMessage.value = 'Код отправлен на вашу почту!'
    isCodeSent.value = true 
    startTimer() // Запускаем таймер при успешной отправке
    
  } catch (error) {
    // Если бэкенд вернул 429 Too Many Requests
    if (error.response?.status === 429) {
      errorMessage.value = 'Письмо уже отправлено. Подождите 1 минуту.'
      isCodeSent.value = true // Переводим на шаг ввода пароля
      startTimer() // Запускаем таймер, даже если была ошибка 429
    } else if (error.response?.data?.detail) {
      errorMessage.value = error.response.data.detail
    } else {
      errorMessage.value = 'Ошибка отправки кода. Попробуйте позже.'
    }
  } finally {
    loading.value = false
  }
}

// Проверка кода и редирект
const handleVerifyOtp = async () => {
  if (otpCode.value.length < 6) {
    errorMessage.value = 'Код должен состоять из 6 цифр'
    return
  }

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Вызываем метод из Store, который возвращает is_new_user
    const isNewUser = await authStore.verifyOtp(email.value, otpCode.value)
    
    // Редиректы
    if (isNewUser) {
      router.push('/my-orders') // Если профиль пустой, пусть заполнит имя и телефон
    } else if (authStore.isAdmin || authStore.isStaff) {
      router.push('/admin') // Админов и менеджеров кидаем в панель
    } else {
      router.push('/my-orders') // Обычных клиентов - в заказы
    }

  } catch (error) {
    if (error.response?.status === 400) {
      errorMessage.value = 'Неверный код или срок его действия истек.'
    } else {
      errorMessage.value = 'Произошла непредвиденная ошибка.'
    }
    otpCode.value = '' // Очищаем поле при ошибке
  } finally {
    loading.value = false
  }
}

const resetState = () => {
  isCodeSent.value = false
  otpCode.value = ''
  errorMessage.value = ''
  successMessage.value = ''
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <h2>Вход в личный кабинет</h2>
      
      <div v-if="errorMessage" class="alert error">{{ errorMessage }}</div>
      <div v-if="successMessage" class="alert success">{{ successMessage }}</div>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>Email</label>
          <div class="email-input-wrapper">
            <input 
              v-model.trim="email" 
              type="email" 
              placeholder="почта@mail.ru" 
              required 
              :disabled="loading || isCodeSent"
            >
            <button 
              v-if="isCodeSent" 
              type="button" 
              class="edit-email-btn" 
              @click="resetState"
              :disabled="loading"
            >
              ✎ Изменить
            </button>
          </div>
        </div>

        <div class="form-group" :class="{ 'disabled-group': !isCodeSent }">
          <label>Пароль из письма</label>
          <input 
            v-model.trim="otpCode" 
            type="text" 
            placeholder="Вам придет 6 цифр" 
            maxlength="6"
            :disabled="!isCodeSent || loading"
            :required="isCodeSent"
            class="otp-input"
          >
          
          <!-- Кнопка повторной отправки кода -->
          <div v-if="isCodeSent" class="resend-container">
            <button 
              type="button" 
              class="resend-btn" 
              @click="handleRequestOtp" 
              :disabled="countdown > 0 || loading"
            >
              {{ countdown > 0 ? `Повторить отправку через ${countdown} сек` : 'Отправить код еще раз' }}
            </button>
          </div>
        </div>

        <button 
          type="submit" 
          class="submit-btn" 
          :disabled="loading || (!isCodeSent && countdown > 0)"
        >
          <span v-if="loading">Подождите...</span>
          <span v-else-if="!isCodeSent">
            {{ countdown > 0 ? `Отправить пароль (${countdown} сек)` : 'Отправить пароль' }}
          </span>
          <span v-else>Войти</span>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-container { display: flex; justify-content: center; align-items: center; min-height: 70vh; }
.auth-card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
h2 { text-align: center; margin-bottom: 25px; color: #2c3e50; }

.form-group { margin-bottom: 20px; transition: opacity 0.3s; }
.disabled-group { opacity: 0.6; }
label { display: block; margin-bottom: 5px; color: #555; font-size: 14px; font-weight: 500;}
input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box; transition: border 0.3s;}
input:focus:not(:disabled) { border-color: #42b983; outline: none; }
input:disabled { background-color: #f5f5f5; cursor: not-allowed; color: #888; }

.email-input-wrapper { position: relative; }
.edit-email-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #42b983; cursor: pointer; font-size: 13px; padding: 5px; }
.edit-email-btn:hover { color: #2c3e50; }

.otp-input { letter-spacing: 2px; }

/* Стили для кнопки "Отправить код еще раз" */
.resend-container { margin-top: 8px; text-align: right; }
.resend-btn { background: none; border: none; color: #42b983; font-size: 13px; cursor: pointer; padding: 0; transition: color 0.3s; }
.resend-btn:disabled { color: #aaa; cursor: not-allowed; text-decoration: none; }
.resend-btn:hover:not(:disabled) { color: #2c3e50; text-decoration: underline; }

.submit-btn { width: 100%; padding: 14px; background-color: #42b983; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 10px; transition: background 0.3s;}
.submit-btn:hover:not(:disabled) { background-color: #3aa876; }
.submit-btn:disabled { background-color: #a0d8bf; cursor: not-allowed; }

.alert { padding: 12px; border-radius: 6px; margin-bottom: 20px; text-align: center; font-size: 14px; }
.error { background-color: #ffebee; color: #c62828; border: 1px solid #ffcdd2; }
.success { background-color: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; }
</style>