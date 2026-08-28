#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
js = (ROOT / "module/webroot/observability.js").read_text(encoding="utf-8")
app = (ROOT / "module/webroot/app.js").read_text(encoding="utf-8")

required = [
    'globalThis.fetch = async function actionFeedbackFetch',
    'endpoint(input) !== "/api/v1/action"',
    'body.slice(0, 2048)',
    'actionFeedbackPanel',
    'Latest action result',
    'output.className = "job-output"',
    'button.textContent !== "Run check"',
    'Action failed. Details are shown in Actions.',
    'completed. Output is shown in Actions.',
]
for needle in required:
    assert needle in js, f"missing action feedback contract marker: {needle}"

for forbidden in ["JSON.parse(body)", "innerHTML", "insertAdjacentHTML", "eval(", "new Function"]:
    assert forbidden not in js, f"forbidden action feedback pattern: {forbidden}"

# The legacy base renderer still calls showNotice(result.message). The wrapper
# must therefore replace long semantic action output with a bounded short status
# before app.js receives it.
assert 'showNotice(result.message || `${definition.label} completed.`);' in app
assert 'message: `${compactActionName(name)} completed. Output is shown in Actions.`' in js
assert 'new Response(JSON.stringify(summarized)' in js

print("RESULT: WEBUI_ACTION_FEEDBACK_STATIC_PASS")
