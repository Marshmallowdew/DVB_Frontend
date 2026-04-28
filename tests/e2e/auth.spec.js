import { test, expect } from '@playwright/test';

const delay = ms => new Promise(res => setTimeout(res, ms));

test.describe('Сценарий: Авторизация', () => {
  test('Успешный вход по Email', async ({ page }) => {
    // 1. Глобальный перехватчик 
    await page.route('**/api/**', async route => {
      const request = route.request();
      if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
        return route.continue();
      }

      await delay(10);
      const url = request.url();
      
      // Запросы авторизации
      if (url.includes('/api/users/auth/request-otp/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: "OK" }) });
      } 
      else if (url.includes('/api/users/auth/verify-otp/')) {
        await route.fulfill({ 
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ access: "fake", refresh: "fake", is_new_user: false }) 
        });
      } 
      // Запрос профиля (вызывается из authStore после verifyOtp)
      else if (url.includes('/api/users/profile/')) {
        await route.fulfill({ 
          status: 200, contentType: 'application/json', 
          body: JSON.stringify({ id: 1, first_name: "Иван", role: "client", cars: [] }) 
        });
      } 
      // мок филиалов
      else if (url.includes('/api/branches')) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([{ id: 1, name: "Москва", address: "ул. Ленина", phone_number: "8999" }])
        });
      }
      else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    // 2. Идем на страницу логина
    await page.goto('https://localhost:5173/login', { waitUntil: 'networkidle' });

    // 3. Вводим почту
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@example.com');
    await page.locator('button[type="submit"]').first().click();

    // 4. Ждем поле для кода и вводим его
    const codeInput = page.locator('input:not([type="email"])').first();
    await codeInput.waitFor({ state: 'visible', timeout: 5000 });
    await codeInput.fill('123456');

    // 5. Кликаем кнопку "Войти"
    const loginBtn = page.locator('button[type="submit"]').last();
    await loginBtn.click();

    // 6. Проверяем редирект
    await page.waitForURL('**/my-orders');
    
    // 7. Проверяем, что в шапке появилось имя
    const profileLink = page.locator('.user-profile-link');
    await profileLink.waitFor({ state: 'visible', timeout: 5000 });
    await expect(profileLink).toBeVisible();
    await expect(profileLink).toContainText('Иван', { ignoreCase: true });
  });
});