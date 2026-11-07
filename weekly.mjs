import {activeWeek,claimDaily,claimQuest,createState,dailyOffer,dutchDay,event,isoDay,itemLabels,nextMidnight,
  recordWeekPuzzle,validateThemes,visit,weekStart} from './economy.mjs';
import {currentPassLevel,puzzleXp,requiredXp,stageCount,stageReward,trackSkin,stageClaimStatus,claimMilestone} from './pass-track.mjs';
import {speedProfile} from './world-ui.mjs';

const key='weekly.004';
const $=id=>document.getElementById(id);
const dayMs=86400000;
const weekday=new Intl.DateTimeFormat('nl-NL',{weekday:'short',timeZone:'UTC'});
const amount=value=>value.toLocaleString('nl-NL');
const text=(tag,content,className)=>{
  const node=document.createElement(tag);
  if (content) node.textContent=content;
  if (className) node.className=className;
  return node;
};
const rewardText=reward=>[reward?.coins && amount(reward.coins)+' muntjes',reward?.item && itemLabels[reward.item]].filter(Boolean).join(' + ');

export function initWeekly({read,write,transact,refreshWallet,openPuzzle}) {
  const pass=$('pass-dialog'), wheel=$('wheel-dialog');
  const stored=()=>read(key,null);
  const data=()=>stored() || createState();
  let config, pickedWeek, pickedStage, displayedWeek, displayedLevel, lastPaint, lastPassData, toastTimer;

  function enter(current) {
    const day=dutchDay(Date.now());
    if (current.daily.lastActive===undefined) {
      const old=read('wheel',{});
      if (Number.isInteger(old.visitDay) && old.visitDay<=day) {
        current.daily.lastActive=old.visitDay;
        current.daily.streak=old.streak || 1;
      }
    }
    visit(current,day);
    const active=activeWeek(current,config,day);
    const spinDay=read('wheel',{}).spinDay;
    const spinWeek=Number.isInteger(spinDay) && spinDay<=day ? current.weeks[isoDay(weekStart(spinDay))] : null;
    if (spinWeek) {
      (spinWeek.spinDays ||= {})[spinDay]=true;
      spinWeek.events.spin=Math.max(spinWeek.events.spin || 0,Object.keys(spinWeek.spinDays).length);
    }
    return active;
  }
  async function change(action=()=>{}) {
    if (!config) return null;
    const result=await transact(()=>{
      const current=data();
      const before=JSON.stringify(current);
      const week=enter(current);
      const result=action(current,week);
      if (before!==JSON.stringify(current) && !write(key,current)) return null;
      return result;
    });
    render();
    return result;
  }

  const hud=text('div','','pass-hud');
  const hudLabel=text('strong');
  hudLabel.setAttribute('aria-live','polite');
  const hudXp=text('span');
  hud.append(hudLabel,hudXp);
  function placeHud() {
    const open=[...document.querySelectorAll('dialog[open]')];
    const top=open.reduce((latest,item)=>(order.get(item)||0)>=(order.get(latest)||0)?item:latest,null);
    const parent=top || document.body;
    if (hud.parentElement!==parent) parent.prepend(hud);
  }
  let orderId=0;
  const order=new WeakMap();
  function render() {
    const current=stored();
    if (!current) return;
    const id=isoDay(current.latestWeek), week=current.weeks[id], level=currentPassLevel(week);
    if (displayedWeek===id && level>displayedLevel) {
      hud.classList.remove('pass-hud-up');
      void hud.offsetWidth;
      hud.classList.add('pass-hud-up');
    }
    displayedWeek=id;
    displayedLevel=level;
    const label='Passlevel '+level, xp=amount(week.xp)+' XP';
    if (hudLabel.textContent!==label) hudLabel.textContent=label;
    if (hudXp.textContent!==xp) hudXp.textContent=xp;
    if (pass.open) renderPass(current,id);
    if (wheel.open) renderDaily(current);
  }

  function renderPass(current,latest) {
    const weeks=Object.keys(current.weeks).sort().reverse();
    if (!current.weeks[pickedWeek]) pickedWeek=latest;
    const week=current.weeks[pickedWeek], level=currentPassLevel(week), theme=week.theme;
    const snapshot=JSON.stringify([weeks,pickedWeek,week]);
    if (lastPassData===snapshot) return;
    lastPassData=snapshot;
    const skin=week.track?.skin || trackSkin(week);
    const weekPicker=$('week-picker');
    if (weekPicker.options.length!==weeks.length || weekPicker.options[0]?.value!==latest) {
      weekPicker.replaceChildren(...weeks.map(id=>new Option(id+(id===latest?' · Actief':' · Archief'),id)));
    }
    weekPicker.value=pickedWeek;
    $('pass-dates').textContent=pickedWeek+(pickedWeek===latest?' · Actief':' · Archief');
    $('theme-name').textContent=theme.name;
    $('theme-description').textContent=theme.description;
    $('theme-note').textContent=skin?'Level 40 · '+skin.name:'40 mijlpalen met XP uit Meowdoku';
    const hero=$('pass-hero');
    for (const [name,color] of Object.entries(theme.colors)) hero.style.setProperty('--theme-'+name,color);
    const picture=$('theme-image');
    picture.hidden=!skin && !theme.image;
    if (skin || theme.image) {
      picture.src=theme.image==='capy-portrait.webp' && !skin ? './capy-portrait.webp' : './assets/'+(skin?.art || theme.image.split('/').at(-1));
      picture.alt=skin?.name || '';
    }
    $('pass-xp').textContent=amount(week.xp)+' XP';
    $('pass-progress').max=requiredXp(stageCount);
    $('pass-progress').value=week.xp;
    const unclaimed=Array.from({length:stageCount},(_,i)=>i+1).filter(stage=>stageClaimStatus(current,week,stage)==='ready').length;
    $('pass-cleared').textContent='Level '+level+' / '+stageCount+(unclaimed?' · '+unclaimed+' te claimen':'');
    $('pass-earn-xp').hidden=pickedWeek!==latest;
    $('pass-earn-xp').onclick=()=>{
      if (openPuzzle(week.puzzleXp || {})) pass.close();
    };
    const stamp=pickedWeek+':'+level;
    const advanced=lastPaint!==stamp;
    if (advanced) pickedStage=level;
    lastPaint=stamp;
    const list=$('tiers');
    const scroll=list.scrollLeft;
    list.replaceChildren(...Array.from({length:stageCount},(_,index)=>{
      const stage=index+1, prize=stageReward(week,stage);
      const status=stageClaimStatus(current,week,stage);
      const card=text('li','','pass-tile '+(status==='ready'?'available claim-ready':stage<=level?'cleared':'locked')+
        (stage===stageCount?' finale':''));
      const tile=text('button');
      tile.type='button';
      tile.dataset.stage=stage;
      tile.setAttribute('aria-label','Level '+stage+' · '+(status==='ready'?'Te claimen':status==='claimed'?'Geclaimd':stage<=level?'Vrijgespeeld':'Op slot'));
      const graphic=text('span',prize?.icon || '✦','tile-prize');
      if (stage===stageCount && skin) {
        const image=text('img');
        image.src='./assets/'+skin.art;
        image.alt='';
        graphic.replaceChildren(image);
      }
      tile.append(text('span',String(stage),'tile-number'),graphic,
        text('span',status==='ready'?'🎁':stage<=level?'✓':'🔒','tile-state'),
        text('span',stage===stageCount&&skin?'Skin':prize?.label || amount(requiredXp(stage))+' XP','tile-reward'));
      tile.onclick=()=>select(stage);
      card.append(tile);
      return card;
    }));
    function select(stage) {
      pickedStage=stage;
      for (const tile of list.querySelectorAll('button')) tile.setAttribute('aria-pressed',Number(tile.dataset.stage)===stage);
      const prize=stageReward(week,stage), xp=requiredXp(stage);
      $('stage-title').textContent='Level '+stage+' · '+(stage===stageCount&&skin?skin.name:prize?.label || amount(xp)+' XP');
      const status=stageClaimStatus(current,week,stage);
      $('stage-info').textContent=status==='claimed'?'Al in bezit':status==='ready'?'Vrijgespeeld · klaar om te claimen':
        stage<=level?'Mijlpaal bereikt':pickedWeek!==latest?'Deze week is voorbij':amount(xp-week.xp)+' XP nodig ('+amount(xp)+' XP totaal)';
      const claim=$('stage-claim'), weekId=pickedWeek;
      claim.hidden=status!=='ready';
      claim.onclick=async()=>{
        claim.disabled=true;
        try {
          const receipt=await change(state=>claimMilestone(state,state.weeks[weekId],stage));
          if (receipt) celebrate(receipt);
        } finally { claim.disabled=false; }
      };
    }
    function jump(stage) {
      select(stage);
      const tile=list.querySelector('[data-stage="'+stage+'"]');
      list.scrollLeft=tile.parentElement.offsetLeft-list.offsetLeft-tile.offsetWidth;
    }
    select(pickedStage);
    if (advanced) jump(level);
    else list.scrollLeft=scroll;
    $('pass-finale').onclick=()=>jump(stageCount);
    $('pass-current').onclick=()=>jump(level);
    $('quests').replaceChildren(...theme.quests.map(quest=>{
      const row=text('div','','weekly-goal');
      const complete=Math.min(quest.target,week.events[quest.event] || 0);
      const claimed=Boolean(week.questClaims?.[quest.id]);
      const claim=text('button',claimed?'Geclaimd':'+ '+amount(quest.xp)+' XP claimen','pass-claim');
      claim.type='button';
      claim.disabled=claimed || complete<quest.target;
      const weekId=pickedWeek;
      claim.onclick=async()=>{
        claim.disabled=true;
        try { await change(state=>claimQuest(state.weeks[weekId],quest.id)); }
        finally { if (claim.isConnected) claim.disabled=claimed || complete<quest.target; }
      };
      const progress=text('small',complete+' / '+quest.target,'quest-progress');
      const label=text('div');
      label.append(text('span',quest.label),progress);
      row.append(label,claim);
      return row;
    }));
  }

  function celebrate(receipt) {
    const banner=$('pass-unlock');
    const prize=receipt.item?.label || receipt.skin?.name;
    const destination=receipt.skin?'Te kiezen in de Katjeswinkel':
      receipt.item?.type==='Accessoire'?'Te kiezen bij Uiterlijk':'Te vinden in het capibarahuis';
    banner.replaceChildren(text('span',receipt.item?.icon || (receipt.skin?'👑':'✦'),'unlock-icon'),
      text('strong',prize?'Geclaimd · '+prize:'Level '+receipt.stage+' vrijgespeeld'));
    if (prize) {
      banner.append(text('small',destination));
      const sparks=text('div','','unlock-sparks');
      sparks.setAttribute('aria-hidden','true');
      for (let i=0;i<12;i++) {
        const spark=text('i');
        spark.style.setProperty('--x',Math.cos(i*Math.PI/6)*105+'px');
        spark.style.setProperty('--y',Math.sin(i*Math.PI/6)*46+'px');
        sparks.append(spark);
      }
      banner.append(sparks);
    }
    banner.hidden=false;
    banner.classList.remove('celebrate-unlock');
    void banner.offsetWidth;
    banner.classList.add('celebrate-unlock');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{ banner.hidden=true; },4600);
  }

  function renderDaily(current) {
    const day=dutchDay(Date.now()), {daily}=current;
    $('daily-calendar').replaceChildren(...Array.from({length:7},(_,index)=>{
      const date=day-6+index;
      const active=date<=daily.lastActive && date>daily.lastActive-daily.streak;
      const tile=text('li','',active?'active':'');
      tile.append(text('span',weekday.format(new Date(date*dayMs))),text('strong',active?'✓':String(new Date(date*dayMs).getUTCDate())));
      return tile;
    }));
    const claimed=day<=(daily.lastClaim ?? -Infinity);
    const prize=dailyOffer(daily.streak);
    const remaining=Math.ceil((nextMidnight(Date.now())-Date.now())/60000);
    $('daily-info').textContent=claimed?'Dagbeloning geclaimd · nieuw over '+Math.floor(remaining/60)+'u '+remaining%60+'m':
      'Vandaag · '+rewardText(prize.base)+(prize.bonus?' · Streakbonus '+rewardText(prize.bonus):'');
    $('daily-claim').disabled=claimed;
  }

  $('pass-open').onclick=async()=>{
    await change();
    if (!pass.open) pass.showModal();
    render();
  };
  $('week-picker').onchange=event=>{ pickedWeek=event.target.value; render(); };
  $('daily-claim').onclick=async()=>{
    const reward=await change(current=>claimDaily(current,config,dutchDay(Date.now())));
    if (reward) refreshWallet();
  };
  new MutationObserver(records=>{
    for (const {target} of records) if (target instanceof HTMLDialogElement && target.open) order.set(target,++orderId);
    placeHud();
    if (wheel.open && records.some(({target})=>target===wheel)) change();
  }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  window.addEventListener('storage',()=>render());

  return {
    async start() {
      const response=await fetch('./themes.json');
      if (!response.ok) throw Error('Weekthema’s ontbreken');
      config=validateThemes(await response.json());
      await change();
      placeHud();
      setInterval(()=>{ if (!document.hidden) change(); },15000);
      document.addEventListener('visibilitychange',()=>{ if (!document.hidden) change(); });
    },
    win(level) {
      return change(current=>recordWeekPuzzle(current,config,dutchDay(Date.now()),
        (level.campaign?'campaign.005.':level.world && !level.legacy?'world.004.':'level.')+level.id,puzzleXp(speedProfile(level))));
    },
    spin:()=>change(),
    care:()=>change(current=>event(current,config,dutchDay(Date.now()),'care')),
    coins:()=>data().coins,
    items:()=>Object.values(data().passItems || {}).map(item=>({...item,passExclusive:true})),
    skins:()=>Object.values(data().passSkins || {}).map(skin=>({...skin,id:'pass-'+skin.id,description:'Verdiend met de Game Pass.'})),
    skinArt:id=>id.startsWith('pass-') ? data().passSkins?.[id.slice(5)]?.art : undefined,
    hasItem:item=>Boolean(data().items[item]),
    withStock(pet) {
      if (!pet) return pet;
      const current=data();
      pet.weeklyGrants ||= {};
      for (const item of ['berry','soap','bow','crown']) {
        const total=current.itemGrants?.[item] || 0, received=pet.weeklyGrants[item] || 0;
        if (total<=received) continue;
        pet.stock[item]=(pet.stock[item] || 0)+total-received;
        pet.weeklyGrants[item]=total;
      }
      for (const item of Object.values(current.passItems || {})) pet.stock[item.id]=1;
      return pet;
    }
  };
}
