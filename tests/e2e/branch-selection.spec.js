import { test, expect } from '@playwright/test';

test.describe('Главная страница: Выбор филиала', () => {
  test('Пользователь может выбрать город и филиал', async ({ page }) => {
    // 1. Переходим на локальный сервер (убедитесь, что порт совпадает с вашим)
    await page.goto('https://localhost:5173/');

    // 2. Проверяем, что кнопка выбора города отображает текст по умолчанию
    const cityBtn = page.locator('.city-btn');
    await expect(cityBtn).toContainText('Выберите город');

    // 3. Наводим курсор на кнопку, чтобы открылось выпадающее меню
    await cityBtn.hover();

    // 4. Наводим курсор на первый город в списке
    const firstCity = page.locator('.city-name').first();
    await firstCity.hover();

    // 5. Кликаем по первому появившемуся филиалу в подменю
    const firstBranch = page.locator('.branch-address').first();
    await firstBranch.click();

    // 6. Проверяем, что в адресной строке появился параметр branch
    await expect(page).toHaveURL(/.*branch=\d+.*/);
  });
});