# Vercel Deployment Setup Guide

## Step 1: Deploy to Vercel

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy
vercel --prod
```

Or use the Vercel dashboard:
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Click "Deploy"

---

## Step 2: Add Redis Storage (REQUIRED)

Aegis-3 requires persistent storage for audit results. Vercel serverless functions have isolated `/tmp` directories that don't persist between invocations.

### Via Vercel Dashboard (Recommended)
1. Go to your project dashboard: `https://vercel.com/[your-username]/aegis-3`
2. Click **Storage** tab
3. Click **Create Database**
4. Select **Upstash Redis** (recommended) or any Redis provider
5. Name it `aegis-audits` (or any name)
6. Click **Create**
7. **Connect to Project** - Select your `aegis-3` project
8. Vercel will automatically add the `REDIS_URL` environment variable

**Free Tier:** 30MB storage, 10k commands/day (enough for ~10 stored audits)

---

## Step 3: Add Gemini API Key

1. Go to **Settings → Environment Variables**
2. Add new variable:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** Your Gemini API key from https://ai.google.dev/gemini-api/docs/api-key
   - **Environments:** Production, Preview, Development
3. Click **Save**

---

## Step 4: Redeploy (if needed)

If you added environment variables after initial deployment:

```bash
vercel --prod
```

Or trigger a redeploy via the dashboard:
- Go to **Deployments** → Click **Redeploy** on the latest deployment

---

## Verification

Once deployed:

1. Visit your deployed URL: `https://aegis-3.vercel.app`
2. Paste a GitHub repo URL (e.g., `https://github.com/OpenZeppelin/openzeppelin-contracts`)
3. Click **Initialize Audit**
4. You should see the audit progress and be redirected to the results page

If you get "Audit not found" errors, KV storage is not properly configured.

---

## Local Development vs Production

| Environment | Storage | Setup Required |
|-------------|---------|----------------|
| **Local** (`npm run dev`) | Filesystem (`.temp/audits/`) | None - works out of the box |
| **Vercel Production** | Upstash Redis | Redis database creation required |

The code automatically detects the environment:
- If `REDIS_URL` is set → Uses Redis (Upstash)
- If not set → Uses filesystem (local dev only)

---

## Troubleshooting

### "Audit not found" error on Vercel
**Cause:** Redis storage not configured or not linked to project  
**Fix:** Follow Step 2 above to create and link Upstash Redis storage. Verify `REDIS_URL` is in your environment variables.

### "API quota exceeded" error
**Cause:** Gemini API free tier limit reached  
**Fix:** Wait for quota reset or upgrade to paid plan at https://ai.google.dev/pricing

### Vercel function timeout (10s/60s)
**Cause:** Very large repositories exceed serverless function timeout  
**Fix:** 
- Upgrade to Vercel Pro (60s timeout)
- Or deploy to Railway/Render (no timeout limits)
- Or implement async job processing

---

## Cost Estimate

**Free Tier (Hobby Plan):**
- Vercel hosting: Free (100GB bandwidth, 10s function timeout)
- Upstash Redis: Free (30MB storage, 10k commands/day)
- Gemini API: Free (15 RPM, 1500 RPD, 1M TPM)

**Storage capacity:** ~10 stored audits (medium-sized repos) on free tier
**Sufficient for:** Demo purposes and hackathon judging

**Pro Plan ($20/month):**
- 60s function timeout (handles larger repos)
- Unlimited KV storage and commands
- Better for production use

---

## Next Steps

- See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for technical deep-dive
- See [API.md](./docs/API.md) for API documentation
- Join the discussion: [GitHub Issues](https://github.com/Victor-Okpukpan/aegis-3/issues)
