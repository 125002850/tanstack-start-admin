# Column Resize Preview Overlay Implementation Plan

**Goal:** Add a native-DOM overlay that shows real-time column width preview during drag, avoiding React re-renders in the table component tree during mousemove.
**Architecture:** All drag-time rendering happens via `document.createElement` / direct style mutations on a single overlay div. React only participates on mousedown (create overlay, register listeners) and mouseup (commit via `table.setColumnSizing`). The `columnResizeMode: 'onEnd'` config stays unchanged — TanStack only commits on mouseup. This keeps the performance profile optimal: the business table avoids React reconciliation during 60fps drag, unlike a React-state-based approach which would trigger reconciliation on every mousemove. (Note: TanStack internally updates `columnSizingInfo.isResizingColumn` once at drag start, which is a single React state update — not per-frame.)
**Tech Stack:** React 19, TypeScript, TanStack Table v8 (`columnResizeMode: 'onEnd'`), Tailwind CSS, native DOM APIs.

---

## Design Decision Record

### Why native DOM overlay, not React-state-based overlay

An alternative approach stores preview state in React (`useState({ columnId, previewWidth, columnLeft })`) and renders overlay as a React component, calling `setState` on every mousemove.

**Rejected because:**

1. **Performance equivalence to `onChange` mode.** `columnResizeMode: 'onEnd'` exists precisely to avoid per-pixel re-renders during drag. Mousemove-driven `setState` triggers React reconciliation on every frame — the same cost profile as `onChange`, defeating the purpose of `onEnd`.
2. **Engineering complexity.** A React overlay requires: injecting state context into the table component tree, throttling `setState` to 60fps, managing React batching vs browser paint timing, and avoiding parent reconciliation. The native-DOM approach is ~50 lines vs ~200+ lines for the React equivalent.
3. **Correct abstraction level.** Drag feedback is a rendering-layer concern — moving a visual indicator — not a declarative state change. Native DOM is the right tool for "move this div to here, now here, now here" without entering React's declarative pipeline.
4. **TanStack community consensus.** The `onEnd` + native DOM overlay pattern is the standard approach in TanStack Table community when visual preview is needed during resize.

### Why mouse/touch dual handlers, not Pointer Events

An alternative unifies mouse and touch via Pointer Events (`onPointerDown`, `setPointerCapture`, `pointermove`, `pointerup`, `pointercancel`).

**Rejected because:**

1. **TanStack compatibility.** TanStack Table v8's `header.getResizeHandler()` produces a mouse event handler (`React.MouseEvent`). TypeScript rejects passing a `React.PointerEvent` to it. Using pointer events would require synthesizing a fake `MouseEvent` to pass to TanStack, which is more brittle and error-prone than maintaining two separate handlers.
2. **No practical benefit in this context.** The resize handle is a single narrow element (2.5px wide). `setPointerCapture` is valuable for drag operations that may leave the element bounds (e.g., dragging a card across the screen), but a column resize drag always stays within the document body — global `document` event listeners already capture all mousemove/mouseup regardless of pointer position. Pointer capture adds no value here.
3. **Simplicity.** The mouse and touch handlers share the same core logic (`resizeHandler` call + overlay lifecycle). Maintaining two thin wrappers is simpler than bridging the Pointer Event → Mouse Event impedance mismatch with TanStack.

---

## File Structure

- Modify: `src/components/ui/table/data-table-column-resize-handle.tsx`
- Modify: `src/components/ui/table/data-table.tsx` (add `data-table-resize-overlay-root` attribute)
- Create: `src/lib/data-table-column-resize-overlay.ts` (pure width-clamp + position-calc functions)
- Create: `src/lib/data-table-column-resize-overlay.test.ts`
- Create: `src/components/ui/table/data-table-column-resize-handle.test.tsx`
- Reference: `src/hooks/use-data-table.ts` (columnResizeMode: 'onEnd', line 411; persistence: lines 439-463)
- Reference: `src/lib/data-table-column-resize-storage.ts` (saveColumnSizing persistence layer)
- Reference: `src/components/ui/table/data-table-body.tsx` (virtual scroll transform — overlay must mount outside this)
- Reference: `src/components/ui/scroll-area.tsx` (Radix ScrollArea — viewport has `data-slot='scroll-area-viewport'`)

---

### Task 1: Browser Preflight — Verify Resize Selectors and DOM Structure

**Type:** `infra`

