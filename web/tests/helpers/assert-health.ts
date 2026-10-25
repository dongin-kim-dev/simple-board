
import { expect } from "vitest";

import { TEST_CONFIG } from "../config/test-config";
import { API_STATUS, HTTP_STATUS } from "@/types/api";

export function assertHealth(
    response: Response,
    body: any
): void {
    expect(response.status).toBe(HTTP_STATUS.OK);
    expect(body.status).toBe(API_STATUS.SUCCESS);

    expect(Object.keys(body.data).sort()).toEqual(
        ["database", "user"].sort()
    );

    expect(body.data.database).toBe(TEST_CONFIG.DB_NAME);
    expect(body.data.user).toBe(TEST_CONFIG.DB_USER);
}
