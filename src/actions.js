import * as postscript from "./postscript.js";

/** A form value the user must fix; shown next to the form and never sent to the API. */
export class InputError extends Error {}

export const DEFAULTS = {
  email: "jane@example.com",
  type: "order.completed",
  properties: JSON.stringify({ order_id: "1001", total_price: 139.97, currency: "USD" }, null, 2),
  first_name: "Jane",
  attributes: JSON.stringify({ loyalty_tier: "gold" }, null, 2),
};

/**
 * The three API calls the app demonstrates. `request` turns form fields into an API call;
 * `profileId` finds the profile the call touched, for the dashboard link.
 */
export const ACTIONS = {
  "send-event": {
    label: "Send event",
    fields: [
      { name: "type", label: "Type" },
      { name: "properties", label: "Properties (JSON)", json: true },
    ],
    request: (form) => ({
      method: "POST",
      path: "/v1/events",
      body: {
        type: required(form, "type", "Type"),
        identifier: { type: "email", value: required(form, "email", "Email") },
        properties: jsonObject(form, "properties", "Properties"),
      },
    }),
    profileId: (form) => postscript.profileIdByEmail(form.email.trim()),
  },
  "upsert-profile": {
    label: "Upsert profile",
    fields: [
      { name: "first_name", label: "First name" },
      { name: "attributes", label: "Attributes (JSON)", json: true },
    ],
    request: (form) => {
      const firstName = (form.first_name ?? "").trim();
      return {
        method: "POST",
        path: "/v1/profiles/upsert",
        body: {
          identifiers: [{ type: "email", value: required(form, "email", "Email") }],
          attributes: { ...(firstName && { first_name: firstName }), ...jsonObject(form, "attributes", "Attributes") },
        },
      };
    },
    profileId: (_form, response) => response.data.id,
  },
  "lookup-profile": {
    label: "Look up profile",
    fields: [],
    request: (form) => ({
      method: "GET",
      path: `/v1/profiles/lookup?${new URLSearchParams({ email: required(form, "email", "Email") })}`,
    }),
    profileId: (_form, response) => response.data.id,
  },
};

/** Run an action and attach a dashboard link to its activity entry when it succeeds. */
export async function run(id, form, account) {
  const action = ACTIONS[id];
  const { method, path, body } = action.request(form);
  const { ok, data, entry } = await postscript.request(method, path, body);
  if (!ok) return;
  const profileId = await action.profileId(form, data);
  if (profileId) entry.link = postscript.dashboardProfileUrl(profileId, account?.id);
}

function required(form, name, label) {
  const value = (form[name] ?? "").trim();
  if (!value) throw new InputError(`${label} is required`);
  return value;
}

function jsonObject(form, name, label) {
  let value;
  try {
    value = JSON.parse(form[name] || "{}");
  } catch (err) {
    throw new InputError(`${label} is not valid JSON: ${err.message}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError(`${label} must be a JSON object`);
  }
  return value;
}
