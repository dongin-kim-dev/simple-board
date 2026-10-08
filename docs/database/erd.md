# Database ERD

```mermaid
erDiagram

    users ||--o{ sessions : has
    users ||--o{ posts : writes
    users ||--o{ comments : writes
    posts ||--o{ comments : has

    users {
        bigint id PK
        varchar email UK
        varchar password_hash
        varchar name
        timestamptz created_at
        timestamptz updated_at
    }

    sessions {
        bigint id PK
        bigint user_id FK
        varchar token UK
        timestamptz expires_at
        timestamptz created_at
    }

    posts {
        bigint id PK
        bigint user_id FK
        varchar title
        text content
        timestamptz created_at
        timestamptz updated_at
    }

    comments {
        bigint id PK
        bigint post_id FK
        bigint user_id FK
        text content
        timestamptz created_at
        timestamptz updated_at
    }