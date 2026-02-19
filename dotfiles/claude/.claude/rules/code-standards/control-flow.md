# Control Flow

- Guard clauses at function start: validate and return early before the main logic.
- Avoid `else` — use early returns to reduce nesting.
- Prefer `switch` over multiple `if-else` chains when dealing with multiple discrete values for a single variable.
- Immutability: create new objects/arrays instead of mutating existing ones.

## Guard clauses

```
// Bad - nested
if (user) {
  if (user.isActive) {
    if (user.hasPermission) {
      return processUser(user);
    }
  }
}
return null;

// Good - guard clauses
if (!user) return null;
if (!user.isActive) return null;
if (!user.hasPermission) return null;
return processUser(user);
```

## Switch over if-else chains

```
// Bad
if (status === 'pending') {
  return 'yellow';
} else if (status === 'approved') {
  return 'green';
} else if (status === 'rejected') {
  return 'red';
} else {
  return 'gray';
}

// Good
switch (status) {
  case 'pending': return 'yellow';
  case 'approved': return 'green';
  case 'rejected': return 'red';
  default: return 'gray';
}
```

## Early return over else

```
// Bad
function getDiscount(amount) {
  if (amount > 100) {
    return 0.2;
  } else {
    return 0.1;
  }
}

// Good
function getDiscount(amount) {
  if (amount > 100) return 0.2;
  return 0.1;
}
```
