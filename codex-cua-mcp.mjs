#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHATGPT_APP = process.env.CHATGPT_APP_PATH || "/Applications/ChatGPT.app";
const CUA_DIR = `${CHATGPT_APP}/Contents/Resources/cua_node`;
const PLUGINS_DIR = `${CHATGPT_APP}/Contents/Resources/plugins/openai-bundled/plugins`;
const CODEX_CLI_DIR = `${CHATGPT_APP}/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS`;
const CODEX_CLI_BIN = `${CODEX_CLI_DIR}/codex`;
const CUA_NODE = `${CUA_DIR}/bin/node`;

// Ensure depth 0, depth 1, and depth 2 are all signed by 2DC432GLL2
const hop = Number(process.env.CODEX_ANCESTRY_HOP || "0");
if (hop < 2) {
  const child = spawn(CUA_NODE, [process.argv[1], ...process.argv.slice(2)], {
    env: { ...process.env, CODEX_ANCESTRY_HOP: String(hop + 1) },
    stdio: ["pipe", "pipe", "pipe"],
  });
  process.stdin.pipe(child.stdin);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  process.on("SIGINT", () => child.kill("SIGINT"));
} else {
  startProxy();
}

const BOOTSTRAP_PREAMBLE = `if (!globalThis.__agyCodexBootstrapped) {
  let __req = (await import("node:module")).createRequire("file:///tmp/index.js");
  globalThis.require ??= __req;
  globalThis.process ??= __req("node:process");
  globalThis.Buffer ??= __req("node:buffer").Buffer;
  let rawSky = (await import("@oai/sky")).sky;
  let decorateState = (res) => {
    if (res && typeof res === "object" && typeof res.text === "string") {
      Object.defineProperties(res, {
        ax_tree: { get() { return res.text; }, configurable: true },
        toString: { value() { return res.text; }, configurable: true },
        split: { value(...a) { return res.text.split(...a); }, configurable: true },
        slice: { value(...a) { return res.text.slice(...a); }, configurable: true },
        includes: { value(...a) { return res.text.includes(...a); }, configurable: true },
        indexOf: { value(...a) { return res.text.indexOf(...a); }, configurable: true },
        match: { value(...a) { return res.text.match(...a); }, configurable: true },
      });
    }
    return res;
  };
  let origGetAppState = rawSky.get_app_state.bind(rawSky);
  let origClick = rawSky.click.bind(rawSky);
  let origPressKey = rawSky.press_key.bind(rawSky);
  let origScroll = rawSky.scroll.bind(rawSky);
  let origSecondary = rawSky.perform_secondary_action.bind(rawSky);
  globalThis.sky = Object.assign({}, rawSky, {
    async get_app_state(opts) {
      let norm = typeof opts === "string" ? { app: opts } : opts;
      return decorateState(await origGetAppState(norm));
    },
    async click(opts) {
      let norm = Object.assign({}, opts);
      if (norm.point && norm.x === undefined) {
        norm.x = Array.isArray(norm.point) ? norm.point[0] : norm.point.x;
        norm.y = Array.isArray(norm.point) ? norm.point[1] : norm.point.y;
        delete norm.point;
      }
      if (norm.button && norm.mouse_button === undefined) {
        norm.mouse_button = norm.button;
        delete norm.button;
      }
      await origClick(norm);
    },
    async press_key(opts) {
      let norm = Object.assign({}, opts);
      if (Array.isArray(norm.key)) norm.key = norm.key.join("+");
      await origPressKey(norm);
    },
    async scroll(opts) {
      let norm = Object.assign({}, opts);
      if (norm.point && norm.x === undefined) {
        norm.x = Array.isArray(norm.point) ? norm.point[0] : norm.point.x;
        norm.y = Array.isArray(norm.point) ? norm.point[1] : norm.point.y;
        delete norm.point;
      }
      if (!norm.direction && typeof norm.delta_y === "number") {
        norm.direction = norm.delta_y >= 0 ? "down" : "up";
        norm.pages ??= Math.max(1, Math.round(Math.abs(norm.delta_y) / 3));
        delete norm.delta_y;
        delete norm.delta_x;
      }
      await origScroll(norm);
    },
    type: rawSky.type_text.bind(rawSky),
    async perform_Contextual_action(opts) {
      let norm = Object.assign({}, opts);
      if (norm.action_name && !norm.action) {
        norm.action = norm.action_name;
        delete norm.action_name;
      }
      await origSecondary(norm);
    },
  });
  globalThis.setupBrowserRuntime ??= async (...args) => {
    const mod = await import("${PLUGINS_DIR}/chrome/scripts/browser-client.mjs");
    return mod.setupBrowserRuntime(...args);
  };
  globalThis.__agyCodexBootstrapped = true;
}\n`;

