// Presentation only: never used by the solver, scoring or save data.
const palettes = [
  ['Klaver & honing','8fbe6c d7da70 f3bc57 63ac93 e8a581 a9c8dc b3a0d6 d993a6 6f9c70 d6c8a1 70b8b4 e4b7ce'],
  ['Perzikbloesem','e9977a f2b267 ecb6ac b47863 f3cd8f d389a7 9e7eb4 81ab7c a7c2df b6a089 78b3ab c3cc86'],
  ['Vijvergolf','5aadc4 68bfb1 7da3d5 93cadd 507f9a a3c67a f4cb78 db8ca8 b397d2 8ad6ba eaa680 a8b5de'],
  ['Lavendelzijde','a089ce 8472b5 b5a2df c68cbc dda7d1 839bd2 67b1c6 e2c182 a2c295 efad93 82ada6 d57d9a'],
  ['Citroenpatio','f3cb55 e8a949 f0df92 ce8d5d e88166 a2bc65 69afa5 78a8cc d88eae ab95ce d5b28a a8d1b6'],
  ['Mos & steen','819c64 a9b578 c4ce96 a57c5c e0ab76 618f79 7dadad b5a5c6 d6acb1 9aa5c5 d9cb85 cb8e86'],
  ['Koraal & schelp','e68c95 e8a38b f3bd9c d77a9b dcc5a4 58b7b2 8bcbd0 739bc2 b398cf aec67f e8ca70 9e889d'],
  ['Dauwdruppels','68a18d 84b69e 8dc1b5 6195a1 aac8a0 b4d2d9 8e9fc6 b4a1c5 e0b67e d794a2 d4cf9c c39479'],
  ['Maanglas','8191c3 9ba7df b3afd4 7c81a6 c4ade6 7aaab9 b2c6dc e7d091 d893b7 94ba9b d9ab91 64a39d'],
  ['Amberzand','dc9d55 edbd7d f5d693 c28a67 cf7761 a9809a 8ba795 d4c48f 86acc2 e4a496 a8a7cf 7eae85'],
  ['Havenlicht','6f9ac6 5f80af 97b9df 86abc8 83bdb6 eac97e d9a2a9 b4a2d5 a3c58a e6a37b 9b7fae c6c6df'],
  ['Aurorasluier','82c8b2 66b6a2 8ca9dc b4a0df 9a82c9 e0abd4 93c7de c3d29d e8c883 d788ad 7a8cbb eba996']
].map(([name,colors])=>({name,colors:colors.split(' ').map(color=>'#'+color)}));
export const worldNumber = level => Math.floor((level.id-1)/50)+1;

function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
export function colorDistance(a,b){const x=rgb(a),y=rgb(b);return Math.sqrt(x.reduce((sum,v,i)=>sum+(v-y[i])**2,0));}
const cache=new Map();
export function levelPalette(level) {
  const key=level.id+':'+level.regions;
  if(cache.has(key)) return cache.get(key);
  const palette=palettes[worldNumber(level)-1];
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
