-- 1. 데이터베이스 접근
GRANT CONNECT ON DATABASE simple_board
TO simple_app;

-- 2. public 스키마 접근
GRANT USAGE ON SCHEMA public
TO simple_app;

-- 3. 백엔드 서비스 테이블 CRUD
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE
    public.users,
    public.sessions,
    public.posts,
    public.comments,
    public.post_attachments,
    public.post_daily_views
TO simple_app;
