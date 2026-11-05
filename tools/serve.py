#!/usr/bin/env python3
"""本地预览服务器：静态文件 + 强制 no-store，避免改了 JS 却看到旧页面。

用法：python3 tools/serve.py [端口]
"""
import functools
import http.server
import socketserver
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 开发期一律不缓存，否则「改了没生效」会白白排查半天
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    root = __file__.rsplit('/tools/', 1)[0]
    handler = functools.partial(Handler, directory=root)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('0.0.0.0', port), handler) as httpd:
        print(f'预览：http://127.0.0.1:{port}  （root={root}）', flush=True)
        httpd.serve_forever()


if __name__ == '__main__':
    main()
