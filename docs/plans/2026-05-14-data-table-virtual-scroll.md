# DataTable Virtual Scroll Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add opt-in row virtualization to `DataTable` with low coupling, minimal intrusion, and no changes to the existing search-param / server-pagination contract.

**Architecture:** Keep virtualization strictly inside the `DataTable` render layer. `useDataTable` remains responsible only for TanStack Table state and router search params, while `DataTable` decides whether to render a normal body or a virtualized body for the current row model. Use a fixed-row-height, spacer-row strategy first so sticky headers, pinned columns, and current table semantics keep working without switching the whole table to the more invasive `grid/flex + measureElement` pattern from the TanStack examples.

**Tech Stack:** React 19, TypeScript, `@tanstack/react-table`, `@tanstack/react-virtual`, Radix `ScrollArea`, Tailwind CSS

---

## Current Context

- `src/components/ui/table/data-table.tsx` currently owns all table rendering, including the scroll container, sticky header, row rendering, and pagination footer.
- `src/hooks/use-data-table.ts` manages search-param-backed pagination, sorting, filters, row selection, and column pinning. It should stay virtualization-agnostic.
- `src/components/ui/scroll-area.tsx` wraps Radix `ScrollArea`, but it does not expose the viewport ref needed by `useVirtualizer`.
- `src/features/products/components/product-tables/index.tsx` is the best rollout target because the mock source has 2,000 products and the footer already allows `perPage=1000`.
- `src/features/users/components/users-table/index.tsx` only renders 50 seeded rows today, so it is not a good first stress target.

## Constraints

- Do not couple virtualization to query fetching, infinite loading, or router params.
- Do not move virtualization logic into `useDataTable`.
- Do not rewrite the whole table into CSS grid unless fixed-height virtualization fails in practice.
- Do not introduce test infrastructure as part of this feature. This repo currently has no test runner configured, so verification should stay at `lint + build + manual QA`.

## Proposed Public API

Add an opt-in prop on `DataTable`:

```ts
type DataTableVirtualizationOptions = {
  enabled?: boolean
  estimateRowHeight?: number
  overscan?: number
  rowCountThreshold?: number
  resetScrollOnChange?: boolean
}
```

Usage:

```tsx
<DataTable
  table={table}
  virtualization={{
    enabled: true,
    estimateRowHeight: 48,
    overscan: 8,
    rowCountThreshold: 100,
  }}
>
  <DataTableToolbar table={table} />
</DataTable>
```

Behavior:

- If `virtualization` is missing, `DataTable` behaves exactly as it does now.
- If `enabled !== false` and the current page row count is greater than or equal to `rowCountThreshold`, only visible rows render.
- Existing footer pagination stays intact. Virtualization only optimizes the current page’s rendered rows.

## Task 1: Add the Virtualization Contract and Dependency

**Files:**
- Modify: `package.json`
- Modify: `src/types/data-table.ts`
- Modify: `pnpm-lock.yaml` after install

**Step 1: Add the virtualizer dependency**

Add:

```json
"@tanstack/react-virtual": "^3.x"
```

Use the latest compatible major already recommended by current TanStack docs.

**Step 2: Add the public config type**

In `src/types/data-table.ts`, add:

```ts
export interface DataTableVirtualizationOptions {
  enabled?: boolean;
  estimateRowHeight?: number;
  overscan?: number;
  rowCountThreshold?: number;
  resetScrollOnChange?: boolean;
}
```

**Step 3: Keep the state hook untouched**

Do not add virtualization state to `src/hooks/use-data-table.ts`. That hook should remain focused on table state, URL sync, and TanStack row-model configuration only.

**Step 4: Install and verify dependency graph**

Run:

```bash
pnpm install
```

Expected:

