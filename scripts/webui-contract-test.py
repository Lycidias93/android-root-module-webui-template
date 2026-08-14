#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
failures = []


class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.lang = ""
        self.ids = set()
        self.inline_scripts = 0
        self.inline_styles = 0
        self.scripts = []
        self.links = []
        self.features = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.lang = attrs.get("lang", "")
        if "id" in attrs:
            self.ids.add(attrs["id"])
        if "data-feature" in attrs:
            self.features.add(attrs["data-feature"])
        if tag == "script":
            source = attrs.get("src")
            if source:
                self.scripts.append(source)
            else:
                self.inline_scripts += 1
        if tag == "style":
            self.inline_styles += 1
        if tag == "link":
            self.links.append(attrs.get("href", ""))


html = (ROOT / "module/webroot/index.html").read_text(encoding="utf-8")
parser = Parser()
parser.feed(html)

expected_ids = {
    "moduleName", "moduleVersion", "connectionBadge", "notice", "statusCards",
    "statusDetails", "configForm", "dirtyBadge", "saveConfigButton",
    "actionCards", "jobLaunchers", "jobList", "inventoryLaunchers",
    "inventoryOutput", "logFilter", "logOutput", "safetyCards",
}
missing = expected_ids - parser.ids
if missing:
    failures.append(f"missing_ids={sorted(missing)}")
if parser.lang != "en":
    failures.append(f"lang={parser.lang}")
if parser.inline_scripts:
    failures.append("inline_script")
if parser.inline_styles:
    failures.append("inline_style")
if parser.scripts != ["app.js", "/v03.js"]:
    failures.append(f"scripts={parser.scripts}")
if "app.css" not in parser.links:
    failures.append("app_css_missing")
if 'aria-live="polite"' not in html:
    failures.append("aria_live_missing")
if parser.features != {"config", "actions", "jobs", "inventory", "logs"}:
    failures.append(f"features={sorted(parser.features)}")

javascript = (ROOT / "module/webroot/app.js").read_text(encoding="utf-8")
for endpoint in (
    "/api/v1/capabilities", "/api/v1/status", "/api/v1/config",
    "/api/v1/action", "/api/v1/jobs", "/api/v1/inventory", "/api/v1/log",
):
    if endpoint not in javascript:
        failures.append(f"endpoint={endpoint}")
for guard in (
    'credentials: "same-origin"',
    'headers.set("X-WebUI-Request", "1")',
    'cache: "no-store"',
    'function applyFeatureVisibility()',
    'Array.isArray(status.summary)',
    'scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })',
    'function configuredState(definition)',
    'Configured · leave blank to preserve.',
    'function syncRunState()',
):
    if guard not in javascript:
        failures.append(f"guard={guard}")

v03 = (ROOT / "module/webroot/v03.js").read_text(encoding="utf-8")
for endpoint in (
    "/api/v1/v03/capabilities", "/api/v1/v03/collection",
    "/api/v1/v03/import", "/api/v1/v03/import/apply", "/api/v1/v03/export",
):
    if endpoint not in v03:
        failures.append(f"v03_endpoint={endpoint}")
for guard in (
    'headers.set("X-WebUI-Request", "1")',
    'credentials: "same-origin"',
    'cache: "no-store"',
    'Preview changes',
    'Apply reviewed changes',
    'Validate & preview',
    'Apply reviewed import',
    'definition.max_bytes',
    'function resultSummary(value)',
    'function syncApplyState()',
    'function syncImportApply()',
    'New record added.',
    'recordCount',
    'aria-live',
):
    if guard not in v03:
        failures.append(f"v03_guard={guard}")

for label, source in (("app", javascript), ("v03", v03)):
    for forbidden in (
        "ksu.exec", "apatch.exec", "magisk.exec", "webui.exec", "Android.exec",
        "eval(", "new Function", "innerHTML =", "insertAdjacentHTML",
    ):
        if forbidden in source:
            failures.append(f"{label}_forbidden={forbidden}")

action = (ROOT / "module/action.sh").read_text(encoding="utf-8")
for required in ("-token-file", "/data/local/tmp/", "/bootstrap?token=", "-self-test"):
    if required not in action:
        failures.append(f"action_contract={required}")
if ' -token "$TOKEN"' in action or " -token " in action:
    failures.append("token_in_argv")

control = (ROOT / "module/bin/module-control").read_text(encoding="utf-8")
for operation in ("capabilities)", "config-apply)", "action-file)", "job-run)", "inventory)"):
    if operation not in control:
        failures.append(f"control_operation={operation}")

server_v03 = (ROOT / "server/cmd/webui-server/v03.go").read_text(encoding="utf-8")
for required in (
    'v03CapabilitySchema = "root-module-webui.extensions.v1"',
    'maxV03UploadBytes',
    'requireV03JSONMutation',
    'requireV03UploadMutation',
    'matching unexpired preview required',
    'file outside private upload directory',
    'credential_material',
):
    if required not in server_v03:
        failures.append(f"v03_server_guard={required}")

if failures:
    print("FAIL: webui_contract=" + ",".join(failures))
    sys.exit(1)
print("RESULT: WEBUI_CONTRACT_TEST_PASS")
