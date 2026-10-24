
import pool from "@/lib/db/pool";
import { createHash, randomUUID } from "node:crypto";

import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
} from "vitest";
import { TEST_CONFIG } from "../config/test-config";
import { createTestUser } from "../helpers/test-user";
import { API_ERROR_CODE, API_MESSAGE, API_STATUS, HTTP_STATUS } from "@/types/api";

const BASE_URL = TEST_CONFIG.BASE_URL;
const TEST_USER = createTestUser();
const UNKNOWN_EMAIL = `unknown-${randomUUID()}@example.com`;

let verifiedTestEnvironment = false;
let registeredUserId: string | undefined;

describe("로그인 API 테스트", () => {

    // 1. 테스트 환경 확인 및 사용자 생성
    beforeAll(async () => {
        // Health Check
        const healthResponse = await fetch(
            `${BASE_URL}/api/health/db`
        );

        const healthBody = await healthResponse.json();

        // HTTP 상태 코드 확인
        expect(healthResponse.status).toBe(HTTP_STATUS.OK);
        // 반환된 데이터의 status가 "success"인지 확인
        expect(healthBody.status).toBe(API_STATUS.SUCCESS);

        // 반환된 데이터의 키가 database, user만 있는지 확인
        expect(Object.keys(healthBody.data).sort()).toEqual(["database", "user"].sort());
        // 반환된 데이터의 값이 일치하는지 확인
        expect(healthBody.data.database).toBe(TEST_CONFIG.DB_NAME);
        expect(healthBody.data.user).toBe(TEST_CONFIG.DB_USER);

        // Vitest가 직접 연결한 DB도 확인
        const dbResult = await pool.query(
            "SELECT current_database() AS database"
        );

        expect(dbResult.rows[0].database).toBe(TEST_CONFIG.DB_NAME);

        verifiedTestEnvironment = true;

        // 로그인 테스트에 필요한 사용자 생성
        const registerResponse = await fetch(
            `${BASE_URL}/api/auth/register`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: TEST_USER.email,
                    password: TEST_USER.password,
                    name: TEST_USER.name,
                }),
            }
        );

        const registerBody = await registerResponse.json();

        // HTTP 상태 코드 확인
        expect(registerResponse.status).toBe(HTTP_STATUS.CREATED);

        // 반환된 데이터의 status가 "success"인지 확인
        expect(registerBody.status).toBe(API_STATUS.SUCCESS);
        // 반환된 데이터의 키가 email, id, name만 있는지 확인
        expect(Object.keys(registerBody.data).sort()).toEqual(["email", "id", "name"].sort());

        // 반환된 데이터의 값이 일치하는지 확인
        expect(registerBody.data.id).toMatch(/^[1-9]\d*$/);
        expect(registerBody.data.email).toBe(TEST_USER.email);
        expect(registerBody.data.name).toBe(TEST_USER.name);

        registeredUserId = registerBody.data.id;

    });

    // 2. 정상 로그인
    it("정상 로그인 시 HTTP 200을 반환", async () => {
        // 세션 유효기간 검증을 위해 로그인 직전 시간을 기록
        const beforeLogin = Date.now();

        const response = await fetch(
            `${BASE_URL}/api/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: TEST_USER.email,
                    password: TEST_USER.password,
                }),
            }
        );

        // 세션 유효기간 검증을 위해 로그인 직후 시간을 기록
        const afterLogin = Date.now();

        const body = await response.json();

        // HTTP 상태 코드 확인
        expect(response.status).toBe(HTTP_STATUS.OK);

        // 반환된 데이터의 status가 "success"인지 확인
        expect(body.status).toBe(API_STATUS.SUCCESS);

        // 반환된 데이터의 키가 email, id, name만 있는지 확인
        expect(Object.keys(body.data).sort()).toEqual(["email", "id", "name"].sort());

        // 반환된 데이터의 값이 일치하는지 확인
        expect(body.data.id).toMatch(/^[1-9]\d*$/); // id가 숫자로만 이루어져 있는지 확인
        expect(body.data.id).toBe(registeredUserId);
        expect(body.data.email).toBe(TEST_USER.email);
        expect(body.data.name).toBe(TEST_USER.name);

        // 로그인 응답에서 쿠키 확인
        const setCookie = response.headers.get("set-cookie");

        expect(setCookie).not.toBeNull();
        expect(setCookie).toContain("HttpOnly");

        // 쿠키의 원본 세션 토큰 추출
        const sessionToken = setCookie?.match(/^session=([0-9a-f]{64})(?:;|$)/)?.[1];

        expect(sessionToken).toBeDefined();

        // 원본 토큰을 SHA-256으로 해시
        const tokenHash = createHash("sha256")
            .update(sessionToken!)
            .digest("hex");

        // DB에 세션이 생성되었는지 확인
        const sessionResult = await pool.query(
            `
            SELECT
                id::text AS id,
                user_id::text AS user_id,
                token,
                expires_at
            FROM public.sessions
            WHERE token = $1
            `,
            [tokenHash]
        );

        // 해당 세션이 존재하는지 확인
        expect(sessionResult.rowCount).toBe(1);

        // 세션의 user_id가 로그인한 사용자의 id와 일치하는지 확인
        expect(sessionResult.rows[0].user_id).toBe(registeredUserId);

        // 세션의 토큰이 해시된 값과 일치하는지 확인
        expect(sessionResult.rows[0].token).toBe(tokenHash);

        const expiresAt = new Date(sessionResult.rows[0].expires_at).getTime();
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

        // 세션 유효기간이 7일인지 확인
        expect(expiresAt).toBeGreaterThanOrEqual(beforeLogin + sevenDaysInMs);
        expect(expiresAt).toBeLessThanOrEqual(afterLogin + sevenDaysInMs);

    });

    // 3. 비밀번호가 틀린 경우
    it("비밀번호가 틀리면 HTTP 401을 반환", async () => {
        // 로그인 실패 요청 전 세션 개수
        const beforeResult = await pool.query(
            `
            SELECT COUNT(*)::int AS count
            FROM public.sessions
            WHERE user_id = $1
            `,
            [registeredUserId]
        );

        const response = await fetch(
            `${BASE_URL}/api/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: TEST_USER.email,
                    password: "Wrong1234!",
                }),
            }
        );

        const body = await response.json();

        // HTTP 상태 코드 확인
        expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);

        // 반환된 데이터의 키가 status, code, message만 있는지 확인
        expect(Object.keys(body).sort()).toEqual(["status", "code", "message"].sort());


        // 반환된 데이터의 status가 "error"인지 확인
        expect(body.status).toBe(API_STATUS.ERROR);

        // 반환된 데이터의 값이 일치하는지 확인
        expect(body.code).toBe(API_ERROR_CODE.UNAUTHORIZED);
        expect(body.message).toBe(API_MESSAGE.INVALID_CREDENTIALS);

        // 세션 쿠키가 발급되지 않았는지 확인
        expect(response.headers.get("set-cookie")).toBeNull();

        const afterResult = await pool.query(
            `
            SELECT COUNT(*)::int AS count
            FROM public.sessions
            WHERE user_id = $1
            `,
            [registeredUserId]
        );

        // 세션 개수가 증가하지 않았는지 확인
        expect(afterResult.rows[0].count).toBe(
            beforeResult.rows[0].count
        );
    });

    // 4. 존재하지 않는 이메일
    it("존재하지 않는 이메일이면 HTTP 401을 반환", async () => {
        const response = await fetch(
            `${BASE_URL}/api/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: UNKNOWN_EMAIL,
                    password: TEST_USER.password,
                }),
            }
        );

        const body = await response.json();

        // HTTP 상태 코드 확인
        expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);

        // 반환된 데이터의 키가 status, code, message만 있는지 확인
        expect(Object.keys(body).sort()).toEqual(["status", "code", "message"].sort());

        // 반환된 데이터의 status가 "error"인지 확인
        expect(body.status).toBe(API_STATUS.ERROR);

        // 반환된 데이터의 값이 일치하는지 확인
        expect(body.code).toBe(API_ERROR_CODE.UNAUTHORIZED);
        expect(body.message).toBe(API_MESSAGE.INVALID_CREDENTIALS);

        // 세션 쿠키가 발급되지 않았는지 확인
        expect(response.headers.get("set-cookie")).toBeNull();
    });

    // 5. 잘못된 입력 타입
    it("잘못된 입력 타입이면 HTTP 400을 반환", async () => {
        // 로그인 실패 요청 전 세션 개수
        const beforeResult = await pool.query(
            `
            SELECT COUNT(*)::int AS count
            FROM public.sessions
            WHERE user_id = $1
            `,
            [registeredUserId]
        );

        const response = await fetch(
            `${BASE_URL}/api/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: 123,
                    password: TEST_USER.password,
                }),
            }
        );

        const body = await response.json();

        // HTTP 상태 코드 확인
        expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);

        // 반환된 데이터의 키가 status, code, message만 있는지 확인
        expect(Object.keys(body).sort()).toEqual(["status", "code", "message"].sort());

        // 반환된 데이터의 status가 "error"인지 확인
        expect(body.status).toBe(API_STATUS.ERROR);

        // 반환된 데이터의 값이 일치하는지 확인
        expect(body.code).toBe(API_ERROR_CODE.VALIDATION_ERROR);
        expect(body.message).toBe(API_MESSAGE.VALIDATION_ERROR);

        // 세션 쿠키가 발급되지 않았는지 확인
        expect(response.headers.get("set-cookie")).toBeNull();

        const afterResult = await pool.query(
            `
            SELECT COUNT(*)::int AS count
            FROM public.sessions
            WHERE user_id = $1
            `,
            [registeredUserId]
        );

        // 세션 개수가 증가하지 않았는지 확인
        expect(afterResult.rows[0].count).toBe(
            beforeResult.rows[0].count
        );
    });

    // 6. 잘못된 JSON 본문
    it("잘못된 JSON이면 HTTP 400을 반환", async () => {
        // 로그인 실패 요청 전 세션 개수
        const beforeResult = await pool.query(
            `
            SELECT COUNT(*)::int AS count
            FROM public.sessions
            WHERE user_id = $1
            `,
            [registeredUserId]
        );

        const response = await fetch(
            `${BASE_URL}/api/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: '{"email":',
            }
        );

        const body = await response.json();

        // HTTP 상태 코드 확인
        expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);

        // 반환된 데이터의 키가 status, code, message만 있는지 확인
        expect(Object.keys(body).sort()).toEqual(["status", "code", "message"].sort());

        // 반환된 데이터의 status가 "error"인지 확인
        expect(body.status).toBe(API_STATUS.ERROR);

        // 반환된 데이터의 값이 일치하는지 확인
        expect(body.code).toBe(API_ERROR_CODE.VALIDATION_ERROR);
        expect(body.message).toBe(API_MESSAGE.INVALID_JSON_BODY);

        // 세션 쿠키가 발급되지 않았는지 확인
        expect(response.headers.get("set-cookie")).toBeNull();

        const afterResult = await pool.query(
            `
            SELECT COUNT(*)::int AS count
            FROM public.sessions
            WHERE user_id = $1
            `,
            [registeredUserId]
        );

        // 세션 개수가 증가하지 않았는지 확인
        expect(afterResult.rows[0].count).toBe(
            beforeResult.rows[0].count
        );
    });

    // 7. 테스트 데이터 정리
    afterAll(async () => {
        try {
            if (!verifiedTestEnvironment) {
                return;
            }

            // 삭제 직전에 실제 DB 확인
            const result = await pool.query(
                "SELECT current_database() AS database"
            );

            if (result.rows[0].database !== TEST_CONFIG.DB_NAME) {
                throw new Error("테스트 DB가 아닙니다.");
            }

            // 테스트 사용자 삭제
            // sessions는 ON DELETE CASCADE로 자동 삭제
            const deleteResult = await pool.query(
                `
                DELETE FROM public.users
                WHERE email = $1
                `,
                [TEST_USER.email]
            );


            if (registeredUserId !== undefined) {
                // 삭제된 행 수가 1인지 확인
                expect(deleteResult.rowCount).toBe(1);
            }
        } finally {
            await pool.end();
        }
    });
});
