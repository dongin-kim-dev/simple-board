CREATE TABLE post_attachments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    post_id BIGINT NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    type VARCHAR(10) NOT NULL
        CHECK (type IN ('image', 'video')),

    storage_key TEXT NOT NULL,

    original_name VARCHAR(255),

    mime_type VARCHAR(100), 

    size_bytes BIGINT
        CHECK (size_bytes >= 0),

    sort_order INTEGER NOT NULL DEFAULT 0
        CHECK (sort_order >= 0),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_attachments_post_id
ON post_attachments(post_id);
