# Antigravity Codex Bridge (`antigravity-codex-bridge`)

Bridge **OpenAI Codex / ChatGPT.app** native macOS capabilities — **`@oai/sky` Computer Use (`Codex Computer Use.app`)**, **`cua_node/bin/node_repl`**, **Chrome Extension Control (`control-chrome` / TinySky `tab.ax`)**, **Computer History (`Skysight`)**, **Record & Replay (`EventStream`)**, **macOS Calendar & Messages**, and **Artifact Templates** — directly into **Google Antigravity**, **Claude Code**, **Cursor**, or any **Model Context Protocol (MCP)** client.

将 **OpenAI Codex / ChatGPT.app** 内置的 macOS 原生能力（**`@oai/sky` Computer Use 桌面控制**、**`cua_node/bin/node_repl` 持久化沙盒**、**`control-chrome` 原生 Chrome 插件控制与 `tab.ax` TinySky 无障碍树**、**Computer History 活动历史**、**Record & Replay 录制回放**、**macOS 日历与信息**、以及 **Artifact Templates 模板引擎**）通过 **MCP 协议**无损桥接到 **Google Antigravity** 等 Agent 客户端。

---

## 1. Core Architecture & Capabilities / 核心架构与能力

| MCP Server | Implementation Script | Tools Exposed | Core Capability & Mechanism |
| :--- | :--- | :--- | :--- |
| **`codex-cua`** | [`codex-cua-mcp.mjs`](./codex-cua-mcp.mjs) | `js`, `js_add_node_module_dir`, `js_reset` | Wraps OpenAI's signed `cua_node/bin/node_repl` with `@oai/sky` (`Codex Computer Use.app`) and `browser-service.mjs` (`control-chrome`). Pre-loads `globalThis.sky`, `globalThis.setupBrowserRuntime`, `globalThis.require`, `globalThis.process`, and `globalThis.Buffer`. Auto-normalizes top-level `const` and `return` statements. |
| **`codex-sky`** | [`codex-sky-mcp.mjs`](./codex-sky-mcp.mjs) | **30 Native macOS Tools** (Computer Use, Skysight, EventStream, Calendar, Messages) | Standalone MCP server directly driving `@oai/sky`'s IPC client (`client.js` & `create_client.js`) over `computeruse.sock` without needing to write JS code in `node_repl`. |
| **`codex-artifact-templates`** | [`codex-templates-mcp.mjs`](./codex-templates-mcp.mjs) | `list_artifact_templates`, `choose_artifact_template` | Bridges `/Applications/ChatGPT.app/Contents/Resources/artifact-template-picker/server.mjs` and builds the template catalog from `~/.codex/plugins/cache/.../openai-templates`. |
| **`codex-data`** | [`codex-data-mcp.mjs`](./codex-data-mcp.mjs) | `search_mentions`, `form_elicitation_v2_request` | Bridges OpenAI Codex's `data-analytics` MCP server (`~/.codex/plugins/cache/.../data-analytics/.../server.mjs`). |

---

## 2. How It Works Under the Hood / 核心技术原理

### 2.1 Why Codex Computer Use & Chrome Control Need Zero Full Disk Access (FDA)
Unlike standard CDP tools that read `~/Library/Application Support/Google/Chrome/DevToolsActivePort` (which triggers macOS TCC `EPERM` blocks without Full Disk Access):
1. **Reverse Unix Domain Socket for Chrome (`control-chrome`)**:
   - Chrome launches OpenAI's Native Messaging Host (`com.openai.codexextension`), which listens on `/tmp/codex-browser-use/*.sock` outside macOS TCC protection.
   - Provides `chrome.user.openTabs()`, `chrome.user.claimTab(id)`, `tab.ax.write()` (TinySky numbered Accessibility tree), `tab.ax.click(index)`, and `tab.playwright`.
2. **Dedicated Accessibility Daemon (`Codex Computer Use.app` / `@oai/sky`)**:
   - Communicates over `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock`.
   - Uses macOS Accessibility (`AXUIElement`) to inspect any running macOS app's UI tree with integer `element_index` identifiers and incremental diffs (`sky.get_app_state({ app })`), consuming **zero vision tokens**.

### 2.2 Passing OpenAI's 3-Hop Apple Team ID (`2DC432GLL2`) Ancestry Check
Both `Codex Computer Use.app` and `ChatGPT for Chrome` verify the connecting process via `getsockopt(..., LOCAL_PEERTOKEN)` and require **depth 0 (`peer`), depth 1 (`peer parent`), and depth 2 (`peer grandparent`)** in the process tree to be signed by OpenAI's Apple Team ID (`2DC432GLL2`):
- `codex-cua-mcp.mjs` and `codex-sky-mcp.mjs` use `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node` (signed by `2DC432GLL2`) to recursively re-spawn themselves for 2 ancestry hops (`CODEX_ANCESTRY_HOP=0 -> 1 -> 2`) before launching `node_repl` or connecting to `computeruse.sock`.
- This guarantees that all 3 process levels carry valid `2DC432GLL2` signatures even when launched from third-party hosts like Antigravity, Cursor, or Claude Code.

