const formatter = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'});
const dayMs = 86400000;
export const itemLabels = {
  bow:'Lavendelstrik', crown:'Kroontje', berry:'Bessenmix', soap:'Zeep',
  'flower-wreath':'Bloemenkrans', 'star-glasses':'Sterrenbril',
  'autumn-star':'Herfstster', 'moon-badge':'Maaninsigne', 'test-ticket':'Testticket',
  water:'Water', melon:'Watermeloen', juice:'Appelsap', bubbles:'Bubbelschuim',
  ball:'Strandbal', pillow:'Sterrenkussen'
};
export const dailyRewards = [
  {coins:10}, {coins:12}, {item:'berry'}, {coins:18}, {coins:22}, {item:'soap'}, {coins:35}
];
export const milestones = {
  3:{coins:15}, 7:{coins:35,item:'bow'}, 14:{coins:75}, 30:{coins:150,item:'crown'}
};
export const wheelPrizes = [
  {label:'8 muntjes',icon:'8',weight:24,color:'#f7cc8f',reward:{coins:8}},
  {label:'18 muntjes',icon:'18',weight:25,color:'#ebabc4',reward:{coins:18}},
  {label:'35 muntjes',icon:'35',weight:18,color:'#a5d3bb',reward:{coins:35}},
  {label:'Zeep',icon:'🧼',weight:16,color:'#bdb1e8',reward:{item:'soap'}},
  {label:'Sterrenbril',icon:'★',weight:9,color:'#f5a891',reward:{item:'star-glasses'}},
  {label:'Bloemenkrans',icon:'✿',weight:8,color:'#a8c5eb',reward:{item:'flower-wreath'}}
];

export function dutchDay(ms) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(ms)).map(part=>[part.type,part.value]));
  return Date.UTC(+parts.year,+parts.month-1,+parts.day) / dayMs;
}
export function weekStart(day) { return day - ((day+3)%7+7)%7; }
export function isoDay(day) { return new Date(day * dayMs).toISOString().slice(0,10); }
export function nextMidnight(now) {
  const day = dutchDay(now);
  let low = now, high = now + 27*3600000;
  while (high-low>1) {
    const mid = Math.floor((low+high)/2);
    if (dutchDay(mid)===day) low=mid;
    else high=mid;
  }
  return high;
}

export function createState() {
  return {coins:0, items:{}, weeks:{}, daily:{streak:0}, solved:{}, clockShift:0,
    puzzleId:200, pet:{food:65,clean:58,joy:70,lastCare:0}};
}
export function testNow(state) { return Date.now() + state.clockShift; }
export function themeFor(config, monday) {
  const themes = config.themes;
  const exact = themes.find(theme=>theme.start===isoDay(monday));
  if (exact) return exact;
  const first = Date.parse(themes[0].start+'T00:00:00Z')/dayMs;
  const index = ((Math.floor((monday-first)/7)%themes.length)+themes.length)%themes.length;
  const {skin,passItems,...fallback}=themes[index];
  return {...fallback,start:isoDay(monday)};
}
export function activeWeek(state, config, day) {
  const monday = Math.max(state.latestWeek ?? -Infinity, weekStart(day));
  state.latestWeek = monday;
  const id = isoDay(monday);
  state.weeks[id] ||= {theme:themeFor(config,monday),xp:0,claims:{},questClaims:{},events:{}};
  return state.weeks[id];
}
export function visit(state,day) {
  const daily = state.daily;
  if (day <= (daily.lastActive ?? -Infinity)) return false;
  daily.streak = day === daily.lastActive+1 ? daily.streak+1 : 1;
  daily.lastActive = day;
  return true;
}
export function grant(state,week,reward) {
  state.coins += reward.coins || 0;
  week.xp += reward.xp || 0;
  if (reward.item) {
    state.itemGrants ||= {...state.items};
    state.items[reward.item] = (state.items[reward.item] || 0) + 1;
    state.itemGrants[reward.item] = (state.itemGrants[reward.item] || 0) + 1;
  }
}
export function event(state,config,day,kind,xp=0) {
  visit(state,day);
  const week = activeWeek(state,config,day);
  week.events[kind] = (week.events[kind] || 0) + 1;
  week.xp += xp;
  return week;
}
export function recordWeekPuzzle(state,config,day,id,xp) {
  const week=activeWeek(state,config,day);
  week.puzzleXp ||= {};
  if (Object.hasOwn(week.puzzleXp,id)) return null;
  week.puzzleXp[id]=xp;
  event(state,config,day,'puzzle',xp);
  return xp;
}
export function dailyOffer(streak) {
  const base = dailyRewards[(Math.max(streak,1)-1)%dailyRewards.length];
  return {base,bonus:milestones[streak]};
}
export function claimDaily(state,config,day) {
  if (day < (state.daily.lastActive ?? -Infinity) || day <= (state.daily.lastClaim ?? -Infinity)) return null;
  const week = event(state,config,day,'daily');
  const offer = dailyOffer(state.daily.streak);
  state.daily.lastClaim = day;
  grant(state,week,offer.base);
  if (offer.bonus) grant(state,week,offer.bonus);
  return offer;
}

