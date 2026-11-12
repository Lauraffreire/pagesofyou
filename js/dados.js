/* Pessoas e memórias fictícias para demonstrar o projeto. */
const initial = {
  books: [{
    id: 'amelia',
    name: 'Amélia Ferreira',
    dates: '1942 — 2023',
    category: 'Família',
    color: '#697658',
    symbol: '✳',
    subtitle: 'Uma vida de pequenos gestos',
    owner: true,
    visibility: 'public',
    memories: [{
      title: 'A casa cheirava a domingo',
      text: 'A avó Amélia tinha uma maneira especial de reunir toda a gente à mesa. Nunca perguntava se tínhamos fome. Punha mais um prato, cortava mais uma fatia de pão e fazia-nos sentir em casa.\n\nAinda hoje, o cheiro de alecrim me leva de volta à sua cozinha.',
      author: 'Marta · neta'
    }, {
      title: 'O jardim da Amélia',
      text: 'Dizia que as flores precisavam de tempo, tal como as pessoas. No seu jardim havia sempre um lugar à sombra e uma conversa por acabar.',
      author: 'João · amigo'
    }]
  }, {
    id: 'antonio',
    name: 'António Silva',
    dates: '1956 — 2022',
    category: 'Amigos',
    color: '#b16e50',
    symbol: '☼',
    subtitle: 'Os caminhos que partilhámos',
    visibility: 'public',
    memories: [{
      title: 'O caminho até ao mar',
      text: 'Saíamos cedo, ainda com a cidade a acordar. O António conhecia todos os atalhos, mas escolhia sempre o caminho mais demorado. «Há tempo», dizia. E ao lado dele havia mesmo.',
      author: 'Rui · amigo'
    }]
  }, {
    id: 'leonor',
    name: 'Leonor Costa',
    dates: '1938 — 2021',
    category: 'Família',
    color: '#525e74',
    symbol: '❋',
    subtitle: 'Tudo o que nos ensinaste',
    visibility: 'public',
    memories: [{
      title: 'As palavras que ficam',
      text: 'A Leonor escrevia bilhetes para tudo. Dentro de livros, junto à fruta, no bolso de um casaco. Guardámos muitos. São pequenas conversas que continuam connosco.',
      author: 'Sofia · filha'
    }]
  }, {
    id: 'miguel',
    name: 'Miguel Santos',
    dates: '1970 — 2024',
    category: 'Comunidade',
    color: '#aa8c52',
    symbol: '⌁',
    subtitle: 'Uma história feita de encontros',
    visibility: 'public',
    memories: [{
      title: 'Uma porta sempre aberta',
      text: 'No bairro, todos conhecíamos o Miguel. Tinha tempo para ouvir e um talento raro para transformar vizinhos em amigos. Este livro reúne alguns desses encontros.',
      author: 'Ana · vizinha'
    }]
  }],
  pending: [{
    id: 'p1',
    bookId: 'amelia',
    title: 'As tardes de verão',
    text: 'Lembro-me das tardes no quintal, a ouvir as histórias da Amélia e a partilhar limonada. Fazia de cada visita um pequeno acontecimento.',
    author: 'Inês · amiga'
  }]
};
