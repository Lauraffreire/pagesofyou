"""Verifica o site num Chrome headless, com Supabase simulado e sem dados reais.

Executar: python tests/check_site.py (a partir de pages-of-you).
Não requer pacotes Python adicionais. CHROME_PATH permite escolher o navegador.
"""
import functools
import http.server
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import socket
import base64
import hashlib
import json
import struct
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '--baseline' in sys.argv


def source_file(name):
    if BASELINE:
        return subprocess.check_output(['git', 'show', 'HEAD:' + name], cwd=ROOT).decode('utf-8')
    return (ROOT / name).read_text(encoding='utf-8')


MOCK = """
window.testErrors = [];
window.addEventListener('error', e => testErrors.push(e.message));
window.addEventListener('unhandledrejection', e => testErrors.push(String(e.reason)));
window.testCollection = {books: [], pending: [], history: []};
window.PoyCloud = {
  connection: () => ({auth: {
    getSession: async () => ({data: {session: null}}),
    onAuthStateChange: () => ({data: {subscription: {}}})
  }}),
  check: value => {if (value.error) throw value.error; return value.data;},
  collection: async () => structuredClone(testCollection),
  commit: async (before, after) => {
    testCollection = structuredClone({books: after.books, pending: after.pending, history: after.history});
  },
  message: error => error.message || String(error)
};
"""
CHECKS = """
(async () => {
  const checks = [];
  const styles = [];
  const capture = label => {
    const selectors = ['body', 'main', 'h1', '.button', '.quiet-title', '.personal-book-stack', '.design-sheet', '.editor-properties'];
    styles.push([label, selectors.map(selector => {
      const node = document.querySelector(selector);
      if (!node) return [selector, null];
      const css = getComputedStyle(node);
      return [selector, ...['display', 'color', 'backgroundColor', 'fontFamily', 'fontSize', 'width', 'height', 'padding', 'position'].map(key => css[key])];
    })]);
  };
  const assert = (ok, label) => {if (!ok) throw Error(label); checks.push(label);};
  const wait = () => new Promise(resolve => setTimeout(resolve, 30));
  const go = async hash => {await navigate(hash, true); await wait();};
  try {
    while (!started || cloudLoading) await wait();
    const landing = main.querySelector('.landing-shelves');
    const shelves = landing.querySelectorAll('.landing-shelf');
    const bounds = landing.getBoundingClientRect();
    assert(shelves.length === 3 && landing.querySelectorAll('.landing-spine').length >= 47 &&
      !landing.querySelector('img') && Math.abs(bounds.width - innerWidth) < 1 &&
      Math.abs(bounds.height - innerHeight) < 1, 'Estante desenhada no site ocupa todo o ecra');
    assert([...landing.querySelectorAll('.landing-spine')].every(book => {
      const css = getComputedStyle(book);
      const referenceRatio = parseFloat(css.getPropertyValue('--book-width')) /
        parseFloat(css.getPropertyValue('--book-height'));
      return Math.abs(parseFloat(css.width) / parseFloat(css.height) / referenceRatio - 1) < .01;
    }), 'Livros mantêm as proporções da referência em ambas as orientações');
    const leaningBooks = [...landing.querySelectorAll('.landing-spine--against-left, .landing-spine--against-right')];
    assert(leaningBooks.length > 0 && leaningBooks.every(book => {
      const bay = book.parentElement;
      const bayBounds = bay.getBoundingClientRect();
      const bookBounds = book.getBoundingClientRect();
      const css = getComputedStyle(bay);
      const wallGap = book.classList.contains('landing-spine--against-left') ?
        bookBounds.left - bayBounds.left - parseFloat(css.borderLeftWidth) : bayBounds.right - bookBounds.right;
      const floorGap = bayBounds.bottom - parseFloat(css.borderBottomWidth) - bookBounds.bottom;
      return Math.abs(wallGap) < 1 && Math.abs(floorGap) < 1;
    }), 'Livros inclinados apoiam-se na parede e na prateleira');
    const logo = landing.querySelector('#landing-title a');
    const logoBounds = logo.getBoundingClientRect();
    const topBook = logo.closest('h1').nextElementSibling.getBoundingClientRect();
    assert(document.elementFromPoint(logoBounds.left + logoBounds.width / 2, logoBounds.top + logoBounds.height / 2)
      ?.closest('a') === logo && logo.hash === '#area' &&
      Math.abs(logoBounds.bottom - topBook.top) < 1, 'Logotipo pousado sobre os livros abre a area pessoal');
    capture('inicio');
    await go('#biblioteca');
    assert(document.querySelector('#book-results'), 'Biblioteca e pesquisa');
    capture('biblioteca');
    await go('#criar');
    assert(main.querySelector('input[type="password"]'), 'Criação protegida por autenticação');
    capture('login');
    await session({id: 'test-owner', email: 'teste@example.test', user_metadata: {name: 'Teste'}});
    await go('#criar');
    const form = document.querySelector('#book-start-form');
    form.elements.creatorName.value = 'Teste';
    form.elements.name.value = 'Pessoa de teste';
    form.elements.relationship.value = 'Amiga';
    form.requestSubmit();
    await wait();
    assert(document.querySelector('#design-sheet'), 'Editor visual e capa');
    capture('editor');
    document.querySelector('#edit-spine').click();
    const spineDialog = document.querySelector('#modal');
    assert(spineDialog.scrollHeight <= spineDialog.clientHeight, 'Editor de lombada sem deslocamento vertical');
    spineDialog.querySelector('.spine-close').click();
    assert(!spineDialog.open, 'Fechar o editor de lombada pelo botão superior');
    document.querySelector('#edit-spine').click();
    const spineOptions = [...document.querySelectorAll('[data-spine-format]')];
    assert(spineOptions.length === 7, 'Apresentar os seis detalhes e a opção lisa');
    const spineForm = document.querySelector('#spine-form');
    spineForm.elements.background.value = '#345678';
    spineForm.elements.patternColor.value = '#fedcba';
    spineForm.elements.color.value = '#ffffff';
    spineOptions.find(option => option.dataset.spineFormat === 'terra-lines').click();
    const spinePreview = document.querySelector('.spine-preview');
    assert(getComputedStyle(spinePreview).backgroundColor === 'rgb(52, 86, 120)' &&
      getComputedStyle(spinePreview).borderTopLeftRadius !== '0px' &&
      spineForm.elements.color.value === '#ffffff' &&
      spineForm.elements.patternColor.value === '#fedcba', 'Combinar detalhes arredondados com cores personalizadas');
    spineForm.requestSubmit();
    for (const type of ['postit', 'shape']) {
      const item = {id: 'move-' + type, type, text: '', x: 50, y: 50, width: 120, height: 100, rotation: 0, color: '#eee6ce', fontSize: 22};
      activeDesign().elements.push(item);
      renderDesigner();
      const node = document.querySelector('[data-design-id="' + item.id + '"]');
      const sheet = document.querySelector('#design-sheet');
      node.setPointerCapture = () => {};
      sheet.onpointerdown({button: 0, target: node, clientX: 20, clientY: 20, pointerId: 1, preventDefault() {}});
      if (type === 'postit') assert(node.isContentEditable, 'Post-it permite escrever com um clique');
      assert(typeof node.onpointermove === 'function', 'Arrastar ativo: ' + type);
      node.onpointermove({clientX: 30, clientY: 30});
      node.onpointerup();
      assert(item.x > 50 && item.y > 50, 'Mover elemento: ' + type);
      activeDesign().elements = activeDesign().elements.filter(el => el.id !== item.id);
    }
    renderDesigner();
    assert(document.querySelector('#book-form [name="visibility"]'), 'Visibilidade do livro');
    await saveBookDraft();
    assert(state.bookDrafts.length === 1, 'Guardar rascunho no navegador');
    const savedId = state.bookDrafts[0].id;
    dirty = false;
    editorCache = null;
    await go('#rascunho/' + savedId);
    assert(document.querySelector('#design-sheet'), 'Retomar rascunho');
    document.querySelector('#book-form').requestSubmit();
    await wait();
    assert(draft?.kind === 'book' && document.querySelector('[data-action="publish"]'), 'Pré-visualização do livro');
    publishDraft();
    document.querySelector('#confirm-operation').click();
    await wait();
    const book = state.books[0];
    assert(book?.name === 'Pessoa de teste', 'Publicar livro no serviço simulado');
    assert(book.spine?.format === 'terra-lines' && book.spine.background === '#345678' &&
      book.spine.patternColor === '#fedcba' && book.spine.color === '#ffffff', 'Publicar detalhes e cores da lombada');
    await go('#livro/' + book.id);
    assert(main.textContent.includes(book.name) || main.querySelector('.book-preview, .book-reader, .design-sheet'), 'Leitura do livro');
    await session({id: 'test-collaborator', email: 'outra@example.test', user_metadata: {name: 'Outra pessoa'}});
    await go('#contribuir/' + book.id);
    const memoryForm = document.querySelector('#memory-form');
    assert(memoryForm && document.querySelector('#design-sheet'), 'Editor de colaboração');
    memoryForm.elements.author.value = 'Outra pessoa';
    editorCache.design.elements.push({id: 'test-text', type: 'text', text: 'Uma memória de teste', x: 20, y: 20, width: 300, height: 100, rotation: 0, color: '#333333', fontSize: 20});
    memoryForm.requestSubmit();
    await wait();
    assert(draft?.kind === 'memory', 'Pré-visualização da proposta');
    publishDraft();
    document.querySelector('#confirm-operation').click();
    await wait();
    assert(state.pending.length === 1, 'Enviar proposta para revisão');
    await session({id: 'test-owner', email: 'teste@example.test', user_metadata: {name: 'Teste'}});
    await go('#recebidas');
    assert(main.textContent.includes('Outra pessoa'), 'Consultar propostas recebidas');
    const proposal = state.pending[0];
    decide(proposal.id, true);
    document.querySelector('#confirm-operation').click();
    await wait();
    assert(state.history.some(item => item.id === proposal.id && item.status === 'accepted'), 'Aceitar contribuição');
    assert(bookById(book.id).memories.length === 1, 'Integrar memória no livro');
    assert(!testErrors.length, 'Sem erros JavaScript: ' + testErrors.join('; '));
    document.body.innerHTML = '<pre id="test-result">PASS\\n' + checks.join('\\n') + '\\nSTYLES:' + JSON.stringify(styles) + '</pre>';
  } catch (error) {
    document.body.innerHTML = '<pre id="test-result">FAIL: ' + String(error.stack || error).replace(/</g, '&lt;') + '\\n' + testErrors.join('\\n') + '</pre>';
  }
})();
"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/test-mock.js' or self.path == '/test-checks.js':
            body = (MOCK if self.path == '/test-mock.js' else CHECKS).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.end_headers()
            self.wfile.write(body)
        elif self.path == '/test.html':
            html = source_file('index.html')
            html = re.sub(r'    <script src="supabase/[^\"]+" defer></script>\n', '', html)
            html = html.replace('<head>', '<head><script src="/test-mock.js" defer></script>')
            html = html.replace('</head>', '<script src="/test-checks.js" defer></script></head>')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(html.encode())
        elif self.path.endswith(('.css', '.js')):
            try:
                source = source_file(self.path.lstrip('/'))
            except (OSError, subprocess.CalledProcessError):
                self.send_error(404)
                return
            if self.path.endswith('.css'):
                source = re.sub(r"@import url\(['\"]https://fonts.googleapis.com/.*?\);", '', source)
            self.send_response(200)
            self.send_header('Content-Type', ('text/css' if self.path.endswith('.css') else 'text/javascript') + '; charset=utf-8')
            self.end_headers()
            self.wfile.write(source.encode())
        else:
            super().do_GET()


def evaluate(ws_url, expression):
    """Pedido CDP por WebSocket, apenas com a biblioteca padrão de Python."""
    url = urlsplit(ws_url)
    with socket.create_connection((url.hostname, url.port), timeout=5) as connection:
        key = base64.b64encode(os.urandom(16)).decode()
        connection.sendall((f'GET {url.path} HTTP/1.1\r\nHost: {url.netloc}\r\n'
                            'Upgrade: websocket\r\nConnection: Upgrade\r\n'
                            f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        response = b''
        while not response.endswith(b'\r\n\r\n'):
            response += connection.recv(1)
        expected = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest())
        if b' 101 ' not in response or expected.lower() not in response.lower():
            raise RuntimeError('Falha na ligação ao navegador de teste: ' + response.decode())
        payload = json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': expression, 'returnByValue': True}}).encode()
        mask = os.urandom(4)
        header = bytes([0x81, 0x80 | len(payload)]) if len(payload) < 126 else bytes([0x81, 0xfe]) + struct.pack('!H', len(payload))
        connection.sendall(header + mask + bytes(value ^ mask[i % 4] for i, value in enumerate(payload)))

        def read(size):
            data = b''
            while len(data) < size:
                part = connection.recv(size - len(data))
                if not part:
                    raise RuntimeError('O navegador fechou a ligação.')
                data += part
            return data

        while True:
            first, second = read(2)
            length = second & 127
            if length == 126:
                length = struct.unpack('!H', read(2))[0]
            elif length == 127:
                length = struct.unpack('!Q', read(8))[0]
            data = read(length)
            if first & 15 == 1:
                message = json.loads(data)
                if message.get('id') == 1:
                    return message.get('result', {}).get('result', {}).get('value')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    candidates = [os.environ.get('CHROME_PATH', ''),
                  'C:/Program Files/Google/Chrome/Application/chrome.exe',
                  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
    browser = next((path for path in candidates if path and Path(path).is_file()), None)
    if not browser:
        raise SystemExit('Defina CHROME_PATH com o caminho de um navegador Chromium.')
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        with tempfile.TemporaryDirectory(prefix='poy-test-') as profile:
            process = subprocess.Popen([browser, '--headless', '--disable-gpu',
                                     '--no-first-run', '--no-default-browser-check',
                                     '--disable-background-networking',
                                     '--user-data-dir=' + profile, '--remote-debugging-port=0',
                                     f'http://127.0.0.1:{server.server_port}/test.html'],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            result = None
            try:
                deadline = time.monotonic() + 30
                port_file = Path(profile) / 'DevToolsActivePort'
                while not port_file.exists() and time.monotonic() < deadline:
                    time.sleep(.1)
                port = int(port_file.read_text().splitlines()[0])
                while time.monotonic() < deadline:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/json') as response:
                        pages = json.load(response)
                    page = next((item for item in pages if item.get('type') == 'page'), None)
                    if page:
                        result = evaluate(page['webSocketDebuggerUrl'], 'document.getElementById("test-result")?.textContent')
                        if result:
                            break
                    time.sleep(.1)
                if not result and page:
                    result = 'FAIL: Tempo excedido. ' + str(evaluate(page['webSocketDebuggerUrl'], 'JSON.stringify({errors:window.testErrors, text:document.querySelector("main")?.innerText})'))
            finally:
                process.terminate()
                process.wait(timeout=10)
                time.sleep(.3)
        server.shutdown()
    if not result:
        raise SystemExit('O navegador não terminou a verificação.')
    print(result)
    if not result.startswith('PASS'):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
