---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---

# React Standards

## State management

- On simple components, prefer `useState` per piece of state — no objects as state unless necessary.
- When handling 5+ related state variables with complex or batched updates, use `useReducer`.
  - Add data types for all values and actions.
  - Define everything in a separate file; if the component is a single file, convert it to a directory with an index file.

### Global state

- On new or small projects, install `zustand` for global state management.
- On existing projects using `redux`, continue with `redux-toolkit` patterns and hooks API (`useSelector`, `useDispatch`).
- Avoid Context API for global state unless it is for theming, localization, or building providers.

## UseEffect

- Prefer multiple `useEffect` hooks for separate concerns instead of combining unrelated logic.
- If a dependency is a pure function defined inside the component, move it outside to avoid re-creation on each render.
- Do not overlook cleanup functions for subscriptions or timers.
- When exhaustive-deps warns, fix the root cause:
  - Pure functions: move outside component
  - Callbacks: use `useCallback` only when necessary (memoized children, external dependencies)
  - Complex objects: extract primitive values (IDs, strings) as dependencies instead of the whole object

```tsx
// Bad: combining unrelated logic
useEffect(() => {
  fetchUserData();
  startTimer();
}, [userId]);

// Good: separate concerns
useEffect(() => { fetchUserData(); }, [userId]);
useEffect(() => {
  const interval = setInterval(() => tick(), 1000);
  return () => clearInterval(interval);
}, []);

// Good: cleanup for subscriptions
useEffect(() => {
  const subscription = dataSource.subscribe(handleData);
  return () => subscription.unsubscribe();
}, [dataSource]);
```

## Conditional rendering

- Prefer short-circuit (`&&`) over ternary for simple cases: `{condition && <Component />}`
- Only use ternaries when both branches have JSX.
- Prefer a component that returns `null` for the negative case over deep nesting.
- Use `clsx` or `classnames` for conditional CSS classes instead of complex template literals.

## Performance

- Inside custom hooks: always memoize returned functions with `useCallback` — consumers may use them as dependencies or props.
- At component level: do not add `React.memo`, `useMemo`, or `useCallback` by default — measure first.
- Use `React.memo` only when a child re-renders unnecessarily due to parent renders.
- Use `useMemo` only for genuinely expensive computations, not simple derivations.

## Import order

1. React and related libraries (`react`, `react-dom`, `react-router`)
2. Third-party libraries (`lodash`, `axios`, `redux`)
3. Project components (`components/Button`, `components/Header`)
4. Hooks (`hooks/useAuth`, `hooks/useFetch`)
5. Utilities and helpers (`utils/formatDate`, `utils/apiClient`)
6. Styles and assets (`styles/main.css`, `assets/logo.png`)

## Forms

- For 1-2 fields: controlled components with `useState` or `useReducer`.
- For 3+ fields, async validation, or multi-step flows: install `react-hook-form`.

## Split business logic and rendering

- Separate into logic (container) and presentation (UI) components when they grow beyond 150 lines or have complex logic.
- Alternatively, extract logic into custom hooks.

```tsx
// useUserProfile.ts
function useUserProfile(userId) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${userId}`).then(res => res.json()).then(setData);
  }, [userId]);
  return data;
}

// UserProfile.tsx
function UserProfile({ userId }) {
  const data = useUserProfile(userId);
  if (!data) return <div>Loading...</div>;
  return <div><h1>{data.name}</h1></div>;
}
```
