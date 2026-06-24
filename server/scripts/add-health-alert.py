#!/usr/bin/env python3
"""One-shot transform of n8n-workflow.json: add a conditional health alert.

Hooks off the in-app pipeline once runs finish (the false output of the
"Run still running?" IF). Fetches GET /dashboard/summary, and only pings
Telegram when something is actually wrong:

    Run still running? --(false)--> Fetch daily digest        (existing)
                                +--> Fetch dashboard summary
                                       -> Health needs attention? (IF)
                                            --(true)--> Notify health alert
                                            --(false)--> (nothing; stay silent)

"Wrong" = ollama not ok, database down, model reloads > 0 (memory thrash),
chat/extraction errors, or any source whose last run FAILED or orphaned.
The dashboard's Tier 3 (today's candidates) is intentionally NOT pushed
here — the existing "Summarize in-app digest" node already covers that.
Idempotent: re-running is a no-op once the nodes exist.
"""
import json
import pathlib

WF = pathlib.Path(__file__).resolve().parent.parent / "n8n-workflow.json"
TELEGRAM_CRED = {"telegramApi": {"id": "MOl4hUz3memSul0W", "name": "Telegram account"}}
CHAT_ID = "5651295221"
BASE = "http://express-api:3000"

data = json.loads(WF.read_text())
existing = {n["name"] for n in data["nodes"]}

# Single boolean expression: true when any health signal is bad.
NEEDS_ATTENTION = (
    "={{ (() => {"
    " const h = $json.health || {};"
    " const m = (h.metrics && h.metrics.overall) || {};"
    " const chat = (h.metrics && h.metrics.byKind && h.metrics.byKind.chat) || {};"
    " const srcs = Array.isArray($json.sources) ? $json.sources : [];"
    " const badRun = srcs.some(s => s.lastRun && (s.lastRun.status === 'FAILED' || s.lastRun.orphaned));"
    " return Boolean((h.ollama && h.ollama.ok === false) || (h.database && h.database.ok === false)"
    " || (m.reloads || 0) > 0 || (chat.errors || 0) > 0 || badRun);"
    " })() }}"
)

ALERT_TEXT = (
    "=<b>⚠ Job hunter health alert</b>\n"
    "{{\n"
    "  (() => {\n"
    "    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n"
    "    const h = $json.health || {};\n"
    "    const lines = [];\n"
    "    if (h.database && h.database.ok === false) lines.push('• Database: DOWN');\n"
    "    if (h.ollama && h.ollama.ok === false) lines.push('• Ollama: NOT OK' + (h.ollama.missingRequired && h.ollama.missingRequired.length ? ' (missing: ' + h.ollama.missingRequired.join(', ') + ')' : ''));\n"
    "    const m = (h.metrics && h.metrics.overall) || {};\n"
    "    if ((m.reloads || 0) > 0) lines.push('• Ollama reloads: ' + m.reloads + ' (memory thrash)');\n"
    "    const chat = (h.metrics && h.metrics.byKind && h.metrics.byKind.chat) || {};\n"
    "    if ((chat.errors || 0) > 0) lines.push('• Chat/extraction errors: ' + chat.errors);\n"
    "    const rt = h.runtime || {};\n"
    "    if (rt.memoryPressure) lines.push('• Memory pressure: ' + (rt.totalResident || '') + ' / ' + (rt.memoryBudget || ''));\n"
    "    const srcs = Array.isArray($json.sources) ? $json.sources : [];\n"
    "    for (const s of srcs) {\n"
    "      const r = s.lastRun; if (!r) continue;\n"
    "      if (r.orphaned) lines.push('• ' + esc(s.source) + ': ORPHANED run #' + r.id);\n"
    "      else if (r.status === 'FAILED') lines.push('• ' + esc(s.source) + ': FAILED — ' + esc(r.errorMessage || 'unknown'));\n"
    "    }\n"
    "    const cand = ($json.digest && $json.digest.totals && $json.digest.totals.candidates) || 0;\n"
    "    lines.push('');\n"
    "    lines.push('Candidates ≥0.6 today: ' + cand);\n"
    "    return lines.join('\\n');\n"
    "  })()\n"
    "}}"
)

new_nodes = [
    {
        "parameters": {"url": f"{BASE}/dashboard/summary", "options": {}},
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [1808, 1040],
        "id": "b1111111-1111-4111-8111-111111111111",
        "name": "Fetch dashboard summary",
    },
    {
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "",
                            "typeValidation": "loose", "version": 2},
                "conditions": [
                    {"id": "cond-health", "leftValue": NEEDS_ATTENTION, "rightValue": "",
                     "operator": {"type": "boolean", "operation": "true", "singleValue": True}},
                ],
                "combinator": "and",
            },
            "options": {},
        },
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": [2016, 1040],
        "id": "b2222222-2222-4222-8222-222222222222",
        "name": "Health needs attention?",
    },
    {
        "parameters": {
            "chatId": CHAT_ID,
            "text": ALERT_TEXT,
            "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"},
        },
        "type": "n8n-nodes-base.telegram",
        "typeVersion": 1.2,
        "position": [2224, 1040],
        "id": "b3333333-3333-4333-8333-333333333333",
        "name": "Notify health alert",
        "webhookId": "b3333333-3333-4333-8333-333333333333",
        "credentials": TELEGRAM_CRED,
    },
]

if "Fetch dashboard summary" in existing:
    print("health alert branch already present, skipping")
else:
    data["nodes"].extend(new_nodes)
    conns = data["connections"]

    # Fan the false output (index 1) of the run-status IF into the summary fetch,
    # alongside the existing digest fetch. Guard against shape drift.
    rsr = conns.setdefault("Run still running?", {"main": [[], []]})
    main = rsr["main"]
    while len(main) < 2:
        main.append([])
    main[1].append({"node": "Fetch dashboard summary", "type": "main", "index": 0})

    conns["Fetch dashboard summary"] = {
        "main": [[{"node": "Health needs attention?", "type": "main", "index": 0}]]
    }
    # IF: true -> alert; false -> dead-end (stay silent when healthy).
    conns["Health needs attention?"] = {
        "main": [
            [{"node": "Notify health alert", "type": "main", "index": 0}],
            [],
        ]
    }
    print("health alert branch added")

WF.write_text(json.dumps(data, indent=2) + "\n")
print(f"wrote {WF}")
