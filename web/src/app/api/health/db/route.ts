import pool from "@/lib/db/pool";

import {
    API_ERROR_CODE,
    type ApiResponse,
} from "@/types/api";

type DatabaseHealth = {
    database: string;
    user: string;
};

export async function GET(): Promise<Response> {
    try {
        const result = await pool.query<{
            current_user: string;
            current_database: string;
        }>(
            "SELECT current_user, current_database()"
        );

        const data: DatabaseHealth = {
            database: result.rows[0].current_database,
            user: result.rows[0].current_user,
        };

        const response: ApiResponse<DatabaseHealth> = {
            status: "success",
            data,
        };

        return Response.json(response, {
            status: 200,
        });
    } catch (error) {
        console.error("Database health check failed:", error);

        const response: ApiResponse<DatabaseHealth> = {
            status: "error",
            code: API_ERROR_CODE.DATABASE_UNAVAILABLE,
            message: "Database unavailable",
        };

        return Response.json(response, {
            status: 503,
        });
    }
}