import { createHash, randomBytes } from "node:crypto";
import { API_URL, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, SCOPE } from "./config.js";

const PENDING_TTL_MS = 10 * 60 * 1000;
const REFRESH_MARGIN_MS = 60 * 1000;

const pending = new Map(); // state -> { verifier, createdAt }
let tokens = null; // { accessToken, refreshToken, expiresAt, scope }
let refreshing = null;

export class AuthorizationError extends Error {}

export const isConnected = () => tokens !== null;
export const grantedScope = () => tokens?.scope;

/** The URL that starts an install: a fresh PKCE verifier and state for each attempt. */
export function authorizationUrl() {
  const now = Date.now();
  for (const [state, attempt] of pending) {
    if (now - attempt.createdAt > PENDING_TTL_MS) pending.delete(state);
  }
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(16).toString("base64url");
  pending.set(state, { verifier, createdAt: now });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return `${API_URL}/oauth/authorize?${params}`;
}

/** Handle the redirect back from Postscript: check state, then trade the code for tokens. */
export async function completeAuthorization(params) {
  const state = params.get("state");
  const attempt = pending.get(state);
  pending.delete(state);
  if (params.get("error")) throw new AuthorizationError(`Authorization failed: ${params.get("error")}`);
  if (!attempt) throw new AuthorizationError("Authorization state didn't match; start over from Connect");
  await requestTokens({
    grant_type: "authorization_code",
    code: params.get("code"),
    redirect_uri: REDIRECT_URI,
    code_verifier: attempt.verifier,
  });
}

/** A current access token, refreshed first when it is about to expire. */
export async function accessToken() {
  if (Date.now() > tokens.expiresAt - REFRESH_MARGIN_MS) await refresh();
  return tokens.accessToken;
}

/** Concurrent callers share one refresh: refresh tokens rotate, so a second request would fail. */
export function refresh() {
  refreshing ??= requestTokens({ grant_type: "refresh_token", refresh_token: tokens.refreshToken })
    .catch((err) => {
      tokens = null;
      throw err;
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

async function requestTokens(grant) {
  const res = await fetch(`${API_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...grant, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  const body = await res.json();
  if (!res.ok) throw new AuthorizationError(`Token request failed: ${body.error ?? res.status}`);
  // Store the new refresh token: the previous one stops working once this response arrives.
  tokens = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    scope: body.scope,
  };
}
