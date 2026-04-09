"""Serve README.md as plain text in a monospace viewer. No rendering, no transformation."""
import http.server
from pathlib import Path

PORT = 5088
README = Path(__file__).resolve().parent / "README.md"

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        text = README.read_text(encoding="utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(text.encode())

    def log_message(self, fmt, *args):
        pass

if __name__ == "__main__":
    print(f"README viewer: http://127.0.0.1:{PORT}")
    http.server.HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
