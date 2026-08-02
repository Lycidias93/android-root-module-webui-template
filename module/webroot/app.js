(() => {
  "use strict";

  const state = {
    capabilities: null,
    status: null,
    config: null,
    logText: "",
    jobs: [],
    polling: null,
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const ui = {
    moduleName: $("#moduleName"),
    moduleVersion: $("#moduleVersion"),
    connectionBadge: $("#connectionBadge"),
    notice: $("#notice"),
    statusCards: $("#statusCards"),
    statusDetails: $("#statusDetails"),
    configForm: $("#configForm"),
    dirtyBadge: $("#dirtyBadge"),
    saveConfigButton: $("#saveConfigButton"),
    actionCards: $("#actionCards"),
    jobLaunchers: $("#jobLaunchers"),
    jobList: $("#jobList"),
    inventoryLaunchers: $("#inventoryLaunchers"),
    inventoryOutput: $("#inventoryOutput"),
    logFilter: $("#logFilter"),
    logOutput: $("#logOutput"),
    safetyCards: $("#safetyCards"),
  };

  function element(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(options).forEach(([key, value]) => {
      if (key === "className") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key === "attributes") Object.entries(value).forEach(([name, val]) => node.setAttribute(name, val));
      else node[key] = value;
    });
    for (const child of children) node.append(child);
    return node;
  }

  function showNotice(message, level = "good") {
    ui.notice.textContent = message;
    ui.notice.className = `notice ${level}`;
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => ui.notice.classList.add("hidden"), 4500);
  }

  function showFatal(error) {
    ui.connectionBadge.textContent = "disconnected";
    ui.connectionBadge.className = "badge danger";
    showNotice(error instanceof Error ? error.message : String(error), "danger");
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body) {
      headers.set("Content-Type", "application/json");
      headers.set("X-WebUI-Request", "1");
    }
    const response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {
        // Preserve the HTTP status when no JSON error is available.
      }
      throw new Error(message);
    }
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json") ? response.json() : response.text();
  }

  function riskClass(risk) {
    return risk === "danger" ? "danger" : risk === "caution" ? "caution" : "good";
  }

  function card(label, value, level = "") {
    return element("div", { className: "card" }, [
      element("div", { className: "label", text: label }),
      element("div", { className: `value ${level}`, text: value ?? "—" }),
    ]);
  }

  function flattenObject(value, prefix = "") {
    const output = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) return output;
    Object.entries(value).forEach(([key, item]) => {
      const name = prefix ? `${prefix}.${key}` : key;
      if (item && typeof item === "object" && !Array.isArray(item)) output.push(...flattenObject(item, name));
      else output.push([name, Array.isArray(item) ? JSON.stringify(item) : String(item)]);
    });
    return output;
  }

  function wireTabs() {
    $$(".tab").forEach(button => {
      button.addEventListener("click", () => {
        $$(".tab").forEach(item => item.classList.remove("active"));
        $$(".tab-panel").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        $(`#${button.dataset.panel}`).classList.add("active");
      });
    });
  }

  function renderStatus() {
    const status = state.status || {};
    const module = status.module || state.capabilities?.module || {};
    ui.moduleName.textContent = module.name || module.id || "Root Module WebUI";
    ui.moduleVersion.textContent = `${module.version || "unknown"} · standalone browser session`;
    ui.connectionBadge.textContent = "local · connected";
    ui.connectionBadge.className = "badge good";

    const config = status.config || {};
    const summary = [
      ["Module", module.id],
      ["Version", module.version],
      ["Enabled", config.enabled],
      ["Mode", config.mode],
      ["Log level", config.log_level],
      ["Interval", config.interval_seconds ? `${config.interval_seconds}s` : "—"],
    ];
    ui.statusCards.replaceChildren(...summary.map(([label, value]) => card(label, String(value ?? "—"))));

    const details = element("dl", { className: "details-grid" });
    flattenObject(status.runtime || {}).forEach(([key, value]) => {
      details.append(element("dt", { text: key }), element("dd", { text: value }));
    });
    ui.statusDetails.replaceChildren(details);

    const safety = status.safety || {};
    ui.safetyCards.replaceChildren(...Object.entries(safety).map(([key, value]) =>
      card(key.replaceAll("_", " "), value === true ? "PASS" : String(value), value === true ? "good" : "caution")
    ));
  }

  function fieldInput(definition, value) {
    let input;
    if (definition.type === "boolean") {
      input = element("input", { type: "checkbox", checked: Boolean(value), name: definition.key });
      return element("label", { className: "field" }, [
        element("span", { text: definition.label }),
        element("span", { className: "toggle" }, [input, element("small", { text: definition.description || "" })]),
      ]);
    }
    if (definition.type === "enum") {
      input = element("select", { name: definition.key });
      for (const option of definition.options || []) {
        input.append(element("option", { value: option.value, text: option.label, selected: option.value === value }));
      }
    } else {
      input = element("input", {
        name: definition.key,
        type: definition.secret ? "password" : definition.type === "integer" ? "number" : "text",
        value: value ?? "",
      });
      if (definition.min !== undefined) input.min = definition.min;
      if (definition.max !== undefined) input.max = definition.max;
      if (definition.max_length) input.maxLength = definition.max_length;
      if (definition.pattern) input.pattern = definition.pattern;
    }
    return element("label", { className: "field" }, [
      element("span", { text: definition.label }),
      input,
      element("small", { text: definition.description || "" }),
    ]);
  }

  function renderConfig() {
    const fields = state.capabilities?.config_fields || [];
    const features = state.capabilities?.features || {};
    if (!features.config) {
      ui.configForm.replaceChildren(element("p", { className: "muted", text: "This module does not expose settings." }));
      ui.saveConfigButton.disabled = true;
      return;
    }
    ui.configForm.replaceChildren(...fields.map(definition => fieldInput(definition, state.config?.[definition.key])));
    ui.configForm.querySelectorAll("input,select").forEach(input => {
      input.addEventListener("input", () => ui.dirtyBadge.classList.remove("hidden"));
    });
    ui.saveConfigButton.disabled = false;
  }

  function readConfigForm() {
    const config = {};
    for (const definition of state.capabilities?.config_fields || []) {
      const input = ui.configForm.elements.namedItem(definition.key);
      if (!input) continue;
      if (definition.type === "boolean") config[definition.key] = input.checked;
      else if (definition.type === "integer") config[definition.key] = Number(input.value);
      else config[definition.key] = input.value;
    }
    return config;
  }

  async function saveConfig(event) {
    event.preventDefault();
    const response = await api("/api/v1/config", {
      method: "POST",
      body: JSON.stringify(readConfigForm()),
    });
    state.config = response.config || await api("/api/v1/config");
    ui.dirtyBadge.classList.add("hidden");
    renderConfig();
    await refreshStatus();
    showNotice("Settings saved.");
  }

  function renderActions() {
    const actions = state.capabilities?.actions || [];
    if (!actions.length) {
      ui.actionCards.replaceChildren(element("p", { className: "muted", text: "No actions declared." }));
      return;
    }
    ui.actionCards.replaceChildren(...actions.map(definition => {
      const dryRun = element("input", { type: "checkbox", checked: Boolean(definition.supports_dry_run) });
      const confirmation = element("input", {
        type: "text",
        placeholder: definition.requires_confirmation ? `Type ${definition.confirmation_text}` : "",
      });
      const runButton = element("button", {
        type: "button",
        className: riskClass(definition.risk),
        text: definition.label,
      });
      runButton.addEventListener("click", async () => {
        runButton.disabled = true;
        try {
          const result = await api("/api/v1/action", {
            method: "POST",
            body: JSON.stringify({
              name: definition.name,
              dry_run: definition.supports_dry_run ? dryRun.checked : false,
              confirmation: definition.requires_confirmation ? confirmation.value : "",
            }),
          });
          showNotice(result.message || `${definition.label} completed.`);
          await refreshAll();
        } catch (error) {
          showFatal(error);
        } finally {
          runButton.disabled = false;
        }
      });
      const controls = element("div", { className: "action-controls" });
      if (definition.supports_dry_run) {
        controls.append(element("label", { className: "toggle" }, [
          dryRun,
          element("span", { text: "Dry-run" }),
        ]));
      }
      if (definition.requires_confirmation) {
        controls.append(element("label", { className: "field" }, [
          element("span", { text: "Confirmation" }),
          confirmation,
        ]));
      }
      controls.append(runButton);
      return element("article", { className: "action-card" }, [
        element("header", {}, [
          element("div", {}, [
            element("h3", { text: definition.label }),
            element("p", { className: "muted", text: definition.description || "" }),
          ]),
          element("span", { className: `badge ${riskClass(definition.risk)}`, text: definition.risk }),
        ]),
        controls,
      ]);
    }));
  }

  function renderJobLaunchers() {
    const jobs = state.capabilities?.jobs || [];
    if (!jobs.length) {
      ui.jobLaunchers.replaceChildren(element("p", { className: "muted", text: "No background jobs declared." }));
      return;
    }
    ui.jobLaunchers.replaceChildren(...jobs.map(definition => {
      const button = element("button", { type: "button", className: riskClass(definition.risk), text: definition.label });
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await api("/api/v1/jobs", { method: "POST", body: JSON.stringify({ name: definition.name }) });
          showNotice(`${definition.label} started.`);
          await refreshJobs();
          startJobPolling();
        } catch (error) {
          showFatal(error);
        } finally {
          button.disabled = false;
        }
      });
      return element("div", { className: "card" }, [
        element("div", { className: "label", text: definition.risk }),
        element("div", { className: "value", text: definition.label }),
        element("p", { className: "muted", text: definition.description || "" }),
        element("div", { className: "actions-row" }, [button]),
      ]);
    }));
  }

  async function loadJobOutput(job, stream) {
    const response = await api(`/api/v1/jobs/${job.id}/output?stream=${stream}&offset=0&limit=65536`);
    return response.data?.text || "";
  }

  async function renderJobs() {
    const cards = [];
    for (const job of state.jobs) {
      const output = element("pre", { className: "job-output", text: "Output not loaded." });
      const load = element("button", { type: "button", text: "Load output" });
      load.addEventListener("click", async () => {
        load.disabled = true;
        try {
          const stdout = await loadJobOutput(job, "stdout");
          const stderr = await loadJobOutput(job, "stderr");
          output.textContent = `${stdout}${stderr ? `\n--- stderr ---\n${stderr}` : ""}` || "(no output)";
        } catch (error) {
          output.textContent = error.message;
        } finally {
          load.disabled = false;
        }
      });
      cards.push(element("article", { className: "job-card" }, [
        element("header", {}, [
          element("div", {}, [element("h3", { text: job.name }), element("code", { text: job.id })]),
          element("span", { className: `badge ${job.status === "success" ? "good" : job.status === "failed" ? "danger" : "caution"}`, text: job.status }),
        ]),
        element("div", { className: "job-meta" }, [
          element("span", { text: `stdout ${job.stdout_bytes} B` }),
          element("span", { text: `stderr ${job.stderr_bytes} B` }),
          element("span", { text: job.duration_seconds ? `${job.duration_seconds.toFixed(1)}s` : "pending" }),
          element("span", { text: job.truncated ? "output truncated" : "bounded output" }),
        ]),
        element("div", { className: "actions-row" }, [load]),
        output,
      ]));
    }
    ui.jobList.replaceChildren(...cards.length ? cards : [element("p", { className: "muted", text: "No jobs in this WebUI session." })]);
  }

  async function refreshJobs() {
    const response = await api("/api/v1/jobs");
    state.jobs = response.data || [];
    await renderJobs();
    if (!state.jobs.some(job => job.status === "queued" || job.status === "running")) stopJobPolling();
  }

  function startJobPolling() {
    if (state.polling) return;
    state.polling = window.setInterval(() => refreshJobs().catch(showFatal), 1800);
  }

  function stopJobPolling() {
    if (!state.polling) return;
    window.clearInterval(state.polling);
    state.polling = null;
  }

  function renderInventoryLaunchers() {
    const inventories = state.capabilities?.inventories || [];
    if (!inventories.length) {
      ui.inventoryLaunchers.replaceChildren(element("p", { className: "muted", text: "No inventories declared." }));
      return;
    }
    ui.inventoryLaunchers.replaceChildren(...inventories.map(definition => {
      const button = element("button", { type: "button", text: definition.label });
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const response = await api(`/api/v1/inventory?name=${encodeURIComponent(definition.name)}`);
          renderInventory(response);
        } catch (error) {
          showFatal(error);
        } finally {
          button.disabled = false;
        }
      });
      return button;
    }));
  }

  function renderInventory(response) {
    const columns = response.columns || [];
    const items = response.items || [];
    if (!columns.length || !items.length) {
      ui.inventoryOutput.replaceChildren(element("p", { className: "muted", text: "Inventory is empty." }));
      return;
    }
    const table = element("table");
    table.append(element("thead", {}, [element("tr", {}, columns.map(column => element("th", { text: column })))]));
    const body = element("tbody");
    items.forEach(item => body.append(element("tr", {}, columns.map(column => element("td", { text: String(item[column] ?? "") })))));
    table.append(body);
    ui.inventoryOutput.replaceChildren(table);
  }

  function renderLog() {
    const query = ui.logFilter.value.toLowerCase().trim();
    if (!query) {
      ui.logOutput.textContent = state.logText || "Log is empty.";
      return;
    }
    ui.logOutput.textContent = state.logText.split("\n").filter(line => line.toLowerCase().includes(query)).join("\n") || "No matching log lines.";
  }

  async function loadLog() {
    state.logText = await api("/api/v1/log?lines=300");
    renderLog();
  }

  async function refreshStatus() {
    state.status = await api("/api/v1/status");
    renderStatus();
  }

  async function refreshAll() {
    await Promise.all([
      refreshStatus(),
      state.capabilities?.features?.config ? api("/api/v1/config").then(value => { state.config = value; }) : Promise.resolve(),
      state.capabilities?.features?.logs ? loadLog() : Promise.resolve(),
      state.capabilities?.features?.jobs ? refreshJobs() : Promise.resolve(),
    ]);
    renderConfig();
  }

  async function initialize() {
    wireTabs();
    $("#refreshButton").addEventListener("click", () => refreshAll().then(() => showNotice("Refreshed.")).catch(showFatal));
    ui.configForm.addEventListener("submit", event => saveConfig(event).catch(showFatal));
    $("#reloadLogButton").addEventListener("click", () => loadLog().catch(showFatal));
    $("#copyLogButton").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(ui.logOutput.textContent);
        showNotice("Log copied.");
      } catch {
        showNotice("Clipboard access was denied.", "caution");
      }
    });
    ui.logFilter.addEventListener("input", renderLog);

    const capabilityResponse = await api("/api/v1/capabilities");
    state.capabilities = capabilityResponse.capabilities;
    renderActions();
    renderJobLaunchers();
    renderInventoryLaunchers();
    await refreshAll();
    if (state.jobs.some(job => job.status === "queued" || job.status === "running")) startJobPolling();
  }

  initialize().catch(showFatal);
})();
