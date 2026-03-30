---
name: split-component
description: Esta skill debe usarse cuando el usuario pide "dividir componente", "separar componente", "split component", "extraer componentes", "componente muy grande", "refactorizar componente grande", "break down component", "este archivo tiene muchas responsabilidades", o menciona que un archivo React tiene demasiado codigo, demasiado estado, o demasiada logica mezclada con UI. Analiza un componente React y lo divide en piezas mas manejables siguiendo el patron smart/dumb components.
argument-hint: <file-path>
allowed-tools: Read, Edit, Write, Grep, Glob, LSP
---

# Split React Component

You receive a single React component file to analyze and split into smaller, focused pieces. The goal is to separate concerns: business logic goes into custom hooks, repetitive or large UI blocks become presentation components.

## Step 1: Analyze the component

Read the file at `$ARGUMENTS`, then run an LSP-driven analysis pipeline. LSP provides semantic understanding -- it does not guess, it knows. Use it as the primary source of truth.

### 1.1 Symbol map

Run `documentSymbol` on the target file to get every symbol: functions, variables, types, interfaces. This is the skeleton of the component -- the full list of what exists and where.

### 1.2 Type and signature inspection

For each symbol returned in 1.1, run `hover` to get its type signature. This reveals:

- Which variables are state (`useState` returns `[T, Dispatch<SetStateAction<T>>]`)
- Which are memoized values (`useMemo` return types)
- Which are callbacks (`useCallback` signatures)
- Prop types and their shape
- Return types of custom hooks and helper functions

### 1.3 Internal dependency graph

For each function, handler, and hook call identified in 1.1-1.2:

- Run `outgoingCalls` to map what each function calls internally. This reveals which helpers, hooks, and API calls are tightly coupled.
- Run `findReferences` on state variables and handlers to identify which JSX sections consume them. This determines what moves together during extraction.

### 1.4 External dependency check

For imported symbols (API clients, utilities, types from other modules):

- Run `goToDefinition` to confirm where they live.
- Run `findReferences` scoped to the target file to see how many places use each import. Imports used in only one extracted piece can move with it cleanly.

### 1.5 Synthesis

With the LSP data collected, build a split plan identifying:

- **Hook candidates**: clusters of state + effects + handlers that `outgoingCalls` and `findReferences` show are cohesive (they reference each other but not the rest).
- **Component candidates**: JSX blocks inside loops, conditional sections, or large standalone sections where `findReferences` shows they depend on a narrow set of props/state.
- **Shared dependencies**: symbols referenced by multiple extraction candidates -- these stay in the parent or get lifted.

Present findings to the user as a short summary with the proposed split plan. Use `AskUserQuestion` to confirm before making changes.

## Step 2: Determine extraction strategy

The file's location determines how to organize the new files.

### Domain context (component lives inside a module)

When the component is inside a domain directory (e.g., `src/modules/orders/components/OrderDetail.tsx`), add new files as siblings within that domain:

```
modules/orders/
  components/
    OrderDetail.tsx            <- refactored, now lean
    OrderSummaryCard.tsx       <- extracted presentation component
  hooks/
    useOrderCalculations.ts    <- extracted logic
```

Create `hooks/` or `stores/` directories inside the domain if they don't exist yet.

### Isolated context (component lives outside a domain)

When the component is standalone (e.g., `src/components/Dashboard.tsx`), convert it into a self-contained directory with an `index.tsx` that preserves the original import path:

```
components/
  Dashboard/
    index.tsx                  <- re-exports, preserves import path
    DashboardFilters.tsx       <- extracted presentation component
    hooks/
      useDashboardData.ts      <- extracted logic
```

Use `git mv` to move the original file into the new directory as `index.tsx`, then extract from there.

## Step 3: Extract custom hooks

Business logic, state management, data fetching, and complex computations belong in custom hooks. Each hook should have a single, clear responsibility.

Guidelines for extraction:

- A hook manages one cohesive concern (e.g., form validation, data fetching for a specific resource, pagination state).
- The hook returns only what the component needs to render -- no internal implementation details leak out.
- Consolidate into `useReducer` when either condition applies: (a) 5+ `useState` variables, or (b) multiple `setState` calls scattered across different handlers that represent a single state transition -- these become one `dispatch` call with a descriptive action type instead of several `set*` calls spread across the codebase.
- Name the hook after what it does, not where it came from. `useOrderFilters` over `useOrderDetailFilters`.

## Step 4: Extract presentation components

UI blocks that are large, repeated, or self-contained become their own components. These are pure: they receive props and render JSX, nothing more.

What qualifies for extraction:

- JSX blocks inside `.map()` or `.forEach()` loops -- almost always worth extracting.
- Conditionally rendered sections with their own visual identity (a modal, a sidebar panel, an empty state).
- Repeated layout patterns, even if not identical -- parameterize with props.

Presentation components receive data and callbacks as props. They do not call hooks for data fetching or global state. If a presentation component needs local UI state (like a toggle or hover), that's fine -- keep it inside the component.

## Step 5: State management decisions

Apply this decision tree for each piece of state:

1. **Used only in one component?** Keep it local with `useState`. Escalate to `useReducer` when: (a) 5+ state variables, or (b) multiple `set*` calls in different handlers that logically represent a single state transition and can collapse into one `dispatch`.
2. **Shared across siblings or cousins?** Lift to the nearest common parent and pass as props if the prop chain is shallow (2 levels max).
3. **Shared across distant components or prop drilling becomes painful?** Use a zustand store scoped to that feature.

### Stores and reducers organization

When creating a zustand store or reducer, place it in a `stores/` or `reducers/` directory within the domain or component directory. Naming rules:

- Name after the concern, not the component: `cart-items.ts`, not `shopping-cart-store.ts`.
- Never append "store" or "reducer" to the filename -- the directory already communicates that.
- Always use kebab-case for filenames.

## Step 6: Wire everything together

After extraction:

1. Update the original component to import and use the new hooks and components.
2. Verify that the original import path still works (barrel file / index.tsx).
3. Check that no circular dependencies were introduced.
4. Run a build (`npm run build`, `npx tsc --noEmit`, or the project's equivalent) to confirm there are no type errors or broken imports.

## File naming

Name files after their purpose, not after the parent component. Each file type follows its own convention:

- **Components** (PascalCase): `Pagination.tsx` over `DataTablePagination.tsx`
- **Hooks** (camelCase): `usePagination.ts` over `useTablePaginationHook.ts`
- **Stores/reducers** (kebab-case): `cart-items.ts` over `shopping-cart-store.ts`
