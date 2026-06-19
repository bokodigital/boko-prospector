/* Boko B2B Prospector — front-end
 * Sends filters to /api/search (server-side Apollo proxy), renders results,
 * and exports a CSV with headers matched to HubSpot, Klaviyo or Mailchimp.
 */
const $ = (id) => document.getElementById(id);
let LAST = null; // {headers, dataRows, platform, fileBase}

/* platform column maps (shared with the sample generator) */
function shape(rows, platform) {
  if (platform === "hubspot") {
    return {
      headers: ["First Name","Last Name","Email","Job Title","Company Name","Website","City","State/Region","Country/Region","LinkedIn","Email Status","Lifecycle Stage","Lead Source"],
      map: (r) => [r.first,r.last,r.email,r.title,r.company,r.domain,r.city,r.state,r.country,r.linkedin,r.email_status,"Lead",r.source],
    };
  }
  if (platform === "klaviyo") {
    return {
      headers: ["Email","First Name","Last Name","Title","Organization","Website","City","Region","Country","Properties.LinkedIn","Properties.Email Status","Properties.Lead Source"],
      map: (r) => [r.email,r.first,r.last,r.title,r.company,r.domain,r.city,r.state,r.country,r.linkedin,r.email_status,r.source],
    };
  }
  return { // mailchimp
    headers: ["Email Address","First Name","Last Name","Job Title","Company","Website","City","State","Country","LinkedIn","Email Status","Lead Source"],
    map: (r) => [r.email,r.first,r.last,r.title,r.company,r.domain,r.city,r.state,r.country,r.linkedin,r.email_status,r.source],
  };
}

function toCSV(headers, dataRows) {
  const esc = (v) => { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return [headers.map(esc).join(",")].concat(dataRows.map((r) => r.map(esc).join(","))).join("\r\n");
}

function setLoading(on) {
  const b = $("genBtn");
  b.classList.toggle("loading", on);
  b.disabled = on;
  b.querySelector(".lbl").textContent = on ? "Searching Apollo…" : "🔎 Find prospects";
}
function showMsg(text, kind) {
  const m = $("msg");
  m.className = "msg " + (kind || "");
  m.textContent = text;
}

function renderTable(headers, dataRows) {
  document.querySelector("#tbl thead").innerHTML = "<tr>" + headers.map((h) => `<th>${h}</th>`).join("") + "</tr>";
  const body = document.querySelector("#tbl tbody");
  const preview = dataRows.slice(0, 50);
  body.innerHTML = preview.map((r) => "<tr>" + r.map((c) => `<td>${(c == null ? "" : String(c)).replace(/</g, "&lt;")}</td>`).join("") + "</tr>").join("");
  if (dataRows.length > preview.length) {
    body.innerHTML += `<tr><td colspan="${headers.length}" style="text-align:center;color:#73798a;font-style:italic">+ ${dataRows.length - preview.length} more rows in the CSV…</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("yr").textContent = new Date().getFullYear();
  const countEl = $("count");
  countEl.addEventListener("input", () => ($("countVal").textContent = countEl.value));

  $("genForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("", "");
    const platform = $("platform").value;
    const reveal = $("reveal").checked;
    const body = {
      passcode: $("passcode").value,
      reveal,
      count: parseInt(countEl.value, 10) || 25,
      filters: {
        keywords: $("keywords").value.trim(),
        orgKeywords: $("industry").value.trim(),
        titles: $("titles").value.trim(),
        seniorities: $("seniorities").value.trim(),
        personLocations: $("personLocations").value.trim(),
        orgLocations: $("orgLocations").value.trim(),
        headcount: $("headcount").value.trim().split(/\s+/).filter(Boolean),
        technologies: Array.from(document.querySelectorAll(".tech:checked")).map((c) => c.value),
      },
    };

    setLoading(true);
    $("csvBtn").disabled = true;
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showMsg((data && data.error ? data.error : "Search failed.") + (data && data.detail ? " — " + (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) : ""), "err");
        setLoading(false);
        return;
      }
      if (!data.leads.length) {
        showMsg("No prospects matched those filters. Try broadening the keywords, titles or location.", "err");
        setLoading(false);
        return;
      }
      const { headers, map } = shape(data.leads, platform);
      const dataRows = data.leads.map(map);
      LAST = { headers, dataRows, platform, fileBase: (($("industry").value.trim() || $("keywords").value.trim() || "prospects").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "prospects") };
      renderTable(headers, dataRows);
      const names = { hubspot: "HubSpot", klaviyo: "Klaviyo", mailchimp: "Mailchimp" };
      const withEmail = data.leads.filter((l) => l.email).length;
      $("pill").textContent = `${data.leads.length} prospects · ${withEmail} with email · ${names[platform]}`;
      $("results").classList.add("show");
      $("csvBtn").disabled = false;
      if (!reveal) {
        showMsg("Preview only — emails are not revealed yet. Tick “Reveal verified emails” and search again to fill them in (uses Apollo credits).", "ok");
      } else {
        showMsg(`Done. ${withEmail} of ${data.leads.length} prospects returned a verified email.`, "ok");
      }
      $("results").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      showMsg("Network error talking to the server: " + err, "err");
    }
    setLoading(false);
  });

  $("csvBtn").addEventListener("click", () => {
    if (!LAST) return;
    const csv = toCSV(LAST.headers, LAST.dataRows);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${LAST.fileBase}-${LAST.platform}-prospects.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $("resetBtn").addEventListener("click", () => {
    $("genForm").reset();
    $("countVal").textContent = $("count").value;
    $("results").classList.remove("show");
    $("csvBtn").disabled = true;
    showMsg("", "");
    LAST = null;
  });
});
