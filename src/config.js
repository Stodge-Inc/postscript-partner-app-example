const trimSlash = (url) => url.replace(/\/+$/, "");

export const PORT = 3000;
export const REDIRECT_URI = `http://localhost:${PORT}/callback`;
export const SCOPE = "write:customers";

export const CLIENT_ID = process.env.POSTSCRIPT_CLIENT_ID;
export const CLIENT_SECRET = process.env.POSTSCRIPT_CLIENT_SECRET;
export const API_URL = trimSlash(process.env.POSTSCRIPT_API_URL || "https://api.pscrpt.com");
export const DASHBOARD_URL = trimSlash(process.env.POSTSCRIPT_DASHBOARD_URL || "https://app.pscrpt.com");
