import { test, expect } from '@playwright/test'

/**
 * Task 0: Performance Profiling & Column Width Stability Gate
 *
 * Tests the current absolute-position virtual rows prototype at perPage=2000.
 */

const PRODUCT_URL = '/dashboard/product'
const SCROLL_TARGET = '[data-scroll-target-id="products-table"]'

test('task0: baseline — perPage=2000 profiling, column width stability, sticky header @workspace-v2-rollback', async ({ page }) => {
  // Set perPage=2000 via localStorage BEFORE navigating, avoiding the runtime
  // Suspense remount that breaks the current prototype's virtualizer.
  await page.goto(PRODUCT_URL)
  await page.evaluate(() => {
    localStorage.setItem('app-data-table-per-page', '2000')
  })

  // Reload to pick up localStorage page size
  await page.reload()
  await page.waitForSelector(SCROLL_TARGET, { timeout: 15000 })

  // Wait for Suspense + data to settle after remount
  await page.waitForTimeout(3000)

  const viewport = page.locator(SCROLL_TARGET)
  await expect(viewport).toBeVisible()

  // Wait for potential Suspense remount after perPage change
  // useSuspenseQuery triggers a new query key → suspend → unmount → remount
  await page.waitForTimeout(3000)

  // === Profiling: DOM baseline ===
  const tbodyRows = await viewport.locator('tbody tr').count()
  const rowsWithDataIndex = await viewport.locator('tbody tr[data-index]').count()
  const scrollHeight = await viewport.evaluate((el) => el.scrollHeight)
  const clientHeight = await viewport.evaluate((el) => el.clientHeight)

  console.log(`[Task0] tbody row count: ${tbodyRows}`)
  console.log(`[Task0] virtual rows (data-index): ${rowsWithDataIndex}`)
  console.log(`[Task0] scrollHeight=${scrollHeight}, clientHeight=${clientHeight}`)
  console.log(`[Task0] DOM reduction: ${tbodyRows} rows vs expected 2000`)

  // Check perPage value
  const perPageCombobox = page.locator('[role="combobox"]').last()
  const perPageVal = await perPageCombobox.textContent().catch(() => 'unknown')
  console.log(`[Task0] Current perPage display: ${perPageVal}`)

  // === Column Width Stability Gate ===
  const measureHeaderWidths = async () => {
    return viewport.locator('thead th').evaluateAll((ths) =>
      ths.map((th) => ({
        text: th.textContent?.trim().slice(0, 20) ?? '',
        width: Math.round(th.getBoundingClientRect().width),
      }))
    )
  }

  const widthsTop = await measureHeaderWidths()
  console.log(`[Task0] Header widths at top:`, JSON.stringify(widthsTop))

  // Scroll to middle
  await viewport.evaluate((el) => {
    const maxScroll = el.scrollHeight - el.clientHeight
    el.scrollTop = Math.floor(maxScroll / 2)
  })
  await page.waitForTimeout(500)

  const widthsMid = await measureHeaderWidths()
  console.log(`[Task0] Header widths at middle:`, JSON.stringify(widthsMid))

  // Assert column width stability (within 1px)
  for (let i = 0; i < widthsTop.length; i++) {
    const wTop = widthsTop[i]?.width ?? 0
    const wMid = widthsMid[i]?.width ?? 0
    expect(Math.abs(wTop - wMid)).toBeLessThanOrEqual(1)
  }
  console.log('[Task0] Column Width Stability Gate: PASS')

  // === Sticky Header Gate ===
  const headerTop = await viewport.locator('thead').evaluate((el) =>
    Math.round(el.getBoundingClientRect().top)
  )
  const viewportTop = await viewport.evaluate((el) =>
    Math.round(el.getBoundingClientRect().top)
  )
  expect(Math.abs(headerTop - viewportTop)).toBeLessThanOrEqual(1)

  await viewport.evaluate((el) => {
    const maxScroll = el.scrollHeight - el.clientHeight
    el.scrollTop = Math.min(500, maxScroll)
  })
  await page.waitForTimeout(500)

  const headerTopAfter = await viewport.locator('thead').evaluate((el) =>
    Math.round(el.getBoundingClientRect().top)
  )
  const viewportTopAfter = await viewport.evaluate((el) =>
    Math.round(el.getBoundingClientRect().top)
  )
  expect(Math.abs(headerTopAfter - viewportTopAfter)).toBeLessThanOrEqual(1)
  console.log('[Task0] Sticky header gate: PASS')

  // === Telemetry audit ===
  const events = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    return w.__DATA_TABLE_VIRTUAL_EVENTS__ ?? 'not found'
  })
  const virtualEnabled = await viewport.evaluate((el) =>
    el.getAttribute('data-virtual-enabled')
  )
  console.log(`[Task0] Virtual events:`, events)
  console.log(`[Task0] data-virtual-enabled: ${virtualEnabled ?? 'not set'}`)
})
