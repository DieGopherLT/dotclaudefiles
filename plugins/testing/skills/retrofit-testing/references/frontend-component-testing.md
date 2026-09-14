# Frontend Component Testing (React)

Backing reference for the frontend mode of the retrofit pipeline. It applies when a target is a React component (`.tsx`/`.jsx`) or a custom hook (`useX`). The pipeline's default seam model is backend/OOP (constructor and parameter injection); components and hooks do not break dependencies that way.

Scope: fast unit/integration tests of component and hook logic in jsdom/happy-dom. Out of scope: full E2E, real-browser visual regression, deep accessibility audits, anything needing a real network or pixel comparison. Those are different tools and a different pipeline.

## The seam model is different from the backend

A component receives its collaborators through props, context, custom hooks, and the network, not a constructor. Map each backend instinct to its frontend equivalent:

| Dependency to break | Backend instinct | Frontend seam |
|---------------------|------------------|---------------|
| Child component / sibling module | extract interface | `vi.mock('./Child', ...)` module mock |
| Custom hook (`useUser`, `useCart`) | inject a service | `vi.mock` the hook module, return a controlled value |
| Network / HTTP | inject a client | **MSW** (`setupServer` + handlers) at the network boundary |
| Context (auth, theme, store, router) | inject the dependency | wrap in providers via a custom `renderWithProviders` |
| Time / timers / animations | inject a clock | `vi.useFakeTimers()` + `vi.advanceTimersByTime` |
| Props | constructor args | pass props directly, the most honest seam of all |

Prefer the least-mocking option that isolates the unit. Passing props and wrapping in real providers is more faithful than mocking; reach for `vi.mock` only when a collaborator does I/O or pulls in infrastructure the unit should not exercise.

Network is special: prefer MSW over `vi.mock(fetch)` or `vi.mock(axios)`. MSW intercepts at the network layer, so the component runs its real data-fetching code and you mock the response, not the client. That survives a fetch-to-axios refactor; a mocked client does not.

## Writing the test

Assert on what the user observes, not on how the component is built. Three operational rules beyond React Testing Library's own docs:

- Query by role/label first, `getByTestId` last. `queryBy*` only to assert non-existence; `findBy*` for content that appears after an await.
- `userEvent` (with `setup()`), never `fireEvent`: it skips the keyDown/input/keyUp sequence real handlers depend on.
- Reserve `waitFor` for assertions only. Its callback re-runs, so side effects inside it fire repeatedly.

Hooks: `renderHook` + `result.current`, updates inside `act`, `rerender` to re-run; never a throwaway harness component. For a fetching hook, MSW plus `await waitFor(...)` on the state transition.

## Characterization on components

Do not use a full-DOM snapshot as the characterization mechanism; the auditor scores it as `FULL_DOM_SNAPSHOT` (critical). Pin observable behavior instead: the text and roles a user sees for given props/state, which callbacks fire with which args. Small serializable snapshots of pure derived data are fine.

## Scaffolding frontend utilities

The shared utilities the scaffolder builds for a frontend scope are not backend mocks:

- **`renderWithProviders`**: a custom render that wraps the UI in the app's real providers (store, query client, theme, router, i18n) with test defaults and per-test overrides. Every component test that needs context imports this one helper instead of re-assembling the provider tree.
- **Prop / object builders**: `buildUser()`, `buildProps({ ... })`, Test Data Builders for the props and domain objects components consume.
- **MSW server + handlers**: one `setupServer(...handlers)` with the default happy-path handlers, started/reset/closed in shared setup; tests override a handler with `server.use(...)` for error/edge cases.
