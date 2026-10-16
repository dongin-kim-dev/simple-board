// API 오류 코드 정의
export const API_ERROR_CODE = {
    DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

// 오류 코드 타입
export type ApiErrorCode =
    (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE];

// 성공 응답
export type ApiSuccess<T> = {
    status: "success";
    data: T;
};

// 실패 응답
export type ApiError = {
    status: "error";
    code: ApiErrorCode;
    message: string;
};

// 최종 API 응답
export type ApiResponse<T> =
    | ApiSuccess<T>
    | ApiError;