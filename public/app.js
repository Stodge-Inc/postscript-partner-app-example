// Tabs: one action form visible at a time, kept in the URL hash across reloads.
const tabs = [...document.querySelectorAll('[role="tab"]')];

function selectTab(id, focus = false) {
  for (const tab of tabs) {
    const selected = tab.dataset.tab === id;
    tab.setAttribute("aria-selected", selected);
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(`panel-${tab.dataset.tab}`).classList.toggle("active", selected);
    if (selected && focus) tab.focus();
  }
  history.replaceState(null, "", `#${id}`);
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  tab.addEventListener("keydown", (event) => {
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectTab(tabs[(next + tabs.length) % tabs.length].dataset.tab, true);
  });
});

if (tabs.length) {
  const fromHash = tabs.find((tab) => `#${tab.dataset.tab}` === location.hash);
  selectTab((fromHash ?? tabs[0]).dataset.tab);
}

// Every tab has its own Email field; keep them in step.
const emailInputs = document.querySelectorAll('input[name="email"]');
for (const input of emailInputs) {
  input.addEventListener("input", () => emailInputs.forEach((other) => (other.value = input.value)));
}

// Submit actions in place and refresh the activity log.
for (const form of document.querySelectorAll("form[data-action]")) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!jsonFieldsValid(form)) return;
    const formError = form.querySelector(".form-error");
    const button = form.querySelector("button");
    const label = button.textContent;
    setBusy(true);
    button.textContent = "Working…";
    formError.textContent = "";
    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams(new FormData(form)),
      });
      const data = await res.json();
      if (data.reload) return location.reload();
      document.getElementById("log").innerHTML = data.log;
      formError.textContent = data.error ?? "";
    } catch (err) {
      formError.textContent = `Request failed: ${err.message}`;
    } finally {
      setBusy(false);
      button.textContent = label;
    }
  });
}

function jsonFieldsValid(form) {
  let valid = true;
  for (const area of form.querySelectorAll("textarea")) {
    const error = area.parentElement.querySelector(".field-error");
    error.textContent = "";
    try {
      const value = JSON.parse(area.value);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Must be a JSON object");
    } catch (err) {
      error.textContent = err.message;
      valid = false;
    }
  }
  return valid;
}

function setBusy(busy) {
  document.querySelectorAll("form[data-action] button").forEach((button) => (button.disabled = busy));
}
