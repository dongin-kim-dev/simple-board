CREATE TABLE post_daily_views (
    post_id BIGINT NOT NULL
        REFERENCES posts(id) ON DELETE CASCADE,

    view_date DATE NOT NULL,

    view_count BIGINT NOT NULL DEFAULT 0
        CHECK (view_count >= 0),

    PRIMARY KEY (post_id, view_date)
);