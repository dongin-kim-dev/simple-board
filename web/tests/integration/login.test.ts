
import pool from "@/lib/db/pool";
import { randomUUID } from "node:crypto";

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

    });

    // 3. 비밀번호가 틀린 경우
    it("비밀번호가 틀리면 HTTP 401을 반환", async () => {
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
    });

    // 5. 잘못된 입력 타입
    it("잘못된 입력 타입이면 HTTP 400을 반환", async () => {
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
    });

    // 6. 잘못된 JSON 본문
    it("잘못된 JSON이면 HTTP 400을 반환", async () => {
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
