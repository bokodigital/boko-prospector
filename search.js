/**
 * Boko B2B Prospector — Apollo search proxy (Vercel serverless function)
 *
 * Why this is a server function and not browser code:
 *   the Apollo API key must NEVER reach the browser, or anyone viewing the
 *   site could copy it and burn your credits. The key lives only in the
 *   Vercel environment variable APOLLO_API_KEY and is used here, server-side.
 *
 * Environment variables (set in Vercel → Project → Settings → Environment Variables):
 *   APOLLO_API_KEY  (required) — your Apollo MASTER api key
 *   APP_PASSWORD    (recommended) — a shared passcode; if set, callers must send it.
 *                   Stops a public URL from spending your Apollo credits.
 *
 * Apollo docs:
 *   Search (no credits, no emails):  POST /api/v1/mixed_people/api_search
 *   Bulk enrichment (uses credits, reveals emails): POST /api/v1/people/bulk_match
 */

const APOLLO_BASE = "https://api.apollo.io/api/v1";

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function apolloHeaders(key) {
  return {
    "X-Api-Key": key,
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    accept: "application/json",
  };
}

/* Build the Apollo search payload from the front-end filters. */
function buildSearchBody(f, perPage, page) {
  const arr = (v) =>
    Array.isArray(v)
      ? v.filter(Boolean)
      : String(v || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  const body = { page, per_page: perPage };
  if (f.keywords) body.q_keywords = String(f.keywords).trim();
  const titles = arr(f.titles);
  if (titles.length) body["person_titles"] = titles;
  const senior = arr(f.seniorities);
  if (senior.length) body["person_seniorities"] = senior;
  const ploc = arr(f.personLocations);
  if (ploc.length) body["person_locations"] = ploc;
  const oloc = arr(f.orgLocations);
  if (oloc.length) body["organization_locations"] = oloc;
  const head = arr(f.headcount); // e.g. "1,10" or "51,200"
  if (head.length) body["organization_num_employees_ranges"] = head;
  // Only pull contacts Apollo believes have a usable email.
  body["contact_email_status"] = ["verified", "likely to engage"];
  return body;
}

/* Map an Apollo person record into our flat lead shape. */
function mapPerson(p) {
  const org = p.organization || p.account || {};
  return {
    first: p.first_name || "",
    last: p.last_name || "",
    email: p.email && !/email_not_unlocked/i.test(p.email) ? p.email : "",
    email_status: p.email_status || "",
    title: p.title || "",
    company: org.name || p.organization_name || "",
    domain: org.primary_domain || org.website_url || "",
    city: p.city || "",
    state: p.state || "",
    country: p.country || "",
    linkedin: p.linkedin_url || "",
    apollo_id: p.id || "",
    source: "Apollo via Boko Prospector",
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });

  let payload;
  try {
    payload = await readBody(req);
  } catch (e) {
    return send(res, 400, { error: "Invalid JSON body." });
  }

  // Passcode guard
  if (process.env.APP_PASSWORD) {
    if (!payload.passcode || payload.passcode !== process.env.APP_PASSWORD) {
      return send(res, 401, { error: "Incorrect or missing passcode." });
    }
  }

  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    return send(res, 500, {
      error:
        "APOLLO_API_KEY is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.",
    });
  }

  const count = Math.min(200, Math.max(1, parseInt(payload.count, 10) || 25));
  const reveal = payload.reveal === true;
  const filters = payload.filters || {};

  /* ---- 1. Search (paginate up to `count`) ---- */
  const people = [];
  try {
    let page = 1;
    while (people.length < count && page <= 5) {
      const perPage = Math.min(100, count - people.length);
      const body = buildSearchBody(filters, perPage, page);
      const r = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
        method: "POST",
        headers: apolloHeaders(key),
        body: JSON.stringify(body),
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      if (!r.ok) {
        const hint =
          r.status === 403
            ? " (403 — this usually means the key is not a MASTER api key)"
            : r.status === 401
            ? " (401 — check the API key value)"
            : r.status === 429
            ? " (429 — Apollo rate limit, try again shortly)"
            : "";
        return send(res, r.status, {
          error: `Apollo search failed${hint}.`,
          detail: data && (data.error || data.message || data.raw) || null,
        });
      }

      const batch = data.people || data.contacts || [];
      if (!batch.length) break;
      for (const p of batch) people.push(p);
      const totalPages = data.pagination && data.pagination.total_pages;
      if (totalPages && page >= totalPages) break;
      page += 1;
    }
  } catch (e) {
    return send(res, 502, { error: "Could not reach Apollo.", detail: String(e) });
  }

  let leads = people.slice(0, count).map(mapPerson);

  /* ---- 2. Optional enrichment to reveal emails (consumes credits) ---- */
  let enriched = false;
  if (reveal && leads.length) {
    try {
      // Bulk match in chunks of 10 (Apollo bulk_match limit).
      for (let i = 0; i < leads.length; i += 10) {
        const chunk = leads.slice(i, i + 10);
        const details = chunk.map((l) => ({
          first_name: l.first,
          last_name: l.last,
          organization_name: l.company,
          domain: l.domain || undefined,
          id: l.apollo_id || undefined,
        }));
        const r = await fetch(
          `${APOLLO_BASE}/people/bulk_match?reveal_personal_emails=true`,
          {
            method: "POST",
            headers: apolloHeaders(key),
            body: JSON.stringify({ details }),
          }
        );
        const data = await r.json().catch(() => ({}));
        const matches = data.matches || data.people || [];
        matches.forEach((m, idx) => {
          if (m && m.email && !/email_not_unlocked/i.test(m.email)) {
            chunk[idx].email = m.email;
            chunk[idx].email_status = m.email_status || chunk[idx].email_status;
          }
        });
        enriched = true;
      }
    } catch (e) {
      // Don't fail the whole request if enrichment hiccups; return search rows.
      enriched = false;
    }
  }

  return send(res, 200, {
    ok: true,
    count: leads.length,
    enriched,
    leads,
  });
};
