(() => {
  "use strict";

  const CORE_VERSION = "0.6.0";
  const MAX_OPERATIONS = 200;
  const MAX_SNAPSHOT_DEPTH = 6;
  const MAX_SNAPSHOT_ITEMS = 50;
  const MAX_SNAPSHOT_KEYS = 100;
  const MAX_SNAPSHOT_STRING = 500;
  const SENSITIVE_KEY = /(?:pass(?:word|phrase)?|secret|token|credential|cookie|authorization|auth|private[_-]?key|api[_-]?key|key[_-]?material)/i;
  const API_PREFIX = "/api/v1/";

  const nativeFetch = window.fetch.bind(window);
  const operations = [];
  const snapshots = new Map();
  const dirtyScopes = new Map();
  let ui = null;
  let suppressBeforeUnload = false;

  function safeText(value, limit = 160) {
    const text = String(value ?? "");
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
  }

  function sanitize(value, depth = 0) {
    if (depth > MAX_SNAPSHOT_DEPTH) return "[depth-limit]";
    if (value === null || value === undefined) return value ?? null;
    if (["boolean", "number"].includes(typeof value)) return value;
    if (typeof value === "string") return safeText(value, MAX_SNAPSHOT_STRING);
    if (Array.isArray(value)) return value.slice(0, MAX_SNAPSHOT_ITEMS).map(item => sanitize(item, depth + 1));
    if (typeof value !== "object") return safeText(value, MAX_SNAPSHOT_STRING);

    const output = {};
    Object.entries(value).slice(0, MAX_SNAPSHOT_KEYS).forEach(([key, item]) => {
      output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitize(item, depth + 1);
    });
    return output;
  }

  function sanitizeStatus(value) {
    if (!value || typeof value !== "object") return {};
    return sanitize({
      module: value.module,
      summary: value.summary,
      runtime: value.runtime,
      action_state: value.action_state,
      safety: value.safety,
    });
  }

  function sanitizeJobs(value) {
    const source = Array.isArray(value?.data) ? value.data : Array.isArray(value) ? value : [];
    return source.slice(0, MAX_SNAPSHOT_ITEMS).map(job => sanitize({
      id: job?.id,
      name: job?.name,
      status: job?.status,
      stdout_bytes: job?.stdout_bytes,
      stderr_bytes: job?.stderr_bytes,
      duration_seconds: job?.duration_seconds,
      truncated: job?.truncated,
    }));
  }

  function endpoint(input) {
    try {
      const raw = typeof input === "string" ? input : input?.url;
      return new URL(raw, window.location.href);
    } catch {
      return null;
    }
  }

  function requestMethod(input, init) {
    return String(init?.method || input?.method || "GET").toUpperCase();
  }

  function collectionMode(body) {
    if (typeof body !== "string") return "";
    const match = /"mode"\s*:\s*"(preview|apply)"/.exec(body.slice(0, 2048));
    return match?.[1] || "";
  }

  function operationName(path, method, body) {
    if (!path.startsWith(API_PREFIX)) return "";
    if (path === "/api/v1/capabilities" && method === "GET") return "capabilities.read";
    if (path === "/api/v1/status" && method === "GET") return "status.refresh";
    if (path === "/api/v1/config" && method === "GET") return "config.read";
    if (path === "/api/v1/config" && method === "POST") return "config.apply";
    if (path === "/api/v1/action" && method === "POST") return "action.run";
    if (path === "/api/v1/jobs" && method === "GET") return "jobs.list";
    if (path === "/api/v1/jobs" && method === "POST") return "job.start";
    if (/^\/api\/v1\/jobs\/[^/]+\/output$/.test(path) && method === "GET") return "job.output";
    if (/^\/api\/v1\/jobs\/[^/]+$/.test(path) && method === "GET") return "job.status";
    if (path === "/api/v1/inventory" && method === "GET") return "inventory.read";
    if (path === "/api/v1/log" && method === "GET") return "log.read";
    if (path === "/api/v1/v03/capabilities" && method === "GET") return "v03.capabilities.read";
    if (path === "/api/v1/v03/collection" && method === "GET") return "collection.read";
    if (path === "/api/v1/v03/collection" && method === "POST") {
      const mode = collectionMode(body);
      return mode ? `collection.${mode}` : "collection.change";
    }
    if (path === "/api/v1/v03/import" && method === "POST") return "import.preview";
    if (path === "/api/v1/v03/import/apply" && method === "POST") return "import.apply";
    if (path === "/api/v1/v03/export" && method === "POST") return "export.generate";
    if (path === "/api/v1/v04/capabilities" && method === "GET") return "v04.capabilities.read";
    if (path === "/api/v1/v04/reference" && method === "GET") return "reference.read";
    if (path === "/api/v1/v04/jobs" && method === "POST") return "workflow.start";
    if (path === "/api/v1/v04/inventory-operation" && method === "POST") return "inventory.operation";
    return `${method.toLowerCase()} ${path}`;
  }

  function recordOperation({ name, path, method, status, durationMs, error }) {
    if (!name) return;
    operations.push({
      at: new Date().toISOString(),
      operation: safeText(name),
      method,
      path: safeText(path),
      status: safeText(status),
      duration_ms: Math.max(0, Math.round(durationMs)),
      error: error ? safeText(error, 240) : "",
    });
    if (operations.length > MAX_OPERATIONS) operations.splice(0, operations.length - MAX_OPERATIONS);
    renderDiagnostics();
  }

  function snapshotKey(path, method) {
    if (method !== "GET") return "";
    if (path === "/api/v1/capabilities") return "base_capabilities";
    if (path === "/api/v1/status") return "status";
    if (path === "/api/v1/jobs") return "jobs";
    if (path === "/api/v1/v03/capabilities") return "v03_capabilities";
    if (path === "/api/v1/v04/capabilities") return "v04_capabilities";
    return "";
  }

  async function captureSnapshot(response, path, method) {
    const key = snapshotKey(path, method);
    if (!key || !response.ok) return;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return;
    try {
      const value = await response.json();
      const safe = key === "status" ? sanitizeStatus(value) : key === "jobs" ? sanitizeJobs(value) : sanitize(value);
      snapshots.set(key, safe);
      renderDiagnostics();
    } catch {
      // Diagnostics must never affect the productive request path.
    }
  }

  function clearDirty(scope) {
    if (!scope || !dirtyScopes.has(scope)) return;
    dirtyScopes.delete(scope);
    renderDirty();
  }

  function markDirty(scope, label, panel) {
    if (!scope) return;
    dirtyScopes.set(scope, { scope, label, panel });
    renderDirty();
  }

  function handleSuccessfulRequest(path, method) {
    if (path === "/api/v1/config" && (method === "GET" || method === "POST")) clearDirty("settings");
    if (path === "/api/v1/v03/collection" && method === "GET") clearDirty("profiles");
    if (path === "/api/v1/v03/import/apply" && method === "POST") clearDirty("import");
  }

  window.fetch = async function observedFetch(input, init = {}) {
    const url = endpoint(input);
    const method = requestMethod(input, init);
    const path = url?.pathname || "";
    const name = operationName(path, method, init?.body);
    const started = performance.now();
    try {
      const response = await nativeFetch(input, init);
      const durationMs = performance.now() - started;
      recordOperation({
        name,
        path,
        method,
        status: response.ok ? `success:${response.status}` : `failed:${response.status}`,
        durationMs,
      });
      if (response.ok) handleSuccessfulRequest(path, method);
      void captureSnapshot(response.clone(), path, method);
      return response;
    } catch (error) {
      recordOperation({
        name,
        path,
        method,
        status: "network-error",
        durationMs: performance.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  function element(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(options).forEach(([key, value]) => {
      if (key === "className") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "attributes") Object.entries(value).forEach(([name, item]) => node.setAttribute(name, item));
      else node[key] = value;
    });
    children.forEach(child => node.append(child));
    return node;
  }

  function activatePanel(panelID) {
    const button = document.querySelector(`.tab[data-panel="${CSS.escape(panelID)}"]`);
    if (!button || button.hidden) return false;
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(panelID)?.classList.add("active");
    button.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
    return true;
  }

  function reviewFirstDirty() {
    const first = dirtyScopes.values().next().value;
    if (first?.panel && activatePanel(first.panel)) return;
    activatePanel("diagnosticsPanel");
  }

  function diagnosticsPayload() {
    return {
      core_version: CORE_VERSION,
      dirty_areas: [...dirtyScopes.values()].map(item => ({ scope: item.scope, label: item.label })),
      operations: operations.slice(),
      state: Object.fromEntries(snapshots.entries()),
    };
  }

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnosticsPayload(), null, 2));
      ui.copyButton.textContent = "Copied";
      window.setTimeout(() => { if (ui) ui.copyButton.textContent = "Copy diagnostics"; }, 1400);
    } catch {
      ui.copyButton.textContent = "Copy denied";
      window.setTimeout(() => { if (ui) ui.copyButton.textContent = "Copy diagnostics"; }, 1400);
    }
  }

  function clearTimeline() {
    operations.length = 0;
    renderDiagnostics();
  }

  function renderDirty() {
    if (!ui) return;
    const entries = [...dirtyScopes.values()];
    ui.dirtyBar.hidden = entries.length === 0;
    ui.dirtyText.textContent = entries.length
      ? `${entries.length} unsaved ${entries.length === 1 ? "area" : "areas"} · ${entries.map(item => item.label).join(", ")}`
      : "No unsaved changes";
    ui.dirtyCard.textContent = entries.length ? `${entries.length}` : "0";
  }

  function operationCard(entry) {
    const head = element("div", { className: "core-operation-head" }, [
      element("strong", { text: entry.operation }),
      element("span", { className: `badge ${entry.status.startsWith("success") ? "good" : "danger"}`, text: entry.status }),
    ]);
    const meta = element("div", { className: "core-operation-meta" }, [
      element("span", { text: `${entry.method} ${entry.path}` }),
      element("span", { text: `${entry.duration_ms} ms` }),
      element("span", { text: entry.at }),
    ]);
    const card = element("article", { className: "core-operation-entry" }, [head, meta]);
    if (entry.error) card.append(element("div", { className: "core-operation-error", text: entry.error }));
    return card;
  }

  function renderDiagnostics() {
    if (!ui) return;
    ui.coreCard.textContent = CORE_VERSION;
    ui.operationCountCard.textContent = String(operations.length);
    ui.operationList.replaceChildren(...(operations.length
      ? operations.slice().reverse().map(operationCard)
      : [element("p", { className: "muted", text: "No typed API operations recorded in this browser session yet." })]));
    ui.rawState.textContent = JSON.stringify(Object.fromEntries(snapshots.entries()), null, 2) || "{}";
  }

  function installUI() {
    if (document.getElementById("diagnosticsPanel")) return;
    const tabs = document.querySelector(".tabs");
    const shell = document.querySelector(".shell");
    const safetyPanel = document.getElementById("safetyPanel");
    if (!tabs || !shell) return;

    const diagnosticsTab = element("button", { className: "tab", type: "button", text: "Diagnostics" });
    diagnosticsTab.dataset.panel = "diagnosticsPanel";
    diagnosticsTab.addEventListener("click", () => activatePanel("diagnosticsPanel"));
    const safetyTab = tabs.querySelector('[data-panel="safetyPanel"]');
    tabs.insertBefore(diagnosticsTab, safetyTab || null);

    const coreCard = element("div", { className: "value", text: CORE_VERSION });
    const dirtyCard = element("div", { className: "value", text: "0" });
    const operationCountCard = element("div", { className: "value", text: "0" });
    const cards = element("div", { className: "cards" }, [
      element("div", { className: "card" }, [element("div", { className: "label", text: "Core version" }), coreCard]),
      element("div", { className: "card" }, [element("div", { className: "label", text: "Unsaved areas" }), dirtyCard]),
      element("div", { className: "card" }, [element("div", { className: "label", text: "Session operations" }), operationCountCard]),
    ]);

    const copyButton = element("button", { type: "button", text: "Copy diagnostics" });
    const clearButton = element("button", { type: "button", text: "Clear timeline" });
    copyButton.addEventListener("click", copyDiagnostics);
    clearButton.addEventListener("click", clearTimeline);

    const operationList = element("div", { className: "stack core-operation-list" });
    const rawState = element("pre", { className: "job-output core-raw-state", text: "{}" });
    const diagnosticsPanel = element("section", { className: "panel tab-panel", attributes: { id: "diagnosticsPanel" } }, [
      element("div", { className: "panel-heading" }, [
        element("div", {}, [
          element("h2", { text: "Diagnostics" }),
          element("p", { text: "Session-local typed operation metadata and allowlisted, redacted API state. Request bodies, shell commands and job output are not recorded here." }),
        ]),
        element("div", { className: "actions-row compact" }, [copyButton, clearButton]),
      ]),
      cards,
      element("h3", { className: "core-section-title", text: "Operation timeline" }),
      operationList,
      element("h3", { className: "core-section-title", text: "Safe raw API state" }),
      rawState,
    ]);
    shell.insertBefore(diagnosticsPanel, safetyPanel || null);

    const dirtyText = element("span", { text: "No unsaved changes" });
    const reviewButton = element("button", { type: "button", text: "Review" });
    const discardButton = element("button", { type: "button", className: "danger", text: "Discard local" });
    reviewButton.addEventListener("click", reviewFirstDirty);
    discardButton.addEventListener("click", () => {
      suppressBeforeUnload = true;
      window.location.reload();
    });
    const dirtyBar = element("aside", {
      className: "core-dirty-bar",
      attributes: { id: "coreDirtyBar", "aria-live": "polite" },
    }, [
      dirtyText,
      element("div", { className: "actions-row compact" }, [reviewButton, discardButton]),
    ]);
    dirtyBar.hidden = true;
    document.body.append(dirtyBar);

    ui = { diagnosticsTab, diagnosticsPanel, coreCard, dirtyCard, operationCountCard, operationList, rawState, copyButton, clearButton, dirtyBar, dirtyText };
    renderDirty();
    renderDiagnostics();
  }

  document.addEventListener("input", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("#configForm")) markDirty("settings", "Settings", "settingsPanel");
    if (target.matches("#v03CollectionsPanel [data-field-key]")) markDirty("profiles", "Profiles", "v03CollectionsPanel");
  }, true);

  document.addEventListener("change", event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type === "file" && target.closest("#v03TransferPanel")) markDirty("import", "Import", "v03TransferPanel");
  }, true);

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("#v03CollectionsPanel button");
    const label = button?.textContent?.trim();
    if (label === "Add record" || label === "Remove") markDirty("profiles", "Profiles", "v03CollectionsPanel");
  }, true);

  window.addEventListener("beforeunload", event => {
    if (suppressBeforeUnload || !dirtyScopes.size) return;
    event.preventDefault();
    event.returnValue = "";
  });

  window.WebUICoreObservability = Object.freeze({
    version: CORE_VERSION,
    markDirty,
    clearDirty,
    diagnostics: () => sanitize(diagnosticsPayload()),
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installUI, { once: true });
  else installUI();
})();