function ensureCodexCliAndSkyReady() {
  try {
    const localBinDir = path.join(os.homedir(), ".local", "bin");
    if (fs.existsSync(localBinDir) && fs.existsSync(CODEX_CLI_BIN)) {
      const linkPath = path.join(localBinDir, "codex");
      let currentTarget = null;
      try {
        currentTarget = fs.readlinkSync(linkPath);
      } catch {}
      if (currentTarget !== CODEX_CLI_BIN && !fs.existsSync(linkPath)) {
        fs.symlinkSync(CODEX_CLI_BIN, linkPath);
      }
    }
  } catch {}

  try {
    execFileSync("launchctl", ["setenv", "CODEX_CLI_PATH", CODEX_CLI_BIN], {
      stdio: "ignore",
      timeout: 3000,
    });
  } catch {}

  try {
    const pids = execFileSync("pgrep", ["-x", "SkyComputerUseService"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    })
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    for (const pid of pids) {
      const envOut = execFileSync("ps", ["eww", "-p", pid], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      });
      if (!envOut.includes("CODEX_CLI_PATH=")) {
        process.kill(Number(pid), "SIGTERM");
      }
    }
  } catch {}
}

function transformUserCode(code) {
  if (typeof code !== "string") return code;
  // Avoid "Warning: X was declared with const; use let for reassignable variables." in persistent node_repl
  let normalized = code.replace(/^(\s*)const\s+/gm, "$1let ");
  // Support top-level return statements without throwing "[x:y]: Illegal return statement"
  const hasTopLevelReturn = /(^|[\n;])\s*return\b/.test(normalized);
  if (hasTopLevelReturn) {
    normalized = `{\n  let __agyRet = await (async () => {\n${normalized}\n  })();\n  if (__agyRet !== undefined) nodeRepl.write(__agyRet);\n}`;
  }
  return BOOTSTRAP_PREAMBLE + normalized;
}

