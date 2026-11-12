"""Verifica a configuração e as permissões anónimas sem escrever dados."""
import json
import pathlib
import re
import urllib.request
import urllib.error
import sys


def main():
    source = (pathlib.Path(__file__).resolve().parents[1] / 'config.js').read_text(encoding='utf-8')
    url = re.search(r"url: '([^']+)'", source).group(1)
    key = re.search(r"publishableKey: '([^']+)'", source).group(1)
    # Mesmo formato de pedido que o SDK usa antes de iniciar sessão.
    headers = {'apikey': key, 'Authorization': 'Bearer ' + key}
    for resource in ('poy_books', 'poy_contributions'):
        request = urllib.request.Request(url + '/rest/v1/' + resource + '?select=id&limit=1', headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                data = json.load(response)
                if resource == 'poy_contributions':
                    raise SystemExit('FALHA: os pedidos não devem estar acessíveis sem sessão.')
                print('PASS: ligação e chave pública aceites; tabela de livros acessível para consulta anónima.')
                print('Livros encontrados na consulta limitada:', len(data))
        except urllib.error.HTTPError as error:
            if resource == 'poy_contributions' and error.code in (401, 403):
                print('PASS: consulta anónima de pedidos bloqueada.')
            else:
                print('FALHA:', resource, 'HTTP', error.code)
                raise SystemExit(1)
    # A especificação lista apenas as funções disponíveis ao papel anónimo.
    # Não invocamos funções nem criamos contas durante esta verificação.
    print('Nenhum dado foi escrito e nenhuma conta foi criada.')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
