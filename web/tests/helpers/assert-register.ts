
import { expect } from "vitest";
import { API_ERROR_CODE, API_MESSAGE, API_STATUS, HTTP_STATUS } from "@/types/api";
import type { TestUser } from "./test-user";
import pool from "@/lib/db/pool";

type RegisterSuccessBody = {
    status: typeof API_STATUS.SUCCESS;
    data: {
        id: string;
        email: string;
        name: string;
    };
};

function isRegisterSuccessBody(
    value: unknown
): value is RegisterSuccessBody {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    if (!("status" in value) || !("data" in value)) {
        return false;
    }

    if (value.status !== API_STATUS.SUCCESS) {
        return false;
    }

    const data = value.data;

    if (typeof data !== "object" || data === null) {
        return false;
    }

    return (
        "id" in data &&
        typeof data.id === "string" &&
        "email" in data &&
        typeof data.email === "string" &&
        "name" in data &&
        typeof data.name === "string"
    );
}

/**
 * 회원가입 성공 검증
 */
export async function assertRegisterSuccess(
    response: Response,
    body: unknown,
    user: TestUser
): Promise<string> {
    expect(response.status).toBe(HTTP_STATUS.CREATED);

    expect(body).toEqual({
        status: API_STATUS.SUCCESS,
        data: {
            id: expect.stringMatching(/^[1-9]\d*$/),
            email: user.email,
            name: user.name,
        },
    });

    if (!isRegisterSuccessBody(body)) {
        throw new Error("회원가입 응답 구조가 올바르지 않습니다.");
    }

    // 실제 DB 저장 결과 검증
    const dbResult = await pool.query(
        `
    SELECT id::text AS id, email, name
    FROM public.users
    WHERE email = $1
    `,
        [user.email]
    );

    expect(dbResult.rowCount).toBe(1);

    expect(dbResult.rows).toEqual([
        {
            id: body.data.id,
            email: user.email,
            name: user.name,
        },
    ]);

    return body.data.id;
}

/**
 * 중복 이메일 검증
 */
export function assertRegisterDuplicateEmail(
    response: Response,
    body: unknown
): void {
    expect(response.status).toBe(HTTP_STATUS.CONFLICT);

    expect(body).toEqual({
        status: API_STATUS.ERROR,
        code: API_ERROR_CODE.EMAIL_ALREADY_EXISTS,
        message: API_MESSAGE.EMAIL_ALREADY_EXISTS,
    });
}


/**
 * 입력값 오류 검증
 */
export function assertRegisterValidationError(
    response: Response,
    body: unknown,
): void {
    expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);

    expect(body).toEqual({
        status: API_STATUS.ERROR,
        code: API_ERROR_CODE.VALIDATION_ERROR,
        message: API_MESSAGE.VALIDATION_ERROR,
    });
}