function startProxy() {
  ensureCodexCliAndSkyReady();

  const sessionId = `agy-codex-${crypto.randomUUID()}`;
  let turnCounter = 0;
  let initializeId = null;
  let toolsListId = null;

  const basePath = process.env.PATH || "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
  const defaultSkyApp = path.join(os.homedir(), ".codex/computer-use/Codex Computer Use.app");
  const bundledSkyApp = `${CUA_DIR}/lib/node_modules/@oai/sky/Codex Computer Use.app`;
  const env = {
    ...process.env,
    TMPDIR: "/tmp",
    PATH: `${CODEX_CLI_DIR}:${CUA_DIR}/bin:${basePath}`,
    CODEX_CLI_PATH: CODEX_CLI_BIN,
    NODE_REPL_NODE_PATH: CUA_NODE,
    NODE_REPL_NODE_MODULE_DIRS: `${CUA_DIR}/lib/node_modules:${PLUGINS_DIR}/chrome/node_modules`,
    NODE_REPL_TRUSTED_CODE_PATHS: `${os.homedir()}:${process.cwd()}:/tmp:${CHATGPT_APP}/Contents/Resources:${CUA_DIR}/lib/node_modules:${PLUGINS_DIR}`,
    NODE_REPL_TRUSTED_SERVICES: JSON.stringify({
      sky: "@oai/sky/service",
      browser: `${PLUGINS_DIR}/chrome/scripts/browser-service.mjs`,
    }),
    BROWSER_USE_SECURITY_MODE: "disabled-for-local-testing",
    BROWSER_USE_ENABLE_TINYSKY_ACCESSIBILITY: "1",
    BROWSER_USE_TINYSKY_ENABLED: "1",
    BROWSER_USE_FULL_CDP_ACCESS_ENABLED: "1",
    SKY_CUA_SERVICE_PATH: fs.existsSync(defaultSkyApp) ? defaultSkyApp : bundledSkyApp,
  };
  delete env.CUA_REPL_ENABLED_SURFACES;

  const child = spawn(`${CUA_DIR}/bin/node_repl`, ["--disable-sandbox"], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    const filtered = text
      .split("\n")
      .filter((line) => !line.includes("codex app-server auth fetch failed"))
      .join("\n");
    if (filtered.trim()) {
      process.stderr.write(filtered);
    }
  });

  // Client (Antigravity) -> Server (node_repl)
  let inBuf = "";
  process.stdin.on("data", (chunk) => {
    inBuf += chunk.toString("utf8");
    let idx;
    while ((idx = inBuf.indexOf("\n")) !== -1) {
      const line = inBuf.slice(0, idx).trim();
      inBuf = inBuf.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        // Antigravity sends a 2026-07-28 "server/discover" probe before "initialize".
        // Rust rmcp 1.5.0 aborts if the first message is not "initialize", so reply
        // with JSON-RPC -32601 Method not found directly from the proxy.
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
          initializeId = msg.id;
          msg.params ??= {};
          if (
            !msg.params.protocolVersion ||
            !["2024-11-05", "2025-03-26", "2025-06-18"].includes(msg.params.protocolVersion)
          ) {
            msg.params.protocolVersion = "2025-06-18";
          }
          msg.params.capabilities ??= {};
          msg.params.capabilities.elicitation = { form: {} };
        } else if (msg.method === "tools/list") {
          toolsListId = msg.id;
        } else if (msg.method === "tools/call") {
          msg.params ??= {};
          msg.params._meta ??= {};
          msg.params._meta["x-codex-turn-metadata"] ??= {
            session_id: sessionId,
            turn_id: `turn-${++turnCounter}`,
          };
          if (msg.params.name === "js" && typeof msg.params.arguments?.code === "string") {
            msg.params.arguments.code = transformUserCode(msg.params.arguments.code);
          }
        }
        child.stdin.write(JSON.stringify(msg) + "\n");
      } catch {
        child.stdin.write(line + "\n");
      }
    }
  });

  // Server (node_repl) -> Client (Antigravity)
  let outBuf = "";
  child.stdout.on("data", (chunk) => {
    outBuf += chunk.toString("utf8");
    let idx;
    while ((idx = outBuf.indexOf("\n")) !== -1) {
      const line = outBuf.slice(0, idx).trim();
      outBuf = outBuf.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.method === "elicitation/create" && msg.id !== undefined) {
          child.stdin.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id: msg.id,
              result: {
                action: "accept",
                content: {},
              },
            }) + "\n"
          );
          continue;
        }
        if (msg.id !== undefined && msg.id === initializeId && msg.result?.capabilities) {
          delete msg.result.capabilities.experimental;
        }
        if (msg.id !== undefined && msg.id === toolsListId && Array.isArray(msg.result?.tools)) {
          msg.result.tools = msg.result.tools.filter((t) => t.name !== "turn_ended");
        }
        process.stdout.write(JSON.stringify(msg) + "\n");
      } catch {
        process.stdout.write(line + "\n");
      }
    }
  });

  child.on("exit", (code) => process.exit(code ?? 0));
  process.stdin.on("end", () => child.kill());
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  process.on("SIGINT", () => child.kill("SIGINT"));
}
