# API contract

All endpoints live at `/api`, return JSON except 204 deletes, and use `Cache-Control: no-store`.

| Method | Endpoint              | Behavior                                                        |
| ------ | --------------------- | --------------------------------------------------------------- |
| GET    | `/health`             | Status/version/storage; no session required                     |
| POST   | `/session`            | Create/reuse guest session; returns `csrfToken`, `expiresAt`    |
| GET    | `/projects`           | Owner's saved diagram summaries                                 |
| POST   | `/projects`           | Create `{graph}`; 201 full diagram record                       |
| GET    | `/projects/:id`       | Owner's full record                                             |
| PUT    | `/projects/:id`       | `{graph, revision}`; rejects stale revision with 409            |
| DELETE | `/projects/:id`       | Delete owned diagram and its share; 204                         |
| POST   | `/projects/:id/share` | Publish/replace confirmed immutable snapshot; 201 `{token,url}` |
| DELETE | `/projects/:id/share` | Revoke; 204                                                     |
| GET    | `/shares/:token`      | Public snapshot `{graph,publishedAt}`                           |
| POST   | `/graphs/analyze`     | Analyze `{graph}`; graph observations/summary/questions         |

Session creation requires an exact allowlisted `Origin`. Other mutations require the session cookie, same allowlisted origin and `X-CSRF-Token`. Read access to projects requires the session. Share reads do not require a session. Unowned IDs return 404. Browser clients use the frontend's same-origin `/api` path.

Graph data is validated with the strict shared schema. At most 100 nodes, 250 edges, 4096×4096 geometry, 250 characters per node label, 100 per connection label. IDs must be unique and references/bounds valid. Body limit is 1 MB; 50 projects per workspace; 240 API requests per minute per socket IP.

Errors are `{error: string}`. Common statuses: 400 malformed graph/JSON, 401 no session, 403 origin/CSRF, 404 missing/unowned/revoked, 409 stale write, 413 body too large, 422 workspace capacity/unconfirmed sharing, 429 request quota, 500 generic internal failure. Database errors and session values are not returned.
