# Setup Guide

Complete installation and deployment instructions for Aegis-3.

---

## Prerequisites

### Required

- **Node.js:** 20.x or later ([Download](https://nodejs.org))
- **npm:** 10.x or later (comes with Node.js)
- **Git:** 2.x or later
- **Gemini API Key:** Free tier available ([Get Key](https://ai.google.dev/gemini-api/docs/api-key))

### Optional

- **pnpm/yarn:** Alternative package managers
- **Docker:** For containerized deployment
- **VSCode:** Recommended IDE with Prettier + ESLint extensions

---

## Quick Start (Local Development)

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/aegis
cd aegis
```

### 2. Install Dependencies

```bash
npm install
```

**Expected time:** 30-60 seconds

### 3. Configure Environment

```bash
cp env.example .env
```

Edit `.env`:

```env
# Required: Get from https://ai.google.dev/gemini-api/docs/api-key
GEMINI_API_KEY=your_actual_api_key_here

# Optional: For production analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id
```

### 4. Prepare Data (Security Reports)

**Option A: Use Sample Data (Included)**

```bash
# Already included in repo under /data/security-reports/
# Contains 69,641 findings across 31 DeFi categories
ls -lh data/security-reports/
```

**Option B: Download Full Dataset** (if not included)

```bash
# Download from project releases or Solodit API
curl -L https://github.com/yourusername/aegis/releases/download/v1.0/security-reports.zip -o reports.zip
unzip reports.zip -d data/
```

### 5. Run Development Server

```bash
npm run dev
```

**Output:**

```
   ▲ Next.js 15.1.6
   - Local:        http://localhost:3000
   - Environments: .env

 ✓ Ready in 2.4s
```

Open http://localhost:3000 in your browser.

---

## Vercel Deployment (Production)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/aegis.git
git push -u origin main
```

### 2. Deploy to Vercel

**Via Vercel Dashboard:**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
4. Add Environment Variables:
   - `GEMINI_API_KEY`: Your API key

**Via Vercel CLI:**

```bash
npm i -g vercel
vercel login
vercel --prod
```

### 3. Configure Domain (Optional)

In Vercel dashboard:
- **Settings → Domains → Add Domain**
- Example: `aegis3.yourdomain.com`

---

## Alternative Deployment Options

### Railway (No Timeout Limits)

**Why Railway?** Vercel's serverless functions have 10-60s timeouts. Large repos may exceed this.

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**railway.json:**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Docker Deployment

**Dockerfile:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**Build and run:**

```bash
docker build -t aegis3 .
docker run -p 3000:3000 --env-file .env aegis3
```

---

## Local Setup Deep-Dive

### Directory Structure

```
aegis/
├── app/
│   ├── api/
│   │   ├── ingest/route.ts       # GitHub cloning
│   │   ├── analyze/route.ts      # Gemini pipeline
│   │   └── audits/route.ts       # Data retrieval
│   ├── audit/[id]/page.tsx       # Audit detail view
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home dashboard
├── components/
│   ├── CodeViewer.tsx            # Monaco editor wrapper
│   ├── Header.tsx                # Top navigation
│   └── StatusIndicator.tsx       # Audit status badge
├── lib/
│   ├── gemini.ts                 # Gemini 3 integration
│   ├── github.ts                 # Repository operations
│   ├── reports.ts                # RAG-lite engine
│   ├── storage.ts                # Audit persistence
│   └── types.ts                  # TypeScript interfaces
├── data/
│   └── security-reports/         # 69,641 JSON findings
│       ├── aave-v2.json
│       ├── compound-v3.json
│       └── ...
├── public/                       # Static assets
├── .temp/
│   ├── repos/                    # Cloned repos (gitignored)
│   └── audits/                   # Audit results (gitignored)
└── docs/                         # This documentation
```

### Data Requirements

**Security Reports Format:**

```typescript
// data/security-reports/protocol-name.json
{
  "metadata": {
    "protocol": "Aave V2",
    "audit_date": "2023-06-15",
    "auditor": "Trail of Bits",
    "source_url": "https://github.com/..."
  },
  "findings": [
    {
      "id": "aave-v2-001",
      "title": "Reentrancy in liquidationCall",
      "impact": "CRITICAL",
      "content": "The liquidationCall function transfers...",
      "quality_score": 9,
      "rarity_score": 7,
      "tags": ["Reentrancy", "Liquidation", "Oracle"]
    }
  ]
}
```

**Total Dataset Stats:**
- **Files:** 31 JSON files
- **Findings:** 69,641 unique vulnerabilities
- **Size:** ~45 MB total
- **Categories:** DeFi protocols (lending, DEXs, vaults, bridges)

### Indexing Performance

**Cold Start (First Request):**

```
[REPORTS] Loading from disk...
[REPORTS] Loaded 69,641 findings in 1,247ms
[REPORTS] Index ready
```

**Subsequent Requests:**

```
[REPORTS] Using cached index
[REPORTS] Search completed in 8ms
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | - | Your Gemini API key |
| `NODE_ENV` | No | `development` | Environment mode |
| `NEXT_PUBLIC_VERCEL_ANALYTICS_ID` | No | - | Vercel Analytics ID |
| `PORT` | No | `3000` | Server port |

---

## Troubleshooting

### Issue 1: "Cannot find module 'simple-git'"

**Cause:** Dependencies not installed

**Fix:**

```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue 2: "GEMINI_API_KEY is not defined"

**Cause:** Environment variable not loaded

**Fix:**

1. Verify `.env` exists:
   ```bash
   cat .env
   ```
2. Restart dev server:
   ```bash
   npm run dev
   ```

### Issue 3: "Analysis stuck at 'analyzing'"

**Cause:** Audit process crashed or timed out

**Fix:**

```bash
# Delete stuck audit
rm .temp/audits/[audit-id].json

# Restart server
npm run dev
```

**Or use built-in recovery:**

```bash
curl -X POST http://localhost:3000/api/recovery
```

### Issue 4: "Gemini API quota exceeded"

**Cause:** Free tier limit reached (50 Pro requests/day or 1,500 Flash/day)

**Fix:**

1. **Wait 24 hours** for quota reset
2. **Upgrade plan:** https://ai.google.dev/pricing
3. **Use fallback:** Aegis-3 auto-falls back to Flash when Pro quota exceeded

**Check quota status:**

```bash
curl https://generativelanguage.googleapis.com/v1beta/models \
  -H "x-goog-api-key: YOUR_API_KEY"
```

### Issue 5: "Monaco editor not displaying code"

**Cause:** Static files not built correctly

**Fix:**

```bash
npm run build
npm run start
```

### Issue 6: "Cannot clone repository: EACCES"

**Cause:** Permission denied for `.temp/repos/`

**Fix:**

```bash
mkdir -p .temp/repos .temp/audits
chmod 755 .temp/repos .temp/audits
```

---

## Performance Optimization

### 1. Enable Next.js Caching

```typescript
// app/api/audits/route.ts
export const revalidate = 60; // Cache for 60 seconds
```

### 2. Increase Vercel Function Timeout

```json
// vercel.json
{
  "functions": {
    "app/api/analyze/route.ts": {
      "maxDuration": 60
    }
  }
}
```

**Note:** Requires Pro plan ($20/mo)

### 3. Optimize RAG Search

```typescript
// lib/reports.ts
// Reduce search results to top 10 (vs 15)
const relevantFindings = searchRelevantFindings(keywords, patterns, 10);
```

### 4. Code Truncation

```typescript
// lib/gemini.ts
// Limit context to 700K tokens
const truncatedCode = code.slice(0, 700000);
```

---

## Development Workflow

### 1. Install VSCode Extensions

- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
- **Solidity** (`JuanBlanco.solidity`)

### 2. Enable Auto-Formatting

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### 3. Run Linting

```bash
npm run lint
```

### 4. Build for Production

```bash
npm run build
```

**Output:**

```
Route (app)                              Size     First Load JS
┌ ○ /                                    5.2 kB          95 kB
├ ○ /audit/[id]                         12.8 kB         110 kB
└ ○ /api/analyze                             0 B             0 B
```

---

## API Keys & Rate Limits

### Gemini 3 Free Tier

| Model | Requests/Day | Requests/Minute | Context Window |
|-------|--------------|-----------------|----------------|
| **Flash** | 1,500 | 15 | 1M tokens |
| **Pro** | 50 | 2 | 1M tokens |

**Cost:** $0

**Upgrade to Paid:** https://ai.google.dev/pricing

### GitHub API (for private repos)

If cloning private repos, add GitHub token:

```env
# .env
GITHUB_TOKEN=ghp_your_token_here
```

**Usage:**

```typescript
// lib/github.ts
await git.clone(repoUrl, repoPath, {
  '--depth': 1,
  '--single-branch': true,
  '--config': `http.extraHeader=AUTHORIZATION: token ${process.env.GITHUB_TOKEN}`
});
```

---

## Testing

### Manual Testing

1. Submit test repo: `https://github.com/OpenZeppelin/openzeppelin-contracts`
2. Wait for analysis (2-3 minutes)
3. Verify:
   - Findings display correctly
   - Monaco editor shows real code
   - Vulnerable lines highlighted
   - PoC code copyable

### Automated Testing (Coming Soon)

```bash
npm run test
```

**Test coverage goals:**
- Unit tests for RAG search
- Integration tests for Gemini pipeline
- E2E tests for full audit flow

---

## Maintenance

### Cleanup Temp Files

```bash
# Delete cloned repos older than 24 hours
find .temp/repos/ -type d -mtime +1 -exec rm -rf {} \;

# Delete failed audits
find .temp/audits/ -name "*.json" -exec grep -l '"status":"failed"' {} \; | xargs rm
```

### Monitor Disk Usage

```bash
du -sh .temp/
```

**Recommended:** Schedule daily cleanup cron job:

```bash
# crontab -e
0 2 * * * cd /path/to/aegis && find .temp/repos/ -mtime +1 -delete
```

### Update Dependencies

```bash
npm update
npm audit fix
```

---

## Production Checklist

Before deploying to production:

- [ ] `.env` configured with valid API key
- [ ] Security reports data loaded (`data/security-reports/`)
- [ ] `.gitignore` excludes `.temp/` and `.env`
- [ ] Error handling tested (quota limits, network failures)
- [ ] Vercel/Railway environment variables set
- [ ] Domain configured (if applicable)
- [ ] Analytics enabled (optional)
- [ ] Rate limiting implemented (recommended)
- [ ] Backup strategy for audit results

---

## Next Steps

- **[Architecture Guide](/docs/ARCHITECTURE.md):** Understand the technical implementation
- **[Innovation Thesis](/docs/INNOVATION.md):** Learn why LLMs beat static analysis
- **[API Reference](/docs/API.md):** Explore API endpoints and data models

---

**Need help?** [Open an issue](https://github.com/yourusername/aegis/issues) or email your@email.com
