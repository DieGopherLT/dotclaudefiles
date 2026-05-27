---
name: document-sockets
description: Esta skill debe usarse cuando el usuario pide "documenta los sockets", "documenta los eventos", "documentar websockets", "document the sockets", "document socket events", "necesito la doc de los sockets para el frontend", o cuando menciona documentar eventos de socket.io para consumo desde el frontend. Tambien activar cuando el usuario menciona pasar eventos al frontend, compartir contratos de sockets, o preparar documentacion de eventos en tiempo real. No usar para endpoints HTTP REST (usar document-endpoints en su lugar).
---

# Document Sockets

## Workflow

1. Determine scope from conversation context -- identify which socket handlers/gateways were created or modified. If the user names specific events or namespaces, limit to those. If ambiguous, use `AskUserQuestion` to confirm which events to document.
2. Determine the file prefix (feature name or session context, e.g., `chat`, `notifications`). If unclear, ask with `AskUserQuestion`.
3. Create `.claude/docs/api/` directory if it does not exist.
4. Write documentation to `.claude/docs/api/<prefix>-SOCKETS.md`.
5. Follow the template and conventions in `references/socket-template.md` for every event.
6. Group events by direction: first all client emits (client -> server), then all server emits (server -> client).
