# Naming Conventions

- Variables/functions: descriptive intent over generic terms (`calculateTotalPrice` not `process`, `userAccountBalance` not `data`)
- Classes: specific purpose names (`PaymentProcessor` not `Helper`)
- Avoid generic names without context: `data`, `info`, `handler`, `manager`, `helper`, `utils`
- Booleans: use `is`/`has`/`should` prefix (`isActive`, `hasPermission`, `shouldRender`)
- No abbreviations unless universally known (`url`, `id`, `http` are fine; `usr`, `mgr`, `prod` are not)
- File names: follow language-specific conventions if a per-language rule defines them; otherwise:
  - JS/TS: kebab-case (`auth-service.ts`, `user-helpers.ts`, `use-auth.ts`)
  - React components: PascalCase matching the component name (`UserProfile.tsx`, `PaymentForm.tsx`)
  - Go: snake_case (`user_service.go`, `http_handler.go`)
  - Never camelCase for file names — causes issues on case-sensitive file systems