**Files**
- Reference: `src/components/ui/table/data-table.tsx`
- Reference: `src/components/ui/table/data-table-column-resize-handle.tsx`
- Reference: `src/hooks/use-data-table.ts`

**Shared Runtime Contracts**
- `none`

**Invariants**
- Dev server must serve the products page with virtual scrolling active
- Resize handle elements must be interactable via Playwright
- `columnResizeMode` confirmed as `'onEnd'` at `use-data-table.ts:411`

**Constraints**
- Must not change any source files

**Acceptance Criteria**
- [ ] Playwright can locate resize handles via CSS selector `[data-slot=table] thead th div[data-resizing]`
- [ ] Playwright confirms DOM structure: `[data-table-resize-overlay-root] > [data-slot=scroll-area] > [data-slot='scroll-area-viewport'] > table`
- [ ] Playwright confirms the horizontal scroll element is `[data-slot='scroll-area-viewport']` (Radix viewport), not the overlay root
- [ ] `columnResizeMode` confirmed as `'onEnd'` in running code
- [ ] Existing alignment tests still pass (regression smoke)

**Verification Profile**
- `profile: task-1-core`
  - `npx vitest run src/components/ui/table/data-table.alignment.test.tsx`
  - Playwright: navigate to `/dashboard/product`, verify:
    - `document.querySelector('[data-slot=table] thead th')` exists
    - `table.getAttribute('style')` includes `table-layout: fixed`
    - `div[data-resizing]` elements exist in each `th`
    - `document.querySelector('[data-table-resize-overlay-root]')` exists (the overlay mount point)
    - `document.querySelector('[data-slot="scroll-area-viewport"]')` is the actual scroll element (verify `scrollLeft` works on this element, not the root)
- **Expected Signals:** 6 alignment tests pass. Playwright returns `tableLayout: "fixed"`, overlay root exists, scroll viewport identified correctly.

**Verification Strategy**
- `build + smoke`

**Browser Gate Role**
- `preflight`

- [ ] Step 1: Run `npx vitest run src/components/ui/table/data-table.alignment.test.tsx`
- [ ] Step 2: Run `npx vitest run src/components/ui/table/data-table.test.tsx src/hooks/use-data-table.internal-state.test.tsx` — confirm no regression
- [ ] Step 3: Playwright — navigate to product page, confirm:
  - `table-layout: fixed`
  - Resize handles render per column header
  - DOM nesting: `absolute inset-0` div (target for `data-table-resize-overlay-root`) > `[data-slot=scroll-area]` > `[data-slot="scroll-area-viewport"]` (actual scroll element) > `table`
  - `scrollLeft` is functional on `[data-slot="scroll-area-viewport"]`, not on the `absolute inset-0` div
- [ ] Step 4: Verify `columnResizeMode` is `'onEnd'` at `src/hooks/use-data-table.ts:411`

---

### Task 2: Extract Pure Width Calculation Functions (TDD)

**Type:** `behavior`

**Files**
- Create: `src/lib/data-table-column-resize-overlay.ts`
- Create: `src/lib/data-table-column-resize-overlay.test.ts`

**Shared Runtime Contracts**
- `none`

**Invariants**
- All functions are pure — no DOM access, no side effects
- Functions accept and return plain numbers/objects only

**Constraints**
- Must not import any React, TanStack, or DOM APIs
- Must not depend on any existing module except TypeScript types

**Acceptance Criteria**
- [ ] `clampWidth` clamps to minSize and maxSize at both ends
- [ ] `clampWidth` handles deltaX that would go below minSize
- [ ] `clampWidth` handles deltaX that would go above maxSize
- [ ] `clampWidth` handles default minSize (80) and maxSize (Infinity) when undefined
- [ ] `calculateOverlayLeft` accounts for scrollLeft offset
- [ ] `calculateOverlayLeft` handles left-pinned column scenario (left > 0)
- [ ] TypeScript compiles with zero errors

**Verification Profile**
- `profile: task-2-core`
  - `npx vitest run src/lib/data-table-column-resize-overlay.test.ts`
- **Expected Signals:** All tests pass covering min/max clamp, scrollLeft offset, pinning offset.

**Verification Strategy**
- `TDD` — write tests first, then implement. Pure functions are trivially testable.

**Implementation Recipe**

