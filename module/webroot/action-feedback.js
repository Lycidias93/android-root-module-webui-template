(() => {
  "use strict";

  const originalFetch = globalThis.fetch.bind(globalThis);
  let lastActionResult = null;
  let renderQueued = false;

  function endpoint(input) {
    try {
      const raw = typeof input === "string" ? input : input?.url || "";
      return new URL(raw, globalThis.location?.href || "http://127.0.0.1/").pathname;
    } catch (_) {
      return "";
    }
  }

  function methodOf(input, options) {
    return String(options?.method || input?.method || "GET").toUpperCase();
  }

  function actionName(options) {
    const body = options?.body;
    if (typeof body !== "string") return "action";
    try {
      const value = JSON.parse(body);
      return typeof value?.name === "string" && value.name ? value.name : "action";
    } catch (_) {
      return "action";
    }
  }

  function compactActionName(value) {
    return String(value || "action")
      .replaceAll("-", " ")
      .replace(/\b\w/g, match => match.toUpperCase());
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    globalThis.requestAnimationFrame?.(() => {
      renderQueued = false;
      syncSurface();
    });
  }

  function ensureResultPanel() {
    const actionsPanel = document.querySelector("#actionsPanel");
    const summary = document.querySelector("#actionStateSummary");
    if (!actionsPanel || !summary) return null;
    let panel = document.querySelector("#actionFeedbackPanel");
    if (panel) return panel;

    panel = document.createElement("article");
    panel.id = "actionFeedbackPanel";
    panel.className = "action-card hidden";
    panel.setAttribute("aria-live", "polite");

    const header = document.createElement("header");
    const headingWrap = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = "Latest action result";
    const subline = document.createElement("p");
    subline.className = "muted";
    subline.dataset.actionFeedbackSummary = "1";
    headingWrap.append(heading, subline);
    const badge = document.createElement("span");
    badge.className = "badge muted";
    badge.dataset.actionFeedbackBadge = "1";
    header.append(headingWrap, badge);

    const output = document.createElement("pre");
    output.className = "job-output";
    output.dataset.actionFeedbackOutput = "1";
    output.textContent = "No action has run in this browser session.";
    panel.append(header, output);
    summary.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function renderResult() {
    const panel = ensureResultPanel();
    if (!panel || !lastActionResult) return;
    const summary = panel.querySelector("[data-action-feedback-summary]");
    const badge = panel.querySelector("[data-action-feedback-badge]");
    const output = panel.querySelector("[data-action-feedback-output]");
    const failed = lastActionResult.ok === false;
    panel.classList.remove("hidden");
    panel.classList.toggle("unavailable-state", failed);
    summary.textContent = `${compactActionName(lastActionResult.name)} · ${failed ? "failed" : "completed"}`;
    badge.textContent = failed ? "FAILED" : "DONE";
    badge.className = `badge ${failed ? "danger" : "good"}`;
    output.textContent = lastActionResult.message || (failed ? "Action failed without adapter output." : "Action completed without adapter output.");
  }

  function syncActionLabels() {
    document.querySelectorAll("#actionCards .action-card").forEach(card => {
      if (card.querySelector(".preview-toggle")) return;
      const button = card.querySelector(".action-controls > button");
      if (!button || !button.classList.contains("good")) return;
      const label = card.querySelector("h3")?.textContent?.trim() || "action";
      if (button.textContent !== "Run check") button.textContent = "Run check";
      button.setAttribute("aria-label", `Run check: ${label}`);
    });
  }

  function syncDynamicTabs() {
    const tablist = document.querySelector(".tabs");
    if (!tablist) return;
    tablist.setAttribute("role", "tablist");
    tablist.querySelectorAll(".tab").forEach(button => {
      const panelId = button.dataset.panel;
      button.setAttribute("role", "tab");
      if (panelId) button.setAttribute("aria-controls", panelId);
      button.setAttribute("aria-selected", button.classList.contains("active") ? "true" : "false");
      button.tabIndex = button.classList.contains("active") ? 0 : -1;
      if (panelId) document.getElementById(panelId)?.setAttribute("role", "tabpanel");
    });
  }

  function syncSurface() {
    syncActionLabels();
    syncDynamicTabs();
    renderResult();
  }

  globalThis.fetch = async function actionFeedbackFetch(input, options = {}) {
    const response = await originalFetch(input, options);
    if (methodOf(input, options) !== "POST" || endpoint(input) !== "/api/v1/action") return response;

    const name = actionName(options);
    let payload = null;
    try {
      payload = await response.clone().json();
    } catch (_) {
      if (!response.ok) {
        lastActionResult = { name, ok: false, message: `${response.status} ${response.statusText}` };
        queueRender();
      }
      return response;
    }

    const message = typeof payload?.message === "string"
      ? payload.message
      : typeof payload?.error === "string" ? payload.error : "";
    lastActionResult = { name, ok: response.ok && payload?.ok !== false, message };
    queueRender();

    if (!response.ok) return response;

    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json; charset=utf-8");
    if (payload?.ok === false) {
      return new Response(JSON.stringify({ ok: false, error: "Action failed. Details are shown in Actions." }), {
        status: 422,
        statusText: "Unprocessable Entity",
        headers,
      });
    }

    const summarized = {
      ...payload,
      message: `${compactActionName(name)} completed. Output is shown in Actions.`,
    };
    return new Response(JSON.stringify(summarized), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };

  const observer = new MutationObserver(queueRender);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener("DOMContentLoaded", syncSurface, { once: true });
  queueRender();
})();
