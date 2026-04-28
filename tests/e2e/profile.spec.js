import { test, expect } from '@playwright/test';

const delay = ms => new Promise(res => setTimeout(res, ms));

test.describe('Сценарий: Личный кабинет', () => {
  
  test.beforeEach(async ({ page }) => {
    // Глобальный мок с искусственной задержкой
    await page.route('**/api/**', async route => {
      const request = route.request();
      if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
        return route.continue();
      }

      await delay(10);
      const url = request.url();
      
      if (url.includes('/api/users/auth/request-otp/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: "OK" }) });
      } 
      else if (url.includes('/api/users/auth/verify-otp/')) {
        await route.fulfill({ 
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ access: "fake", refresh: "fake", is_new_user: false }) 
        });
      } 
      else if (url.includes('/api/users/profile/')) {
        await route.fulfill({ 
          status: 200, contentType: 'application/json', 
          body: JSON.stringify({ id: 1, first_name: "Иван", role: "client", cars: [] }) 
        });
      } 
      else if (url.includes('/api/branches')) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([{ id: 1, name: "Москва", address: "ул. Ленина", phone_number: "8999" }])
        });
      } 
      else if (url.includes('/api/orders')) {
        await route.fulfill({
          status: 200, 
          contentType: 'application/json',
          body: JSON.stringify([
            { 
              id: 1, 
              status: 'confirmed', 
              status_display: 'Подтвержден',
              service: { name: "Замена масла" }, 
              appointment_time: "2026-04-10T10:00:00Z",
              car_brand: "Toyota",
              car_model: "Camry"
            }
          ])
        });
      } 
      else if (url.includes('/api/notifications')) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ results: [{ id: 1, message: "Запись подтверждена", is_read: false, created_at: "2026-04-01T12:00:00Z" }] })
        });
      } 
      else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    // Идем на страницу логина и ждем полной загрузки скриптов
    await page.goto('https://localhost:5173/login', { waitUntil: 'networkidle' });
    
    // Выполняем UI логин
    await page.locator('input[type="email"]').fill('test@test.ru');
    await page.locator('button[type="submit"]').first().click();
    
    const codeInput = page.locator('input:not([type="email"])').first();
    await codeInput.waitFor({ state: 'visible' });
    await codeInput.fill('123456');
    await page.locator('button[type="submit"]').last().click();

    // Ждем редиректа в профиль
    await page.waitForURL('**/my-orders');
    
    await page.waitForSelector('.orders-container', { state: 'visible', timeout: 10000 });
  });

  test('Отображение страницы "Мои записи"', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Мои записи', { ignoreCase: true });
    
    // Ждем, пока лоадер исчезнет и появится карточка
    const orderCard = page.locator('text="Замена масла"').first();
    await orderCard.waitFor({ state: 'visible', timeout: 5000 });
    await expect(orderCard).toBeVisible();
  });

  test('Открытие меню уведомлений', async ({ page }) => {
    // Ищем кнопку колокольчика
    const bellBtn = page.locator('.icon-container').first();
    await bellBtn.waitFor({ state: 'visible' });
    
    await bellBtn.click();

    // Проверяем наличие мокового уведомления в выпадающем списке
    const notificationText = page.locator('text="Запись подтверждена"').first();
    await expect(notificationText).toBeVisible();
  });
});