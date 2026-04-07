# Table Scrollbar Removal Pattern

**Keywords**: table scroll, heroui table, internal scrollbar, overflow, responsive table

## Problem
Tables with HeroUI `Table` component can develop unwanted internal scrollbars (vertical or horizontal) inside the table container rather than at the page level.

## Root Cause
- `overflow-x-hidden` or `overflow-auto` on parent containers
- `table-fixed` class forcing rigid table width
- Missing `overflow-hidden` on wrapper layers
- HeroUI Table's default wrapper styles still allowing scroll on specific browser/layout contexts

## Solution
Apply **multi-layer overflow containment** with the following approach:

### 1. Parent Page Level (`page.tsx`)
```tsx
<div className="container mx-auto max-w-7xl pt-16 px-6 overflow-hidden">
  {/* content */}
  <div className="mt-6 overflow-hidden">
    {/* TabComponent */}
  </div>
</div>
```

**Key classes**:
- `overflow-hidden` on main container
- `overflow-hidden` on immediate parent of tab component

### 2. Tab Component Level (`orders-tab.tsx`)

#### For Loading State (Skeleton)
```tsx
<div className="w-full overflow-hidden rounded-medium border border-default-200">
  <TableSkeleton
    removeWrapper
    ariaLabel={copy.tableAriaLabel}
    headers={copy.tableHeaders}
  />
</div>
```

#### For Content State (Table)
```tsx
<div className="w-full overflow-hidden rounded-medium border border-default-200">
  <div className="overflow-hidden w-full">
    <Table
      className="w-full"
      classNames={{
        wrapper: "overflow-visible rounded-none bg-transparent p-0 shadow-none",
        base: "overflow-visible",
        table: "overflow-visible w-full"
      }}
      removeWrapper
      aria-label={copy.tableAriaLabel}
    >
      {/* TableHeader, TableBody, etc. */}
    </Table>
  </div>
</div>
```

**Key changes**:
- Remove `table-fixed` class (forces fixed column widths that can exceed container)
- Add `overflow-hidden` to outer div (container for table + border)
- Add extra wrapper div with `overflow-hidden w-full` (isolates Table from parent)
- Change Table `className` from `"w-full table-fixed"` to `"w-full"`
- Add `overflow-visible` to all HeroUI classNames (`wrapper`, `base`, `table`)
- Add `w-full` to classNames `table` value

## Implementation Checklist
- [ ] Add `overflow-hidden` to page container
- [ ] Add `overflow-hidden` to immediate parent div of component
- [ ] Remove `table-fixed` from Table className
- [ ] Add wrapper div with `overflow-hidden w-full` around Table
- [ ] Update HeroUI `classNames` to include `base` and `table` with `overflow-visible`
- [ ] Verify with `pnpm tsc --noEmit` (TypeScript check)
- [ ] Test in browser: no internal scrollbars, only page-level scroll

## Files Modified (Example)
- `app/erp/orders/page.tsx` - Added overflow-hidden layers
- `app/erp/orders/_components/orders-tab.tsx` - Restructured table wrapper and HeroUI props

## Why This Works
1. **Layer 1 (Page)**: `overflow-hidden` prevents page-level content from scrolling except intentionally
2. **Layer 2 (Tab Parent)**: Additional `overflow-hidden` ensures tab component respects boundaries
3. **Layer 3 (Table Wrapper)**: Extra div with `overflow-hidden w-full` creates firm boundary for HeroUI Table
4. **Table Level**: Removing `table-fixed` allows natural width distribution; `overflow-visible` tells HeroUI not to add internal scroll

## Browser Compatibility
Tested on modern browsers (Chrome, Firefox, Safari). CSS classes are standard Tailwind.

## Related Components
- HeroUI `Table` component
- `FilterSearch`, `FilterSelect` for filters (no changes needed)
- `TableSkeleton` for loading state (wrapped same as Table)

## Reusable Pattern
Use this pattern for any table in the app that has internal scrollbars:
```tsx
// ALWAYS: overflow-hidden layers at page + parent level
// ALWAYS: wrapper div with overflow-hidden around Table
// ALWAYS: remove table-fixed from Table
// ALWAYS: add overflow-visible to HeroUI classNames
```
