---
name: codex-computer-use
description: Control native macOS desktop applications using OpenAI Codex's native @oai/sky Computer Use engine via the codex-cua MCP server (js tool) or codex-sky MCP server. Use this skill when interacting with native macOS apps (Finder, System Settings, Safari, Notes, VS Code, Chrome desktop UI, Calendar, Messages, etc.) with Codex's exact element_index Accessibility tree and zero Full Disk Access requirements.
---

# Codex Computer Use (`@oai/sky` via `codex-cua` & `codex-sky` MCP)

This skill uses OpenAI Codex's bundled `@oai/sky` Computer Use runtime (`Codex Computer Use.app` + `cua_node/bin/node_repl`) exposed through:
- **`codex-cua`** MCP server (`js` tool): Persistent Node REPL with `globalThis.sky`, `globalThis.require`, `globalThis.process`, and `globalThis.Buffer` pre-loaded.
- **`codex-sky`** MCP server: 30 direct MCP tools for Computer Use (`list_apps`, `get_app_state`, `click`, `set_value`, `press_key`, `type_text`, `scroll`, `drag`, `select_text`, `perform_secondary_action`), Computer History (`computer_history_*`), Record & Replay (`event_stream_*`), Calendar (`list_calendars`, `list_events`, `get_event`, `create_event`, `update_event`, `delete_event`), and Messages (`find_chats`, `read_messages`, `search_messages`, `send_message`, `count_message_activity`, `read_image`).

## Pre-Loaded Runtime (`globalThis.sky` & `globalThis.require`)

In `codex-cua`'s `js` tool:
- `globalThis.sky` (`@oai/sky`) and `globalThis.require` are **automatically pre-loaded** before every snippet (you can also write `globalThis.sky ??= (await import("@oai/sky")).sky;`).
- Top-level `const` declarations and top-level `return` statements are automatically normalized so persistent REPL calls never warn on re-declaration or fail on `return`.
- Use `nodeRepl.write(value)` or `console.log(value)` or top-level `return value;` to output results.

## Core Workflow: Accessibility-First (`element_index`)

1. **List Running Apps**:
   ```js
   const apps = await sky.list_apps();
   nodeRepl.write(apps.filter(a => a.isRunning));
   ```
2. **Inspect App Accessibility State (Zero Vision Tokens)**:
   ```js
   const state = await sky.get_app_state({ app: "com.apple.finder" });
   nodeRepl.write(state.text);
   ```
   - `state.text` (also accessible via `state.ax_tree`, `String(state)`, or `state.split("\n")`) returns the numbered Accessibility tree (`0`, `1`, `2`, ...) or a compact diff from the previous call, plus `state.screenshot?.url`.
   - Pass `disableDiff: true` (`await sky.get_app_state({ app: "com.apple.finder", disableDiff: true })`) if you want the full Accessibility tree rather than a diff.
3. **Act on Elements by `element_index`**:
   > **Note**: Action methods (`sky.click`, `sky.set_value`, `sky.paste`, `sky.press_key`, `sky.scroll`) return `undefined` (`void`). Call `await sky.get_app_state({ app })` afterward when you need to inspect the updated Accessibility tree.
   ```js
   // Click an element by index (or by coordinates { app, x: 400, y: 300 })
   await sky.click({
     app: "com.google.Chrome",
     element_index: 9,
   });

   // Set value directly on a settable text field
   await sky.set_value({
     app: "com.google.Chrome",
     element_index: 9,
     value: "https://example.com",
   });

   // Or paste text into the focused element without disturbing the user's clipboard
   await sky.paste({
     app: "com.google.Chrome",
     text: "Hello world",
   });

   // Press keys (key is a string such as "return", "escape", "tab", "cmd+l", "cmd+v")
   await sky.press_key({
     app: "com.google.Chrome",
     key: "cmd+l",
   });

   // Inspect updated state
   const updated = await sky.get_app_state({ app: "com.google.Chrome" });
   nodeRepl.write(updated.text);
   ```

## Exact `@oai/sky` API Reference (`create_client.js`)

- `await sky.list_apps()` -> Returns `Array<{ id, displayName, isRunning, lastUsedDate, useCount }>`.
- `await sky.get_app_state({ app, disableDiff })` -> Returns `{ app, screenshot: { url } | null, text }` with the numbered Accessibility tree (`0`, `1`, `2`, ...) for the app's windows.
- `await sky.click({ app, element_index, x, y, click_count, mouse_button, key, duration })` -> Clicks an element by integer `element_index` (preferred) or coordinates `x, y` (`mouse_button`: `"left"` | `"right"` | `"middle"`).
- `await sky.set_value({ app, element_index, value })` -> Sets the value of a `(settable)` UI element directly.
- `await sky.paste({ app, text, format })` -> Pastes text into the target app without overwriting the user's prior clipboard.
- `await sky.type_text({ app, text })` (alias: `sky.type({ app, text })`) -> Types characters sequentially.
- `await sky.press_key({ app, key, duration })` -> Sends a key or key chord string (e.g., `"return"`, `"escape"`, `"tab"`, `"cmd+t"`).
- `await sky.scroll({ app, element_index, x, y, direction, pages })` -> Scrolls an element (`element_index`) or coordinate (`x, y`) in `direction`: `"up"` | `"down"` | `"left"` | `"right"` by `pages` (default `1`).
- `await sky.drag({ app, from_x, from_y, to_x, to_y })` -> Drags from `(from_x, from_y)` to `(to_x, to_y)`.
- `await sky.select_text({ app, element_index, text, prefix, suffix, selection_type })` -> Selects text inside an element.
- `await sky.perform_secondary_action({ app, element_index, action })` -> Performs a secondary Accessibility action listed on an element (such as `"Raise"`, `"Expand"`, `"Collapse"`, `"ShowMenu"`).

## Special Note: `com.openai.codex` Self-Control Restriction

OpenAI's `Codex Computer Use.app` (`@oai/sky`) explicitly forbids controlling its own host application `com.openai.codex` (`Computer Use is not allowed to use the app 'com.openai.codex' for safety reasons.`) to prevent recursive self-control.
- For **all other macOS apps** (`com.google.Chrome`, `com.apple.finder`, `com.microsoft.VSCode`, `com.apple.Notes`, etc.), use `@oai/sky` (`codex-cua` or `codex-sky`) directly.
- If you ever need to interact with `com.openai.codex` itself inside `codex-cua`'s `js` tool, use `node:child_process` (`osascript` / `pbcopy`) rather than `sky.get_app_state({ app: "com.openai.codex" })`.