export function randomPercent(source = globalThis.crypto) {
  const sample = new Uint32Array(1);
  const ceiling = Math.floor(2**32/100)*100;
  do { source.getRandomValues(sample); } while (sample[0]>=ceiling);
  return sample[0]%100;
}
export function spinWheel(state,config,day,source) {
  if (day < (state.daily.lastActive ?? -Infinity) || day <= (state.daily.spinDay ?? -Infinity)) return null;
  const roll = randomPercent(source);
  let start = 0;
  for (const prize of wheelPrizes) {
    if (roll < start+prize.weight) {
      const week = event(state,config,day,'spin');
      grant(state,week,prize.reward);
      state.daily.spinDay = day;
      state.daily.lastSpin = {label:prize.label,angle:(start+prize.weight/2)*3.6};
      return state.daily.lastSpin;
    }
    start += prize.weight;
  }
  throw Error('Kansen van het rad tellen niet op tot 100%.');
}
export function claimTier(state,weekId,tierId) {
  const week = state.weeks[weekId];
  const tier = week?.theme.tiers.find(item=>item.id===tierId);
  if (!tier || Object.hasOwn(week.claims,tierId) || week.xp<tier.xp) return null;
  week.claims[tierId] = true;
  // Any archived XP belongs to its own week.
  grant(state,week,tier.reward);
  return tier;
}
export function claimQuest(week,id) {
  const quest = week?.theme.quests.find(item=>item.id===id);
  if (!quest || Object.hasOwn(week.questClaims,id) || (week.events[quest.event] || 0)<quest.target) return null;
  week.questClaims[id] = true;
  week.xp += quest.xp;
  return quest;
}
export function recordPuzzle(state,config,day,id,lives,bonus,xp) {
  if (state.solved[id]) return null;
  const coins = 6+2*lives;
  state.coins += coins;
  state.solved[id] = {coins,xp,bonus};
  if (xp>0) recordWeekPuzzle(state,config,day,id,xp);
  return state.solved[id];
}

