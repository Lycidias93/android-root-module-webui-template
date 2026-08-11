(() => {
  "use strict";

  const state = { extensions: null, collection: new Map(), imports: new Map() };
  const $ = selector => document.querySelector(selector);

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

  async function apiJSON(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      headers.set("X-WebUI-Request", "1");
    }
    const response = await fetch(path, { ...options, headers, credentials: "same-origin", cache: "no-store" });
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const value = await response.json();
        message = value.error || message;
      } catch {
        // Keep HTTP status.
      }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function apiUpload(path, file) {
    const headers = new Headers();
    headers.set("Content-Type", file.type || "application/octet-stream");
    headers.set("X-WebUI-Request", "1");
    const response = await fetch(path, { method: "POST", body: file, headers, credentials: "same-origin", cache: "no-store" });
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const value = await response.json();
        message = value.error || message;
      } catch {
        // Keep HTTP status.
      }
      throw new Error(message);
    }
    return response.json();
  }

  function activateTab(button) {
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    $(`#${button.dataset.panel}`)?.classList.add("active");
  }

  function addTab(id, label, heading, description) {
    const tabs = $(".tabs");
    const shell = $(".shell");
    const safety = $("#safetyPanel");
    const button = element("button", { className: "tab", text: label, type: "button" });
    button.dataset.panel = id;
    button.addEventListener("click", () => activateTab(button));
    tabs.append(button);
    const panel = element("section", { className: "panel tab-panel", attributes: { id } }, [
      element("div", { className: "panel-heading" }, [
        element("div", {}, [element("h2", { text: heading }), element("p", { text: description })]),
      ]),
    ]);
    shell.insertBefore(panel, safety || null);
    return panel;
  }

  function fieldInput(definition, value) {
    let input;
    if (definition.type === "boolean") {
      input = element("input", { type: "checkbox", checked: Boolean(value) });
    } else if (definition.type === "enum") {
      input = element("select");
      (definition.options || []).forEach(option => input.append(element("option", {
        value: option.value,
        text: option.label,
        selected: option.value === value,
      })));
    } else {
      input = element("input", {
        type: definition.secret ? "password" : definition.type === "integer" ? "number" : "text",
        value: value ?? "",
      });
      if (definition.min !== undefined) input.min = definition.min;
      if (definition.max !== undefined) input.max = definition.max;
      if (definition.max_length) input.maxLength = definition.max_length;
      if (definition.pattern) input.pattern = definition.pattern;
    }
    input.dataset.fieldKey = definition.key;
    input.dataset.fieldType = definition.type;
    return element("label", { className: "field" }, [
      element("span", { text: definition.label }),
      input,
      element("small", { text: definition.description || "" }),
    ]);
  }

  function recordFromCard(card, definition) {
    const record = {};
    definition.fields.forEach(field => {
      const input = card.querySelector(`[data-field-key="${CSS.escape(field.key)}"]`);
      if (!input) return;
      if (field.type === "boolean") record[field.key] = input.checked;
      else if (field.type === "integer") record[field.key] = Number(input.value);
      else record[field.key] = input.value;
    });
    return record;
  }

  function defaultRecord(definition) {
    const record = {};
    definition.fields.forEach(field => {
      if (field.type === "boolean") record[field.key] = false;
      else if (field.type === "integer") record[field.key] = field.min ?? 0;
      else if (field.type === "enum") record[field.key] = field.options?.[0]?.value || "";
      else record[field.key] = "";
    });
    return record;
  }

  function renderResult(target, value) {
    target.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }

  async function renderCollection(panel, definition) {
    panel.replaceChildren(
      element("div", { className: "panel-heading" }, [
        element("div", {}, [element("h2", { text: definition.label }), element("p", { text: definition.description || "Typed collection editor" })]),
      ])
    );
    const toolbar = element("div", { className: "actions-row" });
    const recordsRoot = element("div", { className: "stack" });
    const previewOutput = element("pre", { className: "job-output", text: "No preview yet." });
    const confirmation = element("input", {
      type: "text",
      placeholder: definition.requires_confirmation ? `Type ${definition.confirmation_text}` : "",
    });
    const addButton = element("button", { type: "button", text: "Add record" });
    const reloadButton = element("button", { type: "button", text: "Reload" });
    const previewButton = element("button", { type: "button", className: "caution", text: "Preview changes" });
    const applyButton = element("button", { type: "button", className: definition.risk === "danger" ? "danger" : "primary", text: "Apply reviewed changes", disabled: true });

    function renderRecords(records) {
      recordsRoot.replaceChildren(...records.map((record, index) => {
        const remove = element("button", { type: "button", className: "danger", text: "Remove" });
        const card = element("article", { className: "action-card" }, [
          element("header", {}, [
            element("div", {}, [element("h3", { text: String(record[definition.identity_key] || `Record ${index + 1}`) })]),
            remove,
          ]),
          element("div", { className: "form-grid" }, definition.fields.map(field => fieldInput(field, record[field.key]))),
        ]);
        remove.addEventListener("click", () => {
          card.remove();
          const current = state.collection.get(definition.name) || {};
          current.previewToken = "";
          state.collection.set(definition.name, current);
          applyButton.disabled = true;
        });
        card.querySelectorAll("input,select").forEach(input => input.addEventListener("input", () => {
          const current = state.collection.get(definition.name) || {};
          current.previewToken = "";
          state.collection.set(definition.name, current);
          applyButton.disabled = true;
        }));
        return card;
      }));
    }

    function currentRecords() {
      return [...recordsRoot.querySelectorAll(".action-card")].map(card => recordFromCard(card, definition));
    }

    async function reload() {
      const response = await apiJSON(`/api/v1/v03/collection?name=${encodeURIComponent(definition.name)}`);
      const records = Array.isArray(response.records) ? response.records : Array.isArray(response.items) ? response.items : [];
      state.collection.set(definition.name, { records, previewToken: "" });
      renderRecords(records);
      applyButton.disabled = true;
      renderResult(previewOutput, { ok: true, message: "Loaded current collection.", records: records.length });
    }

    addButton.addEventListener("click", () => {
      const records = currentRecords();
      if (records.length >= definition.max_records) {
        renderResult(previewOutput, { ok: false, error: "Maximum record count reached." });
        return;
      }
      records.push(defaultRecord(definition));
      renderRecords(records);
      applyButton.disabled = true;
    });
    reloadButton.addEventListener("click", () => reload().catch(error => renderResult(previewOutput, { ok: false, error: error.message })));
    previewButton.addEventListener("click", async () => {
      previewButton.disabled = true;
      try {
        const response = await apiJSON("/api/v1/v03/collection", {
          method: "POST",
          body: JSON.stringify({ name: definition.name, mode: "preview", records: currentRecords() }),
        });
        state.collection.set(definition.name, { records: currentRecords(), previewToken: response.preview_token });
        applyButton.disabled = false;
        renderResult(previewOutput, response.result || response);
      } catch (error) {
        applyButton.disabled = true;
        renderResult(previewOutput, { ok: false, error: error.message });
      } finally {
        previewButton.disabled = false;
      }
    });
    applyButton.addEventListener("click", async () => {
      const current = state.collection.get(definition.name) || {};
      if (!current.previewToken) return;
      applyButton.disabled = true;
      try {
        const response = await apiJSON("/api/v1/v03/collection", {
          method: "POST",
          body: JSON.stringify({
            name: definition.name,
            mode: "apply",
            records: currentRecords(),
            preview_token: current.previewToken,
            confirmation: definition.requires_confirmation ? confirmation.value : "",
          }),
        });
        renderResult(previewOutput, response);
        await reload();
      } catch (error) {
        renderResult(previewOutput, { ok: false, error: error.message });
      }
    });

    toolbar.append(reloadButton, addButton, previewButton);
    panel.append(toolbar, recordsRoot);
    if (definition.requires_confirmation) panel.append(element("label", { className: "field" }, [
      element("span", { text: "Apply confirmation" }), confirmation,
      element("small", { text: `Exact text required: ${definition.confirmation_text}` }),
    ]));
    panel.append(element("div", { className: "actions-row" }, [applyButton]), previewOutput);
    await reload();
  }

  function renderCollections(definitions) {
    if (!definitions.length) return;
    const panel = addTab("v03CollectionsPanel", "Profiles", "Profiles", "Typed collections with preview-before-apply transactions.");
    const select = element("select");
    definitions.forEach(definition => select.append(element("option", { value: definition.name, text: definition.label })));
    const selector = element("label", { className: "field" }, [element("span", { text: "Collection" }), select]);
    const editor = element("div", { className: "stack" });
    panel.append(selector, editor);
    async function renderSelected() {
      const definition = definitions.find(item => item.name === select.value);
      if (!definition) return;
      editor.replaceChildren(element("p", { className: "muted", text: "Loading…" }));
      try {
        await renderCollection(editor, definition);
      } catch (error) {
        editor.replaceChildren(element("pre", { className: "job-output", text: error.message }));
      }
    }
    select.addEventListener("change", renderSelected);
    renderSelected();
  }

  function filenameFromDisposition(response, fallback) {
    const disposition = response.headers.get("content-disposition") || "";
    const match = /filename="([^"\\/]+)"/.exec(disposition);
    return match ? match[1] : fallback;
  }

  function renderTransfer(imports, exports) {
    if (!imports.length && !exports.length) return;
    const panel = addTab("v03TransferPanel", "Backup", "Import / Export", "Schema-bound exports and preview-first imports staged only in the private WebUI runtime.");

    if (exports.length) {
      panel.append(element("h3", { text: "Exports" }));
      const exportRoot = element("div", { className: "cards" });
      exports.forEach(definition => {
        const confirmation = element("input", { type: "text", placeholder: definition.requires_confirmation ? `Type ${definition.confirmation_text}` : "" });
        const output = element("pre", { className: "job-output", text: `Policy: ${definition.secret_policy}` });
        const button = element("button", { type: "button", className: definition.risk === "danger" ? "danger" : "primary", text: definition.label });
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const response = await fetch("/api/v1/v03/export", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-WebUI-Request": "1" },
              credentials: "same-origin",
              cache: "no-store",
              body: JSON.stringify({ name: definition.name, confirmation: definition.requires_confirmation ? confirmation.value : "" }),
            });
            if (!response.ok) {
              let message = `${response.status} ${response.statusText}`;
              try { message = (await response.json()).error || message; } catch { /* keep status */ }
              throw new Error(message);
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = element("a", { href: url, download: filenameFromDisposition(response, `${definition.name}.${definition.format}`) });
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            renderResult(output, { ok: true, bytes: blob.size, policy: response.headers.get("x-webui-export-policy") || definition.secret_policy });
          } catch (error) {
            renderResult(output, { ok: false, error: error.message });
          } finally {
            button.disabled = false;
          }
        });
        const card = element("article", { className: "card" }, [
          element("h3", { text: definition.label }),
          element("p", { className: "muted", text: definition.description || "" }),
        ]);
        if (definition.requires_confirmation) card.append(element("label", { className: "field" }, [element("span", { text: "Confirmation" }), confirmation]));
        card.append(element("div", { className: "actions-row" }, [button]), output);
        exportRoot.append(card);
      });
      panel.append(exportRoot);
    }

    if (imports.length) {
      panel.append(element("h3", { text: "Imports" }));
      const importRoot = element("div", { className: "stack" });
      imports.forEach(definition => {
        const file = element("input", { type: "file" });
        const confirmation = element("input", { type: "text", placeholder: definition.requires_confirmation ? `Type ${definition.confirmation_text}` : "" });
        const preview = element("button", { type: "button", className: "caution", text: "Validate & preview" });
        const apply = element("button", { type: "button", className: definition.risk === "danger" ? "danger" : "primary", text: "Apply reviewed import", disabled: true });
        const output = element("pre", { className: "job-output", text: "No import preview yet." });

        preview.addEventListener("click", async () => {
          const selected = file.files?.[0];
          if (!selected) {
            renderResult(output, { ok: false, error: "Choose a file first." });
            return;
          }
          if (selected.size > definition.max_bytes) {
            renderResult(output, { ok: false, error: `File exceeds ${definition.max_bytes} byte limit.` });
            return;
          }
          preview.disabled = true;
          apply.disabled = true;
          try {
            const response = await apiUpload(`/api/v1/v03/import?name=${encodeURIComponent(definition.name)}`, selected);
            state.imports.set(definition.name, { previewToken: response.preview_token });
            apply.disabled = false;
            renderResult(output, { sha256: response.sha256, bytes: response.bytes, preview: response.result });
          } catch (error) {
            state.imports.delete(definition.name);
            renderResult(output, { ok: false, error: error.message });
          } finally {
            preview.disabled = false;
          }
        });

        apply.addEventListener("click", async () => {
          const current = state.imports.get(definition.name);
          if (!current?.previewToken) return;
          apply.disabled = true;
          try {
            const response = await apiJSON("/api/v1/v03/import/apply", {
              method: "POST",
              body: JSON.stringify({
                name: definition.name,
                preview_token: current.previewToken,
                confirmation: definition.requires_confirmation ? confirmation.value : "",
              }),
            });
            state.imports.delete(definition.name);
            renderResult(output, response);
          } catch (error) {
            renderResult(output, { ok: false, error: error.message });
            apply.disabled = false;
          }
        });

        const card = element("article", { className: "action-card" }, [
          element("header", {}, [
            element("div", {}, [element("h3", { text: definition.label }), element("p", { className: "muted", text: definition.description || "" })]),
            element("span", { className: `badge ${definition.risk === "danger" ? "danger" : definition.risk === "caution" ? "caution" : "good"}`, text: definition.risk }),
          ]),
          element("label", { className: "field" }, [element("span", { text: `File · max ${definition.max_bytes} bytes` }), file]),
        ]);
        if (definition.requires_confirmation) card.append(element("label", { className: "field" }, [
          element("span", { text: "Apply confirmation" }), confirmation,
          element("small", { text: `Exact text required: ${definition.confirmation_text}` }),
        ]));
        card.append(element("div", { className: "actions-row" }, [preview, apply]), output);
        importRoot.append(card);
      });
      panel.append(importRoot);
    }
  }

  async function initialize() {
    let response;
    try {
      response = await apiJSON("/api/v1/v03/capabilities");
    } catch (error) {
      if (error.status === 404) return;
      console.warn("WebUI v0.3 extension unavailable", error);
      return;
    }
    state.extensions = response.extensions;
    const features = state.extensions?.features || {};
    if (features.collections) renderCollections(state.extensions.collections || []);
    if (features.transfer) renderTransfer(state.extensions.imports || [], state.extensions.exports || []);
  }

  initialize();
})();
