import {mechanics,logicProfile} from './solver.mjs';
import {worlds,worldColors} from './worlds.mjs';
const id=name=>document.getElementById(name);
let rulesSignature;
const palettes=worlds.map(worldColors);
export const tileColor=(level,index)=>palettes[level.world-1]?.[index];
export function worldBadge(level) {
  const label=id('world-badge');
  label.hidden=!level.world;
  if (level.world) label.textContent='Wereld '+level.world+' · '+worlds[level.world-1].name;
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
