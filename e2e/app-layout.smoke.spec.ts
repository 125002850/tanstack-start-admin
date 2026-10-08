import {
  mockWorkspacePageData,
  expectNoUnexpectedWorkspaceApiRequests
} from './support/mock-workspace-page-data';
import { expect, test } from '@playwright/test';
import { mockLoginInfo } from './support/mock-login-info';

test('@workspace-v2 AppLayout supports two-level navigation', async ({ page }) => {
  await mockLoginInfo(page);
  await mockWorkspacePageData(page);
  await page.goto('/overview');
  const center = page.getByRole('button', { name: '系统管理', exact: true });
  await center.click();
  await page.getByRole('link', { name: '字典管理', exact: true }).click();
  await expect(page).toHaveURL(/\/system-management\/dictionaries$/);
  await expect(page.getByRole('tab', { name: /^字典管理/ })).toBeVisible();
  await center.click();
  await expect(page.getByRole('link', { name: '字典管理', exact: true })).toBeHidden();
  await center.click();
  await expect(page.getByRole('link', { name: '字典管理', exact: true })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expectNoUnexpectedWorkspaceApiRequests(page);
});
