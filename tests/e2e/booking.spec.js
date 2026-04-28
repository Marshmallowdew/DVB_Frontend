import { test, expect } from '@playwright/test';

const delay = ms => new Promise(res => setTimeout(res, ms));

test.describe('Сценарий: Оформление записи', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async route => {
      const request = route.request();
      if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
        return route.continue();
      }

      await delay(10);
      const url = request.url();
      const method = request.method();
      
      if (url.includes('/api/users/auth/request-otp/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: "OK" }) });
      } else if (url.includes('/api/users/auth/verify-otp/')) {
        await route.fulfill({ 
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ access: "fake", refresh: "fake", is_new_user: false }) 
        });
      } else if (url.includes('/api/users/profile/')) {
        await route.fulfill({ 
          status: 200, contentType: 'application/json', 
          body: JSON.stringify({ id: 1, first_name: "Иван", role: "client", cars: [] }) 
        });
      } else if (url.includes('/api/branches')) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([{ id: 1, name: "Москва", address: "ул. Ленина", phone_number: "8999" }])
        });
      } 

      else if (url.includes('/api/departments')) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([{ id: 10, name: "Шиномонтаж", is_active: true }])
        });
      } else if (url.includes('/api/services')) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([{ id: 5, name: "Замена колеса", price: 1000, duration_minutes: 30, department: 10 }])
        });
      } 
       
      else if (url.includes('/api/orders/available-slots')) {
        // Возвращаем слоты в формате BookingView
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ slots: ["10:00", "11:00", "12:00"] })
        });
      } else if (url.includes('/api/cars') && method === 'GET') {
        // Имитируем пустой гараж, чтобы появилась форма добавления машины
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      } else if (url.includes('/api/cars') && method === 'POST') {
        // Успешное добавление машины
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 1, brand: 'Toyota', model: 'Camry' }) });
      } else if (url.includes('/api/orders') && method === 'POST') {
        // Успешное создание заказа
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 999, status: 'pending' }) });
      } 
      else {
        // Заглушка для всего остального
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    await page.goto('https://localhost:5173/login', { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill('test@test.ru');
    await page.locator('button[type="submit"]').first().click();
    
    const codeInput = page.locator('input:not([type="email"])').first();
    await codeInput.waitFor({ state: 'visible' });
    await codeInput.fill('123456');
    await page.locator('button[type="submit"]').last().click();

    await page.waitForURL('**/my-orders');
  });

  test('Полный цикл записи на услугу', async ({ page }) => {
    // 1. Идем на главную страницу
    await page.goto('https://localhost:5173/?branch=1');

    // 2. Ждем появления карточки отдела и кликаем
    const firstDept = page.locator('.department-card').first();
    await firstDept.waitFor({ state: 'visible', timeout: 10000 });
    await firstDept.click();

    // 3. Выбираем первую услугу 
    const firstServiceBtn = page.locator('.btn-book').first();
    await firstServiceBtn.waitFor({ state: 'visible' });
    await firstServiceBtn.click();

    // 4. Проверяем URL
    await page.waitForURL(/.*book\?service=\d+/);

    // 5. Выбираем дату 
    const firstDate = page.locator('.date-item:not(.calendar-btn)').first();
    await firstDate.waitFor({ state: 'visible', timeout: 5000 });
    await firstDate.click();

    // 6. Выбираем время (слот)
    const firstSlot = page.locator('.slot-item').first();
    await firstSlot.waitFor({ state: 'visible', timeout: 5000 });
    await firstSlot.click();

    // 7. Добавляем автомобиль
    const brandInput = page.locator('.add-car-box input').first();
    await brandInput.waitFor({ state: 'visible' });
    await brandInput.fill('Toyota');
    
    // Кликаем по первой выскочившей подсказке автокомплита для Марки
    await page.locator('.autocomplete-list li', { hasText: 'Toyota' }).click();

    // Ищем второе поле ввода (Модель) в форме добавления машины
    const modelInput = page.locator('.add-car-box input').nth(1);
    await modelInput.waitFor({ state: 'visible' });
    await modelInput.fill('Camry');

    // Кликаем по первой подсказке для Модели
    await page.locator('.autocomplete-list li', { hasText: 'Camry' }).click();
    
    // Вводим госномер (третье поле ввода)
    const numberInput = page.locator('.add-car-box input').nth(2);
    await numberInput.fill('А111АА77');
    
    // Кликаем Сохранить и выбрать
    await page.locator('.btn-save-car').click();
  });
});