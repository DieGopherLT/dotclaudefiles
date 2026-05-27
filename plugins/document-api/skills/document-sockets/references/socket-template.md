# Socket Event Documentation Template

Use this template for every socket.io event. Omit sections that do not apply (e.g., no acknowledgement section if the event has no callback, no room if the event broadcasts globally on the namespace).

---

## Template

### `event-name`

Brief description of what this event does.

- **Namespace**: `/chat`
- **Room**: `room:<roomId>` (omit if not scoped to a room)

#### Payload

```jsonc
{
  "message": "Hello",         // string
  "roomId": "room-123",       // string
  "timestamp": 1706745600000  // number (Unix ms)
}
```

#### Acknowledgement

When the event expects a callback response from the receiver:

```jsonc
{
  "success": true,      // boolean
  "messageId": "msg-1"  // string
}
```

On error:

```jsonc
{
  "success": false,           // boolean
  "error": "Room not found"   // string
}
```

---

## Conventions

### Event naming

Use kebab-case for event names: `send-message`, `user-joined`, `typing-start`.

### Direction grouping

Organize the document in two main sections:

```markdown
# Feature Name Socket Events

## Client Emits (client -> server)

Events the client sends to the server.

### `send-message`

...

### `typing-start`

...

## Server Emits (server -> client)

Events the server sends to the client.

### `new-message`

...

### `user-joined`

...
```

### Namespace and room

- **Namespace**: the socket.io namespace where the event lives (e.g., `/`, `/chat`, `/notifications`). Always document it, even if it is the default `/`.
- **Room**: the room scope for the event, if applicable. Use a pattern like `room:<id>` or `user:<userId>` to show the naming convention. Omit if the event broadcasts to the entire namespace.

### Payload conventions

- Use `jsonc` blocks with inline type annotations, same syntax as endpoint documentation.
- Primitives: `// number`, `// string`, `// boolean`
- Nullable: `// string | null`
- Optional: `// string | optional`
- Unions: `// "online" | "offline" | "away"`
- Timestamps: `// number (Unix ms)` or `// string (ISO 8601)`

### Acknowledgement conventions

Document acknowledgements only when the event uses a callback. Show both the success and error shapes. If the event is fire-and-forget (no callback), omit the acknowledgement section entirely.

### Events without payload

Some events carry no data (e.g., `disconnect`, `typing-stop`). Document them with a note:

```markdown
### `typing-stop`

Signals the user stopped typing.

- **Namespace**: `/chat`
- **Room**: `room:<roomId>`

No payload.
```

### Connection lifecycle events

If relevant, document connection-related events separately at the top of the file:

- `connection` / `connect` - initial handshake, auth token in handshake query/headers
- `disconnect` - cleanup behavior, reason codes
- `error` - error event shapes

### Grouping within direction

Within each direction section (Client Emits / Server Emits), group related events together. For example, all chat-related events before notification events. Use the logical flow of the feature to determine order.