- `package.json` contains `@tanstack/react-virtual`
- `pnpm-lock.yaml` updates cleanly

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/types/data-table.ts
git commit -m "feat: add data table virtualization contract"
```

## Task 2: Expose the Scroll Viewport Ref and Isolate the Body Renderer

**Files:**
- Modify: `src/components/ui/scroll-area.tsx`
- Modify: `src/components/ui/table/data-table.tsx`
- Create: `src/components/ui/table/data-table-body.tsx`

**Step 1: Expose the viewport ref from `ScrollArea`**

Update `ScrollArea` so callers can pass a ref to the Radix viewport:

```ts
function ScrollArea({
  className,
  children,
  viewportRef,
  viewportClassName,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  viewportRef?: React.Ref<HTMLDivElement>;
  viewportClassName?: string;
}) {
  return (
    <ScrollAreaPrimitive.Root className={cn("relative", className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        className={cn("size-full rounded-[inherit] ...", viewportClassName)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      ...
    </ScrollAreaPrimitive.Root>
  )
}
```

This change is additive and should not affect existing call sites.

**Step 2: Split body rendering out of `data-table.tsx`**

Create `src/components/ui/table/data-table-body.tsx` so `data-table.tsx` stays orchestration-only:

```ts
interface DataTableBodyProps<TData> {
  table: Table<TData>;
  virtualization?: DataTableVirtualizationOptions;
  scrollElementRef: React.RefObject<HTMLDivElement | null>;
}
```

`data-table.tsx` should still own:

- the outer layout
- the scroll container
- the sticky header
- the footer and action bar

It should stop owning:

- the normal row loop
- the virtualized row loop
- the no-results body branch

**Step 3: Pass the viewport ref from `DataTable`**

In `data-table.tsx`:

- create `const scrollViewportRef = React.useRef<HTMLDivElement>(null)`
- pass `viewportRef={scrollViewportRef}` into `ScrollArea`
- pass `scrollElementRef={scrollViewportRef}` into `DataTableBody`

**Step 4: Keep the header path unchanged**

Do not change the existing header rendering or `getCommonPinningStyles` usage in the header path. Virtualization should affect body rows only.

**Step 5: Commit**

```bash
git add src/components/ui/scroll-area.tsx src/components/ui/table/data-table.tsx src/components/ui/table/data-table-body.tsx
git commit -m "refactor: isolate data table body rendering"
```

## Task 3: Implement Fixed-Height Row Virtualization with Spacer Rows

**Files:**
- Modify: `src/components/ui/table/data-table-body.tsx`

**Step 1: Add the virtualization decision**

Inside `data-table-body.tsx`:

```ts
const rows = table.getRowModel().rows;
const rowCountThreshold = virtualization?.rowCountThreshold ?? 100;
const shouldVirtualize =
  virtualization?.enabled !== false && rows.length >= rowCountThreshold;
```

This keeps the feature opt-in and avoids overhead on small tables.

**Step 2: Implement the normal-body branch**

Preserve the current behavior exactly when `shouldVirtualize === false`:

- render all rows
- reuse `flexRender`
- reuse `getCommonPinningStyles`
- preserve the current no-results fallback row

**Step 3: Implement the virtual-body branch**

Use `useVirtualizer` with the scroll viewport ref:

```ts
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => scrollElementRef.current,
  estimateSize: () => virtualization?.estimateRowHeight ?? 48,
  overscan: virtualization?.overscan ?? 8,
});
```

Use the spacer-row strategy, not absolute positioning:

```ts
const virtualItems = rowVirtualizer.getVirtualItems();
const paddingTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0;
const paddingBottom =
  virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1]!.end
    : 0;
