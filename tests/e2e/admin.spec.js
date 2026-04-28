import { test, expect } from '@playwright/test';

const delay = ms => new Promise(res => setTimeout(res, ms));

test.describe('Сценарий Администратора: Обработка заявки', () => {
  
  test.beforeEach(async ({ page }) => {
    
    await page.route('**/ws/notifications/**', route => route.abort());

    //  Глобальный перехватчик для Админки
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
          body: JSON.stringify({ access: "fake-admin", refresh: "fake-admin", is_new_user: false }) 
        });
      } else if (url.includes('/api/users/profile/')) {
        await route.fulfill({ 
          status: 200, contentType: 'application/json', 
          body: JSON.stringify({ id: 99, first_name: "Анна", role: "manager", branch: { id: 1, name: "Москва" }, cars: [] }) 
        });
      } else if (url.includes('/api/branches')) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([{ id: 1, name: "Москва", address: "ул. Ленина" }])
        });
      }
      
      else if (url.includes('/api/orders') && method === 'GET') {
        const orderData = [
          { 
            id: 500, 
            status: 'pending', 
            status_display: 'Ожидает',
            service: { name: "Замена масла" }, 
            appointment_time: "2026-04-10T10:00:00Z",
            car_brand: "Toyota",
            car_model: "Camry",
            client_last_name: "Иванов",
            client_first_name: "Иван",
            client_phone: "89990001122"
          }
        ];
        
        // ИСПРАВЛЕНО: возвращаем чистый объект с results (стандарт Django REST)
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ results: orderData })
        });
      } 
      
      else if (url.includes('/api/orders/500') && (method === 'PATCH' || method === 'PUT')) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 500, status: 'confirmed' })
        });
      } 
      else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    // 3. UI-ЛОГИН
    await page.goto('https://localhost:5173/login', { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill('manager@autoservice.ru');
    await page.locator('button[type="submit"]').first().click();
    
    const codeInput = page.locator('input:not([type="email"])').first();
    await codeInput.waitFor({ state: 'visible' });
    await codeInput.fill('123456');
    await page.locator('button[type="submit"]').last().click();

    // Ждем редиректа в админку
    await page.waitForURL('**/*');
    await page.goto('https://localhost:5173/admin', { waitUntil: 'networkidle' });
  });

  test('Смена статуса новой заявки', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Панель управления', { ignoreCase: true });

    const ordersTabBtn = page.locator('button', { hasText: 'Заказ-наряды' });
    await ordersTabBtn.click();

    await expect(page.locator('text="Загрузка..."')).toBeHidden({ timeout: 10000 });

    const orderRow = page.locator('tbody tr').first();
    await orderRow.waitFor({ state: 'visible', timeout: 10000 });

    const statusSelect = orderRow.locator('select');
    await expect(statusSelect).toBeVisible();

    await statusSelect.selectOption('confirmed');

    await page.waitForTimeout(500);

    await expect(statusSelect).toHaveValue('confirmed');
  });
});