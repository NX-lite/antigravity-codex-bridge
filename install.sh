#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${HOME}/.gemini/config"
CHATGPT_APP="${CHATGPT_APP_PATH:-/Applications/ChatGPT.app}"
RESOURCES_DIR="${CHATGPT_APP}/Contents/Resources"

echo "==> Creating target directory: ${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"

echo "==> Copying Codex MCP bridge scripts to ${TARGET_DIR}..."
for f in codex-cua-mcp.mjs codex-sky-mcp.mjs codex-templates-mcp.mjs codex-data-mcp.mjs; do
  cp "${SCRIPT_DIR}/${f}" "${TARGET_DIR}/${f}"
  chmod +x "${TARGET_DIR}/${f}"
  echo "    Installed ${TARGET_DIR}/${f}"
done

# Optionally populate local reference docs & bundled skills from the user's own ChatGPT.app installation
if [ -d "${RESOURCES_DIR}" ]; then
  echo "==> Syncing local reference docs from ${CHATGPT_APP} into .agents/skills/..."
  if [ -d "${RESOURCES_DIR}/plugins/openai-bundled/plugins/chrome/docs" ]; then
    mkdir -p "${SCRIPT_DIR}/.agents/skills/codex-chrome-control/references"
    cp -R "${RESOURCES_DIR}/plugins/openai-bundled/plugins/chrome/docs/"* "${SCRIPT_DIR}/.agents/skills/codex-chrome-control/references/" 2>/dev/null || true
  fi
  if [ -d "${RESOURCES_DIR}/cua_node/lib/node_modules/@oai/sky/docs" ]; then
    mkdir -p "${SCRIPT_DIR}/.agents/skills/codex-computer-use/references"
    cp -R "${RESOURCES_DIR}/cua_node/lib/node_modules/@oai/sky/docs/"* "${SCRIPT_DIR}/.agents/skills/codex-computer-use/references/" 2>/dev/null || true
  fi
  for pair in \
    "chrome/skills/control-chrome:control-chrome" \
    "browser/skills/control-in-app-browser:control-in-app-browser" \
    "computer-use/skills/computer-use:computer-use" \
    "computer-history/skills/computer-history:computer-history" \
    "record-and-replay/skills/record-and-replay:record-and-replay"; do
    src_rel="${pair%%:*}"
    dst_name="${pair##*:}"
    if [ -d "${RESOURCES_DIR}/plugins/openai-bundled/plugins/${src_rel}" ]; then
      mkdir -p "${SCRIPT_DIR}/.agents/skills/${dst_name}"
      cp -R "${RESOURCES_DIR}/plugins/openai-bundled/plugins/${src_rel}/"* "${SCRIPT_DIR}/.agents/skills/${dst_name}/" 2>/dev/null || true
    fi
  done
fi

cat <<EOF

==> Installation complete!
Add the following entries to your MCP configuration (e.g. ~/.gemini/antigravity/mcp_config.json):

{
  "mcpServers": {
    "codex-cua": {
      "command": "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node",
      "args": [
        "${TARGET_DIR}/codex-cua-mcp.mjs"
      ],
      "env": {
        "TMPDIR": "/tmp"
      }
    },
    "codex-sky": {
      "command": "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node",
      "args": [
        "${TARGET_DIR}/codex-sky-mcp.mjs"
      ],
      "env": {
        "TMPDIR": "/tmp"
      }
    },
    "codex-artifact-templates": {
      "command": "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node",
      "args": [
        "${TARGET_DIR}/codex-templates-mcp.mjs"
      ],
      "env": {
        "TMPDIR": "/tmp"
      }
    },
    "codex-data": {
      "command": "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node",
      "args": [
        "${TARGET_DIR}/codex-data-mcp.mjs"
      ],
      "env": {
        "TMPDIR": "/tmp"
      }
    }
  }
}
EOF
