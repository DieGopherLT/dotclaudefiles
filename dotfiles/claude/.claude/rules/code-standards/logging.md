# Logging

- Use structured logging (JSON) for production systems.
- Log at the boundary — not inside every function.
- Never log sensitive data (passwords, tokens, full card numbers, PII).
- Include correlation IDs for distributed tracing when applicable.

## Log levels

| Level | When to use |
|-------|-------------|
| ERROR | Operation failed, needs attention |
| WARN  | Degraded state, system still functional |
| INFO  | Key business events (order placed, user signed in) |
| DEBUG | Development only — remove before production |

## Structured log format

```json
{
  "level": "error",
  "message": "Payment processing failed",
  "correlationId": "req-abc123",
  "userId": "usr-456",
  "amount": 99.99,
  "error": "card declined",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## What NOT to log

```
// Bad - sensitive data
logger.info('User login', { email, password });
logger.debug('Payment attempt', { cardNumber, cvv });

// Good - safe identifiers only
logger.info('User login', { userId, email });
logger.info('Payment attempt', { userId, amount, currency });
```
