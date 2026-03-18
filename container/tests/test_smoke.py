"""Smoke tests: import verification, server startup, routing."""
import importlib
import json
import threading
import urllib.request
from http.server import HTTPServer

import pytest

from main import TASK_ROUTES, SOCIAL_PLATFORM_MODULES, AutomationHandler


class TestTaskImports:
    """All task modules are importable and have a handle() function."""

    @pytest.mark.parametrize(
        "module_name",
        [m for m in TASK_ROUTES.values() if m is not None],
    )
    def test_task_module_importable(self, module_name):
        mod = importlib.import_module(module_name)
        assert hasattr(mod, "handle"), f"{module_name} has no handle()"

    @pytest.mark.parametrize("module_name", SOCIAL_PLATFORM_MODULES.values())
    def test_social_module_importable(self, module_name):
        mod = importlib.import_module(module_name)
        assert hasattr(mod, "handle"), f"{module_name} has no handle()"


class TestServer:
    """HTTP server basic behavior."""

    @pytest.fixture(autouse=True)
    def server(self):
        srv = HTTPServer(("127.0.0.1", 0), AutomationHandler)
        port = srv.server_address[1]
        t = threading.Thread(target=srv.serve_forever)
        t.daemon = True
        t.start()
        self.base_url = f"http://127.0.0.1:{port}"
        yield
        srv.shutdown()

    def _get(self, path):
        req = urllib.request.Request(f"{self.base_url}{path}")
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())

    def test_health(self):
        status, body = self._get("/health")
        assert status == 200
        assert body["status"] == "ok"

    def test_unknown_get(self):
        status, body = self._get("/unknown")
        assert status == 200

    def test_routes_registered(self):
        for path in TASK_ROUTES:
            assert path.startswith("/"), f"Route {path} must start with /"