```ts
// src/lib/data-table-column-resize-overlay.ts

const DEFAULT_MIN_SIZE = 80

/**
 * Clamp a preview width to column min/max constraints.
 * Pure function — no DOM access.
 */
export function clampWidth(
  startWidth: number,
  deltaX: number,
  minSize?: number,
  maxSize?: number,
): number {
  const min = minSize ?? DEFAULT_MIN_SIZE
  const max = maxSize ?? Number.MAX_SAFE_INTEGER
  const raw = startWidth + deltaX
  if (raw < min) return min
  if (raw > max) return max
  return raw
}

export interface OverlayPositionParams {
  /** The column th's left edge relative to viewport */
  columnLeft: number
  /** The overlay root's left edge relative to viewport */
  rootLeft: number
  /** The scroll viewport's current scrollLeft (horizontal scroll offset) */
  scrollLeft: number
}

/**
 * Calculate the overlay's left offset relative to the overlay root.
 * Accounts for horizontal scroll so the overlay stays aligned with the column
 * when the user has scrolled right.
 */
export function calculateOverlayLeft(params: OverlayPositionParams): number {
  return params.columnLeft - params.rootLeft + params.scrollLeft
}
```

- [ ] Step 1: Write tests for `clampWidth`: within range, below minSize, above maxSize, undefined minSize defaults to 80, undefined maxSize allows large values
- [ ] Step 2: Write tests for `calculateOverlayLeft`: no scroll, with scrollLeft > 0, with pinned column offset
- [ ] Step 3: Run tests — expect FAIL
- [ ] Step 4: Implement both functions
- [ ] Step 5: Run `profile: task-2-core` — expect PASS
- [ ] Step 6: Commit `feat: 列宽拖拽预览 — 纯函数宽度计算`

---

### Task 3: Implement Native-DOM Overlay Resize Preview (TDD)

**Type:** `behavior`

**Files**
- Modify: `src/components/ui/table/data-table.tsx` (add `data-table-resize-overlay-root` attribute to the `absolute inset-0` wrapper div)
- Modify: `src/components/ui/table/data-table-column-resize-handle.tsx`
- Create: `src/components/ui/table/data-table-column-resize-handle.test.tsx`
- Reference: `src/lib/data-table-column-resize-overlay.ts` (clampWidth, calculateOverlayLeft)

**Shared Runtime Contracts**
- `none`

**Invariants**
- `columnResizeMode: 'onEnd'` stays unchanged — TanStack Table only commits column sizing on mouseup
- `header.getResizeHandler()` is still called on mousedown — it sets `isResizingColumn` for visual feedback (`data-[resizing=true]` on the handle)
- Column sizing persistence (`saveColumnSizing` in `useDataTable`, lines 439-463) still fires after mouseup (triggered by `isResizingColumn` false→true→false transition)
- Non-resize mouse interactions on the table must not be affected
- Virtual scroll rows must not be affected (overlay mounts outside `<tbody>`, not inside virtualized `position: absolute; transform: translateY()` rows)

**Constraints**
- Modification to `data-table.tsx` is limited to adding ONE `data-table-resize-overlay-root` attribute to the existing `absolute inset-0` wrapper div — no structural or behavioral changes
- Must not modify `data-table-body.tsx` or `use-data-table.ts`
- Must not trigger React state updates during mousemove (no business-table React renders during drag)
- Must not add new props to `DataTableColumnResizeHandle` — the overlay container is located via `closest('[data-table-resize-overlay-root]')`
- Overlay must have `pointer-events: none` — must not block mouse events on the resize handle or table
- Must save and restore `document.body.style.userSelect` and `document.body.style.cursor` to their previous values (not blindly reset to `''`)

**Acceptance Criteria**
- [ ] During drag: a semi-transparent overlay appears at the column's left edge, spanning the full table height
- [ ] During drag: the overlay's `style.width` updates in real-time as the mouse moves (clamped to `minSize`/`maxSize`)
- [ ] On mouseup: overlay is removed; column width snaps to the final position (TanStack commits `onEnd`)
- [ ] On Escape: overlay is removed; column width is restored to `startWidth` via `table.setColumnSizing` (not `resetSize()`, which may use defaultSize)
- [ ] `document.body.style.userSelect` and `cursor` are restored to their pre-drag values on cleanup (not reset to `''`)
- [ ] Existing table tests pass (no regression)
- [ ] `profile: task-3-core` passes (unit tests)
- [ ] `profile: task-3-behavior` passes (Playwright smoke)

**Verification Profile**
- `profile: task-3-core`
  - `npx vitest run src/components/ui/table/data-table-column-resize-handle.test.tsx src/components/ui/table/data-table.test.tsx src/components/ui/table/data-table.alignment.test.tsx`
