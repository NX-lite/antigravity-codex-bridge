#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let CHATGPT_APP = process.env.CHATGPT_APP_PATH || "/Applications/ChatGPT.app";
let CUA_NODE = `${CHATGPT_APP}/Contents/Resources/cua_node/bin/node`;

function resolveDataAnalyticsServer() {
  let baseDir = path.join(
    os.homedir(),
    ".codex/plugins/cache/openai-curated-remote/data-analytics"
  );
  if (fs.existsSync(baseDir)) {
    let versions = fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse();
    for (let ver of versions) {
      let candidate = path.join(baseDir, ver, "mcp/dist/server.mjs");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return path.join(baseDir, "latest/mcp/dist/server.mjs");
}

let SERVER_MJS = resolveDataAnalyticsServer();

let child = spawn(CUA_NODE, [SERVER_MJS], {
  env: {
    ...process.env,
    TMPDIR: "/tmp",
    CODEX_HOME: path.join(os.homedir(), ".codex"),
  },
  stdio: ["pipe", "pipe", "pipe"],
});

child.stderr.pipe(process.stderr);
child.stdout.pipe(process.stdout);

let inBuf = "";
process.stdin.on("data", (chunk) => {
  inBuf += chunk.toString("utf8");
  let idx;
  while ((idx = inBuf.indexOf("\n")) !== -1) {
    let line = inBuf.slice(0, idx).trim();
    inBuf = inBuf.slice(idx + 1);
    if (!line) continue;
    try {
      let msg = JSON.parse(line);
      if (msg.method === "server/discover") {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id ?? null,
            error: { code: -32601, message: "Method not found" },
          }) + "\n"
        );
        continue;
      }
      if (msg.method === "initialize") {
        msg.params ??= {};
        msg.params.protocolVersion = "2025-06-18";
      }
      child.stdin.write(JSON.stringify(msg) + "\n");
    } catch {
      child.stdin.write(line + "\n");
    }
  }
});

child.on("exit", (code) => process.exit(code ?? 0));
process.stdin.on("end", () => child.kill());
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
