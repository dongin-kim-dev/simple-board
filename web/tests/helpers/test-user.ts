import { randomUUID } from "node:crypto";

export type TestUser = {
    email: string;
    password: string;
    name: string;
};

export function createTestUser(): TestUser {
    return {
        email: `test-${randomUUID()}@example.com`,
        password: "Test1234!",
        name: "tester",
    };
}