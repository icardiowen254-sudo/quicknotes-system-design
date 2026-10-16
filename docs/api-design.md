# QuickNotes REST API Design

This document describes the **production QuickNotes API**, not the JSONPlaceholder practice endpoint used by the browser client. All paths are relative to `/api/v1`; JSON requests and responses use `Content-Type: application/json`. Authenticated routes require a valid bearer access token.

## Endpoints

| Method | Path | Description | Success status |
|---|---|---|---|
| `GET` | `/api/v1/notes` | List the authenticated user's notes; supports `limit` and cursor pagination. | `200 OK` |
| `GET` | `/api/v1/notes/{noteId}` | Retrieve one note owned by the authenticated user. | `200 OK` |
| `POST` | `/api/v1/notes` | Create a note for the authenticated user. | `201 Created` |
| `PATCH` | `/api/v1/notes/{noteId}` | Update a note's title, body, or tags. | `200 OK` |
| `DELETE` | `/api/v1/notes/{noteId}` | Delete a note owned by the authenticated user. | `204 No Content` |
| `GET` | `/api/v1/tags` | List tags used by the authenticated user. | `200 OK` |
| `GET` | `/api/v1/tags/{tagId}/notes` | List the user's notes associated with a tag. | `200 OK` |
| `GET` | `/api/v1/users/me` | Return the authenticated user's profile. | `200 OK` |

## Create a note

**Request** — `POST /api/v1/notes`

```json
{
  "title": "Plan the week",
  "body": "Finish the database assignment and review the project.",
  "tagIds": [2, 4]
}
```

The server derives the owner from the authenticated token rather than trusting a `userId` supplied by the client. The title is required, trimmed, and limited to 100 characters; body is optional. Referenced tags must belong to the current user or be otherwise permitted.

**Response** — `201 Created`

```json
{
  "data": {
    "id": 1042,
    "userId": 27,
    "title": "Plan the week",
    "body": "Finish the database assignment and review the project.",
    "tags": [
      { "id": 2, "name": "Work" },
      { "id": 4, "name": "Study" }
    ],
    "createdAt": "2026-10-16T08:30:00Z",
    "updatedAt": "2026-10-16T08:30:00Z"
  }
}
```

The response should include a `Location: /api/v1/notes/1042` header. IDs and timestamps above are illustrative.

## List notes

**Request** — `GET /api/v1/notes?limit=2&cursor=eyJpZCI6MTAwMH0`

The `limit` parameter is optional and capped (for example, at 100). The opaque `cursor` is optional. The server returns only notes the authenticated user is allowed to see.

**Response** — `200 OK`

```json
{
  "data": [
    {
      "id": 1042,
      "userId": 27,
      "title": "Plan the week",
      "body": "Finish the database assignment and review the project.",
      "tags": [{ "id": 2, "name": "Work" }],
      "createdAt": "2026-10-16T08:30:00Z",
      "updatedAt": "2026-10-16T08:30:00Z"
    },
    {
      "id": 1039,
      "userId": 27,
      "title": "Reading list",
      "body": "Read one chapter tonight.",
      "tags": [],
      "createdAt": "2026-10-15T18:00:00Z",
      "updatedAt": "2026-10-15T18:00:00Z"
    }
  ],
  "page": {
    "limit": 2,
    "nextCursor": "eyJpZCI6MTAzOX0"
  }
}
```

An empty collection returns `200 OK` with `"data": []`, not a `404`.

## Error status codes

| Status | Meaning | Typical cause |
|---|---|---|
| `400 Bad Request` | Invalid request data or parameters. | Missing title, title longer than 100 characters, malformed JSON, invalid pagination. |
| `401 Unauthorized` | Authentication is missing or invalid. | Missing, expired, or invalid bearer token. |
| `403 Forbidden` | Authenticated user lacks permission. | Attempting an operation forbidden by a policy. |
| `404 Not Found` | Resource does not exist or is not visible to the user. | Unknown note ID. |
| `409 Conflict` | Request conflicts with current state. | A unique tag name already exists for the user. |
| `413 Content Too Large` | Request exceeds the allowed size. | Body is larger than the configured limit. |
| `429 Too Many Requests` | Rate limit exceeded. | Too many requests in a short period. |
| `500 Internal Server Error` | Unexpected server-side failure. | Unhandled application or infrastructure error. |

**Example error body** (`400 Bad Request`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The title must be between 1 and 100 characters.",
    "details": [{ "field": "title", "issue": "required_or_too_long" }],
    "requestId": "req_8f21c"
  }
}
```

The API should use consistent error shapes, avoid returning stack traces or secrets, validate ownership on every note operation, enforce rate limits, and log the request ID for troubleshooting.