const safeId = id => typeof id==='string' && /^[a-z][a-z0-9-]{0,32}$/.test(id) && id!=='constructor';
const safeInt = (value,max) => Number.isInteger(value) && value>0 && value<=max;
const unique = list => new Set(list).size===list.length;
const hex = value => typeof value==='string' && /^#[a-fA-F0-9]{6}$/.test(value);
export function validateThemes(config) {
  const themes = config?.themes;
  if (!Array.isArray(themes) || !themes.length || themes.length>30) throw Error('Gebruik één tot dertig thema’s.');
  for (const theme of themes) {
    const day = Date.parse(theme?.start+'T00:00:00Z')/dayMs;
    if (!Number.isInteger(day) || isoDay(day)!==theme.start || day!==weekStart(day)) throw Error('Kies een geldige maandag als startdatum.');
    if (typeof theme.name!=='string' || !theme.name.trim() || theme.name.length>45 ||
      typeof theme.description!=='string' || theme.description.length>200 ||
      (theme.note!==undefined && (typeof theme.note!=='string' || theme.note.length>200))) throw Error('Naam of beschrijving is ongeldig.');
    if (!['accent','background','end'].every(key=>hex(theme.colors?.[key]))) throw Error('Gebruik drie kleuren in #RRGGBB-formaat.');
    if (theme.skin && (!safeId(theme.skin.id) || typeof theme.skin.name!=='string' ||
      !theme.skin.name.trim() || theme.skin.name.length>45 || theme.skin.art!=='skin-'+theme.skin.id+'.svg')) {
      throw Error('Geef de weekskin een naam, unieke ID en bestandsnaam skin-ID.svg.');
    }
    if (theme.passItems!==undefined && (!Array.isArray(theme.passItems) ||
      !theme.passItems.every(item=>safeId(item?.id) && safeInt(item.stage,39) &&
        typeof item.label==='string' && item.label.trim() && item.label.length<=45 &&
        typeof item.icon==='string' && item.icon.trim() && item.icon.length<=12 &&
        (item.type==='Accessoire' || (['Speelgoed','Meubel'].includes(item.type) && ['living','kitchen','bath','bedroom'].includes(item.room)))) ||
      !unique(theme.passItems.map(item=>item.id)) || !unique(theme.passItems.map(item=>item.stage)))) {
      throw Error('Gebruik unieke item-ID’s en levels van 1 t/m 39. Kies een type en, voor meubels en speelgoed, een kamer.');
    }
    if (theme.image && (typeof theme.image!=='string' || !/^(?:custom\/)?[a-z0-9-]+\.(webp|svg|png|jpg|jpeg)$/.test(theme.image))) throw Error('Gebruik een lokale afbeelding, bijvoorbeeld mascot.webp of custom/mijn-thema.webp.');
    if (!Array.isArray(theme.tiers) || !theme.tiers.length || theme.tiers.length>12 ||
      !theme.tiers.every((tier,i)=>safeId(tier?.id) && safeInt(tier.xp,10000) &&
        (!i || theme.tiers[i-1].xp<tier.xp) && typeof tier.label==='string' && tier.label.trim() && tier.label.length<=55 &&
        tier.reward && Object.keys(tier.reward).length>0 && Object.keys(tier.reward).every(key=>
          key==='coins' || key==='xp' ? safeInt(tier.reward[key],10000) : key==='item' && safeId(tier.reward.item)
        )) || !unique(theme.tiers.map(tier=>tier.id))) throw Error('Controleer de beloningen, unieke ID’s en oplopende XP-grenzen.');
    if (!Array.isArray(theme.quests) || theme.quests.length>12 ||
      !theme.quests.every(quest=>safeId(quest?.id) && ['puzzle','care','daily','spin'].includes(quest.event) &&
        safeInt(quest.target,100) && safeInt(quest.xp,10000) && typeof quest.label==='string' && quest.label.length<=70) ||
      !unique(theme.quests.map(quest=>quest.id))) throw Error('Controleer de opdrachten, XP en unieke ID’s.');
  }
  if (!unique(themes.map(theme=>theme.start))) throw Error('Gebruik per thema een verschillende startdatum.');
  if (!unique(themes.flatMap(theme=>theme.skin?[theme.skin.id]:[]))) throw Error('Gebruik voor elke weekskin een andere ID.');
  return {themes:[...themes].sort((a,b)=>a.start.localeCompare(b.start))};
}

export function speedWindow(puzzle) {
  const full = Math.round(7 + 1.05*puzzle.n + Math.min(16,puzzle.logic.rating/35) + (puzzle.quota===2 ? 5 : 0));
  return {full, medium:Math.round(full*1.65), end:Math.round(full*2.45)};
}
export function speedPoints(puzzle,elapsedMs) {
  const {full,medium,end}=speedWindow(puzzle);
  return elapsedMs <= full*1000 ? 40 : elapsedMs <= medium*1000 ? 25 : elapsedMs <= end*1000 ? 10 : 0;
}
