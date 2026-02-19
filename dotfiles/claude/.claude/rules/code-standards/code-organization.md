# Code Organization

- Group related code with blank lines between distinct concepts.
- Group related functions and types together in the same file.
- Separate files by functionality when they grow beyond ~200 lines.
- Write public API at the top of the file; private implementation details below.
- Function parameters: use a config object when 3+ parameters.
- Comments: only for non-obvious technical decisions — never for self-explanatory code.

## Config object for 3+ parameters

```
// Bad - positional params are hard to read and reorder
function createUser(name, email, role, isActive) { ... }
createUser('Diego', 'diego@dev.com', 'admin', true);

// Good - config object, self-documenting at call site
function createUser({ name, email, role, isActive }) { ... }
createUser({ name: 'Diego', email: 'diego@dev.com', role: 'admin', isActive: true });
```

## Public API first

```
// Top of file - public interface
export function createOrder(config) { ... }
export function cancelOrder(orderId) { ... }

// Bottom of file - private helpers
function validateOrderItems(items) { ... }
function applyDiscount(order) { ... }
```

## Comments: only when non-obvious

```
// Bad - self-explanatory, comment adds no value
// Get user from database
const user = await db.users.findById(userId);

// Good - non-obvious technical decision worth documenting
// Raw query avoids N+1 on nested relations that ORM would trigger
const users = await db.raw('SELECT u.*, p.* FROM users u JOIN profiles p ...');
```
