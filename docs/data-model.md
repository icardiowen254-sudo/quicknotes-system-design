# QuickNotes Data Model

QuickNotes stores users, their notes, reusable tags, and the association between notes and tags. The SQL below uses SQLite-compatible types and syntax.

## Entities and columns

- **users** — one account per user. `id` is the primary key; `email` is required and unique; `display_name` is required; `created_at` records account creation.
- **notes** — a note belongs to one user. `id` is the primary key and `user_id` is a required foreign key to `users.id`; title is required and limited by application validation to 100 characters; body is optional.
- **tags** — a tag belongs to one user, so users can have tags with the same name without sharing private labels. `id` is the primary key and `user_id` references `users.id`.
- **note_tags** — join table associating notes and tags. Both columns are foreign keys, and the composite primary key `(note_id, tag_id)` prevents the same tag being attached to the same note twice.

## Relationships

**One-to-many:** one user can own many notes, but each note has exactly one owner; one user can also create many tags, while each tag belongs to one user. These relationships are represented by foreign keys in `notes` and `tags`.

**Many-to-many:** one note can have multiple tags and one tag can be used on multiple notes belonging to its owner. `note_tags` is the join table that turns this many-to-many relationship into two one-to-many relationships and stores each note/tag pairing. Application logic must ensure the note and tag belong to the same user.

## SQLite schema

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),
    body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_user_updated
    ON notes(user_id, updated_at DESC);

CREATE INDEX idx_note_tags_tag
    ON note_tags(tag_id);
```

The application should update `updated_at` when a note changes; SQLite does not automatically refresh it with the schema above. Foreign-key enforcement must be enabled for each SQLite connection.

## Example SQL queries

### 1. List a user's notes, newest updated first

```sql
SELECT id, title, body, created_at, updated_at
FROM notes
WHERE user_id = 1
ORDER BY updated_at DESC
LIMIT 20;
```

### 2. Find notes with their tags (JOIN across the join table)

```sql
SELECT n.id, n.title, t.name AS tag_name
FROM notes AS n
JOIN note_tags AS nt ON nt.note_id = n.id
JOIN tags AS t ON t.id = nt.tag_id AND t.user_id = n.user_id
WHERE n.user_id = 1
ORDER BY n.id, t.name;
```

### 3. Count notes per user, including users with no notes

```sql
SELECT u.id, u.display_name, COUNT(n.id) AS note_count
FROM users AS u
LEFT JOIN notes AS n ON n.user_id = u.id
GROUP BY u.id, u.display_name
ORDER BY u.display_name;
```

### 4. Find notes without any tags

```sql
SELECT n.id, n.title
FROM notes AS n
LEFT JOIN note_tags AS nt ON nt.note_id = n.id
WHERE n.user_id = 1 AND nt.note_id IS NULL;
```

## Index choice

The index `idx_notes_user_updated` on `(user_id, updated_at DESC)` supports the most common list operation: fetch one user's notes ordered by most recently updated. It reduces the rows the database must scan and can help avoid a separate sort. The `idx_note_tags_tag` index supports looking up notes for a given tag; the composite primary key on `note_tags` already supports lookups beginning with `note_id`.

## SQL or NoSQL?

I would choose a relational SQL database such as PostgreSQL for QuickNotes. Users, notes, tags, and note-tag associations have clear relationships and integrity rules, and transactions help keep note edits and tag changes consistent. SQL provides foreign keys, unique constraints, indexes, and joins for common queries. NoSQL can be appropriate for flexible document-shaped data or specialized high-scale access patterns, but the predictable relationships and ownership rules here make SQL a strong default. PostgreSQL can scale with indexing, read replicas, connection pooling, and partitioning if future measurements justify them.
