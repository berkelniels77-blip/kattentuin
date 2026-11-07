// Presentation only: never used by the solver, scoring or save data.
export const palettes = [
  {name:'Pastel', colors:['#edb84c','#e88fb3','#65b9d5','#9b80d0','#8cba60','#43a8a0','#efa074','#a8bddb','#aa775b','#d7a8d6','#bedc8d','#668bc1']},
  {name:'Oceaan', colors:['#50b8b4','#83c8eb','#ecaa78','#8777c6','#df91af','#aac86d','#547fa9','#efcf67','#b798ce','#ba815f','#8bd4c4','#dc718b']},
  {name:'Herfst', colors:['#dfa24d','#b8795b','#92b276','#e995a0','#77b5c2','#c1a0d1','#e8c76a','#a1cfc1','#bd789e','#728dbe','#dcb7a2','#a4bbdb']},
  {name:'Candy', colors:['#e57fae','#9e86d8','#66beca','#efba60','#a2c87c','#e99576','#83a4d1','#c4a5cf','#d77577','#a6d8bc','#b38b69','#e4c87e']},
  {name:'Natuur', colors:['#88b46d','#51a99d','#e2bd63','#b68c6d','#99bdda','#ce8fa5','#8b85c7','#c3d78c','#edab83','#70a9c4','#d7ade0','#e38685']}
];
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
export function colorDistance(a,b){const x=rgb(a),y=rgb(b);return Math.sqrt(x.reduce((sum,v,i)=>sum+(v-y[i])**2,0));}
const cache=new Map();
export function levelPalette(level) {
  const key=level.id+':'+level.regions;
  if(cache.has(key)) return cache.get(key);
  const palette=palettes[(level.id-1+Math.floor((level.id-1)/5)*2)%palettes.length];
  const {n,regions}=level, adjacent=Array.from({length:n},()=>new Set());
  for(let cell=0;cell<n*n;cell++) for(const next of [cell%n<n-1?cell+1:-1,cell+n<n*n?cell+n:-1]) {
    if(next<0)continue;
    const a=parseInt(regions[cell],36), b=parseInt(regions[next],36);
    if(a!==b){adjacent[a].add(b);adjacent[b].add(a);}
  }
  const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>adjacent[b].size-adjacent[a].size);
  let best, quality=-1;
  // Search several deterministic assignments; every area has its own color.
  for(let trial=0;trial<24;trial++) {
    const available=palette.colors.map((_,i)=>(i+level.id*7+trial)%12), result=[];
    for(const region of order) {
      let choice=available[0], value=-1;
      for(const color of available) {
        const neighbors=[...adjacent[region]].filter(other=>result[other]);
        const distance=neighbors.length?Math.min(...neighbors.map(other=>colorDistance(palette.colors[color],result[other]))):200;
        if(distance>value){value=distance;choice=color;}
      }
      result[region]=palette.colors[choice];available.splice(available.indexOf(choice),1);
    }
    const minimum=Math.min(...adjacent.flatMap((others,a)=>[...others].map(b=>colorDistance(result[a],result[b]))));
    if(minimum>quality){quality=minimum;best=result;}
  }
  const result={name:palette.name,colors:best,minimumDistance:quality};cache.set(key,result);return result;
}
