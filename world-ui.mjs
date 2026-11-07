import {mechanics,logicProfile} from './solver.mjs';
import {worlds} from './worlds.mjs';
import {levelPalette,worldNumber} from './palettes.mjs';
const id=name=>document.getElementById(name);
let rulesSignature;
export const tileColor=(level,index)=>levelPalette(level).colors[index];
const scenery = [
  ['#dbeccc','#426d49'], ['#f8cfb6','#8b4e38'], ['#cee9e9','#2b6779'],
  ['#e6d9f3','#695090'], ['#f9e4b2','#80551c'], ['#d9e5bc','#526a39'],
  ['#f5d7d4','#8f4862'], ['#bed8ce','#37665a'], ['#d4dcf2','#4f598c'],
  ['#f2d2ab','#925227'], ['#c2d6ef','#345887'], ['#d0c8e9','#5c478a']
];
function atmosphere(level) {
  if (!level) return;
  const world=worldNumber(level);
  const [sky,accent]=scenery[world-1];
  const root=document.documentElement;
  root.dataset.world=world;
  root.style.setProperty('--world-sky',sky);
  root.style.setProperty('--world-accent',accent);
  root.style.setProperty('--world-art',`url("./assets/world-${String(world).padStart(2,'0')}.svg")`);
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
