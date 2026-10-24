
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const EXPECTED_DB = "simple_board_test";
const EXPECTED_USER = "simple_app";

const env = { ...process.env };
delete env.NODE_OPTIONS;

let server = null;
let testProcess = null;

// 1. 테스트 환경변수 확인
function checkEnvironment() {
    if (
        env.DB_NAME !== EXPECTED_DB ||
        env.DB_USER !== EXPECTED_USER
    ) {
        throw new Error("테스트 DB 환경변수가 올바르지 않습니다.");
    }
}

// 2. 포트 사용 여부 확인
async function checkPort() {
    await new Promise((resolve, reject) => {
        const socket = createServer();

        socket.once("error", reject);

        socket.listen(PORT, "127.0.0.1", () => {
            socket.close(resolve);
        });
    });
}

// 3. Next.js 테스트 서버 시작
function startServer() {
    return spawn(
        process.execPath,
        [
            "./node_modules/next/dist/bin/next",
            "dev",
            "-p",
            String(PORT),
            "--hostname",
            "127.0.0.1",
        ],
        {
            env,
            stdio: "inherit",
            detached: process.platform !== "win32",
        }
    );
}

// 4. Health Check
async function waitForHealth() {
    const deadline = Date.now() + 60000;

    while (Date.now() < deadline) {
        if (server.exitCode !== null || server.signalCode !== null) {
            throw new Error("Next.js 서버가 비정상 종료되었습니다.");
        }

        try {
            const response = await fetch(
                `${BASE_URL}/api/health/db`,
                { signal: AbortSignal.timeout(3000) }
            );

            if (response.ok) {
                const body = await response.json();

                if (
                    body.status !== "success" ||
                    body.data?.database !== EXPECTED_DB ||
                    body.data?.user !== EXPECTED_USER
                ) {
                    throw new Error("테스트 DB 연결 정보 불일치");
                }

                console.log("Health Check 성공");
                return;
            }
        } catch (error) {
            if (error?.message === "테스트 DB 연결 정보 불일치") {
                throw error;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error("테스트 서버 준비 시간 초과");
}

// 5. Vitest 실행
async function runVitest() {
    const testArgs = process.argv.slice(2);

    return new Promise((resolve, reject) => {
        testProcess = spawn(
            process.execPath,
            [
                "./node_modules/vitest/vitest.mjs",
                "run",
                ...testArgs,
            ],
            { env, stdio: "inherit" }
        );

        testProcess.once("error", reject);
        testProcess.once("close", code => {
            resolve(code ?? 1);
        });
    });
}

// 6. 테스트 서버 종료
async function stopServer() {
    if (!server?.pid) return;

    const child = server;

    const closed = new Promise(resolve => {
        if (child.exitCode !== null || child.signalCode !== null) {
            resolve();
        } else {
            child.once("close", resolve);
        }
    });

    try {
        if (process.platform === "win32") {
            child.kill("SIGTERM");
        } else {
            process.kill(-child.pid, "SIGTERM");
        }
    } catch (error) {
        if (error.code !== "ESRCH") throw error;
    }

    await Promise.race([
        closed,
        new Promise(resolve => setTimeout(resolve, 5000)),
    ]);

    console.log("Next.js 테스트 서버 종료");
}

// 7. 전체 실행
async function main() {
    try {
        checkEnvironment();
        await checkPort();

        console.log("Next.js 테스트 서버 실행");

        server = startServer();

        await waitForHealth();

        console.log("Vitest 테스트 시작");

        process.exitCode = await runVitest();

    } catch (error) {
        console.error("테스트 실행 실패:", error);
        process.exitCode = 1;

    } finally {
        await stopServer();
    }
}

process.once("SIGINT", () => {
    if (testProcess?.pid) testProcess.kill("SIGTERM");

    if (server?.pid) {
        try {
            if (process.platform === "win32") {
                server.kill("SIGTERM");
            } else {
                process.kill(-server.pid, "SIGTERM");
            }
        } catch {
            // 이미 종료된 프로세스
        }
    }

    process.exit(130);
});

await main();
