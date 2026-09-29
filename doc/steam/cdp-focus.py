# TEMP. CDP: force the renderer to be treated as focused.
# The game pauses its simulation when the window loses focus, which leaves
# placements stuck at `queued: true` and stops every processor from ticking.
# `Emulation.setFocusEmulationEnabled` forces the focused state without needing
# real window activation (which requires macOS assistive access).
# Usage: python3 cdp-focus.py <port>
import os
import sys
import json
import socket
import struct
import base64
import urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9602
targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list"))
pages = [
    t
    for t in targets
    if t.get("type") == "page" and not t.get("url", "").startswith("devtools")
]
if not pages:
    sys.exit("no page target")

u = pages[0]["webSocketDebuggerUrl"].replace("ws://", "")
host, path = u.split("/", 1)
host_name, port = host.split(":")
sock = socket.create_connection((host_name, int(port)))
key = base64.b64encode(os.urandom(16)).decode()
sock.send(
    (
        f"GET /{path} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\n"
        f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    ).encode()
)
sock.recv(4096)


def send(obj):
    data = json.dumps(obj).encode()
    n = len(data)
    if n < 126:
        head = b"\x81" + bytes([0x80 | n])
    elif n < 65536:
        head = b"\x81" + bytes([0x80 | 126]) + struct.pack(">H", n)
    else:
        head = b"\x81" + bytes([0x80 | 127]) + struct.pack(">Q", n)
    mask = os.urandom(4)
    sock.send(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))


def read_one(want_id):
    buf = b""
    for _ in range(40):
        try:
            chunk = sock.recv(65536)
        except socket.timeout:
            break
        if not chunk:
            break
        buf += chunk
        while len(buf) >= 2:
            b1, b2 = buf[0], buf[1]
            idx, masked, n = 2, bool(b2 & 0x80), b2 & 0x7F
            if n == 126:
                if len(buf) < 4:
                    break
                n = struct.unpack(">H", buf[2:4])[0]
                idx = 4
            elif n == 127:
                if len(buf) < 10:
                    break
                n = struct.unpack(">Q", buf[2:10])[0]
                idx = 10
            if masked:
                idx += 4
            if len(buf) < idx + n:
                break
            payload, buf = buf[idx:idx + n], buf[idx + n:]
            if b1 & 0x0F != 1:
                continue
            try:
                msg = json.loads(payload)
            except ValueError:
                continue
            if msg.get("id") == want_id:
                return msg
    return None


sock.settimeout(20)
send({"id": 1, "method": "Page.bringToFront"})
print("bringToFront ->", json.dumps(read_one(1))[:160])
send(
    {
        "id": 2,
        "method": "Emulation.setFocusEmulationEnabled",
        "params": {"enabled": True},
    }
)
print("focusEmulation ->", json.dumps(read_one(2))[:160])
send(
    {
        "id": 3,
        "method": "Runtime.evaluate",
        "params": {
            "expression": (
                "JSON.stringify({hidden:document.hidden,"
                "vis:document.visibilityState,focus:document.hasFocus()})"
            ),
            "returnByValue": True,
        },
    }
)
print("page ->", json.dumps(read_one(3))[:300])
