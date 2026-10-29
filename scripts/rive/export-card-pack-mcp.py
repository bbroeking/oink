#!/usr/bin/env python3
"""Export the active Rive file through the local MCP bridge without printing base64."""

import base64
import json
import os
import sys
import urllib.request


URL = "http://127.0.0.1:9791/mcp"


def request(body, session_id=None):
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    if session_id:
        headers["mcp-session-id"] = session_id
    req = urllib.request.Request(URL, json.dumps(body).encode(), headers)
    with urllib.request.urlopen(req) as response:
        return response.headers, response.read().decode()


def parse(raw):
    lines = [line[5:].strip() for line in raw.splitlines() if line.startswith("data:")]
    return json.loads(lines[-1] if lines else raw)


def export(fmt, destination, session_id):
    _, raw = request({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {"name": "export_file", "arguments": {
            "format": fmt,
            "destination": destination,
            "inline_base64": True,
            **({"embed_assets": True} if fmt == "rev" else {}),
        }},
    }, session_id)
    body = parse(raw)
    payload = json.loads(body["result"]["content"][0]["text"])
    output = os.path.join(destination, payload["filename"])
    with open(output, "xb") as handle:
        handle.write(base64.b64decode(payload["data"]))
    print(output)


def main():
    destination = os.path.abspath(sys.argv[1])
    os.makedirs(destination, exist_ok=True)
    headers, _ = request({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {"protocolVersion": "2025-11-25", "capabilities": {},
                   "clientInfo": {"name": "card-pack-export", "version": "1"}},
    })
    session_id = headers["mcp-session-id"]
    export("riv", destination, session_id)
    export("rev", destination, session_id)


if __name__ == "__main__":
    main()
