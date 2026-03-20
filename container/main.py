"""
Automation container for healthy-person-emulator.org.
HTTP server on port 8080 that dispatches tasks via POST endpoints.
"""

import json
import os
import signal
import time
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler

startup_time = time.time()

# Task registry: path -> module
TASK_ROUTES = {
    "/create-ogp": "tasks.create_og_image",
    "/post-social": None,  # dispatches to sub-tasks based on platform
    "/delete-social": None,  # dispatches to sub-tasks based on platform
    "/report-weekly": "tasks.report_weekly_summary",
    "/report-legendary": "tasks.report_legendary_article",
}

SOCIAL_PLATFORM_MODULES = {
    "twitter": "tasks.post_tweet",
    "bluesky": "tasks.post_bluesky",
    "activitypub": "tasks.post_activitypub",
}


def import_and_handle(module_name: str, params: dict) -> dict:
    import importlib
    mod = importlib.import_module(module_name)
    return mod.handle(params)


class AutomationHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"status": "ok", "uptime_sec": round(time.time() - startup_time, 1)})
        elif self.path == "/metrics":
            import resource
            usage = resource.getrusage(resource.RUSAGE_SELF)
            self._respond(200, {
                "uptime_sec": round(time.time() - startup_time, 1),
                "max_rss_mb": round(usage.ru_maxrss / 1024, 1),
                "user_time_sec": round(usage.ru_utime, 3),
                "system_time_sec": round(usage.ru_stime, 3),
            })
        else:
            self._respond(200, {"message": "HPE Automation Container", "path": self.path})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        params = json.loads(body)

        try:
            if self.path == "/post-social":
                platform = params.get("platform")
                if platform not in SOCIAL_PLATFORM_MODULES:
                    self._respond(400, {"error": f"Unknown platform: {platform}"})
                    return
                result = import_and_handle(SOCIAL_PLATFORM_MODULES[platform], params)
            elif self.path == "/delete-social":
                result = import_and_handle("tasks.delete_social", params)
            elif self.path in TASK_ROUTES:
                module_name = TASK_ROUTES[self.path]
                result = import_and_handle(module_name, params)
            elif self.path == "/echo":
                result = {"echoed": params}
            elif self.path == "/r2-write-test":
                result = self._test_r2_write(params)
            else:
                self._respond(404, {"error": f"unknown path: {self.path}"})
                return
            self._respond(200, result)
        except Exception as e:
            print(f"[container] Error handling {self.path}: {traceback.format_exc()}")
            self._respond(500, {"error": str(e), "type": type(e).__name__})

    def _test_r2_write(self, params: dict) -> dict:
        try:
            from shared.config import get_r2_client, R2_BUCKET
            s3 = get_r2_client()
            bucket = params.get("bucket", R2_BUCKET)
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
    server = HTTPServer(("0.0.0.0", port), AutomationHandler)
    print(f"[container] Automation server listening on :{port}")

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