```

Render:

```tsx
<TableBody>
  {paddingTop > 0 ? (
    <TableRow aria-hidden="true">
      <TableCell colSpan={table.getAllColumns().length} className="p-0" style={{ height: paddingTop }} />
    </TableRow>
  ) : null}

  {virtualItems.map((virtualRow) => {
    const row = rows[virtualRow.index]!;
    return (
      <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
        {row.getVisibleCells().map((cell) => (
          <TableCell
            key={cell.id}
            style={{
              ...getCommonPinningStyles({ column: cell.column }),
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    )
  })}

  {paddingBottom > 0 ? (
    <TableRow aria-hidden="true">
      <TableCell colSpan={table.getAllColumns().length} className="p-0" style={{ height: paddingBottom }} />
    </TableRow>
  ) : null}
</TableBody>
```

Why this approach:

- it preserves semantic table markup
- it avoids the more invasive `display: grid` conversion
- it keeps sticky header and pinned cells compatible with the current implementation

**Step 4: Reset scroll position on table-state changes**

Add an effect that resets the scroll viewport to top when the current page, sort, or filters change:

```ts
React.useLayoutEffect(() => {
  if (!shouldVirtualize) return;
  if (virtualization?.resetScrollOnChange === false) return;

  scrollElementRef.current?.scrollTo({ top: 0 });
}, [
  shouldVirtualize,
  virtualization?.resetScrollOnChange,
  table.getState().pagination.pageIndex,
  table.getState().pagination.pageSize,
  table.getState().sorting,
  table.getState().columnFilters,
]);
```

This prevents landing halfway down a newly sorted or filtered page.

**Step 5: Add viewport-only performance hints**

Only for the virtualized path, add non-invasive viewport styles such as:

```ts
viewportClassName="overflow-anchor-none"
```

or inline style equivalents if needed. Avoid global CSS changes unless a local class is insufficient.

**Step 6: Commit**

```bash
git add src/components/ui/table/data-table-body.tsx
git commit -m "feat: add virtualized data table body"
```

## Task 4: Roll Out on the Product Table First

**Files:**
- Modify: `src/features/products/components/product-tables/index.tsx`
- Optional Modify: `src/features/products/components/product-tables/columns.tsx`

**Step 1: Enable virtualization on `ProductTable`**

Pass the new prop:

```tsx
<DataTable
  table={table}
  virtualization={{
    enabled: true,
    estimateRowHeight: 48,
    overscan: 8,
    rowCountThreshold: 100,
  }}
>
  <DataTableToolbar table={table} />
</DataTable>
```

This is enough to make the table benefit when the user switches the existing footer to `perPage=1000`.

**Step 2: Keep `UsersTable` unchanged for now**

Do not enable virtualization on `src/features/users/components/users-table/index.tsx` in the first rollout. The row count is too small to justify additional moving pieces.

**Step 3: Normalize only if product rows are not visually stable**

If manual QA shows that `ProductTable` rows vary too much in height:

- normalize the consumer cells in `columns.tsx`
- prefer fixed thumbnail and truncated text
- do not solve this by pushing dynamic row measurement into `DataTable` v1

Example normalization direction:

```tsx
cell: ({ cell }) => (
  <div className="max-w-[24rem] truncate">
    {cell.getValue<Product["description"]>()}
  </div>
)
```

The generic component should stay simple; consumer-specific height variance belongs in the consumer.

**Step 4: Commit**

```bash
git add src/features/products/components/product-tables/index.tsx src/features/products/components/product-tables/columns.tsx
git commit -m "feat: enable virtual scrolling for product table"
```

If `columns.tsx` does not need normalization, do not stage it.

## Task 5: Verify the Feature End-to-End

**Files:**
- No code changes required unless issues are found

**Step 1: Run static verification**

Run:

```bash
pnpm lint
pnpm build
```

Expected:

- lint passes
- production build passes

**Step 2: Run manual QA in dev**

Run:

```bash
pnpm dev
```

Check `/dashboard/product` with these scenarios:

1. Change `Rows per page` from `10` to `1000`.
2. Scroll vertically through the product list and confirm rows stay smooth.
3. Scroll horizontally and confirm the right-pinned `actions` column still behaves correctly.
4. Sort by `Name` and confirm the scroll position resets to the top.
5. Filter by `Category` and confirm row virtualization still renders the correct subset.
6. Change page and confirm the next page renders and scroll resets.
7. Select rows and confirm selection state and footer counts still work.
8. Confirm the sticky header stays visible during vertical scroll.

**Step 3: Record any regression**

If you observe one of these, stop and fix before merging:

- blank gaps between rows
- sticky header overlap bugs
- pinned column background or z-index glitches
- scroll position being retained after sort/filter/page changes
- row flicker caused by unstable height assumptions

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: add opt-in data table virtual scrolling"
```

Stage carefully if unrelated files are present.

## Out of Scope for This Iteration

- Infinite loading across backend pages
- Fetch-layer changes in `usersQueryOptions` or `productsQueryOptions`
- Rewriting `useDataTable` for client-side pagination
- Dynamic row-height virtualization with `measureElement`
- Column virtualization
- Enabling virtualization on every table by default

## Follow-Up If This Ships Cleanly

- Add the same `virtualization` prop to other heavy tables only when row counts justify it.
- If a future table truly needs dynamic row heights, keep the same public `virtualization` prop and swap only the internal renderer.
- If the product table later moves to real backend data, keep `DataTable` unchanged and solve “load more rows” at the query layer with `useInfiniteQuery`.
