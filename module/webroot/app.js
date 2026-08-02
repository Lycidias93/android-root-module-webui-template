const state = {
  token: "",
  config: null,
  dirty: false,
};

const elements = {
  connectionBadge: document.querySelector("#connectionBadge"),
  moduleName: document.querySelector("#moduleName"),
  moduleVersion: document.querySelector("#moduleVersion"),
  configForm: document.querySelector("#configForm"),
  enabled: document.querySelector("#enabled"),
  mode: document.querySelector("#mode"),
  logLevel: document.querySelector("#logLevel"),
  intervalSeconds: document.querySelector("#intervalSeconds"),
  dirtyBadge: document.querySelector("#dirtyBadge"),
  logOutput: document.querySelector("#logOutput"),
  fatalPanel: document.querySelector("#fatalPanel"),
  fatalMessage: document.querySelector("#fatalMessage"),
  toast: document.querySelector("#toast"),
};

function loadToken() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const fromHash = hash.get("token");
  if (fromHash) {
    sessionStorage.setItem("webuiToken", fromHash);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
  state.token = sessionStorage.getItem("webuiToken") || "";
  if (!/^[a-f0-9]{32,128}$/i.test(state.token)) {
    throw new Error("Missing or invalid session token. Reopen the WebUI from the module action button.");
  }
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("X-WebUI-Token", state.token);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    cache: "no-store",
    credentials: "omit",
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      // Keep the HTTP status text.
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

function setConnected(connected) {
  elements.connectionBadge.textContent = connected ? "Local · connected" : "Disconnected";
  elements.connectionBadge.classList.toggle("badge-ok", connected);
  elements.connectionBadge.classList.toggle("badge-warn", !connected);
}

function setDirty(dirty) {
  state.dirty = dirty;
  elements.dirtyBadge.classList.toggle("hidden", !dirty);
}

function renderConfig(config) {
  state.config = structuredClone(config);
  elements.enabled.checked = config.enabled;
  elements.mode.value = config.mode;
  elements.logLevel.value = config.log_level;
  elements.intervalSeconds.value = config.interval_seconds;
  setDirty(false);
}

function readConfigForm() {
  return {
    enabled: elements.enabled.checked,
    mode: elements.mode.value,
    log_level: elements.logLevel.value,
    interval_seconds: Number(elements.intervalSeconds.value),
  };
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.add("hidden"), 2600);
}

function showFatal(error) {
  setConnected(false);
  elements.fatalMessage.textContent = error instanceof Error ? error.message : String(error);
  elements.fatalPanel.classList.remove("hidden");
}

async function refreshAll() {
  const status = await api("/api/v1/status");
  setConnected(true);
  elements.moduleName.textContent = status.module_id;
  elements.moduleVersion.textContent = `${status.module_version} · loopback-only session`;
  renderConfig(status.config);
  await loadLog();
}

async function saveConfig(event) {
  event.preventDefault();
  const config = readConfigForm();
  await api("/api/v1/config", {
    method: "POST",
    body: JSON.stringify(config),
  });
  renderConfig(config);
  showToast("Settings saved");
}

async function runAction(name, successMessage) {
  await api("/api/v1/action", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  showToast(successMessage);
  await refreshAll();
}

async function loadLog() {
  const log = await api("/api/v1/log?lines=200");
  elements.logOutput.textContent = log || "Log is empty.";
}

function wireEvents() {
  elements.configForm.addEventListener("submit", (event) => {
    saveConfig(event).catch(showFatal);
  });
  elements.configForm.addEventListener("input", () => setDirty(true));

  document.querySelector("#refreshButton").addEventListener("click", () => refreshAll().catch(showFatal));
  document.querySelector("#reloadLogButton").addEventListener("click", () => loadLog().catch(showFatal));
  document.querySelector("#applyButton").addEventListener("click", () => {
    runAction("apply", "Apply action completed").catch(showFatal);
  });
  document.querySelector("#rotateLogButton").addEventListener("click", () => {
    runAction("rotate-log", "Log rotated").catch(showFatal);
  });
  document.querySelector("#resetButton").addEventListener("click", () => {
    runAction("reset-config", "Defaults restored").catch(showFatal);
  });
}

async function main() {
  loadToken();
  wireEvents();
  await refreshAll();
}

main().catch(showFatal);
