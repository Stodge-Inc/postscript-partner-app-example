import * as activity from "./activity.js";
import { API_URL, DASHBOARD_URL } from "./config.js";
import * as oauth from "./oauth.js";

/**
 * Call the Postscript API with the connected store's access token. A 401 refreshes the
 * token and retries once. Logged calls return their activity entry.
 */
export async function request(method, path, body, { logged = true } = {}) {
  const entry = logged ? activity.record(method, path, body) : null;
  try {
    let res = await send(method, path, body);
    if (res.status === 401) {
      await oauth.refresh();
      res = await send(method, path, body);
    }
    const data = parseBody(await res.text());
    if (entry) Object.assign(entry, { status: res.status, response: activity.format(data ?? "") });
    return { ok: res.ok, status: res.status, data, entry };
  } catch (err) {
    if (entry) Object.assign(entry, { status: "error", response: String(err.cause ?? err.message) });
    throw err;
  }
}

function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function send(method, path, body) {
  const headers = { Authorization: `Bearer ${await oauth.accessToken()}` };
  if (body) headers["Content-Type"] = "application/json";
  return fetch(`${API_URL}${path}`, { method, headers, body: body && JSON.stringify(body) });
}

/** The connected store's name and account ID. */
export async function account() {
  const { ok, status, data } = await request("GET", "/v1/me", undefined, { logged: false });
  if (!ok) throw new Error(`GET /v1/me returned ${status}`);
  return { name: data.data.name, id: data.data.id };
}

export async function profileIdByEmail(email) {
  const path = `/v1/profiles/lookup?${new URLSearchParams({ email })}`;
  const { ok, data } = await request("GET", path, undefined, { logged: false });
  return ok ? data.data.id : null;
}

/** A dashboard link that switches to the store (swro) and opens the profile's events. */
export function dashboardProfileUrl(profileId, accountId) {
  const params = new URLSearchParams({ selected: profileId, tab: "events" });
  if (accountId) params.set("swro", accountId);
  return `${DASHBOARD_URL}/profiles?${params}`;
}