- **Expected Signals:** All existing tests pass. New resize handle tests pass: overlay creation/destruction lifecycle, width clamping, Escape cancel, userSelect/cursor restore.

- `profile: task-3-behavior`
  - Playwright: navigate to `/dashboard/product`, select 100 rows/page to trigger virtual scroll, locate a resize handle, simulate drag 50px right, verify overlay element exists during drag with correct `style.width` and `style.left`, release mouse, verify overlay removed, verify column width updated, verify th/td still aligned.
- **Expected Signals:** Playwright confirms overlay appears/disappears, column width changes, alignment preserved in virtual scroll mode.

**Verification Strategy**
- `TDD` — write test first (overlay lifecycle), then implement, then run all tests. Playwright smoke for visual confirmation and virtual scroll integration.

- [ ] Step 1: Write `data-table-column-resize-handle.test.tsx` covering:
  - mousedown creates overlay div in `[data-table-resize-overlay-root]` (located via `closest`)
  - mousemove updates overlay `style.width` using clamped value
  - mousemove updates overlay `style.left` accounting for scroll viewport `scrollLeft`
  - mouseup removes overlay from DOM
  - mouseup restores `document.body.style.userSelect` and `cursor` to pre-drag values
  - Escape key removes overlay and restores column width to `startWidth` via `table.setColumnSizing`
  - Overlay is not created when `column.getCanResize()` returns false
  - Overlay has `pointer-events: none`
- [ ] Step 2: Run tests — expect FAIL
- [ ] Step 3: Implement the native-DOM overlay logic in `DataTableColumnResizeHandle`
- [ ] Step 4: Run `profile: task-3-core` — expect PASS
- [ ] Step 5: Run `profile: task-3-behavior` — expect PASS
- [ ] Step 6: Commit `feat: 列宽拖拽预览overlay — 原生DOM渲染，避免mousemove重渲染`

#### Implementation Recipe

**Step 0: Add overlay root attribute to `data-table.tsx`**

Change the `absolute inset-0` wrapper div (line 82) from:
```tsx
<div className='absolute inset-0 flex overflow-hidden rounded-lg border'>
```
to:
```tsx
<div data-table-resize-overlay-root className='absolute inset-0 flex overflow-hidden rounded-lg border'>
```

This provides a stable DOM contract that the resize handle can query via `closest('[data-table-resize-overlay-root]')`, independent of the DOM nesting depth between the handle and the root.

The `DataTableColumnResizeHandle` is then rewritten with these additions:

**Refs (no React state for drag-time values):**
```ts
const overlayRef = useRef<HTMLDivElement | null>(null)
const dragStateRef = useRef<{
  startX: number
  startWidth: number
  minSize: number
  maxSize: number
  columnLeft: number
  overlayRoot: HTMLElement
  scrollViewport: HTMLElement
} | null>(null)
```

**Overlay container discovery (stable DOM contract):**

From the resize handle div (`event.currentTarget`), use `closest` with the explicit data attribute:
```ts
// Find mount points via stable data attributes
const overlayRoot = event.currentTarget.closest('[data-table-resize-overlay-root]') as HTMLElement
const scrollViewport = overlayRoot?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
```

Why this approach: The `data-table-resize-overlay-root` attribute decouples the resize handle from the exact DOM nesting depth. The Radix ScrollArea viewport (`[data-slot="scroll-area-viewport"]`) is the element that actually scrolls horizontally — its `scrollLeft` reflects the real scroll position.

The DOM structure with data attributes:
```
<div data-table-resize-overlay-root className="absolute inset-0 ...">  ← overlay mounts HERE
  <ScrollArea>  ← Radix Root
    <div data-slot="scroll-area-viewport">  ← actual scroll element
      <table>
        <thead>
          <th>
            <resize-handle />  ← event.currentTarget
```

Overlay placement is critical — it's in `data-table-resize-overlay-root`, which is:
- **Outside** `<ScrollArea>` → overlay isn't clipped by `overflow: hidden`
- **Outside** `<tbody>` → not affected by virtual scroll's `transform: translateY()`

**Overlay CSS (set via `element.style`):**
```
position: absolute
top: 0
z-index: 20
height: 100%
pointer-events: none
border-right: 2px solid hsl(var(--primary) / 0.6)
background: hsl(var(--primary) / 0.05)
```

**Overlay left position calculation:**

The overlay's `left` must account for:
1. The column's offset within the table
2. Horizontal scroll position of the Radix viewport (if user scrolled right)

