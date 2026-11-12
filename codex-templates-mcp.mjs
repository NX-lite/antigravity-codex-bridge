#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let CHATGPT_APP = process.env.CHATGPT_APP_PATH || "/Applications/ChatGPT.app";
let CUA_NODE = `${CHATGPT_APP}/Contents/Resources/cua_node/bin/node`;
let SERVER_MJS = `${CHATGPT_APP}/Contents/Resources/artifact-template-picker/server.mjs`;
function resolveTemplatesRoot() {
  let baseDir = path.join(
    os.homedir(),
    ".codex/plugins/cache/chatgpt-global/openai-templates"
  );
  if (fs.existsSync(baseDir)) {
    let versions = fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse();
    for (let ver of versions) {
      let candidate = path.join(baseDir, ver);
      if (fs.existsSync(path.join(candidate, "skills"))) return candidate;
    }
  }
  return path.join(baseDir, "latest");
}

let TEMPLATES_ROOT = resolveTemplatesRoot();

function buildTemplateCatalog() {
  let skillsDir = path.join(TEMPLATES_ROOT, "skills");
  let pluginName = "openai-templates";
  try {
    let p = JSON.parse(
      fs.readFileSync(path.join(TEMPLATES_ROOT, ".codex-plugin/plugin.json"), "utf8")
    );
    if (p?.name) pluginName = p.name;
  } catch {}

  let catalog = [];
  if (!fs.existsSync(skillsDir)) return catalog;
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("artifact-template-")) continue;
    let skillPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;
    try {
      let content = fs.readFileSync(skillPath, "utf8");
      let descMatch = /^description:\s*["']?(.+?)["']?\s*$/m.exec(content);
      let description = descMatch ? descMatch[1].trim() : "";
      catalog.push({
        skillName: `${pluginName}:${entry.name}`,
        skillPath,
        description,
      });
    } catch {}
  }
  return catalog;
}

let catalog = buildTemplateCatalog();
let env = {
  ...process.env,
  TMPDIR: "/tmp",
  CODEX_HOME: path.join(os.homedir(), ".codex"),
  CODEX_ARTIFACT_TEMPLATE_SKILLS: JSON.stringify(catalog),
};

let child = spawn(CUA_NODE, [SERVER_MJS], {
  env,
  stdio: ["pipe", "pipe", "pipe"],
});

child.stderr.pipe(process.stderr);

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
      if (msg.params?._meta?.["io.modelcontextprotocol/protocolVersion"]) {
        delete msg.params._meta["io.modelcontextprotocol/protocolVersion"];
      }
      if (msg.method === "initialize") {
        msg.params ??= {};
        msg.params.protocolVersion = "2025-06-18";
        msg.params.capabilities ??= {};
        msg.params.capabilities.extensions = {
          ...(msg.params.capabilities.extensions || {}),
          "openai/elicitation": { form: {} },
        };
      }
      child.stdin.write(JSON.stringify(msg) + "\n");
    } catch {
      child.stdin.write(line + "\n");
    }
  }
});

let outBuf = "";
child.stdout.on("data", (chunk) => {
  outBuf += chunk.toString("utf8");
  let idx;
  while ((idx = outBuf.indexOf("\n")) !== -1) {
    let line = outBuf.slice(0, idx).trim();
    outBuf = outBuf.slice(idx + 1);
    if (!line) continue;
    try {
      let msg = JSON.parse(line);
      if (
        (msg.method === "openai/elicitation/create" || msg.method === "openai/form") &&
        msg.id !== undefined
      ) {
        let options =
          msg.params?.requestedSchema?.properties?.selection?.["x-openai-input"]?.options ||
          msg.params?.requestedSchema?.properties?.selection?.items ||
          [];
        let firstUri = options[0]?.uri || options[0]?.id || "";
        child.stdin.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              action: "accept",
              content: { selection: firstUri },
            },
          }) + "\n"
        );
        continue;
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
