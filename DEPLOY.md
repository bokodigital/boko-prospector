# Deploy guide — GitHub + Vercel + Apollo key

This app needs a serverless function, so it must run on Vercel (not opened as a local file). About 10 minutes.

---

## Before you start

- **GitHub** account → https://github.com
- **Vercel** account → https://vercel.com (sign up with GitHub)
- An **Apollo** account with API access → https://apollo.io
- Your Apollo **master API key**: Apollo → Settings → Integrations → API → **Create API key** (make it a *master* key).

---

## 1. Put the code on GitHub

**Browser way:**
1. Create a new repo at https://github.com/new named `boko-prospector` (Public or Private both work).
2. On the empty repo, click **uploading an existing file** and drag in every file, keeping the `api/` folder structure: `index.html`, `app.js`, `favicon.svg`, `vercel.json`, `README.md`, `DEPLOY.md`, `LICENSE`, `.gitignore`, and `api/search.js`.
3. Commit.

> Tip: GitHub's drag-and-drop preserves folders if you drag the whole `boko-prospector` folder contents, including the `api` subfolder.

**CLI way:**
```bash
git init && git add . && git commit -m "Boko B2B Prospector"
git branch -M main
git remote add origin https://github.com/<you>/boko-prospector.git
git push -u origin main
```

## 2. Import to Vercel

1. Go to https://vercel.com/new and **Import** the `boko-prospector` repo.
2. Framework preset auto-detects as **Other** — leave defaults. Click **Deploy**.

## 3. Add your secrets (this is the important step)

1. In Vercel, open the project → **Settings → Environment Variables**.
2. Add:
   - **Name** `APOLLO_API_KEY` → **Value** = your Apollo master key → Save.
   - **Name** `APP_PASSWORD` → **Value** = any passcode you choose (e.g. a memorable phrase) → Save.
3. Go to the **Deployments** tab → open the latest deployment → **⋯ → Redeploy** so the new variables take effect.

> You enter the key directly into Vercel. It is stored encrypted by Vercel and used only by the server function — it never appears in the code or the browser.

## 4. Use it

1. Open your live URL (e.g. `https://boko-prospector.vercel.app`).
2. Enter the passcode you set, add filters, and click **Find prospects**.
3. Leave **Reveal verified emails** OFF first to preview matches for free; tick it and search again to pull verified emails (uses Apollo credits).
4. Pick the export format and **Download CSV**.

---

## Costs & limits

- Apollo **search** does not consume credits. **Email enrichment** (the reveal step) does — check your plan's monthly credit allowance.
- Keep `APP_PASSWORD` set so only people with the passcode can spend your credits.

## Troubleshooting

- **"403 — not a master api key"**: regenerate the Apollo key as a *master* key.
- **"401 — check the API key"**: the value in Vercel is wrong or has a stray space.
- **"APOLLO_API_KEY is not set"**: add the variable and redeploy.
- **No results**: broaden keywords/titles/location; very narrow filters can return nothing.
