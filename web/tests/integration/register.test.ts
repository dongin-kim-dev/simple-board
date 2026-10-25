
import pool from "@/lib/db/pool";
import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    afterEach,
} from "vitest";
import { TEST_CONFIG } from "../config/test-config";
import { createTestUser } from "../helpers/test-user";
import { assertHealth } from "../helpers/assert-health";
import { assertRegisterDuplicateEmail, assertRegisterSuccess, assertRegisterValidationError } from "../helpers/assert-register";

const BASE_URL = TEST_CONFIG.BASE_URL;
const TEST_USER = createTestUser();

let verifiedTestEnvironment = false;

describe("회원가입 API 테스트", () => {
    beforeAll(async () => {
        const response = await fetch(
            `${BASE_URL}/api/health/db`
        );

        const body = await response.json();

        assertHealth(response, body);

        // Vitest가 직접 연결한 DB 검증
        const result = await pool.query(
            "SELECT current_database() AS database"
        );

        expect(result.rows[0].database).toBe(TEST_CONFIG.DB_NAME);

        verifiedTestEnvironment = true;
    });

    it("회원가입 성공 시 HTTP 201을 반환", async () => {

        const response = await fetch(
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

        const body = await response.json();

        await assertRegisterSuccess(response, body, TEST_USER);
    });

    it.each([
        {
            name: "이메일 누락",
            input: {
                password: TEST_USER.password,
                name: TEST_USER.name,
            },
        },
        {
            name: "이메일 타입 오류",
            input: {
                email: 1234,
                password: TEST_USER.password,
                name: TEST_USER.name,
            },
        },
        {
            name: "비밀번호 누락",
            input: {
                email: TEST_USER.email,
                name: TEST_USER.name,
            },
        },
        {
            name: "이름 타입 오류",
            input: {
                email: TEST_USER.email,
                password: TEST_USER.password,
                name: 1234,
            },
        },
    ])("$name이면 HTTP 400을 반환", async ({ input }) => {
        const response = await fetch(
            `${BASE_URL}/api/auth/register`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(input),
            }
        );

        const body = await response.json();

        assertRegisterValidationError(response, body);

        // 고유 테스트 이메일에 사용자 생성이 없었는지 확인
        const dbResult = await pool.query(
            `
        SELECT id
        FROM public.users
        WHERE email = $1
        `,
            [TEST_USER.email]
        );

        expect(dbResult.rows).toEqual([]);
    });

    it("중복된 email로 회원가입 시 HTTP 409을 반환", async () => {
        const firstResponse = await fetch(
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

        const firstBody = await firstResponse.json();

        const registeredUserId = await assertRegisterSuccess(firstResponse, firstBody, TEST_USER);

        const response = await fetch(
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

        const body = await response.json();

        assertRegisterDuplicateEmail(response, body);

        const dbResult = await pool.query(
            `
            SELECT id::text AS id, email, name
            FROM public.users
            WHERE email = $1
            `,
            [TEST_USER.email]
        );

        expect(dbResult.rows).toEqual([
            {
                id: registeredUserId,
                email: TEST_USER.email,
                name: TEST_USER.name,
            },
        ]);
    });

    afterEach(async () => {
        if (!verifiedTestEnvironment) {
            return;
        }
        // 각 테스트에서 생성한 사용자 삭제
        await pool.query(
            "DELETE FROM public.users WHERE email = $1",
            [TEST_USER.email]
        );
    });

    afterAll(async () => {
        await pool.end();
    });

});
