export const mechanics = {
  forbidden: {icon:'×', label:'Verboden vakjes', description:'In een vakje met een rood kruis mag geen kat staan.'},
  diagonal: {icon:'╱', label:'Diagonale regel', description:'De vakjes met dezelfde diagonaalmarkering bevatten samen precies het aangegeven aantal katten.'},
  number: {icon:'#', label:'Getalaanwijzing', description:'Het getal telt katten in de maximaal acht omliggende vakjes. Het middelste vakje telt niet mee.'},
  link: {icon:'↔', label:'Gekoppelde vakjes', description:'Van de twee vakjes met hetzelfde linkteken bevat precies één vakje een kat.'},
  zone: {icon:'◇', label:'Speciale zone', description:'De gemarkeerde zone bevat precies het aangegeven aantal katten, los van de gekleurde gebieden.'},
  hidden: {icon:'◈', label:'Verborgen zone', description:'Na drie zetten verschijnt een extra zone met een eigen aantal katten. De gekleurde gebieden blijven vanaf het begin geldig.'},
  expert: {icon:'Ⅱ', label:'Twee katten', description:'Plaats twee katten per rij, kolom en gekleurd gebied. Katten mogen elkaar nergens raken.'}
};

export function nearby(index, n) {
  const y = Math.floor(index / n), x = index % n;
  const cells = [];
  for (let r = Math.max(0, y - 1); r <= Math.min(n - 1, y + 1); r++) {
    for (let c = Math.max(0, x - 1); c <= Math.min(n - 1, x + 1); c++) {
      if (r !== y || c !== x) cells.push(r * n + c);
    }
  }
  return cells;
}

export function groupsFor(puzzle) {
  const {n, regions, quota, clues} = puzzle;
  const groups = Array.from({length:3 * n}, () => ({cells:[], count:quota}));
  for (let i = 0; i < n * n; i++) {
    groups[Math.floor(i / n)].cells.push(i);
    groups[n + i % n].cells.push(i);
    groups[2 * n + parseInt(regions[i], 36)].cells.push(i);
  }
  return groups.concat(clues.map(({cells,count}) => ({cells,count})));
}

export function solvePuzzle(puzzle, limit = 2) {
  const {n, quota} = puzzle;
  const groups = groupsFor(puzzle);
  const members = Array.from({length:n*n}, () => []);
  const excluded = new Set();
  groups.forEach((group,index) => group.cells.forEach(cell => {
    members[cell].push(index);
    if (!group.count) excluded.add(cell);
  }));
  const columns = [];
  for (let mask = 1; mask < 2**n; mask++) {
    if (mask & (mask << 1)) continue;
    const list = [];
    for (let col = 0; col < n; col++) if (mask & (1 << col)) list.push(col);
    if (list.length === quota) columns.push({mask,list});
  }
  const options = Array.from({length:n}, (_,row) => columns.flatMap(({mask,list}) => {
    const cells = list.map(col => row*n+col);
    if (cells.some(cell => excluded.has(cell))) return [];
    const hits = new Map();
    for (const cell of cells) for (const group of members[cell]) hits.set(group, (hits.get(group) || 0) + 1);
    if ([...hits].some(([g,count]) => count > groups[g].count)) return [];
    return [{mask,cells,hits:[...hits]}];
  }));
  const future = Array.from({length:n+1}, () => new Uint8Array(groups.length));
  for (let row = n-1; row >= 0; row--) {
    const max = new Uint8Array(groups.length);
    for (const {hits} of options[row]) for (const [g,count] of hits) max[g] = Math.max(max[g],count);
    for (let g = 0; g < groups.length; g++) future[row][g] = future[row+1][g] + max[g];
  }
  const counts = new Uint8Array(groups.length);
  const path = [];
  const solutions = [];
  let nodes = 0;
  function search(row, previous) {
    nodes++;
    if (row === n) { solutions.push(path.flat()); return; }
    const neighbors = previous | previous << 1 | previous >> 1;
    for (const option of options[row]) {
      if (solutions.length >= limit) return;
      if ((option.mask & neighbors) || option.hits.some(([g,count]) => counts[g]+count > groups[g].count)) continue;
      for (const [g,count] of option.hits) counts[g] += count;
      if (groups.every((group,g) => counts[g]+future[row+1][g] >= group.count)) {
        path[row] = option.cells;
        search(row+1, option.mask);
      }
      for (const [g,count] of option.hits) counts[g] -= count;
    }
  }
  search(0,0);
  return {count:solutions.length, solutions, nodes};
}

export function validatePlacement(puzzle, cats) {
  if (cats.size !== puzzle.n * puzzle.quota) return false;
  return groupsFor(puzzle).every(group => group.cells.filter(cell => cats.has(cell)).length === group.count)
    && [...cats].every(cell => !nearby(cell,puzzle.n).some(neighbor => cats.has(neighbor)));
}

// Model the deductions a player can make without trying a candidate.
export function logicProfile(puzzle) {
  const groups = groupsFor(puzzle);
  const neighbors = Array.from({length:puzzle.n**2}, (_, cell) => nearby(cell,puzzle.n));
  const steps=[];
  function propagate(state, record=false) {
    let changed = true;
    function mark(cell, value) {
      if (state[cell] && state[cell] !== value) return false;
      if (!state[cell]) { state[cell] = value; changed = true; }
      return true;
    }
    while (changed) {
      changed = false;
      for (const [groupIndex,group] of groups.entries()) {
        let placed = 0;
        const free = [];
        for (const cell of group.cells) {
          if (state[cell] === 1) placed++;
          else if (!state[cell]) free.push(cell);
        }
        if (placed > group.count || placed + free.length < group.count) return false;
        if (placed === group.count || placed + free.length === group.count) {
          if(record && free.length) steps.push((groupIndex<puzzle.n?'row':groupIndex<puzzle.n*2?'column':groupIndex<puzzle.n*3?'region':'clue')+':'+(placed===group.count?'exclude':'place')+':'+free.length);
          for (const cell of free) if (!mark(cell, placed === group.count ? -1 : 1)) return false;
        }
      }
      for (let cell = 0; cell < state.length; cell++) {
        if (state[cell] === 1) for (const other of neighbors[cell]) if (!mark(other, -1)) return false;
      }
    }
    return true;
  }
  const state = new Int8Array(puzzle.n**2);
  propagate(state,true);
  const countUnknown = () => state.reduce((sum,cell) => sum + Number(!cell),0);
  const afterBasic = countUnknown();
  let probes = 0, deductions = 0;
  // Try both possibilities at one cell, stopping when neither produces a local contradiction.
  let changed = true;
  while (changed && probes < 220) {
    changed = false;
    for (let cell = 0; cell < state.length && probes < 220; cell++) {
      if (state[cell]) continue;
      for (const assumption of [1,-1]) {
        const branch = state.slice();
        branch[cell] = assumption;
        probes++;
        if (!propagate(branch)) {
          steps.push('contradiction:'+assumption+':'+cell);
          state[cell] = -assumption;
          propagate(state,true);
          deductions++;
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  const remaining = countUnknown();
  return {afterBasic, probes, deductions, remaining, steps,
    rating:afterBasic*2 + deductions*3 + Math.round(probes/4) + remaining*5};
}
