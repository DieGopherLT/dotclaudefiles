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

## File element order

Within a file, declare elements in this order:

1. Constants
2. Types / interfaces
3. Classes / structs
4. Exported functions
5. Private functions — ordered by call hierarchy, not alphabetically

## The Stepdown Rule

Private functions follow the caller, not the alphabet. A function should be declared just below the first function that calls it. The file reads top-to-bottom: abstractions first, implementation details last.

```
// Good - validateOrderItems is declared right after the function that calls it
export function createOrder(config) {
  validateOrderItems(config.items);  // calls validateOrderItems
  applyDiscount(config);             // calls applyDiscount
}

function validateOrderItems(items) { ... }   // declared below its caller

function applyDiscount(order) { ... }        // declared below its caller
```

Functions with no dependencies (pure utilities) go at the bottom of the file.

## Comments: only when non-obvious

```
// Bad - self-explanatory, comment adds no value
// Get user from database
const user = await db.users.findById(userId);

// Good - non-obvious technical decision worth documenting
// Raw query avoids N+1 on nested relations that ORM would trigger
const users = await db.raw('SELECT u.*, p.* FROM users u JOIN profiles p ...');
```
