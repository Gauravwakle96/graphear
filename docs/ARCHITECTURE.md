# Graphear architecture

React/TypeScript web workspace + Express REST service + shared validated graph engine.
Original image pixels remain in the browser. Explicit private saves send only graph
text/geometry to a same-origin service; explicit sharing creates a read-only snapshot.
SQLite stores hashed guest sessions, private graph snapshots, immutable shares and
durable request counters. The backend is intended for a single host with a persistent
volume. Horizontal replication requires a shared external database/rate limiter.

Graph model: bounded nodes/edges, unique IDs, labels/types, source boxes, review
status and stable revision data. No arbitrary expressions or executable uploaded code.
Algorithms provide reachability, bounded traversal, cycles, graph differences and
checked learning missions. Draft OCR connections require review; confidence is not
misrepresented as calibrated graph correctness.

Feature boundaries: web/components, web/features, web/lib, api/controllers/service
boundary in app.ts, api/store.ts persistence, core graph.ts/learning.ts/samples.ts.
Local browser library provides an offline fallback. A native speech voice is optional;
available languages/voices depend on the user's browser/OS.

API contract: POST /api/session establishes a guest identity and CSRF token;
GET/POST /api/projects lists/saves private diagrams; PUT/DELETE /api/projects/:id
uses owner-scoped queries and optimistic revision checks; POST/DELETE /api/projects/:id/share
publishes/revokes an immutable snapshot; GET /api/shares/:token returns only that snapshot;
POST /api/graphs/analyze validates a graph and returns deterministic analysis.
JSON size/type checks, source schema validation, exact origin allowlist, HttpOnly
SameSite cookies, CSRF header, durable rate limiting, CSP and safe text rendering.

Production serves the compiled web app and API from one origin. Docker includes a
persistent /app/data volume. No paid APIs, hidden telemetry or user data in the repository.

## AI Learning extension

The separate consented AI Learning mode, private file processing, provider layer, endpoints, limits and known deployment/accuracy constraints are documented in [AI_LEARNING.md](AI_LEARNING.md). Legacy local imports remain on-device.
