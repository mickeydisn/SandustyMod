# TEMP. CDP: navigate the Sandustry renderer to a ?db_load=<saveId> URL.
import os
import json
import sys
import time
import socket
import struct
import base64
import urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9583
SAVE = sys.argv[2] if len(sys.argv) > 2 else "llljdmco4hn-exitsave"

targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list"))
pages = [
    t
    for t in targets
    if t.get("type") == "page" and not t.get("url", "").startswith("devtools")
]
if not pages:
    sys.exit("no page target")

base = pages[0]["url"].split("?")[0]
dest = f"{base}?db_load={SAVE}"
print("from:", base[:80])
print("to  :", dest[:100])

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


send({"id": 1, "method": "Page.navigate", "params": {"url": dest}})
print("navigate sent, waiting 5s for the load to take")
time.sleep(5)
print("done")
