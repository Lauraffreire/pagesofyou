# Ligação dos dois sites ao Supabase

Os dois sites usam `config.js`, `client.js` e a biblioteca oficial em `vendor/`.
O projeto continua compatível com GitHub Pages e não exige um servidor Node.

## Preparar o Supabase

1. Executar `01-base-de-dados.sql` uma vez no SQL Editor. Esta etapa já foi
   confirmada pela utilizadora.
2. Criar outra consulta e executar `02-operacoes.sql`. Esta etapa é necessária
   para publicar, editar, eliminar e tratar os pedidos de contribuição.
3. Em Authentication, manter o fornecedor Email ativo. A aplicação suporta a
   confirmação por email; não é necessário desativá-la.
4. Em Authentication → URL Configuration, configurar o Site URL e os Redirect
   URLs com o endereço exato do site de criação, incluindo a pasta e `/` final.
   Durante o desenvolvimento, acrescentar também o endereço local que se usa.
   Por exemplo: `http://127.0.0.1:5500/pages-of-you/index.html`.
   A confirmação de conta e a recuperação de palavra-passe regressam a esse site.

`config.js` contém apenas o URL e a chave pública. Nunca colocar chaves
secret/service_role no código. As políticas de RLS limitam a consulta de livros
privados ao proprietário e a edição de qualquer livro ao seu proprietário.
As decisões sobre pedidos verificam a identidade no servidor.

## Primeiro acesso e livros antigos

Abrir o site de criação, criar uma conta real, confirmar o email e iniciar sessão.
A conta Laura do protótipo não é automaticamente uma conta Supabase.

Na área pessoal, usar **Descarregar cópia dos dados antigos** e depois
**Importar livros deste navegador**. Escolher apenas os livros que pertencem à
conta. A visibilidade original é mantida: um livro público fica acessível a todos.
Os livros privados ficam acessíveis só ao proprietário. O original em
`pages-of-you-v1` nunca é sobrescrito. Uma importação repetida para a mesma conta
não volta a propor livros já presentes na coleção dessa conta.

Os pedidos antigos e os rascunhos do protótipo ficam na cópia local e não são
enviados automaticamente. Os novos rascunhos ficam apenas no navegador, separados
por conta, e a interface identifica esse comportamento.

## Imagens e atualização

As imagens e outros ficheiros aceites pelo editor acompanham o JSON do livro,
no formato data URL que o protótipo já usa. Assim também ficam protegidos pela
visibilidade do livro, sem URLs públicas separadas para fotografias privadas.
Esta primeira integração não cria um bucket de Storage. Para coleções grandes,
deve-se migrar os ficheiros para um bucket privado com acesso controlado.

A instalação consulta apenas livros públicos, sem usar a sessão do site de
criação, e atualiza a cada 10 segundos. O site de criação consulta a coleção a
cada 15 segundos quando não existe edição em curso. Os erros de rede ficam
identificados; a aplicação não troca silenciosamente para os livros locais.
Gravações concorrentes recusam uma versão desatualizada para evitar sobrescrever
alterações feitas noutro dispositivo. A aceitação de uma contribuição e a
inclusão da memória no livro acontecem na mesma transação.

## Publicação

Manter as pastas `pages-of-you/`, `instalacao/`, `supabase/` e `identidade.css`
na estrutura atual no mesmo repositório GitHub Pages. Os dois endereços públicos
terão caminhos diferentes, mas consultarão o mesmo Supabase. Não é necessário
publicar as consultas SQL nem as pastas de testes para o site funcionar.

Se forem usados repositórios separados, cada publicação precisa de uma cópia
dos ficheiros partilhados e dos caminhos relativos adaptados. A chave e o URL
devem apontar para o mesmo projeto Supabase nos dois sites.

## Verificação

`python supabase/tests/check_online.py` usa Chrome invisível com perfil temporário
e um SDK simulado, sem criar utilizadores ou escrever no projeto real. Cobre
registo, início e fim de sessão, importação, imagens, dois proprietários,
visibilidade, editor, publicação, contribuições, conflitos e falhas de rede.
Este teste valida a integração da interface; não substitui testes das políticas
SQL no projeto real.

`python supabase/tests/verify_connection.py` verifica a ligação real e o bloqueio
da consulta anónima de pedidos, apenas com operações de leitura. Foi confirmada
uma coleção online vazia e o bloqueio de pedidos sem sessão.

Depois de executar `02-operacoes.sql`, testar com duas contas reais em navegadores
ou perfis diferentes: publicar um livro público e um privado, verificar que a
segunda conta e a instalação apenas recebem o público, e testar o envio e a
aceitação de uma memória. Essa validação real ainda depende da configuração
externa e das contas da utilizadora.
## Organiza??o e publica??o

O site de criação est? em `pages-of-you/` e a instalação em `Instalação/`,
na raiz do projeto. Cada site já cont?m os ficheiros de ligação necess?rios
nas suas próprias pastas; ambos devem apontar para o mesmo projeto Supabase.

Os ficheiros SQL e estas instruções ficam em `pages-of-you/supabase/`.
Os SQL são executados no SQL Editor do Supabase; n?o são carregados pelo site.
Guardar estes ficheiros para manutenção ou reconstrução da base de dados.
A pasta antiga `2 fase/supabase/` deixou de ser necessária.

## Verificação da ligação

A partir da pasta `pages-of-you`, executar:

```powershell
python supabase/tests/verify_connection.py
```

Este verificador usa a configuração local e faz apenas consultas de leitura.
Verifica a ligação real e o bloqueio da consulta anónima de pedidos, sem criar
contas nem escrever dados. Requer acesso à Internet.

Depois de alterar as políticas SQL, testar com duas contas em navegadores ou
perfis diferentes: publicar um livro público e um privado, verificar que a
segunda conta e a instalação apenas recebem o público, e testar o envio e a
aceitação de uma memória.
