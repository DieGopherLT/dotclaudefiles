# Error Handling

- Fail fast: validate inputs at system boundaries (user input, external APIs) and return errors immediately.
- Provide context: error messages must include what failed and why, not just that something failed.
- Never silently swallow errors — if you catch, either handle or re-throw with added context.
- Trust internal code and framework guarantees; only validate at boundaries.

## Error message quality

```
// Bad - no context
throw new Error('Failed');
throw new Error('Invalid input');
return null; // silently swallowing

// Good - actionable context
throw new Error(`fetchUser: userId="${userId}" not found`);
throw new Error(`validateOrder: amount ${amount} exceeds limit ${LIMIT}`);
```

## Input validation at boundaries

Validate early, before any processing:

```
function processOrder(order) {
  if (!order.userId) throw new Error('processOrder: userId is required');
  if (!order.items?.length) throw new Error('processOrder: order must contain at least one item');
  // proceed with valid input
}
```

## Never swallow silently

```
// Bad
try {
  await sendEmail(user.email);
} catch (_) {
  // ignore
}

// Good - handle or rethrow with context
try {
  await sendEmail(user.email);
} catch (err) {
  throw new Error(`notifyUser: failed to send email to ${user.email}: ${err.message}`);
}
```
