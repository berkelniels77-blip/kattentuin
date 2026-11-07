import {mechanics,logicProfile} from './solver.mjs';
import {worlds} from './worlds.mjs';
import {levelPalette} from './palettes.mjs';
const id=name=>document.getElementById(name);
let rulesSignature;
export const tileColor=(level,index)=>levelPalette(level).colors[index];
const scenery=[
 ['#eef4df','#bfd5aa','#7d9e71','☘'],['#fff0df','#efc2a1','#ce9877','❀'],
 ['#e4f5f2','#a3d3ce','#669eac','≈'],['#f0eafa','#c6b6dd','#9984b2','✿'],
 ['#fff4da','#edd29a','#c5a269','☀'],['#edf0db','#b5c798','#809674','♧'],
 ['#fff0ec','#f0c0b4','#b2d9d5','≈'],['#e6f0e8','#accbb9','#719487','♧'],
 ['#e9edfa','#b7c3df','#8a91b9','☾'],['#fcf0dd','#dcc096','#b39678','☀'],
 ['#e4eff9','#aac7dd','#819db8','✧'],['#efe9f7','#c5b4db','#9ec4b9','✦']
];
function atmosphere(level) {
 if(!level)return;
 const world=Math.floor((level.id-1)/50)+1;
 const [sky,hill,front,motif]=scenery[(world-1)%scenery.length];
 const root=document.documentElement;
 root.dataset.world=world;
 for(const [name,value] of Object.entries({sky,hill,front}))root.style.setProperty('--world-'+name,value);
 root.style.setProperty('--world-motif','"'+motif+'"');
 return world;
}
export function homeWorld(level) {
 const world=atmosphere(level);
 if(world)id('home-world').textContent='Wereld '+world+' · '+worlds[world-1].name+' · '+((world-1)*50+1)+'–'+world*50;
}
export function worldBadge(level) {
 const world=atmosphere(level),label=id('world-badge');
 label.hidden=false;
 label.textContent='Wereld '+world+' · '+worlds[world-1].name+' · '+levelPalette(level).name;
}
const profiles=new Map();
function speedProfile(level) {
  if (level.logic) return level;
  if (!profiles.has(level.id)) profiles.set(level.id,{...level,logic:logicProfile({...level,quota:1,clues:[]})});
  return profiles.get(level.id);
}



function clearClues() {
  rulesSignature=undefined;
  delete id('board').dataset.clueReveal;
  id('puzzle-rules').hidden=true;
}

export function introduce(level,read,write) {
  const kinds=new Set([...(level.clues || []).map(clue=>clue.kind),...(level.quota===2?['expert']:[])]);
  const seen=read('world.rules',[]);
  const fresh=[...kinds].filter(kind=>!seen.includes(kind));
  if (!fresh.length) return;
  const dialog=document.createElement('dialog');
  const heading=document.createElement('h2');
  heading.textContent='Nieuwe puzzelregels';
  const list=document.createElement('ul');
  for (const kind of fresh) {
    const item=document.createElement('li');
    item.textContent=mechanics[kind].label+' · '+mechanics[kind].description;
    list.append(item);
  }
  const close=document.createElement('button');
  close.className='big violet';
  close.textContent='Begrepen';
  close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{
    write('world.rules',[...new Set([...seen,...fresh])]);
    dialog.remove();
  });
  dialog.append(heading,list,close);
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export function showClues(level,cells,marks,attempts) {
  if (!cells?.length || !marks) return;
  const marked=new Set([...attempts,...marks.flatMap((mark,i)=>mark===2?[i]:[])]);
  const reveal=marked.size>=3 || document.getElementById('board').dataset.clueReveal==='true';
  if (reveal) document.getElementById('board').dataset.clueReveal='true';
  const clues=(level.clues || []).map((clue,i)=>({...clue,label:mechanics[clue.kind].icon+(i+1)}))
    .filter(clue=>clue.kind!=='hidden' || reveal);
  const signature=level.id+':'+reveal;
  if (rulesSignature===signature) return;
  rulesSignature=signature;
  for (const cell of cells) delete cell.dataset.clue;
  const quota=level.quota || 1;
  const rules=id('game').querySelectorAll('.rule-strip li');
  if (rules.length>=2) {
    rules[0].lastChild.textContent=quota===2?'2 katten per kleur':'1 kat per kleur';
    rules[1].lastChild.textContent=quota===2?'2 katten per rij en kolom':'1 kat per rij en kolom';
  }
  const panel=id('puzzle-rules');
  panel.replaceChildren();
  panel.hidden=!clues.length && !level.clues?.some(clue=>clue.kind==='hidden');
  for (const clue of clues) {
    const target=clue.kind==='number'?[clue.center]:clue.cells;
    for (const index of target) {
      const cell=cells[index];
      const tag=clue.kind==='number'?String(clue.count):clue.label;
      cell.dataset.clue=[cell.dataset.clue,tag].filter(Boolean).join(' ');
      if (clue.kind==='forbidden') cell.classList.add('puzzle-forbidden');
    }
    const line=document.createElement('span');
    const count=['forbidden','link'].includes(clue.kind)?'':' = '+clue.count;
    line.textContent=clue.label+count+' '+mechanics[clue.kind].label;
    panel.append(line);
  }
  if (!reveal && level.clues?.some(clue=>clue.kind==='hidden')) panel.append('Verborgen zone verschijnt na drie gemarkeerde vakjes.');
}


export {speedProfile,clearClues};
