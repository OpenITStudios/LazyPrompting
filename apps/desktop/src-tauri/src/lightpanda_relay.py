"""Run a pinned browser and relay its private CDP socket over inherited stdio."""
import fcntl
import hashlib
import http.server
import os
import socket
import stat
import struct
import subprocess
import sys
import tempfile
import threading
import time


SHA256 = "53eb34da09159dcf8f04865dbfe3e63e9a652062684495aa7ced5ddd7c82e8b0"
BINARY_SIZE = 77_403_464
PREVIEW_PORT = 1425
CDP_PORT = 9222


def seal_browser(path):
    fd = os.memfd_create("lazyprompting-lightpanda", os.MFD_ALLOW_SEALING)
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NONBLOCK), "rb") as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size != BINARY_SIZE:
            raise ValueError("Invalid Lightpanda binary")
        with os.fdopen(os.dup(fd), "wb") as target:
            remaining = BINARY_SIZE
            while remaining:
                data = source.read(min(remaining, 1024 * 1024))
                if not data:
                    raise ValueError("Incomplete Lightpanda binary")
                target.write(data)
                remaining -= len(data)
    seals = fcntl.F_SEAL_WRITE | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK | fcntl.F_SEAL_SEAL
    fcntl.fcntl(fd, fcntl.F_ADD_SEALS, seals)
    with os.fdopen(os.dup(fd), "rb") as browser:
        browser.seek(0)
        if hashlib.file_digest(browser, "sha256").hexdigest() != SHA256:
            raise ValueError("Lightpanda checksum mismatch")
    return fd


def start_preview(page):
    class Preview(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path != "/browser-preview.html":
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
            self.send_header("Content-Length", str(len(page)))
            self.end_headers()
            self.wfile.write(page)

        def log_message(self, *args):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", PREVIEW_PORT), Preview)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def connect(child):
    deadline = time.monotonic() + 8
    while child.poll() is None and time.monotonic() < deadline:
        try:
            return socket.create_connection(("127.0.0.1", CDP_PORT), timeout=1)
        except OSError:
            time.sleep(0.05)
    raise RuntimeError("Private CDP listener unavailable")


def relay(child):
    peers = {}
    source, output = sys.stdin.buffer, sys.stdout.buffer
    try:
        while header := source.read(6):
            operation, channel, size = struct.unpack("!BBI", header)
            if not 1 <= channel <= 10 or size > 1024 * 1024:
                raise ValueError("Invalid CDP relay frame")
            result = b""
            try:
                if operation == 1 and size == 0 and channel not in peers:
                    peers[channel] = connect(child)
                    peers[channel].settimeout(5)
                elif operation == 2 and size:
                    data = source.read(size)
                    if len(data) != size:
                        raise EOFError("Incomplete relay write")
                    peers[channel].sendall(data)
                elif operation == 3 and size:
                    result = peers[channel].recv(size)
                    if not result:
                        peers.pop(channel).close()
                elif operation == 4 and size == 0:
                    if peer := peers.pop(channel, None):
                        peer.close()
                else:
                    raise ValueError("Invalid CDP relay operation")
            except (OSError, KeyError, RuntimeError):
                if peer := peers.pop(channel, None):
                    peer.close()
                output.write(struct.pack("!I", 0xffffffff))
            else:
                output.write(struct.pack("!I", len(result)))
                output.write(result)
            output.flush()
    finally:
        for peer in peers.values():
            peer.close()


def main():
    # The native launcher enters a new network namespace before this script runs.
    if any(name != "lo" for _, name in socket.if_nameindex()):
        raise RuntimeError("Private network namespace required")
    subprocess.run(["/usr/sbin/ip", "link", "set", "lo", "up"], check=True, stdout=sys.stderr)
    fd = seal_browser(sys.argv[1])
    with tempfile.TemporaryDirectory(prefix="lazyprompting-cdp-") as workdir:
        with start_preview(sys.argv[2].encode("utf8")):
            child = subprocess.Popen(
                [f"/proc/self/fd/{fd}", "serve", "--host", "127.0.0.1", "--port", str(CDP_PORT),
                 "--disable-metrics"],
                cwd=workdir,
                env={"LIGHTPANDA_DISABLE_TELEMETRY": "true", "HOME": workdir},
                pass_fds=(fd,), stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL, stderr=sys.stderr,
            )
            os.close(fd)
            try:
                relay(child)
            finally:
                if child.poll() is None:
                    child.terminate()
                    try:
                        child.wait(timeout=1)
                    except subprocess.TimeoutExpired:
                        child.kill()
                        child.wait()


if __name__ == "__main__":
    main()
