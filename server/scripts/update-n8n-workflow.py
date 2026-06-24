#!/usr/bin/env python3
"""One-shot transform of n8n-workflow.json for the hybrid scraping flow.

Changes:
  1. Repoint both jobhunt HTTP nodes from the brittle host LAN IP
     (http://10.0.0.23:3000) to the compose-network DNS name
     (http://express-api:3000), which is machine-independent.
  2. Add an in-app pipeline branch off the existing Schedule Trigger:
       Schedule Trigger -> Run WTTJ source -> Run Built-in source
                        -> Wait -> Fetch daily digest -> Telegram summary
     The Apify LinkedIn branch is left untouched (hybrid per design).
"""
import json
import pathlib

WF = pathlib.Path(__file__).resolve().parent.parent / "n8n-workflow.json"
TELEGRAM_CRED = {"telegramApi": {"id": "MOl4hUz3memSul0W", "name": "Telegram account"}}
CHAT_ID = "5651295221"
BASE = "http://express-api:3000"

data = json.loads(WF.read_text())

# 1) Host fix on every HTTP Request node still pointing at the LAN IP.
host_fixes = 0
for node in data["nodes"]:
    if node.get("type") == "n8n-nodes-base.httpRequest":
        url = node["parameters"].get("url", "")
        if "10.0.0.23:3000" in url:
            node["parameters"]["url"] = url.replace("http://10.0.0.23:3000", BASE)
            host_fixes += 1
print(f"host fixes applied: {host_fixes}")

# 2) In-app pipeline branch (skip if already added on a previous run).
existing = {n["name"] for n in data["nodes"]}


def http_post(name, path, body, pos, node_id):
    return {
        "parameters": {
            "method": "POST",
            "url": f"{BASE}{path}",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": json.dumps(body, indent=2),
            "options": {},
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": pos,
        "id": node_id,
        "name": name,
    }


new_nodes = [
    http_post(
        "Run WTTJ source",
        "/sources/wttj/run",
        {"query": "software engineer", "locations": ["san francisco", "remote"],
         "hitsPerPage": 30, "maxPages": 2},
        [704, 720],
        "a1111111-1111-4111-8111-111111111111",
    ),
    http_post(
        "Run Built-in source",
        "/sources/built-in/run",
        {"query": "software engineer", "locations": ["san francisco", "remote"],
         "hitsPerPage": 25, "maxPages": 1},
        [960, 720],
        "a2222222-2222-4222-8222-222222222222",
    ),
    {
        # Poll interval. In-app runs are async (the /sources/:id/run endpoint returns
        # 202 immediately), so we poll the run to completion instead of a fixed wait —
        # extraction on a local 7B model can take minutes.
        "parameters": {"unit": "seconds", "amount": 20},
        "type": "n8n-nodes-base.wait",
        "typeVersion": 1.1,
        "position": [1216, 720],
        "id": "a3333333-3333-4333-8333-333333333333",
        "name": "Wait for in-app runs",
        "webhookId": "a3333333-3333-4333-8333-333333333333",
    },
    {
        "parameters": {
            "url": "=" + BASE + "/runs/{{ $('Run Built-in source').item.json.runId }}",
            "options": {},
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [1408, 720],
        "id": "a6666666-6666-4666-8666-666666666666",
        "name": "Check run status",
    },
    {
        # Loop back to Wait while the run is still RUNNING, capped at ~20 min
        # ($runIndex < 60 × 20s) so a crashed/orphaned run can't loop forever.
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "",
                            "typeValidation": "strict", "version": 2},
                "conditions": [
                    {"id": "cond-status", "leftValue": "={{ $json.status }}",
                     "rightValue": "RUNNING",
                     "operator": {"type": "string", "operation": "equals"}},
                    {"id": "cond-cap", "leftValue": "={{ $runIndex }}", "rightValue": 60,
                     "operator": {"type": "number", "operation": "lt"}},
                ],
                "combinator": "and",
            },
            "options": {},
        },
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": [1600, 720],
        "id": "a7777777-7777-4777-8777-777777777777",
        "name": "Run still running?",
    },
    {
        "parameters": {"url": f"{BASE}/digest/today?minScore=0.6&limit=25", "options": {}},
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [1808, 820],
        "id": "a4444444-4444-4444-8444-444444444444",
        "name": "Fetch daily digest",
    },
    {
        "parameters": {
            "chatId": CHAT_ID,
            # HTML parse mode: only & < > need escaping, so scraped job titles
            # containing (), $, +, _, * can't break the message (legacy Markdown did).
            "text": "=<b>In-app pipeline digest (wttj + built-in)</b>\n"
                    "Date: {{ $json.date }}\n"
                    "Candidates (score ≥ 0.6): {{ $json.totals.candidates }}\n"
                    "By source: {{ JSON.stringify($json.totals.bySource) }}\n\n"
                    "{{\n"
                    "  (() => {\n"
                    "    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n"
                    "    const rows = ($json.listings || []).slice(0, 5).map(l =>\n"
                    "      `• ${esc(l.title)} @ ${esc(l.company)} — ${l.score ? l.score.toFixed(3) : 'n/a'} <a href=\"${esc(l.listingUrl)}\">listing</a>`\n"
                    "    );\n"
                    "    return rows.length ? rows.join('\\n') : 'No candidates today.';\n"
                    "  })()\n"
                    "}}",
            "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"},
        },
        "type": "n8n-nodes-base.telegram",
        "typeVersion": 1.2,
        "position": [2016, 820],
        "id": "a5555555-5555-4555-8555-555555555555",
        "name": "Summarize in-app digest",
        "webhookId": "a5555555-5555-4555-8555-555555555555",
        "credentials": TELEGRAM_CRED,
    },
]

if "Run WTTJ source" not in existing:
    data["nodes"].extend(new_nodes)

    conns = data["connections"]
    # Fan the schedule trigger into the new branch (keep the Apify branch).
    sched = conns["Schedule Trigger"]["main"][0]
    sched.append({"node": "Run WTTJ source", "type": "main", "index": 0})

    def link(src, dst):
        conns[src] = {"main": [[{"node": dst, "type": "main", "index": 0}]]}

    link("Run WTTJ source", "Run Built-in source")
    link("Run Built-in source", "Wait for in-app runs")
    link("Wait for in-app runs", "Check run status")
    link("Check run status", "Run still running?")
    # IF fans out: true (still running) loops back to Wait; false proceeds to digest.
    conns["Run still running?"] = {"main": [
        [{"node": "Wait for in-app runs", "type": "main", "index": 0}],
        [{"node": "Fetch daily digest", "type": "main", "index": 0}],
    ]}
    link("Fetch daily digest", "Summarize in-app digest")
    print("in-app branch added")
else:
    print("in-app branch already present, skipping")

WF.write_text(json.dumps(data, indent=2) + "\n")
print(f"wrote {WF}")
