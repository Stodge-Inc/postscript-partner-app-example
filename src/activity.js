const LIMIT = 20;
const SECRET_KEYS = new Set(["client_secret", "access_token", "refresh_token", "token", "code", "code_verifier"]);

const entries = []; // newest first

export const recent = () => entries;

/** Start an entry for a request the user made; the caller fills in status and response. */
export function record(method, path, request) {
  const entry = { at: new Date(), method, path, request: format(request) };
  entries.unshift(entry);
  entries.length = Math.min(entries.length, LIMIT);
  return entry;
}

/** Pretty-print a body for display, masking any credential-shaped field. */
export function format(body) {
  if (body === undefined) return undefined;
  const mask = (key, value) => (SECRET_KEYS.has(key) && typeof value === "string" ? "•••" : value);
  return typeof body === "string" ? body : JSON.stringify(body, mask, 2);
}
