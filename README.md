# QuickNotes System Design

QuickNotes is a small notes application project that demonstrates browser-to-API communication with a practice API and documents how a production notes service could be designed for one million registered users.

## What is included

- `index.html` — semantic HTML5 interface for loading, creating, and deleting notes.
- `style.css` — responsive, readable styling including distinct success and error messages.
- `api.js` — reusable async `request()` helper and GET, POST, and DELETE operations using JSONPlaceholder.
- `docs/api-design.md` — proposed production REST API, endpoints, examples, and error responses.
- `docs/data-model.md` — SQL entities, constraints, relationships, schema, queries, and indexes.
- `docs/architecture.md` — requirements, capacity estimates, architecture diagram, request flows, and trade-offs.

## Run the API client

1. Clone or download this repository.
2. Open `index.html` in a modern browser, or serve the folder with a local static server (recommended), for example:

   ```bash
   python -m http.server 8000
   ```

3. Visit `http://localhost:8000`.
4. Select **Load notes** to fetch ten sample posts, enter a title and optional body to create a demo note, and use **Delete** to remove a note from the current page.

The client calls `https://jsonplaceholder.typicode.com/posts`. JSONPlaceholder is a practice API: POST and DELETE responses are simulated and are not persisted on its server. The UI therefore keeps newly created notes in local page state and removes a note locally after a successful simulated delete. Reloading the page resets those demo changes. This project is a front-end API exercise, not a deployed production backend. Internet access is required for the practice API.

## Design documents

- [API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Architecture and scaling plan](docs/architecture.md)

## What I learned

- How to structure a reusable asynchronous `fetch()` helper, check HTTP errors, and handle loading, success, empty, and failure states.
- How to validate user input and render text safely with DOM APIs and `textContent` instead of injecting user-controlled HTML.
- How REST endpoints, HTTP status codes, request/response contracts, and authentication fit together in a production API.
- How primary keys, foreign keys, unique constraints, indexes, and a join table model note/tag relationships in SQL.
- How caches, load balancers, read replicas, queues, and multiple application instances address different scaling and availability concerns.
- Why a practice API's simulated writes must be distinguished from durable server-side storage.
