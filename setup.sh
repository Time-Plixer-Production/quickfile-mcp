#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# quickfile-mcp — Interactive local setup script
# Sets up the server for Claude Desktop (stdio mode)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Colour

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║       quickfile-mcp  setup wizard            ║"
echo "  ║   QuickFile × Claude Desktop (stdio mode)    ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Check Node ────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Install Node 20+ from https://nodejs.org${NC}"
  exit 1
fi
NODE_VER=$(node -e "process.stdout.write(process.version)")
echo -e "${GREEN}✓ Node.js ${NODE_VER}${NC}"

# ── 2. Install dependencies ───────────────────────────────────
echo -e "\n${BLUE}Installing dependencies...${NC}"
npm install --silent
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ── 3. Collect QuickFile credentials ─────────────────────────
echo -e "\n${YELLOW}Enter your QuickFile API credentials."
echo -e "Find them at: Account Settings → Third Party Integrations${NC}\n"

read -rp "  QuickFile Account Number : " QF_ACCOUNT_NUMBER
read -rp "  QuickFile API Key        : " QF_API_KEY
read -rp "  QuickFile Application ID : " QF_APP_ID

# ── 4. Optional business profile ─────────────────────────────
echo -e "\n${YELLOW}Optional: Business profile (for automatic VAT handling)${NC}"
read -rp "  VAT registered? (y/N)    : " VAT_ANSWER
QF_VAT_REGISTERED="false"
if [[ "${VAT_ANSWER,,}" == "y" || "${VAT_ANSWER,,}" == "yes" ]]; then
  QF_VAT_REGISTERED="true"
fi
read -rp "  Business name (optional) : " QF_BUSINESS_NAME

# ── 5. Write .dev.vars ───────────────────────────────────────
DEV_VARS=".dev.vars"
cat > "${DEV_VARS}" <<EOF
QF_ACCOUNT_NUMBER=${QF_ACCOUNT_NUMBER}
QF_API_KEY=${QF_API_KEY}
QF_APP_ID=${QF_APP_ID}
LOG_LEVEL=info
QF_VAT_REGISTERED=${QF_VAT_REGISTERED}
QF_BUSINESS_NAME=${QF_BUSINESS_NAME}
EOF
echo -e "\n${GREEN}✓ Credentials written to ${DEV_VARS} (gitignored)${NC}"

# ── 6. Build ─────────────────────────────────────────────────
echo -e "\n${BLUE}Typechecking...${NC}"
if npm run typecheck --silent; then
  echo -e "${GREEN}✓ Typecheck passed${NC}"
else
  echo -e "${RED}✗ Typecheck failed — check the output above${NC}"
  exit 1
fi

# ── 7. Claude Desktop config ─────────────────────────────────
echo -e "\n${YELLOW}Configuring Claude Desktop...${NC}"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)

if [[ "$OSTYPE" == "darwin"* ]]; then
  CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  CLAUDE_CONFIG="$APPDATA/Claude/claude_desktop_config.json"
else
  CLAUDE_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"
fi

MCP_ENTRY=$(cat <<EOF
  "quickfile": {
    "command": "node",
    "args": ["${SCRIPT_DIR}/dist/index.js"],
    "env": {
      "QF_ACCOUNT_NUMBER": "${QF_ACCOUNT_NUMBER}",
      "QF_API_KEY": "${QF_API_KEY}",
      "QF_APP_ID": "${QF_APP_ID}",
      "QF_VAT_REGISTERED": "${QF_VAT_REGISTERED}",
      "QF_BUSINESS_NAME": "${QF_BUSINESS_NAME}",
      "LOG_LEVEL": "info"
    }
  }
EOF
)

echo -e "\n${GREEN}Add the following to your Claude Desktop config:${NC}"
echo -e "  ${BLUE}${CLAUDE_CONFIG}${NC}\n"
echo '  "mcpServers": {'
echo "${MCP_ENTRY}"
echo '  }'

echo -e "\n${GREEN}✓ Setup complete!${NC}"
echo -e "Restart Claude Desktop after updating the config file."
echo -e "Run ${BLUE}npm run dev${NC} to start the local dev server.\n"
