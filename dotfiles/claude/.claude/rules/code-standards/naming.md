# Naming Conventions

- Variables/functions: descriptive intent over generic terms (`calculateTotalPrice` not `process`, `userAccountBalance` not `data`)
- Classes: specific purpose names (`PaymentProcessor` not `Helper`)
- Avoid generic names without context: `data`, `info`, `handler`, `manager`, `helper`, `utils`
- Booleans: use `is`/`has`/`should` prefix (`isActive`, `hasPermission`, `shouldRender`)
- No abbreviations unless universally known (`url`, `id`, `http` are fine; `usr`, `mgr`, `prod` are not)
- File names: match the primary export (`UserProfile.tsx`, `authService.ts`, `payment.go`)

## Variable and function naming

```
// Bad
const data = fetchUser();
const result = calculate(items);
function handle(input) { ... }
function process(x) { ... }

// Good
const currentUser = fetchUser();
const totalPrice = calculateTotal(items);
function validatePaymentInput(input) { ... }
function doublePrice(price) { ... }
```

## Boolean naming

```
// Bad
const active = user.status === 'active';
const perm = user.role === 'admin';
const login = !!session;

// Good
const isActive = user.status === 'active';
const hasAdminPermission = user.role === 'admin';
const isAuthenticated = !!session;
```

## Class naming

```
// Bad
class DataHelper {}
class UserManager {}
class ApiHandler {}

// Good
class PaymentProcessor {}
class SessionValidator {}
class HttpClient {}
```