Formula (using pure function from Task 2):
```ts
const left = calculateOverlayLeft({
  columnLeft: th.getBoundingClientRect().left,
  rootLeft: overlayRoot.getBoundingClientRect().left,
  scrollLeft: scrollViewport.scrollLeft,
})
```

Note: `scrollViewport` is `[data-slot="scroll-area-viewport"]` — the Radix viewport, which is the element that actually scrolls. The overlay root (`[data-table-resize-overlay-root]`) has `overflow: hidden` and its `scrollLeft` is always 0.

Edge case — pinned columns: A left-pinned column has `position: sticky; left: Npx`. The `getBoundingClientRect().left` already reflects the sticky offset, so `calculateOverlayLeft` works correctly without special handling.

Edge case — right-pinned columns: Same — `getBoundingClientRect()` reflects the actual rendered position.

**mousedown handler (replaces existing):**
1. Save pre-drag `userSelect` and `cursor` values:
   ```ts
   const prevUserSelect = document.body.style.userSelect
   const prevCursor = document.body.style.cursor
   document.body.style.userSelect = 'none'
   document.body.style.cursor = 'col-resize'
   ```
2. Call `resizeHandler(event)` — TanStack mousedown handler (sets `isResizingColumn`)
3. Locate overlay root and scroll viewport via stable data attributes (see overlay container discovery above).
4. Read column metrics: `startX = event.clientX`, `startWidth = th.offsetWidth`, `minSize = column.columnDef.minSize ?? 80`, `maxSize = column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER`, `columnLeft = calculateOverlayLeft({ columnLeft: th.getBoundingClientRect().left, rootLeft: overlayRoot.getBoundingClientRect().left, scrollLeft: scrollViewport.scrollLeft })`.
5. Create overlay div, apply CSS, append to container.
6. Store drag state in `dragStateRef`.
7. Register document-level `mousemove`, `mouseup`, `keydown` listeners.

**mousemove handler (document level):**
1. `deltaX = event.clientX - dragState.startX`
2. `previewWidth = clampWidth(startWidth, deltaX, minSize, maxSize)` — pure function from Task 2
3. `overlay.style.width = previewWidth + 'px'`
4. No React state updates. No TanStack API calls.

**mouseup handler (document level):**
1. Remove all document listeners: `mousemove`, `mouseup`, `keydown`
2. Restore body styles: `document.body.style.userSelect = prevUserSelect; document.body.style.cursor = prevCursor`
3. `overlay.remove(); overlayRef.current = null; dragStateRef.current = null`
4. TanStack automatically commits the column sizing (because `columnResizeMode` is `'onEnd'`, it detects mouseup internally)

**Escape keydown handler (document level):**
1. Same cleanup as mouseup (remove listeners, restore styles, remove overlay)
2. Restore the column to its pre-drag width:
   ```ts
   table.setColumnSizing((old) => ({
     ...old,
     [header.column.id]: startWidth,
   }))
   ```
   This uses `startWidth` (recorded at mousedown, before any drag) — guaranteed to restore the exact pre-drag width, unlike `header.column.resetSize()` which may restore the column's `defaultSize` rather than the user's last adjusted width.

**Touch support (handleTouchStart):**
Same logic as mousedown, using `event.touches[0].clientX` for position tracking. Touch-specific: register `touchmove`, `touchend`, `touchcancel` on document.

---

### Task 4: Add tableId Runtime-Switch Dev Warning

**Type:** `wiring`

**Files**
- Modify: `src/hooks/use-data-table.ts`

**Shared Runtime Contracts**
- `none`

**Invariants**
- Production builds must not emit the warning (use `import.meta.env.DEV` guard)
- Existing table behavior must not change

**Constraints**
- Must not add new dependencies
- Must not throw or block rendering — warning only

**Acceptance Criteria**
- [ ] In dev mode: changing `tableId` prop at runtime logs a `console.warn`
- [ ] In production: no warning is emitted
- [ ] Existing tests pass

**Verification Profile**
- `profile: task-4-core`
  - `npx vitest run src/hooks/use-data-table.internal-state.test.tsx`
- **Expected Signals:** All existing tests pass. Manual dev-mode check: change tableId prop at runtime → console.warn appears.

**Verification Strategy**
- `build + smoke`

- [ ] Step 1: Add `useRef` to track initial `tableId`, `useEffect` to compare current vs initial, `console.warn` if changed and `import.meta.env.DEV`
- [ ] Step 2: Run `profile: task-4-core` — expect PASS
- [ ] Step 3: Run `npx tsc --noEmit` — expect zero errors
- [ ] Step 4: Commit `chore: tableId 运行时切换开发环境警告`

