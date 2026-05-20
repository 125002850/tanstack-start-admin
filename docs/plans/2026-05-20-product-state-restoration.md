# Product Page State Restoration Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Make the `/dashboard/product` list page preserve cached data, URL query state, and scroll position when navigating to a product detail page and back, without introducing route keep-alive.

**Architecture:** Keep filter, pagination, and sorting state in TanStack Router search params; extend the product list React Query cache window so back-navigation can reuse list data; and use TanStack Router scroll restoration for both the route entry and the table's inner scroll viewport. This keeps the implementation explicit, route-safe, and compatible with the current React 19 + TanStack Router stack.

**Tech Stack:** TanStack Router, TanStack Query, TanStack Start, Radix Scroll Area, React 19, TypeScript

---

### Task 1: Tighten Product List Query Caching

**Files:**

- Modify: `src/features/products/api/queries.ts`

**Step 1: Add route-appropriate cache timings for the product list query**

Update `productsQueryOptions()` so the list query keeps data warm longer than the global default:

- `staleTime: 5 * 60 * 1000`
- `gcTime: 30 * 60 * 1000`

Do not change the query key shape.


Only touch `productByIdOptions()` if a code-level consistency issue appears while implementing the list behavior.

**Step 3: Verify the file still matches project style**

Run: `npm run format:check`

Expected: the formatter check passes, or reports unrelated pre-existing issues only.

### Task 2: Stabilize Router Scroll Restoration Keys

**Files:**

- Modify: `src/router.tsx`

**Step 1: Add an explicit scroll restoration key strategy**

Configure the router with `getScrollRestorationKey` so the product list route is keyed by pathname + search. This makes each filter/sort/page combination restore its own scroll position instead of relying only on history entry state.

**Step 2: Limit behavior to the routes that need it**

Do not introduce broad custom logic for every route unless the router API requires a single global function. If global is required, keep the condition narrow and default back to the existing location key for other routes.

**Step 3: Verify the router still builds cleanly**

Run: `npm run build`

Expected: the app builds without TypeScript errors from the router configuration.

### Task 3: Restore the Product Table's Inner Scroll Position

**Files:**

- Modify: `src/components/ui/scroll-area.tsx`
- Modify: `src/components/ui/table/data-table.tsx`
- Modify: `src/features/products/components/product-tables/index.tsx`

**Step 1: Expose viewport props from the shared ScrollArea wrapper**

Extend `ScrollArea` so callers can pass props to the Radix viewport element. This is needed because the viewport, not the outer wrapper, is the actual scrollable element.

**Step 2: Make DataTable accept an optional scroll restoration identifier**

Add a prop such as `scrollRestorationId?: string` and forward it to the `ScrollArea` viewport as `data-scroll-restoration-id`.

**Step 3: Register a stable ID for the product table**

In `ProductTable`, pass a route-specific identifier to `DataTable` so the product list can restore its inner table scroll position independently from other tables.

**Step 4: Keep the change generic**

Do not hardcode product-specific logic inside the shared `DataTable` or `ScrollArea` components beyond supporting the optional prop.

**Step 5: Verify the affected code paths**

Run: `npm run build`

Expected: no component prop type errors and no import issues.

### Task 4: Verify Back-Navigation Behavior End-to-End

**Files:**

- No code changes expected

**Step 1: Run static verification**

Run: `npm run format:check`

Expected: passes, or only surfaces unrelated pre-existing issues.

Run: `npm run build`

Expected: passes.

**Step 2: Manual verification checklist**

1. Open `/dashboard/product`.
2. Change page, page size, search term, category, and sorting.
3. Scroll the list page and, if needed, the table viewport.
4. Open a product detail page from the actions menu.
5. Navigate back.
6. Confirm:
   - the same query params are still present
   - the list data renders from cache without a full cold-load feel
   - the previous scroll position is restored

**Step 3: Stop if unrelated failures appear**

If formatting or build failures come from untouched files, note them separately instead of broadening this change set.

Plan complete and saved to `docs/plans/2026-05-20-product-state-restoration.md`. The user already requested execution in this session, so proceed directly with implementation after saving.
