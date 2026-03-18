"""
PoC: Cloudflare Containers hello-world Python server.
Verifies: HTTP server, env vars, R2 S3-compatible API, SIGTERM handling.
"""

import json
import os
import signal
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

startup_time = time.time()


class PoCHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"status": "ok", "uptime_sec": round(time.time() - startup_time, 1)})
        elif self.path == "/env-check":
            self._respond(200, {
                "MESSAGE": os.environ.get("MESSAGE", "(not set)"),
                "CLOUDFLARE_DURABLE_OBJECT_ID": os.environ.get("CLOUDFLARE_DURABLE_OBJECT_ID", "(not set)"),
                "POC_SECRET": os.environ.get("POC_SECRET", "(not set)"),
            })
        elif self.path == "/metrics":
            import resource
            usage = resource.getrusage(resource.RUSAGE_SELF)
            self._respond(200, {
                "uptime_sec": round(time.time() - startup_time, 1),
                "max_rss_mb": round(usage.ru_maxrss / 1024, 1),  # macOS: bytes, Linux: KB
                "user_time_sec": round(usage.ru_utime, 3),
                "system_time_sec": round(usage.ru_stime, 3),
            })
        else:
            self._respond(200, {"message": "Hello from Python container!", "path": self.path})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"

        if self.path == "/r2-write-test":
            result = self._test_r2_write(json.loads(body))
            self._respond(200, result)
        elif self.path == "/echo":
            self._respond(200, {"echoed": json.loads(body)})
        else:
            self._respond(404, {"error": f"unknown path: {self.path}"})

    def _test_r2_write(self, params: dict) -> dict:
        """Test writing to R2 via S3-compatible API."""
        try:
            import boto3
            endpoint = os.environ.get("R2_ENDPOINT")
            access_key = os.environ.get("R2_ACCESS_KEY_ID")
            secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")

            if not all([endpoint, access_key, secret_key]):
                return {"success": False, "error": "R2 credentials not set in env vars"}

            s3 = boto3.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
            )
            bucket = params.get("bucket", "healthy-person-emulator-static")
            key = params.get("key", "poc-test/hello.txt")
            content = params.get("content", f"Hello from container at {time.time()}")

            s3.put_object(Bucket=bucket, Key=key, Body=content.encode())
            return {"success": True, "bucket": bucket, "key": key}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _respond(self, status: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"[container] {args[0]}")


def main():
    port = int(os.environ.get("PORT", "8080"))
    server = HTTPServer(("0.0.0.0", port), PoCHandler)
    print(f"[container] Python PoC server listening on :{port}")

    def shutdown(signum, frame):
        print(f"[container] Received signal {signum}, shutting down...")
        server.shutdown()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    try:
        server.serve_forever()
    finally:
        server.server_close()
        print("[container] Server stopped.")


if __name__ == "__main__":
    main()
