
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
import { API_STATUS, HTTP_STATUS } from "@/types/api";

const BASE_URL = TEST_CONFIG.BASE_URL;
const TEST_USER = createTestUser();

let verifiedTestEnvironment = false;

describe("회원가입 API 테스트", () => {
    beforeAll(async () => {
        const response = await fetch(
            `${BASE_URL}/api/health/db`
        );

        const body = await response.json();

        expect(response.status).toBe(HTTP_STATUS.OK);
        expect(body.status).toBe("success");
        expect(body.data.database).toBe(TEST_CONFIG.DB_NAME);
        expect(body.data.user).toBe(TEST_CONFIG.DB_USER);
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

        expect(response.status).toBe(HTTP_STATUS.CREATED);
        expect(body.status).toBe(API_STATUS.SUCCESS);

        expect(body.data.email).toBe(TEST_USER.email);
        expect(body.data.name).toBe(TEST_USER.name);

        // id가 숫자로만 이루어져 있는지 확인
        expect(body.data.id).toMatch(/^[1-9]\d*$/);

        // 노출되면 안되는 민감한 정보가 반환되지 않았는지 확인(password, password_hash)
        expect(body.data).not.toHaveProperty("password");
        expect(body.data).not.toHaveProperty("password_hash");

        verifiedTestEnvironment = true;
    });

    afterAll(async () => {
        try {
            if (!verifiedTestEnvironment) {
                // health check를 통과하지 못했거나, 테스트가 실패한 경우에는 DB를 초기화하지 않고 종료합니다.
                return;
            }

            // 실제 연결된 DB 확인
            const result = await pool.query(
                "SELECT current_database() AS database"
            );

            if (result.rows[0].database !== "simple_board_test") {
                throw new Error("테스트 DB가 아닙니다.");
            }

            // 테스트에서 생성한 사용자만 삭제
            await pool.query(
                `
                DELETE FROM public.users
                WHERE email = $1
                `,
                [TEST_USER.email]
            );
        } finally {
            await pool.end();
        }
    });

});
