import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import http from "http";
import { spawn } from "child_process";

jest.setTimeout(20_000);

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function request(port, method, route, body, token) {
  const payload = body === undefined ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: route,
      method,
      headers: {
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error(`Server did not start. Output: ${output}`)), 10_000);
    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes("BYB! server running")) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited early with ${code}. Output: ${output}`));
    });
  });
}

test("a stale second session gets 409 without changing data or dataVersion", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "byb-concurrency-"));
  const port = await freePort();
  const child = spawn(process.execPath, [path.resolve("server.js")], {
    cwd: path.resolve("."),
    env: {
      ...process.env,
      BYB_DATA_DIR: dataDir,
      BYB_PORT: String(port),
      BYB_BCRYPT_ROUNDS: "4",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  try {
    await waitForServer(child);
    const users = await request(port, "GET", "/api/users");
    expect(users.status).toBe(200);
    const userId = users.body.users[0].id;

    const firstLogin = await request(port, "POST", "/api/auth/login", { userId, password: "test-pass" });
    const secondLogin = await request(port, "POST", "/api/auth/login", { userId, password: "test-pass" });
    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);

    const firstLoaded = await request(port, "GET", "/api/data", undefined, firstLogin.body.token);
    const secondLoaded = await request(port, "GET", "/api/data", undefined, secondLogin.body.token);
    expect(firstLoaded.body.dataVersion).toBe(0);
    expect(secondLoaded.body.dataVersion).toBe(0);

    const winner = { ...firstLoaded.body, unallocatedBalance: 11 };
    const staleLoser = { ...secondLoaded.body, unallocatedBalance: 99 };
    const firstSave = await request(port, "POST", "/api/data", winner, firstLogin.body.token);
    expect(firstSave.status).toBe(200);
    expect(firstSave.body.dataVersion).toBe(1);

    const staleSave = await request(port, "POST", "/api/data", staleLoser, secondLogin.body.token);
    expect(staleSave.status).toBe(409);
    expect(staleSave.body.dataVersion).toBe(1);

    const afterReject = await request(port, "GET", "/api/data", undefined, firstLogin.body.token);
    expect(afterReject.status).toBe(200);
    expect(afterReject.body.unallocatedBalance).toBe(11);
    expect(afterReject.body.dataVersion).toBe(1);
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
