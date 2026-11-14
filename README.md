# Pages of You — site de criação

Site em HTML, CSS e JavaScript para criar e consultar livros de memórias,
guardar rascunhos e propor contribuições sujeitas a revisão.
Este diretório contém o site; o código de deteção de gestos pertence à instalação.

## Abrir localmente

Na pasta `pages-of-you`, executar:

```powershell
python -m http.server 5500
```

Abrir `http://localhost:5500/`. Não existe compilação nem instalação de pacotes.
A consulta dos dados publicados e a autenticação exigem acesso ao Supabase.

## Organização

| Ficheiro | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura da página e ordem de carregamento dos scripts. |
| `js/state.js` | Estado partilhado, referências ao DOM, permissões e utilitários. |
| `js/ui.js` | Componentes de apresentação, mensagens e formulário do editor. |
| `js/cloud.js` | Sincronização, transações e importação dos dados antigos. |
| `js/auth.js` | Sessão, autenticação, recuperação de palavra-passe e navegação protegida. |
| `js/views.js` | Entrada, biblioteca, leitor, área pessoal, rascunhos e propostas. |
| `js/editor.js` | Fluxos de criação, edição, pré-visualização, publicação e revisão. |
| `js/designer.js` | Estado e operações base do editor visual. |
| `js/designer-geometry.js` | Seleção, transformações, recorte e pegas dos objetos. |
| `js/designer-tools.js` | Ferramentas de desenho, objetos, modelos e organização dos painéis. |
| `js/designer-pages.js` | Composição de páginas, pré-visualização e proteção das memórias aceites. |
| `js/objects.js` | Catálogo e representação dos objetos decorativos. |
| `js/drafts.js` | Rascunhos locais em IndexedDB, com alternativa em localStorage. |
| `js/app.js` | Encaminhamento das rotas, eventos globais e arranque. |
| `supabase/client.js` | Acesso ao serviço, leitura de coleções e gravação de alterações. |

Os scripts são carregados com `defer`, pela ordem indicada no HTML. Partilham o
âmbito da aplicação; não são módulos ES. As funções do editor chamam funções de
outras partes da aplicação, pelo que a ordem deve ser mantida. `app.js` arranca
a aplicação depois de todos os ficheiros terem sido executados.

### Estilos

`css/estilos.css` importa as folhas pela ordem da cascata existente:

- `components.css`: miniaturas, lombadas e pegas.
- `base.css`: base, acessibilidade e componentes iniciais.
- `layout.css`: estruturas das páginas, formulários e editor.
- `editor.css`: composição, tipografia e apresentação dos livros.
- `atelier.css`: ferramentas do atelier e elementos da estante.
- `shelves.css`: composição e disposição das estantes.
- `interface.css`: ajustes da interface, tipografia e adaptações finais.

`identidade.css` é aplicada depois destas folhas e contém a identidade visual
comum ao projeto, incluindo regras destinadas à instalação. Não se deve copiar
esta versão organizada do site por cima do diretório da instalação.
As folhas incluem adaptações responsivas junto dos respetivos componentes.

## Dados e permissões

As contas são geridas pelo Supabase Auth. A tabela `poy_books` guarda os livros;
`poy_contributions` guarda propostas e estados de revisão. O código de um livro
permite encontrá-lo, mas não concede permissão para editar o original.

Os livros públicos podem ser consultados sem sessão; os privados pertencem à
conta responsável. A gravação e as decisões de revisão são verificadas no
servidor. Os rascunhos são locais e separados por conta. A importação dos livros
do protótipo antigo continua disponível sem sobrescrever os dados originais.

Os ficheiros multimédia aceites pelo editor acompanham atualmente os dados do
livro em data URLs. Não existe um bucket de Storage nesta integração.

Consultar `supabase/LE-ME.md` e os dois ficheiros SQL para configurar o serviço.
O SQL é executado no Supabase, não pelo navegador. Nunca colocar uma chave
secreta ou `service_role` nos ficheiros do site.

## Verificação

```powershell
python tests/check_site.py
```

O teste abre um Chrome ou Edge invisível com perfil temporário e usa um Supabase
simulado. Verifica navegação, proteção das páginas, criação, IndexedDB,
recuperação de rascunhos, pré-visualização, publicação, leitura, envio e aceitação
de contribuições. Não cria contas nem altera a base de dados real. Não requer
pacotes Python adicionais. Se necessário, definir `CHROME_PATH`.

`python tests/check_site.py --baseline` executa os mesmos percursos sobre os
ficheiros da revisão Git `HEAD`, para comparação durante uma reorganização.
Os resultados incluem amostras dos estilos calculados nas páginas principais;
as fontes externas são omitidas para uma comparação local estável.

Para verificar apenas a ligação real e as permissões anónimas, sem escrever:

```powershell
python supabase/tests/verify_connection.py
```

O teste simulado não valida as políticas SQL instaladas no serviço. A validação
final da autenticação e das permissões exige contas de teste no Supabase.

## Entrega

Conservar o HTML, as pastas `css/`, `js/` e `supabase/` e `identidade.css` com os
mesmos caminhos. As instruções, o SQL e os testes podem acompanhar a entrega
como documentação, mas não são necessários para servir as páginas. A biblioteca
em `supabase/vendor/` é uma dependência externa e mantém a respetiva licença.
