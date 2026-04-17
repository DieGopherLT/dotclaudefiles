---
paths:
  - "**/*.go"
---

# Go Control Flow

## Guard clauses — flatten error handling

Go's explicit errors invite pyramid nesting. Always return early on error; never put the happy path inside `if err == nil`.

```go
// Bad
order, err := fetchOrder(id)
if err == nil {
    items, err := fetchItems(order)
    if err == nil {
        return buildResponse(order, items)
    }
}

// Good
order, err := fetchOrder(id)
if err != nil {
    return nil, fmt.Errorf("processOrder: %w", err)
}
items, err := fetchItems(order)
if err != nil {
    return nil, fmt.Errorf("processOrder: %w", err)
}
return buildResponse(order, items)
```

## `ok` pattern — same rule applies

Map lookups, channel receives, and type assertions follow the same principle: invert the condition, handle the missing case early.

```go
// Bad
if val, ok := store.Get(key); ok {
    process(val)
} else {
    handleMissing(key)
    return
}

// Good
val, ok := store.Get(key)
if !ok {
    handleMissing(key)
    return
}
process(val)
```

## Never `else` after `return` or error check

Once you return or handle an error, continue at the same indentation level — no `else`.

## Extract nested conditions into named functions

When a condition requires more than one level of nesting, extract it. The name documents the intent.

```go
// Bad
if user != nil {
    if user.IsActive {
        if user.Role == "admin" {
            grantAccess()
        }
    }
}

// Good
if canGrantAccess(user) {
    grantAccess()
}

func canGrantAccess(user *User) bool {
    return user != nil && user.IsActive && user.Role == "admin"
}
```

## Type switches over repeated type assertions

```go
// Bad
if v, ok := val.(string); ok {
    ...
} else if v, ok := val.(int); ok {
    ...
}

// Good
switch v := val.(type) {
case string:  ...
case int:     ...
}
```
