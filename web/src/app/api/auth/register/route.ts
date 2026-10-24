
import * as argon2 from "argon2";
import pool from "@/lib/db/pool";
import {
  API_ERROR_CODE,
  API_MESSAGE,
  HTTP_STATUS,
  type ApiResponse,
} from "@/types/api";

type RegisterResult = {
  id: string;
  email: string;
  name: string;
};

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
};

export async function POST(
  request: Request
): Promise<Response> {
  let body: RegisterBody;

  // 1. JSON 요청 본문 파싱
  try {
    body = await request.json();

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)// 배열도 오브젝트이므로, 배열인지 확인하는 조건을 추가했습니다.
    ) {
      throw new Error("Invalid body");
    }
  } catch {
    const response: ApiResponse<RegisterResult> = {
      status: "error",
      code: API_ERROR_CODE.VALIDATION_ERROR,
      message: API_MESSAGE.INVALID_JSON_BODY,
    };

    return Response.json(response, {
      status: HTTP_STATUS.BAD_REQUEST,
    });
  }

  // 2. 입력값 타입 확인
  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    typeof body.name !== "string"
  ) {
    const response: ApiResponse<RegisterResult> = {
      status: "error",
      code: API_ERROR_CODE.VALIDATION_ERROR,
      message: API_MESSAGE.VALIDATION_ERROR,
    };

    return Response.json(response, {
      status: HTTP_STATUS.BAD_REQUEST,
    });
  }

  // 3. 값 정규화
  const email = body.email.trim();
  const password = body.password;
  const name = body.name.trim();

  // 4. 입력값 검증
  const validEmail =
    email.length <= 255 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validPassword =
    /^[a-zA-Z0-9!@#$%^&*()\-+]{8,16}$/.test(password);

  const validName =
    name.length > 0 && name.length <= 50;

  if (!validEmail || !validPassword || !validName) {
    const response: ApiResponse<RegisterResult> = {
      status: "error",
      code: API_ERROR_CODE.VALIDATION_ERROR,
      message: API_MESSAGE.VALIDATION_ERROR,
    };

    return Response.json(response, {
      status: HTTP_STATUS.BAD_REQUEST,
    });
  }

  // 5. 비밀번호 해싱 및 DB 저장
  try {
    const passwordHash = await argon2.hash(
      password,
      { type: argon2.argon2id }
    );

    const result = await pool.query<RegisterResult>(
      `
      INSERT INTO public.users
        (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id::text AS id, email, name
      `,
      [email, passwordHash, name]
    );

    const response: ApiResponse<RegisterResult> = {
      status: "success",
      data: result.rows[0],
    };

    return Response.json(response, { status: HTTP_STATUS.CREATED });
  } catch (error: unknown) {
    // PostgreSQL UNIQUE 제약조건 위반

    // email 중복 오류 처리
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505" &&
      "constraint" in error &&
      error.constraint === "users_email_key"
    ) {
      const response: ApiResponse<RegisterResult> = {
        status: "error",
        code: API_ERROR_CODE.EMAIL_ALREADY_EXISTS,
        message: API_MESSAGE.EMAIL_ALREADY_EXISTS,
      };

      return Response.json(response, {
        status: HTTP_STATUS.CONFLICT,
      });
    }

    // 기타 오류 처리
    console.error("Registration failed:", error);
    const response: ApiResponse<RegisterResult> = {
      status: "error",
      code: API_ERROR_CODE.INTERNAL_ERROR,
      message: API_MESSAGE.INTERNAL_ERROR,
    };

    return Response.json(response, {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
