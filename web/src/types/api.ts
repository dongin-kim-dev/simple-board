// API 오류 코드 정의
export const API_ERROR_CODE = {
    DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
} as const;

// HTTP 상태 코드 정의
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
} as const;

// 오류 코드 타입
export type ApiErrorCode =
    (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE];

// 성공 응답
export type ApiSuccess<T> = {
    status: typeof API_STATUS.SUCCESS;
    data: T;
};

// 실패 응답
export type ApiError = {
    status: typeof API_STATUS.ERROR;
    code: ApiErrorCode;
    message: string;
};

// 최종 API 응답
export type ApiResponse<T> =
    | ApiSuccess<T>
    | ApiError;

// API 메시지 정의
export const API_MESSAGE = {
    INVALID_JSON_BODY: "Invalid JSON body",
    VALIDATION_ERROR: "Validation error",
    INVALID_LOGIN_INPUT: "Invalid login input",
    INVALID_CREDENTIALS: "Invalid email or password",
    EMAIL_ALREADY_EXISTS: "Email already exists",
    INTERNAL_ERROR: "Internal server error",
    LOGIN_FAILED: "Login failed",
    DATABASE_UNAVAILABLE: "Database unavailable",
} as const;

export const API_STATUS = {
    SUCCESS: "success",
    ERROR: "error",
} as const;