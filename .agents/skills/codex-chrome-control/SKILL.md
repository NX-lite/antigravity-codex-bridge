---
name: codex-chrome-control
description: Control the user's live Google Chrome browser using OpenAI Codex's control-chrome runtime (browser-client.mjs + browser-service.mjs + TinySky tab.ax) and @oai/sky Chrome Accessibility via the codex-cua MCP server. Use this skill when automating Chrome tabs, inspecting web Accessibility trees, clicking/filling web elements, or executing Playwright/DOM scripts on the user's open Chrome session.
---

# Codex Chrome Control (`control-chrome` & `@oai/sky` via `codex-cua` MCP)

This skill integrates OpenAI Codex's bundled Chrome plugin (`/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/chrome/`) and `@oai/sky` macOS Accessibility to control the user's live Google Chrome browser without launching an isolated dev browser or consuming vision tokens.

## 1. Two Native Codex Chrome Control Channels

| Channel | Runtime / API | Best For | Token Cost |
|---|---|---|---|
| **Channel A: Codex `control-chrome` (`browser-client.mjs`)** | `codex-cua` (`js` tool) | Codex's native `chrome.user.openTabs()`, `chrome.user.claimTab()`, `tab.ax.write()` (TinySky a11y), `tab.ax.click(index)`, and `tab.playwright` via `"ChatGPT for Chrome"` Native Messaging Host (`com.openai.codexextension`). | Ultra-low (TinySky numbered tree) |
| **Channel B: Codex `@oai/sky` (`com.google.Chrome`)** | `codex-cua` / `codex-sky` | Controlling Chrome's native macOS browser UI, toolbar, address bar, permission prompts, extension popups, and web content via macOS Accessibility (`sky.get_app_state({ app: "com.google.Chrome" })`). | Ultra-low (macOS AX diff tree) |

---

## 2. Codex `control-chrome` (`browser-client.mjs`) Usage in `codex-cua` MCP

Inside the `codex-cua` MCP `js` tool:

### Setup
`globalThis.setupBrowserRuntime` is pre-loaded in `codex-cua` (`js` tool), or you can import it explicitly:
```js
const { setupBrowserRuntime } = await import(
  "/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/chrome/scripts/browser-client.mjs"
);
globalThis.chrome ??= await (await setupBrowserRuntime()).browsers.get("extension");
```

### Inspecting and Claiming Existing User Tabs
- List the user's open tabs before creating new ones:
  ```js
  const tabs = await chrome.user.openTabs();
  nodeRepl.write(JSON.stringify(tabs, null, 2));
  ```
- Claim an existing tab by ID (gives your session control of that tab):
  ```js
  const tab = await chrome.user.claimTab(tabs[0].id);
  ```
- Or open a new tab:
  ```js
  const tab = await chrome.tabs.new();
  await tab.goto("https://example.com");
  ```

### Codex TinySky Accessibility API (`tab.ax`)
Prefer `tab.ax` over screenshots and ad-hoc DOM selectors:

```js
// 1. Render numbered accessibility tree (0, 1, 2, ...) to nodeRepl output
await tab.ax.write();

// 2. Click an element by its index from the latest tab.ax.write()
await tab.ax.click(14);
await tab.ax.write();

// 3. Set value on a settable text field / input by index
await tab.ax.setValue(9, "search query");

// 4. Scroll an element or viewport
await tab.ax.scroll({ index: 5, deltaY: 400 });

// 5. Perform secondary action (e.g., "Focus", "Increment", "ShowMenu")
await tab.ax.performAction(12, "Focus");
```

### Codex Playwright Locator & Evaluation API (`tab.playwright`)
Every claimed `Tab` also exposes `tab.playwright`:

```js
// Read page title and URL
nodeRepl.write(`${await tab.title()} - ${await tab.url()}`);

// Use Playwright locators
await tab.playwright.getByRole("button", { name: "Submit" }).click();
await tab.playwright.locator("input[name='q']").fill("OpenAI Codex");

// Evaluate JS in page
const data = await tab.playwright.evaluate(() => document.title);
nodeRepl.write(JSON.stringify(data));
```

### Finishing Work
- Mark deliverable tabs with `await tab.markDeliverable()` so they stay open for the user.
- If blocked by login/2FA/CAPTCHA, call `await tab.markHandoff("login")` and ask the user to complete it.

---

## 3. Codex `@oai/sky` Chrome Accessibility Usage

When interacting with Chrome's native macOS UI (address bar, extensions, dialogs) or inspecting Chrome via macOS Accessibility without an extension:

```js
globalThis.sky ??= (await import("@oai/sky")).sky;
const state = await sky.get_app_state({ app: "com.google.Chrome" });
nodeRepl.write(state.text);
```
Then interact using `await sky.click({ app: "com.google.Chrome", element_index: <id> })` or `await sky.set_value({ app: "com.google.Chrome", element_index: <id>, value: "..." })`.
