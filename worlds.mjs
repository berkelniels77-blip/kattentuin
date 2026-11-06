import {logicProfile} from './solver.mjs';

export const worlds=[
  ['Klaverveld',30,42,'horizontal',3],
  ['Perzikgaard',19,44,'vertical',6],
  ['Waterlelietuin',185,36,'horizontal',1],
  ['Lavendeldreef',257,35,'vertical',4],
  ['Zonneterras',43,41,'horizontal',7],
  ['Mosvallei',111,35,'vertical',2],
  ['Koraalkust',349,38,'horizontal',5],
  ['Dauwbos',156,42,'vertical',8],
  ['Maanserre',229,39,'horizontal',2],
  ['Amberduinen',37,46,'vertical',5],
  ['Sterrenhaven',205,38,'horizontal',8],
  ['Noorderlicht',289,36,'vertical',3]
].map(([name,hue,contrast,axis,spread],i)=>({id:i+1,name,hue,contrast,axis,spread}));

const curve=[[0,18],[50,32],[100,48],[150,65],[200,86],[250,112],[300,139],
  [350,169],[400,199],[450,228],[500,256],[550,285],[600,332]];
export function targetDifficulty(id) {
  const end=curve.findIndex(([level])=>level>=id);
  const [startLevel,startScore]=curve[end-1], [endLevel,endScore]=curve[end];
  return Math.round(startScore+(id-startLevel)/(endLevel-startLevel)*(endScore-startScore));
}

export function assess(puzzle) {
  const logic=logicProfile(puzzle);
  // Unresolved work is weighted without making the lookahead cutoff a large scoring cliff.
  const rating=logic.afterBasic*2+logic.deductions*3+Math.round(logic.probes/4)+logic.remaining*2;
  return {...logic,rating};
}

export function worldColors(world) {
  const offsets=[0,139,220,63,300,100,175,34,268,195,325,82];
  return offsets.map((offset,i)=>'hsl('+((world.hue+offset)%360)+' '+(world.contrast+(i%3)*9)+'% '+(70+i%4*5)+'%)');
}

function borders(regions,n) {
  const result=[];
  for (let cell=0;cell<n*n;cell++) {
    if (cell%n+1<n) result.push(regions[cell]!==regions[cell+1]);
    if (cell+n<n*n) result.push(regions[cell]!==regions[cell+n]);
  }
  return result;
}

export function difference(first,second) {
  if (!first || first.n!==second.n) return 1;
  const {n}=second;
  const reference=borders(first.regions,n);
  let minimum=1;
  for (let mode=0;mode<8;mode++) {
    const rotated=Array.from({length:n*n},(_,i)=>{
      let x=i%n,y=Math.floor(i/n);
      if (mode&1) x=n-1-x;
      if (mode&2) y=n-1-y;
      if (mode&4) [x,y]=[y,x];
      return second.regions[y*n+x];
    });
    const pattern=borders(rotated,n);
    let changed=0,total=0;
    for (let i=0;i<pattern.length;i++) {
      if (reference[i] || pattern[i]) total++;
      if (reference[i]!==pattern[i]) changed++;
    }
    minimum=Math.min(minimum,changed/total);
  }
  return minimum;
}