---

### Task 5: Integration Smoke — Virtual Scroll + Column Alignment After Resize

**Type:** `behavior`

**Files**
- Test: `src/components/ui/table/data-table.alignment.test.tsx` (add resize-with-overlay test case)
- Test: Playwright smoke script

**Shared Runtime Contracts**
- `none`

**Invariants**
- Column resize must not break th/td alignment in virtual scroll mode
- ResizeObserver measurement in DataTableBody must update virtual td widths within one frame of mouseup
- Saved column sizing must persist across page reloads

**Constraints**
- Must not modify production code (only tests)
- Playwright smoke uses existing dev server

**Acceptance Criteria**
- [ ] `profile: task-5-core` passes (full test suite)
- [ ] Playwright: after simulated resize, th/td widths match for all columns (including virtual scroll)
- [ ] Playwright: after page reload, column widths persist from localStorage
- [ ] Playwright: overlay does not leave artifacts in the DOM after drag completes

**Verification Profile**
- `profile: task-5-core`
  - `npx vitest run`
- **Expected Signals:** All tests pass. No regression from Task 3 changes.

**Verification Strategy**
- `regression guard` — run full test suite. Playwright for visual integration smoke.

**Browser Gate Role**
- `regression`

- [ ] Step 1: Add test case to `data-table.alignment.test.tsx`: simulate column resize via `table.setColumnSizing()` → verify colgroup widths update → verify th/td widths match → verify overlay is not present in DOM
- [ ] Step 2: Run `profile: task-5-core`
- [ ] Step 3: Playwright — drag resize handle → verify overlay appears with correct width/position → release at new position → verify overlay removed from DOM → verify th/td aligned → verify column sizing persisted to localStorage → reload page → verify widths restored
- [ ] Step 4: Commit `test: 列宽拖拽预览集成测试 & alignment 回归`

---

## Execution Handoff

This is a linear 5-task plan suitable for single-session execution.

**Recommended execution mode:** `executing-plans`
**Plan path:** `docs/plans/2026-05-29-column-resize-preview-overlay.md`

<!-- Execution appended below during runtime -->

### Task 1 Execution
- Result: pass
- Files changed: none (preflight only)
- Verification: `profile: task-1-core` -> PASS (6 alignment tests + 22 additional tests). Playwright: table-layout:fixed confirmed, scroll viewport identified as `[data-slot="scroll-area-viewport"]`, resize handles render. `columnResizeMode: 'onEnd'` confirmed at line 411.
- Notes: Dev server at localhost:3000 serving correctly. 11 th + 10 resize handles (1 column non-resizable).

### Task 2 Execution
- Result: pass
- Files changed: `src/lib/data-table-column-resize-overlay.ts` (created), `src/lib/data-table-column-resize-overlay.test.ts` (created)
- Verification: `profile: task-2-core` -> PASS (13 tests: 9 clampWidth + 4 calculateOverlayLeft)
- Notes: TDD executed — tests written first, then implementation. `npx tsc --noEmit` clean.

### Task 3 Execution
- Result: pass
- Files changed: `src/components/ui/table/data-table.tsx` (added `data-table-resize-overlay-root` attribute), `src/components/ui/table/data-table-column-resize-handle.tsx` (rewritten with overlay logic), `src/components/ui/table/data-table-column-resize-handle.test.tsx` (created)
- Verification: `profile: task-3-core` -> PASS (20 tests: 8 new overlay tests + 6 alignment + 6 table). `profile: task-3-behavior` -> Playwright confirms overlay mid-drag (`width: 159px, pointer-events: none`), overlay removed on mouseup, column width 134→196px.
- Notes: npx tsc --noEmit clean. Touch handler retained alongside mouse handler (Pointer Events rejected per DDR).

### Task 4 Execution
- Result: pass
- Files changed: `src/hooks/use-data-table.ts` (added tableId runtime-switch dev warning)
- Verification: `profile: task-4-core` -> PASS (16 internal-state tests)
- Notes: `import.meta.env.DEV` guard ensures production silence.

### Task 5 Execution
- Result: pass
- Files changed: none (test-only verification)
- Verification: `profile: task-5-core` -> PASS (22 test files, 321 tests). Playwright: column widths persist across page reload (`beforeReload` == `afterReload`), localStorage keys present for `product-list` and `user-list` tables.
- Notes: Full regression clean. No overlay DOM artifacts after drag.