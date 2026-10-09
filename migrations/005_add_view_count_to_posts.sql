ALTER TABLE posts
ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0
    CHECK (view_count >= 0);
