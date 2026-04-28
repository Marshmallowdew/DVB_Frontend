import { test, expect } from '@playwright/test';

test.describe('Сценарий: Навигация и выбор филиала', () => {
  test('Смена города обновляет URL и контакты в футере', async ({ page }) => {
    await page.goto('https://localhost:5173/');

    // Открываем меню городов
    const cityBtn = page.locator('.city-btn');
    await cityBtn.hover();

    // Наводим на первый город
    const firstCity = page.locator('.city-name').first();
    await firstCity.hover();

    // Кликаем по первому филиалу
    const firstBranch = page.locator('.branch-address').first();
    const branchText = await firstBranch.textContent();
    await firstBranch.click();

    // Проверяем URL
    await expect(page).toHaveURL(/.*branch=\d+.*/);

    // Проверяем, что кнопка города теперь содержит адрес или название
    await expect(cityBtn).not.toContainText('Выберите город');

    // Проверяем, что футер обновил контакты (пропала заглушка)
    const footerContacts = page.locator('.footer-contacts');
    await expect(footerContacts).not.toContainText('Выберите город в верхнем меню');
  });
});