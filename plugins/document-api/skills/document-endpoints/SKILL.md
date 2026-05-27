---
name: document-endpoints
description: Esta skill debe usarse cuando el usuario pide "documenta los endpoints", "documenta la API", "documentar las rutas", "document the endpoints", "document the API", "necesito la doc de los endpoints para el frontend", o cuando menciona documentar endpoints HTTP para consumo desde el frontend. Tambien activar cuando el usuario menciona pasar endpoints al frontend, compartir contratos HTTP, o preparar documentacion de rutas REST. No usar para WebSockets ni socket.io (usar document-sockets en su lugar).
---

# Document Endpoints

## Workflow

1. Determine scope from conversation context -- identify which routes/controllers were created or modified. If the user names specific resources, limit to those. If ambiguous, use `AskUserQuestion` to confirm which endpoints to document.
2. Determine the file prefix (feature name or session context, e.g., `auth`, `payments`). If unclear, ask with `AskUserQuestion`.
3. Create `.claude/docs/api/` directory if it does not exist.
4. Write documentation to `.claude/docs/api/<prefix>-ENDPOINTS.md`.
5. Follow the template and conventions in `references/endpoint-template.md` for every endpoint.
6. Group endpoints by resource using H2 sections for resources and H3 for individual endpoints.
