# Naming Conventions

- Variables/functions: descriptive intent over generic terms (`calculateTotalPrice` not `process`, `userAccountBalance` not `data`)
- Classes: specific purpose names (`PaymentProcessor` not `Helper`)
- Avoid generic names without context: `data`, `info`, `handler`, `manager`, `helper`, `utils`
- Booleans: use `is`/`has`/`should` prefix (`isActive`, `hasPermission`, `shouldRender`)
- No abbreviations unless universally known (`url`, `id`, `http` are fine; `usr`, `mgr`, `prod` are not)
- File names: follow language-specific conventions. Never camelCase — it causes issues on case-sensitive file systems.