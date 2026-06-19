# Boko B2B Prospector

Find **real B2B prospects** by industry, job title, seniority, location and company size through the [Apollo](https://apollo.io) database, then export a clean list formatted for direct import into **HubSpot**, **Klaviyo**, or **Mailchimp**.

Built by **Boko Digital** — *Strategize. Execute. Deliver.*

---

## How it works

- The Boko-branded form collects search filters and sends them to a small **Vercel serverless function** (`/api/search`).
- That function calls Apollo **server-side** using your secret API key, so the key is never exposed to the browser.
- Apollo's search returns prospects (name, title, company, location, LinkedIn) for free. Email addresses are revealed only when you tick **Reveal verified emails**, which uses Apollo enrichment credits.

## Required setup (environment variables)

Set these in **Vercel → your project → Settings → Environment Variables**, then redeploy:

| Variable | Required | What it is |
|---|---|---|
| `APOLLO_API_KEY` | Yes | Your Apollo **master** API key (Apollo → Settings → Integrations → API). A master key is required by the search endpoint. |
| `APP_PASSWORD` | Recommended | A shared passcode. When set, the form requires it before running a search — this stops a public URL from spending your Apollo credits. |

You enter these values yourself in Vercel — they are never stored in the code or seen by anyone else.

## Compliance

These are real B2B contacts intended for legitimate business-to-business outreach. You remain responsible for honouring the **Australian Spam Act 2003** and **GDPR**: identify yourself clearly, include a working unsubscribe in every message, and don't email anyone who has opted out. This tool does not scrape, guess, or fabricate addresses.

## Tech

- Static front end: `index.html` + `app.js` (no framework).
- One serverless function: `api/search.js` (Node, uses built-in `fetch`).
- No database, no build step.

## Local development

Use the Vercel CLI so the `/api` function runs locally:

```bash
npm i -g vercel
vercel dev   # then open the printed localhost URL
# set APOLLO_API_KEY / APP_PASSWORD via `vercel env` or a local .env
```

## Deploy

See **DEPLOY.md** for full GitHub + Vercel + env-var steps.

## License

MIT — see `LICENSE`.
