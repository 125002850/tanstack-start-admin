import { expect, test } from '@playwright/test';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('@ai-sso authenticated storage reaches local dashboard on port 3000', async ({
  page,
  baseURL
}) => {
  const expectedOrigin = new URL(baseURL ?? 'http://localhost:3000').origin;

  await page.goto('/dashboard/overview', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(
    new RegExp(`^${escapeRegExp(expectedOrigin)}/dashboard/overview(?:[?#].*)?$`)
  );
  await expect(page.getByText('OIG统一登录认证平台')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /15574898704/ })).toBeVisible({
    timeout: 15_000
  });
  await expect
    .poll(async () =>
      page.evaluate(() => (localStorage.getItem('sso_token') ? 'present' : 'missing'))
    )
    .toBe('present');
});
