"""Servidor local para testar o app no notebook (usado pelo "Abrir o app.bat").

Serve os arquivos desta pasta em http://localhost:8080. Corrige os tipos de
arquivo, porque o registro do Windows às vezes diz que .js é "texto comum" e o
navegador recusa rodar o app.
"""
import functools
import http.server
import pathlib

PORTA = 8080
PASTA = pathlib.Path(__file__).resolve().parent


class Pedidos(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        # Sempre a versão mais nova dos arquivos enquanto testamos.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", PORTA), functools.partial(Pedidos, directory=str(PASTA)))
    print(f"  Servindo em http://localhost:{PORTA}  (Ctrl+C ou feche a janela para parar)")
    servidor.serve_forever()
