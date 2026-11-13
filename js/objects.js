/* Objetos de colagem partilhados pelo editor, leitura e instalação. */
window.PoyObjects = (() => {
  const presets = [
    ['paper-cream','Papel creme','postit','#eee6ce',240,180],
    ['paper-torn','Papel rasgado','postit','#e2dcc3',240,180],
    ['paper-kraft','Papel kraft','postit','#a58a6e',240,170],
    ['paper-rose','Papel rosado','postit','#ead8d0',220,170],
    ['tape-plain','Fita de papel','tape','#d7bc83',180,44],
    ['tape-stripe','Fita às riscas','tape','#779a9b',180,44],
    ['tape-grid','Fita quadriculada','tape','#a39b83',180,44],
    ['tape-dots','Fita com pontos','tape','#b4948f',180,44],
    ['tape-olive','Fita verde','tape','#87906e',180,44],
    ['clip-wire','Clipe metálico','clip','#848783',60,120],
    ['clip-binder','Mola de arquivo','clip','#414641',100,100],
    ['clip-bulldog','Mola de papel','clip','#a95e47',120,80]
  ].map(([id,label,type,color,width,height])=>({id,label,type,color,width,height}));
  const find = id => presets.find(item=>item.id===id);
  const shapes = [
    {id:'star',label:'Estrela',path:'M50 4L61 36 96 37 68 58 78 92 50 72 22 92 32 58 4 37 39 36Z'},
    {id:'sparkle',label:'Estrela de quatro pontas',path:'M50 2Q57 42 98 50Q57 58 50 98Q42 58 2 50Q42 42 50 2Z'},
    {id:'heart',label:'Coração',path:'M50 92C38 80 5 59 5 31C5 3 38 1 50 23C62 1 95 3 95 31C95 59 62 80 50 92Z'},
    {id:'triangle',label:'Triângulo',path:'M50 5L97 94H3Z'},
    {id:'diamond',label:'Losango',path:'M50 2L98 50 50 98 2 50Z'},
    {id:'hexagon',label:'Hexágono',path:'M25 7H75L99 50 75 93H25L1 50Z'},
    {id:'arrow',label:'Seta',path:'M3 35H57V10L98 50 57 90V65H3Z'}
  ];
  const findShape = id => shapes.find(shape=>shape.id===id);

  function svg(item) {
    const shape=findShape(item.shape);
    if(shape) {
      const fill=/^#[a-f0-9]{6}$/i.test(item.color)?item.color:'#b7c6bd';
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${shape.path}" fill="${fill}"/></svg>`;
    }
    const preset=find(item.objectStyle);
    if(!preset) return '';
    const fill=/^#[a-f0-9]{6}$/i.test(item.color)?item.color:preset.color;
    const kind=preset.id;
    let body='';
    if(preset.type==='postit') {
      const shape=kind==='paper-torn'?'M7 15L34 12 60 16 95 12 130 15 165 11 198 15 231 12 233 38 230 66 234 96 231 125 234 156 210 160 180 157 150 161 120 157 90 162 60 158 31 161 6 157 9 127 5 99 9 69 5 42Z':'M8 16L232 12 234 156Q120 166 7 158Z';
      body=`<path d="${shape}" fill="${fill}"/><path d="M8 158Q120 166 234 156" fill="none" stroke="#453b28" stroke-opacity=".16" stroke-width="2"/><path d="M92 5L150 3 149 29 93 31Z" fill="#cfb275" opacity=".7"/><path d="M97 6L98 28M144 5L145 27" stroke="#fff" opacity=".18"/>`;
    } else if(preset.type==='tape') {
      let pattern='';
      if(kind==='tape-stripe') pattern='<path d="M0 0L45 55M25 0L70 55M50 0L95 55M75 0L120 55M100 0L145 55M125 0L170 55M150 0L195 55M175 0L220 55M200 0L245 55" stroke="#fff" stroke-width="7" opacity=".55"/>';
      if(kind==='tape-grid') pattern='<path d="M0 14H240M0 29H240M0 43H240M25 0V55M55 0V55M85 0V55M115 0V55M145 0V55M175 0V55M205 0V55" stroke="#534d43" opacity=".45"/>';
      if(kind==='tape-dots') pattern=Array.from({length:24},(_,i)=>`<circle cx="${12+(i%12)*20}" cy="${i<12?15:38}" r="3" fill="#fff7e9" opacity=".8"/>`).join('');
      body=`<defs><clipPath id="edge"><path d="M5 3L235 0 232 9 239 17 234 26 240 35 234 44 237 52 3 55 7 45 1 36 6 27 0 18 7 10Z"/></clipPath></defs><g clip-path="url(#edge)"><path fill="${fill}" d="M0 0H240V55H0Z"/>${pattern}<path d="M0 5L240 3M0 50L240 48" stroke="#fff" opacity=".18"/></g>`;
    } else if(kind==='clip-wire') {
      const wire='M22 38V88A9 9 0 0 0 40 88V24A15 15 0 0 0 10 24V91A21 21 0 0 0 52 91V35';
      body=`<defs><linearGradient id="wire-metal" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#535957"/><stop offset=".35" stop-color="#d5d8d1"/><stop offset=".65" stop-color="${fill}"/><stop offset="1" stop-color="#6b726d"/></linearGradient></defs><path d="${wire}" fill="none" stroke="url(#wire-metal)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="${wire}" fill="none" stroke="#f4f3eb" stroke-opacity=".6" stroke-width=".8" stroke-linecap="round" transform="translate(-.6 0)"/>`;
    } else if(kind==='clip-binder') {
      body=`<path d="M24 50L30 14Q32 2 46 12L57 24 69 11Q82 2 84 16L88 50" fill="none" stroke="#999b92" stroke-width="4"/><path d="M17 43L92 43 98 86Q60 99 10 86Z" fill="${fill}"/><path d="M17 48H92M18 84Q58 95 91 84" fill="none" stroke="#c5c5b9" stroke-width="2"/>`;
    } else {
      body=`<path d="M8 47H112V72H8Z" fill="${fill}"/><path d="M36 48V23Q36 4 60 4T84 23V48" fill="${fill}"/><circle cx="60" cy="20" r="7" fill="#faf5e9"/><path d="M13 52H107M14 67H106" stroke="#fff" opacity=".45" stroke-width="2"/>`;
    }
    const box=preset.type==='postit'?'0 0 240 180':preset.type==='tape'?'0 0 240 55':kind==='clip-wire'?'0 0 60 120':kind==='clip-binder'?'0 0 110 105':'0 0 120 80';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" preserveAspectRatio="${preset.type==='clip'?'xMidYMid meet':'none'}">${body}</svg>`;
  }
  function style(item) {
    const preset=find(item.objectStyle) || (findShape(item.shape) ? {type:'shape'} : null);
    if(!preset) return '';
    const uri=encodeURIComponent(svg(item)).replace(/'/g,'%27');
    return `background:transparent url('data:image/svg+xml,${uri}') center/${preset.type==='clip'?'contain':'100% 100%'} no-repeat!important;box-shadow:none!important;border:0!important;clip-path:none!important;border-radius:0!important;opacity:1!important;${preset.type==='postit'?'padding:1.2em .7em .7em!important;color:#3f3c33!important;':''}`;
  }
  return {presets:presets.filter(preset=>preset.id!=='clip-binder'),shapes,findShape,find,svg,style};
})();
