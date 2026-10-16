# QuickNotes Architecture and Scaling Plan

## Assumptions for the load estimate

- QuickNotes has **1,000,000 registered users**; assume 10% are active on an average day, giving **100,000 daily active users (DAU)**.
- Each daily active user makes 20 note-list/read requests and creates one note per day. Updates and deletes are excluded from the simple baseline; include them in later production measurements.
- Average stored note text and metadata consume about **1 KB per note** before indexes, replicas, backups, and logs.
- Use 86,400 seconds per day and 365 days per year. Peak traffic is assumed to be 5 times the daily average.
- These are planning estimates, not a capacity guarantee; actual traffic, payload sizes, retention, and access patterns must be measured.

## Estimated load

**Reads:** 100,000 DAU × 20 reads/day = 2,000,000 reads/day. Average reads/second = 2,000,000 ÷ 86,400 = **about 23.1 reads/second**; estimated peak = **about 116 reads/second** at 5× average.

**Writes:** 100,000 DAU × 1 new note/day = 100,000 writes/day. Average writes/second = 100,000 ÷ 86,400 = **about 1.16 writes/second**; estimated peak = **about 5.8 writes/second** at 5× average. This excludes edits, deletes, tags, and background jobs.

**Storage:** 100,000 notes/day × 1 KB = 100,000 KB/day, approximately 100 MB/day. Over 365 days, that is **about 36.5 GB of new note data per year** (decimal units), before indexes, replicas, backups, and growth in existing notes. With this baseline, QuickNotes is read-heavy: it has roughly 20 list/read requests per created note. Caching and read scaling therefore matter, while writes still need transactional correctness.

## Architecture diagram

```text
                    +--------------------------+
                    | Browser / Mobile Client  |
                    +------------+-------------+
                                 |
                           DNS resolves
                                 |
                    +------------v-------------+
                    | CDN / Edge (static files)|
                    +------------+-------------+
                                 |
                    +------------v-------------+
                    | Load Balancer / Ingress  |
                    +-------+-----------+------+
                            |           |
                    +-------v--+   +----v-------+
                    | App      |   | App        |
                    | Server A |   | Server B   |  ... more replicas
                    +----+-----+   +-----+------+
                         |               |
                 +-------v---------------v-------+
                 | Cache (e.g. Redis)             |
                 +---------------+----------------+
                                 |
                    +------------v-------------+
                    | Primary Database          |
                    | users, notes, tags        |
                    +------------+-------------+
                                 | replication
                    +------------v-------------+
                    | Read Replica              |
                    +--------------------------+

 Note-change / async work:
                    +--------------------------+
                    | App Server                |
                    +------------+-------------+
                                 | enqueue job
                    +------------v-------------+
                    | Durable Queue             |
                    +------------+-------------+
                                 | consume
                    +------------v-------------+
                    | Background Worker         |
                    +------------+-------------+
                                 | update derived data,
                                 | notifications, etc.
                    +------------v-------------+
                    | Primary DB / Cache        |
                    +--------------------------+
```

## What each component solves

- **Client:** Provides the user interface and sends HTTPS requests to the service.
- **DNS:** Resolves the public service hostname to the correct edge or load-balancer entry point.
- **CDN:** Caches and delivers versioned static assets close to users, reducing latency and origin traffic; private note API responses should not be publicly cached.
- **Load balancer:** Distributes requests across healthy application instances and removes unhealthy instances from rotation.
- **App servers (at least two):** Run stateless API logic and validation, allowing horizontal scaling and rolling deployments without relying on a single machine.
- **Cache:** Holds short-lived, frequently read data to reduce repeated database work; cache misses fall through to the database.
- **Primary database:** Is the source of truth for users, notes, tags, permissions, and transactions.
- **Read replica:** Serves eligible read-only queries to reduce primary load, with the trade-off that replication can lag.
- **Durable queue:** Buffers background tasks and decouples slow work from the user's request so jobs can be retried after transient failures.
- **Background worker:** Consumes queued jobs for tasks such as notifications, audit processing, and cache refreshes without blocking API responses.

## Flow: `GET /notes`

1. The client resolves the service hostname through DNS and sends an authenticated HTTPS request.
2. The CDN serves static application assets when cached; the private `/api/v1/notes` request is forwarded rather than exposed as a shared public cache response.
3. The load balancer selects a healthy app-server instance.
4. The app server validates the access token, checks the user's permissions, and validates pagination parameters.
5. The server checks the cache for the user's feed/list result using a user-scoped cache key. If a valid entry exists, it returns the result.
6. On a cache miss, the server queries the read replica when its freshness is acceptable, or the primary when read-after-write consistency is required.
7. The server formats a paginated JSON response, updates the cache with a short TTL, and returns `200 OK` to the client.

## Flow: `POST /notes`

1. The client sends an authenticated HTTPS `POST /api/v1/notes` with a JSON title and optional body.
2. DNS and the load balancer route the request to a healthy app server.
3. The app server authenticates the user, validates the title length and payload, and derives `user_id` from the authenticated identity rather than trusting the client.
4. The server inserts the note into the primary database inside a transaction and commits it; the database enforces foreign keys and constraints.
5. After a successful commit, the server invalidates or updates the affected user's note-list cache and enqueues any asynchronous follow-up work using a reliable outbox or equivalent pattern when delivery guarantees matter.
6. The server returns `201 Created`, the new note representation, and a `Location` header. Background workers process queued jobs independently and retry transient failures safely.

## Trade-offs

1. **Cache speed versus freshness:** Cache entries lower latency and database load, but users may briefly see stale data. Use short TTLs, user-scoped keys, and targeted invalidation after writes; keep private responses out of public CDN caches.
2. **Read replicas versus consistency:** Replicas improve read capacity, but replication lag can hide a just-created note. Route read-after-write requests to the primary or use a consistency-aware session strategy.
3. **Asynchronous queue versus immediate completion:** Queues keep API requests fast and absorb bursts, but introduce eventual consistency and worker operations. Make jobs idempotent, monitor queue age, and retry with backoff and a dead-letter path.
4. **More instances versus operational cost:** Multiple app servers and replicas improve availability and throughput but increase cost and deployment complexity. Scale from metrics and use health checks and autoscaling limits.

## Avoiding single points of failure

Run at least two app servers across separate failure domains behind a health-checking load balancer; deploy redundant DNS/edge infrastructure through the hosting provider; use a managed database with automated backups, multi-zone failover, and a tested restore process; configure the read replica so it can be replaced or promoted during an incident; run queue brokers in a durable replicated configuration; and operate multiple workers so one worker failure does not stop background processing. Monitor latency, error rates, database saturation, replication lag, queue depth, and backup/restore success. A replica or backup is not a complete high-availability plan until failover and recovery have been tested.
