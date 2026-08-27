(() => {
  "use strict";

  const STORAGE_KEY = "root-module-webui.action-output.v1";
  const MAX_ENTRIES = 8;
  const MAX_MESSAGE_CHARS = 32768;
  const panel = document.querySelector("#actionsPanel");
  const stateSummary = document.querySelector("#actionStateSummary");
  const actionCards = document.querySelector("#actionCards");
  if (!panel || !stateSummary || !actionCards) return;

  const resultCard = document.createElement("section");
  resultCard.className = "card action-result-card";
  resultCard.setAttribute("aria-label", "Action result history");

  const heading = document.createElement("div");
  heading.className = "panel-heading";
  const headingText = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = "Latest action result";
  const subtitle = document.createElement("p");
  subtitle.className = "muted";
  subtitle.textContent = "Results stay visible in this browser tab until you clear them.";
  headingText.append(title, subtitle);

  const controls = document.createElement("div");
  controls.className = "actions-row compact";
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Copy";
  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.textContent = "Clear";
  controls.append(copyButton, clearButton);
  heading.append(headingText, controls);

  const output = document.createElement("pre");
  output.className = "log-output";
  output.setAttribute("aria-live", "polite");
  output.textContent = "No action run yet.";
  resultCard.append(heading, output);
  stateSummary.insertAdjacentElement("afterend", resultCard);

  function readEntries() {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.filter(item => item && typeof item === "object").slice(-MAX_ENTRIES) : [];
    } catch {
      return [];
    }
  }

  let entries = readEntries();

  function renderEntries() {
    if (!entries.length) {
      output.textContent = "No action run yet.";
      return;
    }
    output.textContent = entries.map(entry => {
      const prefix = `[${entry.time}] ${entry.name || "action"} · ${entry.status}`;
      return `${prefix}\n${entry.message || "(no output)"}`;
    }).join("\n\n---\n\n");
    output.scrollTop = output.scrollHeight;
  }

  function persistEntries() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Persistence is best-effort; the visible result remains available.
    }
  }

  function appendEntry(entry) {
    const raw = String(entry.message || "(no output)");
    const message = raw.length > MAX_MESSAGE_CHARS
      ? `${raw.slice(0, MAX_MESSAGE_CHARS)}\n… output truncated by browser history guard …`
      : raw;
    entries.push({
      time: new Date().toLocaleTimeString(),
      name: entry.name || "action",
      status: entry.status || "completed",
      message,
    });
    entries = entries.slice(-MAX_ENTRIES);
    persistEntries();
    renderEntries();
  }

  function requestActionName(options) {
    try {
      const body = typeof options?.body === "string" ? JSON.parse(options.body) : null;
      return typeof body?.name === "string" ? body.name : "action";
    } catch {
      return "action";
    }
  }

  function requestMethod(input, options) {
    if (options?.method) return String(options.method).toUpperCase();
    if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
    return "GET";
  }

  function requestURL(input) {
    try {
      const raw = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      return new URL(raw, window.location.href);
    } catch {
      return null;
    }
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = requestURL(input);
    const isAction = url?.pathname === "/api/v1/action" && requestMethod(input, options) === "POST";
    let response;
    try {
      response = await nativeFetch(input, options);
    } catch (error) {
      if (isAction) {
        appendEntry({
          name: requestActionName(options),
          status: "network error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }

    if (!isAction) return response;

    let payload = null;
    let text = "";
    try {
      const clone = response.clone();
      const contentType = clone.headers.get("content-type") || "";
      if (contentType.includes("application/json")) payload = await clone.json();
      else text = await clone.text();
    } catch {
      // Keep the HTTP status if the response body cannot be decoded.
    }

    const message = payload?.message || payload?.error || text || `${response.status} ${response.statusText}`;
    appendEntry({
      name: requestActionName(options),
      status: response.ok ? "completed" : `failed · HTTP ${response.status}`,
      message,
    });
    return response;
  };

  function normalizeSafeActionButtons() {
    actionCards.querySelectorAll("button.good").forEach(button => {
      if (!["Apply change", "Reapply current setting"].includes(button.textContent.trim())) return;
      button.textContent = "Run check";
      const aria = button.getAttribute("aria-label") || "";
      button.setAttribute("aria-label", aria.replace(/^(Apply change|Reapply current setting):/, "Run check:"));
    });
  }

  const buttonObserver = new MutationObserver(normalizeSafeActionButtons);
  buttonObserver.observe(actionCards, { childList: true, subtree: true, characterData: true });
  normalizeSafeActionButtons();

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(output.textContent);
      copyButton.textContent = "Copied";
      window.setTimeout(() => { copyButton.textContent = "Copy"; }, 1200);
    } catch {
      copyButton.textContent = "Copy failed";
      window.setTimeout(() => { copyButton.textContent = "Copy"; }, 1600);
    }
  });

  clearButton.addEventListener("click", () => {
    entries = [];
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* best effort */ }
    renderEntries();
  });

  renderEntries();
})();
