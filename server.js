import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { ACTIONS, DEFAULTS, run } from "./src/actions.js";
import * as activity from "./src/activity.js";
import { CLIENT_ID, CLIENT_SECRET, PORT } from "./src/config.js";
import * as oauth from "./src/oauth.js";
import * as postscript from "./src/postscript.js";
import { activityHtml, page } from "./src/views.js";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set POSTSCRIPT_CLIENT_ID and POSTSCRIPT_CLIENT_SECRET in .env (see .env.example).");
  process.exit(1);
}

const STATIC_FILES = { "/styles.css": "text/css", "/app.js": "text/javascript" };

let account = null; // the connected store, loaded once authorization completes
let notice = null; // an error to show on the next page load

async function handle(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && STATIC_FILES[url.pathname]) return serveStatic(res, url.pathname);
  if (req.method === "GET" && url.pathname === "/") return render(res, 200);
  if (req.method === "GET" && url.pathname === "/connect") return redirect(res, oauth.authorizationUrl());
  if (req.method === "GET" && url.pathname === "/callback") return callback(res, url.searchParams);

  const actionId = url.pathname.match(/^\/actions\/([a-z-]+)$/)?.[1];
  if (req.method === "POST" && ACTIONS[actionId]) return action(req, res, actionId);

  send(res, 404, "Not found", "text/plain");
}

async function callback(res, params) {
  try {
    await oauth.completeAuthorization(params);
    account = await postscript.account();
  } catch (err) {
    notice = err.message;
  }
  redirect(res, "/");
}

// The browser script asks for JSON and swaps in the new activity log; a plain form post gets the full page.
async function action(req, res, id) {
  const form = { ...DEFAULTS, ...(await readForm(req)) };
  const wantsJson = req.headers.accept?.includes("application/json");
  let error = null;
  if (oauth.isConnected()) {
    try {
      await run(id, form, account);
    } catch (err) {
      error = err.message;
    }
  }
  if (!oauth.isConnected()) {
    notice = error;
    return wantsJson ? sendJson(res, { reload: true }) : redirect(res, "/");
  }
  if (wantsJson) return sendJson(res, { log: activityHtml(activity.recent()), error });
  render(res, error ? 400 : 200, { form, errors: { [id]: error } });
}

function render(res, status, { form = DEFAULTS, errors } = {}) {
  const html = page({
    connected: oauth.isConnected(),
    scope: oauth.grantedScope(),
    account,
    notice,
    form,
    errors,
    entries: activity.recent(),
  });
  notice = null;
  send(res, status, html, "text/html; charset=utf-8");
}

async function serveStatic(res, path) {
  const file = await readFile(new URL(`./public${path}`, import.meta.url));
  send(res, 200, file, STATIC_FILES[path]);
}

async function readForm(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return Object.fromEntries(new URLSearchParams(body));
}

function send(res, status, body, contentType) {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

const sendJson = (res, value) => send(res, 200, JSON.stringify(value), "application/json");

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

createServer((req, res) =>
  handle(req, res).catch((err) => {
    console.error(err);
    send(res, 500, "Something went wrong; see the server log.", "text/plain");
  }),
).listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
