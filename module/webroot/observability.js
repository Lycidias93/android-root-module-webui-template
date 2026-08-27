(() => {
  "use strict";

  const CORE_VERSION = "0.6.2";
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
    Object.keys(value).slice(0, MAX_SNAPSHOT_KEYS).forEach(key => {
      output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitize(value[key], depth + 1);
    });
    return output;
  }

  function sanitizeStatus(value) {
    if (!value || typeof value !== "object") return null;
    return sanitize({
      module: value.module,
      summary: value.summary,
      runtime: value.runtime,
      safety: value.safety,
      action_state: value.action_state,
    });
  }

  function sanitizeJobs(value) {
    const jobs = Array.isArray(value?.data) ? value.data : Array.isArray(value) ? value : [];
    return jobs.slice(0, 50).map(job => sanitize({
      id: job?.id,
      name: job?.name,
      status: job?.status,
      created_at: job?.created_at,
      started_at: job?.started_at,
      finished_at: job?.finished_at,
      exit_code: job?.exit_code,
      error: job?.error,
      stdout_bytes: job?.stdout_bytes,
      stderr_bytes: job?.stderr_bytes,
      truncated: job?.truncated,
      duration_seconds: job?.duration_seconds,
    }));
  }

  function canonicalPath(input) {
    try {
      const raw = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      const url = new URL(raw, window.location.href);
      return url.origin === window.location.origin ? url.pathname : "external";
    } catch {
      return "unknown";
    }
  }

  function methodFor(input, options) {
    if (options?.method) return String(options.method).toUpperCase();
    if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
    return "GET";
  }

  function snapshotFor(path, payload) {
    if (path === "/api/v1/status") snapshots.set("status", sanitizeStatus(payload));
    if (path === "/api/v1/jobs") snapshots.set("jobs", sanitizeJobs(payload));
    if (path === "/api/v1/capabilities") snapshots.set("capabilities", sanitize(payload));
  }

  function appendOperation(operation) {
    operations.push(operation);
    if (operations.length > MAX_OPERATIONS) operations.splice(0, operations.length - MAX_OPERATIONS);
    renderTimeline();
  }

  window.fetch = async function observedFetch(input, options = {}) {
    const path = canonicalPath(input);
    const method = methodFor(input, options);
    const started = performance.now();
    const operation = {
      at: new Date().toISOString(),
      method,
      path,
      state: "running",
      status: null,
      duration_ms: 0,
    };
    appendOperation(operation);
    try {
      const response = await nativeFetch(input, options);
      operation.status = response.status;
      operation.state = response.ok ? "success" : "failed";
      operation.duration_ms = Math.round(performance.now() - started);
      if (response.ok && method === "GET" && path.startsWith(API_PREFIX)) {
        try {
          const clone = response.clone();
          if ((clone.headers.get("content-type") || "").includes("application/json")) {
            snapshotFor(path, await clone.json());
          }
        } catch {
          // Observability is best effort and must not affect the request.
        }
      }
      renderTimeline();
      renderDiagnostics();
      return response;
    } catch (error) {
      operation.state = "network-error";
      operation.duration_ms = Math.round(performance.now() - started);
      operation.error = safeText(error instanceof Error ? error.message : error);
      renderTimeline();
      throw error;
    }
  };

  function dirtyCount() {
    return [...dirtyScopes.values()].filter(Boolean).length;
  }

  function syncDirtyUI() {
    if (!ui) return;
    const count = dirtyCount();
    ui.dirty.hidden = count === 0;
    ui.dirty.textContent = count ? `${count} unsaved area${count === 1 ? "" : "s"}` : "";
  }

  function setDirty(scope, dirty) {
    dirtyScopes.set(scope, Boolean(dirty));
    syncDirtyUI();
  }

  function wireDirtyScope(root, scope, savedSignals = []) {
    if (!root) return;
    const mark = event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) {
        setDirty(scope, true);
      }
    };
    root.addEventListener("input", mark, true);
    root.addEventListener("change", mark, true);
    savedSignals.forEach(signal => document.addEventListener(signal, () => setDirty(scope, false)));
  }

  function renderTimeline() {
    if (!ui?.timeline) return;
    const rows = operations.slice(-30).reverse().map(operation => {
      const row = document.createElement("tr");
      [operation.at, operation.method, operation.path, operation.state, operation.status ?? "—", `${operation.duration_ms} ms`].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.append(cell);
      });
      return row;
    });
    ui.timeline.replaceChildren(...rows);
  }

  function diagnosticsPayload() {
    return {
      schema: "root-module-webui.browser-diagnostics.v1",
      core_version: CORE_VERSION,
      generated_at: new Date().toISOString(),
      location: { origin: window.location.origin, path: window.location.pathname },
      dirty_scopes: [...dirtyScopes.entries()].filter(([, value]) => value).map(([key]) => key),
      operations: operations.slice(-50).map(item => sanitize(item)),
      snapshots: Object.fromEntries([...snapshots.entries()].map(([key, value]) => [key, sanitize(value)])),
    };
  }

  function renderDiagnostics() {
    if (!ui?.diagnostics) return;
    ui.diagnostics.textContent = JSON.stringify(diagnosticsPayload(), null, 2);
  }

  function buildUI() {
    const shell = document.querySelector("main.shell");
    const nav = document.querySelector("nav.tabs");
    if (!shell || !nav || document.querySelector("#observabilityPanel")) return;

    const dirty = document.createElement("button");
    dirty.id = "globalDirtyButton";
    dirty.type = "button";
    dirty.className = "badge caution global-dirty";
    dirty.hidden = true;
    dirty.addEventListener("click", () => {
      const first = [...dirtyScopes.entries()].find(([, value]) => value)?.[0];
      const tab = first ? document.querySelector(`.tab[data-panel="${CSS.escape(first)}"]`) : null;
      tab?.click();
    });
    document.querySelector("header.hero")?.append(dirty);

    const tab = document.createElement("button");
    tab.className = "tab";
    tab.dataset.panel = "observabilityPanel";
    tab.textContent = "Diagnostics";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.tabIndex = -1;
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(item => {
        item.classList.remove("active");
        item.setAttribute("aria-selected", "false");
        item.tabIndex = -1;
      });
      document.querySelectorAll(".tab-panel").forEach(item => item.classList.remove("active"));
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      tab.tabIndex = 0;
      document.querySelector("#observabilityPanel")?.classList.add("active");
      renderTimeline();
      renderDiagnostics();
    });
    nav.append(tab);

    const panel = document.createElement("section");
    panel.id = "observabilityPanel";
    panel.className = "panel tab-panel";
    panel.setAttribute("role", "tabpanel");

    const heading = document.createElement("div");
    heading.className = "panel-heading";
    const headingText = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = "Diagnostics";
    const subtitle = document.createElement("p");
    subtitle.textContent = "Bounded browser-session operation metadata and safe API snapshots.";
    headingText.append(title, subtitle);
    heading.append(headingText);

    const timelineWrap = document.createElement("div");
    timelineWrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "inventory-table";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Time", "Method", "Path", "Result", "HTTP", "Duration"].forEach(label => {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.append(th);
    });
    head.append(headRow);
    const timeline = document.createElement("tbody");
    table.append(head, timeline);
    timelineWrap.append(table);

    const actions = document.createElement("div");
    actions.className = "actions-row compact";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy diagnostics";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(diagnosticsPayload(), null, 2));
        copy.textContent = "Copied";
        window.setTimeout(() => { copy.textContent = "Copy diagnostics"; }, 1200);
      } catch {
        copy.textContent = "Copy failed";
        window.setTimeout(() => { copy.textContent = "Copy diagnostics"; }, 1600);
      }
    });
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear timeline";
    clear.addEventListener("click", () => {
      operations.splice(0, operations.length);
      renderTimeline();
      renderDiagnostics();
    });
    const discard = document.createElement("button");
    discard.type = "button";
    discard.textContent = "Discard local drafts";
    discard.addEventListener("click", () => {
      suppressBeforeUnload = true;
      window.location.reload();
    });
    actions.append(copy, clear, discard);

    const diagnostics = document.createElement("pre");
    diagnostics.className = "log-output diagnostics-output";
    diagnostics.textContent = "Diagnostics not loaded.";
    panel.append(heading, actions, timelineWrap, diagnostics);
    shell.append(panel);

    ui = { dirty, timeline, diagnostics };
    syncDirtyUI();
    renderTimeline();
    renderDiagnostics();
  }

  buildUI();
  wireDirtyScope(document.querySelector("#configForm"), "settingsPanel", ["webui:settings-saved"]);
  wireDirtyScope(document.querySelector("#profilesPanel"), "profilesPanel", ["webui:profiles-saved"]);
  wireDirtyScope(document.querySelector("#backupPanel"), "backupPanel", ["webui:import-applied"]);

  document.addEventListener("webui:dirty", event => {
    if (event.detail?.scope) setDirty(event.detail.scope, event.detail.dirty !== false);
  });
  document.addEventListener("webui:saved", event => {
    if (event.detail?.scope) setDirty(event.detail.scope, false);
  });

  window.addEventListener("beforeunload", event => {
    if (!suppressBeforeUnload && dirtyCount()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
})();
