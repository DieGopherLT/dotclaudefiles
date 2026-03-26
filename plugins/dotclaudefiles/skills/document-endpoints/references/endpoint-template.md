# Endpoint Documentation Template

Use this template for every endpoint. Omit sections that do not apply (e.g., no query params table for endpoints without query params, no request body for GET/DELETE, no headers section if only standard `Content-Type: application/json` is needed).

---

## Template

### METHOD /path/:param

Brief description of what this endpoint does.

#### Headers

- `Authorization: Bearer <token>` - JWT access token
- `X-Custom-Header: <value>` - Purpose of this header

#### URL Parameters

| Name | Type | Description |
|------|------|-------------|
| param | string | What this parameter identifies |

#### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| page | number | No | Page number for pagination |
| limit | number | No | Items per page (default: 20) |
| search | string | No | Filter by search term |

#### Request Body

For JSON bodies, use a `jsonc` block with inline type annotations:

```jsonc
{
  "name": "John Doe",          // string, required
  "email": "john@example.com", // string, required
  "role": "admin"              // "admin" | "user", optional, defaults to "user"
}
```

For `multipart/form-data` (file uploads), use a table instead and add `Content-Type: multipart/form-data` to the headers section:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| avatar | file | Yes | Profile image (max 5MB, jpg/png) |
| name | string | Yes | Display name |
| bio | string | No | User biography |

#### Responses

**200 OK** - Successfully retrieved the resource.

```jsonc
{
  "id": 1,                        // number
  "name": "John Doe",             // string
  "email": "john@example.com",    // string
  "avatar": null,                 // string | null
  "role": "admin",                // "admin" | "user"
  "metadata": {                   // object | optional -- may not appear
    "lastLogin": "2025-01-15"     // string (ISO 8601 date)
  },
  "createdAt": "2025-01-01T00:00:00Z"  // string (ISO 8601)
}
```

**400 Bad Request** - Validation error.

```jsonc
{
  "error": "Validation failed",   // string
  "details": [                    // array
    {
      "field": "email",           // string
      "message": "Invalid format" // string
    }
  ]
}
```

---

## Conventions

### URL parameters

Use Express-style syntax: `/users/:id`, `/orders/:orderId/items/:itemId`.

### Type annotations in jsonc

Annotate every field with its type as an inline comment:

- Primitives: `// number`, `// string`, `// boolean`
- Nullable: `// string | null`
- Optional (may not appear in the response): `// string | optional`
- Nullable and optional: `// string | null | optional`
- Union of fixed values: `// "active" | "inactive" | "suspended"`
- Nested objects: `// object` (fields documented inline)
- Arrays: `// array` (item shape shown by example)
- Date strings: `// string (ISO 8601)` or `// string (ISO 8601 date)`

### Request body conventions

- **JSON bodies**: always a `jsonc` block. Annotate each field with its type and whether it is required or optional. If a field has a default value, note it (e.g., `// string, optional, defaults to "user"`).
- **Multipart bodies**: always a table with Name/Type/Required/Description columns. Include file constraints (max size, allowed formats) in the description. Type `file` for single file, `file[]` for multiple files.

### Response documentation conventions

Each response is a pair of three elements:

1. **Status line**: bold status code + reason phrase, followed by a dash and a short description of when this response occurs.
   Format: `**<code> <reason>** - <when this happens>.`

2. **Body example**: a `jsonc` block showing the exact shape of the response body with inline type annotations on every field. The example must use realistic values (not placeholders like "string1" or "value") so the consumer can understand the data at a glance.

3. **Nullable/optional callouts**: within the jsonc annotations, explicitly mark:
   - Fields that can be `null` with `| null`
   - Fields that may be absent from the response with `| optional`
   - Both with `| null | optional`

Document responses in this order:

- Success responses first (2xx), from most common to least
- Then client errors (4xx)
- Then server errors (5xx) only if the endpoint has specific error handling

Only document status codes the endpoint actually returns. A typical endpoint documents 2-4 responses (one success + 1-3 errors). Common patterns:

- **GET single resource**: 200, 404
- **GET collection**: 200
- **POST create**: 201, 400, 409 (conflict)
- **PUT/PATCH update**: 200, 400, 404
- **DELETE**: 204 (no body), 404

If the API uses a consistent error response format across endpoints, document the shape once and reference it in subsequent endpoints rather than repeating it.

### Sections to omit

- **Headers**: omit if only `Content-Type: application/json` is needed
- **URL Parameters**: omit if the path has no `:param` segments
- **Query Parameters**: omit if the endpoint accepts no query params
- **Request Body**: omit for GET, DELETE, and any method with no body
- **Error responses**: only document error codes the endpoint actually returns

### Grouping

Within a single document, group endpoints by resource:

```markdown
# Feature Name Endpoints

## Users

### GET /users

### GET /users/:id

### POST /users

## Orders

### GET /orders

### POST /orders
```
