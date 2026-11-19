import { ACTIONS } from "./actions.js";

const escape = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function page({ connected, scope, account, notice, form, errors = {}, entries }) {
  const body = connected ? connectedBody({ account, form, errors }) : connectBody();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Postscript sample app</title>
<link rel="stylesheet" href="/styles.css">
<script>document.documentElement.classList.add("js")</script>
</head>
<body>
<main>
  <header>
    <h1>Postscript sample app</h1>
    ${connected ? `<span class="pill on">Connected · ${escape(scope)}</span>` : `<span class="pill">Not connected</span>`}
  </header>
  ${notice ? `<p class="notice" role="alert">${escape(notice)}</p>` : ""}
  ${body}
  <section class="activity">
    <h2>Recent activity</h2>
    <ol id="log">${activityHtml(entries)}</ol>
  </section>
</main>
<script src="/app.js" type="module"></script>
</body>
</html>`;
}

function connectBody() {
  return `<p class="muted">Connect a Postscript test store to try the API.</p>
  <a class="btn" href="/connect">Connect</a>`;
}

function connectedBody({ account, form, errors }) {
  const ids = Object.keys(ACTIONS);
  const tabs = ids
    .map((id) => `<button type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-controls="panel-${id}">${ACTIONS[id].label}</button>`)
    .join("");
  const panels = ids.map((id) => actionPanel(id, form, errors[id])).join("");
  return `<p class="muted">${account ? `Store: ${escape(account.name)}` : ""}</p>
  <div class="tabs" role="tablist" aria-label="API calls">${tabs}</div>
  ${panels}`;
}

function actionPanel(id, form, error) {
  const { label, fields } = ACTIONS[id];
  const inputs = [{ name: "email", label: "Email" }, ...fields].map((field) => fieldHtml(field, form[field.name])).join("");
  return `<section class="panel" role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}">
  <h2 class="panel-title">${label}</h2>
  <form method="post" action="/actions/${id}" data-action>
    ${inputs}
    <button>${label}</button>
    <p class="form-error" role="alert">${error ? escape(error) : ""}</p>
  </form>
</section>`;
}

function fieldHtml({ name, label, json }, value) {
  if (!json) return `<label>${label}<input name="${name}" value="${escape(value)}" autocomplete="off"></label>`;
  const rows = Math.max(3, value.split("\n").length);
  return `<label>${label}<textarea name="${name}" rows="${rows}" spellcheck="false">${escape(value)}</textarea>
    <span class="field-error" role="alert"></span></label>`;
}

export function activityHtml(entries) {
  if (!entries.length) return `<li class="muted">No requests yet.</li>`;
  return entries.map(entryHtml).join("");
}

function entryHtml(entry) {
  const time = entry.at.toLocaleTimeString("en-US", { hour12: false });
  const link = entry.link
    ? `<a class="link" href="${escape(entry.link)}" target="_blank" rel="noopener">View profile in Postscript ↗</a>`
    : "";
  const details = (label, text) => (text ? `<details><summary>${label}</summary><pre>${escape(text)}</pre></details>` : "");
  return `<li>
  <div class="row"><time>${time}</time><code>${escape(entry.method)} ${escape(entry.path)}</code>${statusBadge(entry.status)}${link}</div>
  ${details("Request", entry.request)}${details("Response", entry.response)}
</li>`;
}

function statusBadge(status) {
  if (typeof status !== "number") return `<span class="code neutral">${escape(status ?? "…")}</span>`;
  return `<span class="code ${status >= 200 && status < 300 ? "ok" : "err"}">${status}</span>`;
}