### 2.3 MCP Protocol & Elicitation Adaptation
- **Intercepts `server/discover` Probes**: Replies with JSON-RPC `-32601 Method not found` before forwarding `initialize` so `node_repl`'s Rust `rmcp 1.5.0` parser does not abort on non-standard discovery frames.
- **Auto-Accepts `elicitation/create` & Injects Turn Metadata**: Automatically injects `x-codex-turn-metadata` (`session_id` & `turn_id`) on every `tools/call` and auto-accepts MCP confirmation elicitations so Computer Use and Chrome actions execute without hanging.

---

## 3. Detailed Tool Reference / MCP 工具清单

### 3.1 `codex-cua` (`node_repl` + `@oai/sky` + `control-chrome`)
Exposes `js`, `js_add_node_module_dir`, and `js_reset`. Inside `js`:
- **Pre-loaded globals**: `globalThis.sky`, `globalThis.setupBrowserRuntime`, `globalThis.require`, `globalThis.process`, `globalThis.Buffer`.
- **macOS Desktop Control (`@oai/sky`)**:
  ```js
  const apps = await sky.list_apps();
  const state = await sky.get_app_state({ app: "com.apple.finder" });
  nodeRepl.write(state.text);
  await sky.click({ app: "com.apple.finder", element_index: 5 });
  ```
- **Live Chrome Control (`control-chrome`)**:
  ```js
  const agent = await setupBrowserRuntime();
  const chrome = await agent.browsers.get("extension");
  const tabs = await chrome.user.openTabs();
  const tab = await chrome.user.claimTab(tabs[0].id);
  await tab.ax.write();
  await tab.ax.click(12);
  ```

### 3.2 `codex-sky` (30 Direct MCP Tools)
Can be run in full mode (default, all 30 tools) or scoped by passing an argument (`mcp`, `computer-history`, `event-stream`, `calendar`, `messages`):
1. **Computer Use (10 tools)**:
   - `list_apps`, `get_app_state`, `click`, `perform_secondary_action`, `set_value`, `select_text`, `scroll`, `drag`, `press_key`, `type_text`
2. **Computer History / Skysight (5 tools)**:
   - `computer_history_pause`, `computer_history_resume`, `computer_history_status`, `computer_history_get_settings`, `computer_history_update_settings`
3. **Record & Replay / EventStream (3 tools)**:
   - `event_stream_start`, `event_stream_status`, `event_stream_stop`
4. **macOS Calendar (6 tools)**:
   - `list_calendars`, `list_events`, `get_event`, `create_event`, `update_event`, `delete_event`
5. **macOS Messages (6 tools)**:
   - `find_chats`, `read_messages`, `search_messages`, `send_message`, `count_message_activity`, `read_image`

---

## 4. Included Codex Bridge Skills (`.agents/skills/`)

This repository includes custom bridge skills under [`.agents/skills/`](./.agents/skills/):
- [`codex-computer-use`](./.agents/skills/codex-computer-use/SKILL.md) — Guide & API reference for `@oai/sky` macOS desktop control via `codex-cua` and `codex-sky` (including the `com.openai.codex` self-control safety exception).
- [`codex-chrome-control`](./.agents/skills/codex-chrome-control/SKILL.md) — Guide for controlling the user's live Google Chrome via `browser-client.mjs` (`tab.ax` TinySky & `tab.playwright`) and `@oai/sky`.

When you run `./install.sh`, it also automatically populates local API reference docs and companion skills (`computer-use`, `control-chrome`, `control-in-app-browser`, `computer-history`, and `record-and-replay`) directly from your local `/Applications/ChatGPT.app` bundle (ignored by git so no proprietary OpenAI bundle files are redistributed in this repository).

---

## 5. Quick Start & Installation / 快速安装与配置

### Prerequisites / 前置条件
1. **macOS** with **ChatGPT.app** installed at `/Applications/ChatGPT.app` (or set `CHATGPT_APP_PATH` environment variable).
2. Grant **Accessibility (辅助功能)** permission to `Codex Computer Use.app` (`~/.codex/computer-use/Codex Computer Use.app`) in **System Settings -> Privacy & Security -> Accessibility**.

### Step 1: Run `install.sh`
```bash
git clone https://github.com/NX-lite/antigravity-codex-bridge.git
cd antigravity-codex-bridge
chmod +x install.sh
./install.sh
```
This installs `codex-cua-mcp.mjs`, `codex-sky-mcp.mjs`, `codex-templates-mcp.mjs`, and `codex-data-mcp.mjs` into `~/.gemini/config/` and prints your ready-to-use `mcp_config.json` block.

### Step 2: Configure `mcp_config.json`
Add the entries from [`mcp_config.example.json`](./mcp_config.example.json) (replacing `/Users/<YOUR_USERNAME>` with your macOS home directory path, as printed by `./install.sh`) to your MCP client configuration (e.g., `~/.gemini/antigravity/mcp_config.json`).

> **Zero Permission Prompts Tip**: Keeping `"env": { "TMPDIR": "/tmp" }` in every MCP server entry ensures temporary files are written to `/tmp` rather than macOS's `/var/folders/...`, preventing workspace permission prompts in Antigravity.

---

## Disclaimer / 免责声明

This project is an independent open-source MCP bridge and is **not** affiliated with, endorsed by, or sponsored by OpenAI or Google. `ChatGPT.app`, `OpenAI Codex`, and `@oai/sky` are proprietary software and trademarks of OpenAI. No proprietary OpenAI binaries or bundled application files are redistributed in this repository; all runtime execution delegates to the user's own locally installed copy of `/Applications/ChatGPT.app`.

---

## License

[AGPL-3.0](./LICENSE)
