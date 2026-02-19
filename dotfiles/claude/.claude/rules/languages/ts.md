---
paths:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.tsx"
  - "**/*.jsx"
---

# TypeScript and JavaScript

When about to install, update or delete dependencies, check which package manager is being used in the project (npm, yarn or pnpm) and use it consistently.

## Types

- Prefer `interface` for object shapes that may be extended; use `type` for unions, intersections, and aliases.
- Avoid `any` — use `unknown` when the type is truly unknown, then narrow with type guards.
- Avoid type assertions (`as Foo`) unless there is no alternative; prefer type guards instead.
- Use generics to avoid duplicating types across similar functions.
- Never use inline objects or arrays inside ternary operators; define them outside.

```typescript
// Bad - any loses type safety
function parseData(input: any): any { ... }

// Good - unknown forces narrowing
function parseData(input: unknown): User {
  if (!isUser(input)) throw new Error('parseData: invalid user shape');
  return input;
}

// Bad - duplicated signatures
function getUser(id: string): Promise<User> { ... }
function getOrder(id: string): Promise<Order> { ... }

// Good - generic
function fetchById<T>(id: string, endpoint: string): Promise<T> { ... }

// Bad - inline object in ternary
const config = isProduction ? { api: 'prod.com', timeout: 5000 } : { api: 'dev.com', timeout: 10000 };

// Good - define outside
const prodConfig = { api: 'prod.com', timeout: 5000 };
const devConfig = { api: 'dev.com', timeout: 10000 };
const config = isProduction ? prodConfig : devConfig;
```

## Promises

- Use `Promise.allSettled()` instead of `Promise.all()` unless you need to fail fast.
- Never use async inside `forEach` — create promise arrays and use `Promise.allSettled()`.

```typescript
// Bad
items.forEach(async (item) => {
  const result = await asyncOperation(item);
  results.push(result);
});

// Good
const promises = items.map(item => asyncOperation(item));
const results = await Promise.allSettled(promises);
```

## Functional paradigm

- Prefer `map`, `filter`, and `reduce` over traditional loops.
- Avoid mutating state directly; return new instances of objects or arrays.
- Use pure functions without side effects.
- Prefer spread or `concat` over `push`; prefer `filter` over `splice`; copy before `reverse`.

```typescript
// Bad - push mutates
numbers.push(4);
// Good
const newNumbers = [...numbers, 4];

// Bad - splice mutates
items.splice(1, 1);
// Good
const newItems = items.filter((_, i) => i !== 1);

// Bad - reverse mutates
original.reverse();
// Good
const reversed = [...original].reverse();

// Bad - mutation
const updateUser = (user) => {
  user.lastUpdated = new Date();
  return user;
};
// Good
const updateUser = (user) => ({ ...user, lastUpdated: new Date() });

// Bad - side effects mixed in
const processItems = (items) => {
  let total = 0;
  for (const item of items) {
    total += item.price;
    item.processed = true;
  }
  return total;
};
// Good - pure, separated
const calculateTotal = (items) => items.reduce((sum, item) => sum + item.price, 0);
const markProcessed = (items) => items.map(item => ({ ...item, processed: true }));
```
