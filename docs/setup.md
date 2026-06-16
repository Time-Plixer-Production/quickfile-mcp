# Setup Guide

## Prerequisites

- Node.js >= 20
- A QuickFile account with API access enabled
- Your QuickFile **Account Number**, **API Key**, and **Application ID**

## Getting Your QuickFile Credentials

1. Log into QuickFile
2. Go to **Account Settings → All Settings → Third Party Integrations**
3. Click **Create a QuickFile App** to get your `ApplicationID`
4. Your `AccountNumber` and `APIKey` are shown on the same page

## Option A — Local / Claude Desktop (stdio)

### 1. Clone and install

```bash
git clone https://github.com/Time-Plixer-Production/quickfile-mcp.git
cd quickfile-mcp
npm install
npm run build
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your credentials:

```env
QF_ACCOUNT_NUMBER=your_account_number
QF_API_KEY=your_api_key
QF_APP_ID=your_app_id
```

### 3. Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "quickfile": {
      "command": "node",
      "args": ["/absolute/path/to/quickfile-mcp/dist/index.js"],
      "env": {
        "QF_ACCOUNT_NUMBER": "your_account_number",
        "QF_API_KEY": "your_api_key",
        "QF_APP_ID": "your_app_id"
      }
    }
  }
}
```

Restart Claude Desktop. You should see QuickFile tools available.

## Option B — Cloudflare Workers (Remote)

### 1. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. Set secrets

```bash
wrangler secret put QF_ACCOUNT_NUMBER
wrangler secret put QF_API_KEY
wrangler secret put QF_APP_ID
```

### 3. Deploy

```bash
npm run deploy
```

The worker URL is shown after deployment. Use it as your MCP endpoint.

## Verifying the Connection

Ask Claude:
> *"Use the get_account_info tool and tell me what QuickFile account is connected."*

If connected correctly, Claude will return your live company name, VAT number, and financial year settings — **not a guess**.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `QF_ACCOUNT_NUMBER` | ✅ | Your QuickFile account number |
| `QF_API_KEY` | ✅ | Your QuickFile API key |
| `QF_APP_ID` | ✅ | Your registered app ID |
| `RATE_LIMIT_OVERRIDE` | Optional | Override daily API call budget (default: 900) |
| `LOG_LEVEL` | Optional | `debug` / `info` / `warn` / `error` (default: `info`) |
