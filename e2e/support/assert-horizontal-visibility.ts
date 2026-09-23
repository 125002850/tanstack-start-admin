import { expect, type Locator } from '@playwright/test';

export async function expectHorizontallyVisible(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    let left = 0;
    let right = window.innerWidth;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowX)) {
        const ancestor = parent.getBoundingClientRect();
        left = Math.max(left, ancestor.left);
        right = Math.min(right, ancestor.right);
      }
    }
    return { left: rect.left, right: rect.right, clipLeft: left, clipRight: right };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(bounds.clipLeft - 1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.clipRight + 1);
}
