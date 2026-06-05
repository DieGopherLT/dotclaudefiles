# Frontend Component Testing (React)

Backing reference for the frontend mode of the retrofit pipeline. It applies when a
target is a React component (`.tsx`/`.jsx`) or a custom hook (`useX`). The pipeline's
default seam model is backend/OOP (constructor and parameter injection); components and
hooks do not break dependencies that way, so this file documents the substitution model
and assertion style that actually fit the DOM and the React render lifecycle.

Scope: fast unit/integration tests of component and hook *logic* in jsdom/happy-dom.
Out of scope (do NOT attempt here): full E2E, real-browser visual regression, deep
accessibility audits. Those are different tools and a different pipeline.

## The seam model is different from the backend

A component receives its collaborators through props, context, custom hooks, and the
network — not a constructor. Map each backend instinct to its frontend equivalent:

| Dependency to break | Backend instinct | Frontend seam |
|---------------------|------------------|---------------|
| Child component / sibling module | extract interface | `vi.mock('./Child', ...)` module mock |
| Custom hook (`useUser`, `useCart`) | inject a service | `vi.mock` the hook module, return a controlled value |
| Network / HTTP | inject a client | **MSW** (`setupServer` + handlers) at the network boundary |
| Context (auth, theme, store, router) | inject the dependency | wrap in providers via a custom `renderWithProviders` |
| Time / timers / animations | inject a clock | `vi.useFakeTimers()` + `vi.advanceTimersByTime` |
| Props | constructor args | pass props directly — the most honest seam of all |

Prefer the least-mocking option that isolates the unit. Passing props and wrapping in
real providers is more faithful than mocking; reach for `vi.mock` only when a collaborator
does I/O or pulls in infrastructure the unit should not exercise.

Network is special: prefer **MSW** over `vi.mock(fetch)` or `vi.mock(axios)`. MSW
intercepts at the network layer, so the component runs its real data-fetching code and you
mock the *response*, not the client. That survives a fetch→axios refactor; a mocked client
does not.

## How to write a component test

React Testing Library's guiding principle: tests should resemble how a user interacts
with the UI. Assert on what the user observes, not on how the component is built.

1. **Render** with `render(<Component {...props} />)` (or `renderWithProviders` when it
   needs context).
2. **Query** by accessibility, in this priority order — falling back only when the higher
   option genuinely does not apply:
   - `getByRole` (with `name`) — the default; reflects the accessibility tree.
   - `getByLabelText` — form fields.
   - `getByPlaceholderText`, `getByText`, `getByDisplayValue`.
   - `getByTestId` — last resort, only when nothing semantic identifies the element.
   - `getBy*` throws if absent (use as an implicit assertion); `queryBy*` returns null
     (use ONLY to assert non-existence); `findBy*` is async (use for elements that appear
     after an await).
3. **Interact** with `@testing-library/user-event`, not `fireEvent`. `userEvent.click`,
   `.type`, `.selectOptions` fire the full event sequence a real user triggers (keyDown,
   keyPress, input, keyUp), so they catch handlers `fireEvent.change` would miss. Set it up
   with `const user = userEvent.setup()` and `await user.click(...)`.
4. **Assert** the observable result: visible text/role appeared or disappeared, a callback
   prop was called with the right args (`expect(onSubmit).toHaveBeenCalledWith(...)`), an
   input shows the typed value. Use `@testing-library/jest-dom` matchers
   (`toBeInTheDocument`, `toBeDisabled`, `toHaveTextContent`).
5. **Async UI**: await `findBy*` for content that arrives after a fetch. Reserve `waitFor`
   for assertions only — never put side effects (clicks, state changes) inside its callback,
   it runs multiple times.

```tsx
test('submits the entered email', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<SignupForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText(/email/i), 'a@b.com');
  await user.click(screen.getByRole('button', { name: /sign up/i }));

  expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.com' });
});
```

## Custom hooks

Test a custom hook in isolation with `renderHook` (from `@testing-library/react`); do not
build a throwaway harness component. Read state from `result.current`, drive updates inside
`act`, and re-run with `rerender`.

```tsx
test('useCounter increments', () => {
  const { result } = renderHook(() => useCounter(0));
  act(() => result.current.increment());
  expect(result.current.count).toBe(1);
});
```

For a hook that fetches, wrap the network with MSW and await the state transition
(`await waitFor(() => expect(result.current.status).toBe('success'))`).

## Characterization on components — the snapshot trap

Backend characterization pins a return value. On a component the equivalent instinct is a
full-DOM snapshot (`toMatchSnapshot()` over the rendered tree) — DO NOT use it as the
characterization mechanism. A full-DOM snapshot:

- breaks on any markup/className/whitespace change unrelated to behavior (brittle), and
- is the classic **Liar**: developers regenerate it on failure without reading it, so it
  asserts nothing and still passes.

Characterize a component by pinning its **observable behavior** instead: the specific text
and roles a user sees for a given set of props/state, which callbacks fire with which args.
Small, serializable snapshots of pure data (a formatted string, a derived object from a
selector/reducer) verified once are fine — it is the sprawling DOM snapshot that is the
anti-pattern.

## Scaffolding frontend utilities

The shared utilities the scaffolder builds for a frontend scope are not backend mocks:

- **`renderWithProviders`** — a custom render that wraps the UI in the app's real providers
  (store, query client, theme, router, i18n) with sensible test defaults and per-test
  overrides. Every component test that needs context imports this one helper instead of
  re-assembling the provider tree.
- **Prop / object builders** — `buildUser()`, `buildProps({ ... })`: Test Data Builders for
  the props and domain objects components consume, with defaults plus overrides.
- **MSW server + handlers** — one `setupServer(...handlers)` with the default happy-path
  handlers, started/reset/closed in shared setup; tests override a handler with
  `server.use(...)` for error/edge cases.

## What NOT to test (frontend)

- CSS classes, inline styles, or exact DOM structure — implementation details that change
  without behavior changing. Assert what the user perceives, not the markup.
- Internal component state or which hooks ran — test through rendered output and effects.
- Third-party libraries (the router, the query client) — trust them; test your usage.
- Anything requiring a real browser, real network, or pixel comparison — out of scope.
