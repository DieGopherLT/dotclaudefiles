---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---

# React Standards

- Component files: PascalCase matching the component (`UserProfile.tsx`).
  Non-component files (hooks, utils, services): kebab-case per the TS convention.

## State

- `useState` per piece of state; no object state unless necessary.
- At 5+ related state variables with complex or batched updates, switch to
  `useReducer`: typed state and actions, defined in a separate file (convert a
  single-file component into a directory with an index if needed).
- Global state: `zustand` on new/small projects; `redux-toolkit` patterns and hooks
  API on existing redux projects. Context API only for theming, localization, or
  building providers.

## Effects

- One `useEffect` per concern; never combine unrelated logic.
- Always clean up subscriptions and timers.
- Fix `exhaustive-deps` warnings at the root cause: move pure functions outside the
  component, extract primitive values (IDs, strings) instead of depending on whole
  objects, and reach for `useCallback` only when consumers genuinely need a stable
  reference.

## Rendering

- Short-circuit (`&&`) for simple conditional rendering; ternary only when both
  branches have JSX; a component returning `null` over deep nesting.
- `clsx`/`classnames` for conditional classes over complex template literals.

## Performance

- Inside custom hooks: always memoize returned functions with `useCallback` —
  consumers may use them as dependencies or props.
- At component level: no `React.memo`/`useMemo`/`useCallback` by default — measure
  first. `useMemo` only for genuinely expensive computations.

## Imports

Order: React and related → third-party → project components → hooks →
utilities/helpers → styles and assets.

## Forms

- 1-2 fields: controlled components with `useState`/`useReducer`.
- 3+ fields, async validation, or multi-step flows: `react-hook-form`.

## Structure

- Past ~150 lines or with complex logic, split container/presentation — or extract
  the logic into a custom hook.