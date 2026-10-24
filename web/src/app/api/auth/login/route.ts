
import * as argon2 from "argon2";

import pool from "@/lib/db/pool";
import {
    API_ERROR_CODE,
    API_MESSAGE,
    API_STATUS,
    HTTP_STATUS,
    type ApiResponse,
} from "@/types/api";

type LoginBody = {
    email?: unknown;
    password?: unknown;
};

type LoginUserRow = {
    id: string;
    email: string;
    name: string;
    password_hash: string;
};

type LoginResult = {
    id: string;
    email: string;
    name: string;
};

export async function POST(request: Request): Promise<Response> {
    let body: LoginBody;

    // 1. JSON 요청 본문 파싱
    try {
        body = await request.json();

        if (
            body === null ||
            typeof body !== "object" ||
            Array.isArray(body)
        ) {
            throw new Error("Invalid body");
        }
    } catch {
        const response: ApiResponse<LoginResult> = {
            status: API_STATUS.ERROR,
            code: API_ERROR_CODE.VALIDATION_ERROR,
            message: API_MESSAGE.INVALID_JSON_BODY,
        };

        return Response.json(response, {
            status: HTTP_STATUS.BAD_REQUEST,
        });
    }

    // 2. 입력값 타입 검증
    if (
        typeof body.email !== "string" ||
        typeof body.password !== "string"
    ) {
        const response: ApiResponse<LoginResult> = {
            status: API_STATUS.ERROR,
            code: API_ERROR_CODE.VALIDATION_ERROR,
            message: API_MESSAGE.VALIDATION_ERROR,
        };

        return Response.json(response, {
            status: HTTP_STATUS.BAD_REQUEST,
        });
    }

    const email = body.email.trim();
    const password = body.password;

    // 3. 입력값 형식 검증
    if (
        email.length === 0 ||
        email.length > 255 ||
        password.length === 0
    ) {
        const response: ApiResponse<LoginResult> = {
            status: API_STATUS.ERROR,
            code: API_ERROR_CODE.VALIDATION_ERROR,
            message: API_MESSAGE.INVALID_LOGIN_INPUT,
        };

        return Response.json(response, {
            status: HTTP_STATUS.BAD_REQUEST,
        });
    }

    // 4. 사용자 조회 및 비밀번호 검증
    try {
        const result = await pool.query<LoginUserRow>(
            `
      SELECT
        id::text AS id,
        email,
        name,
        password_hash
      FROM public.users
      WHERE email = $1
      `,
            [email]
        );

        const user = result.rows[0];

        if (!user) {
            const response: ApiResponse<LoginResult> = {
                status: API_STATUS.ERROR,
                code: API_ERROR_CODE.UNAUTHORIZED,
                message: API_MESSAGE.INVALID_CREDENTIALS,
            };

            return Response.json(response, {
                status: HTTP_STATUS.UNAUTHORIZED,
            });
        }

        const isValidPassword = await argon2.verify(
            user.password_hash,
            password
        );

        if (!isValidPassword) {
            const response: ApiResponse<LoginResult> = {
                status: API_STATUS.ERROR,
                code: API_ERROR_CODE.UNAUTHORIZED,
                message: API_MESSAGE.INVALID_CREDENTIALS,
            };

            return Response.json(response, {
                status: HTTP_STATUS.UNAUTHORIZED,
            });
        }

        // 아직 로그인 세션은 생성하지 않음
        const response: ApiResponse<LoginResult> = {
            status: API_STATUS.SUCCESS,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        };

        return Response.json(response, {
            status: HTTP_STATUS.OK,
        });
    } catch (error: unknown) {
        console.error("Login failed:", error);

        const response: ApiResponse<LoginResult> = {
            status: API_STATUS.ERROR,
            code: API_ERROR_CODE.INTERNAL_ERROR,
            message: API_MESSAGE.LOGIN_FAILED,
        };

        return Response.json(response, {
            status: HTTP_STATUS.INTERNAL_ERROR,
        });
    }
}
