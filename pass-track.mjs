import {itemForStage} from './pass-items.mjs';

export const stageCount=40;
export const firstSkin={id:'pompoenpoot',name:'Pompoenpoot',art:'skin-pompoenpoot.svg'};
const thresholds=[0];
for (let i=0;i<stageCount-1;i++) thresholds.push(thresholds[i]+2+Math.floor(i*16/9));
export const requiredXp=stage=>thresholds[stage-1];

// Reference pace: ten estimated puzzle seconds per XP. Time spent waiting never increases the award.
export function puzzleXp(puzzle) {
  return Math.round(Math.min(150,puzzle.n*7+(puzzle.logic?.rating || 0)*.31)/10);
}

export function currentPassLevel(week) {
  return Math.max(1,thresholds.filter(xp=>xp<=(week?.xp || 0)).length,week?.track?.cleared || 0);
}

export function trackSkin(week) {
  return week.theme.skin ?? (week.theme.start==='2026-11-02' ? firstSkin : null);
}

export const stageReward=(week,stage)=>week.track?.prizes?.[stage] || itemForStage(week,stage);

export function stagePrize(week,stage) {
  return stage===stageCount ? {skin:trackSkin(week)} : {item:stageReward(week,stage)};
}

export function stageClaimStatus(state,week,stage) {
  const {item,skin}=stagePrize(week,stage);
  if (!item && !skin) return 'empty';
  if (stage<=(week.track?.awardedThrough || 0) || week.track?.claimed?.[stage] ||
      (item && state.passItems?.[item.id]) || (skin && state.passSkins?.[skin.id])) return 'claimed';
  return stage<=currentPassLevel(week) ? 'ready' : 'locked';
}

export function claimMilestone(state,week,stage) {
  if (stageClaimStatus(state,week,stage)!=='ready') return null;
  const {item,skin}=stagePrize(week,stage);
  const track=week.track ||= {};
  (track.claimed ||= {})[stage]=true;
  if (item) {
    (track.prizes ||= {})[stage]=item;
    (state.passItems ||= {})[item.id]=item;
  }
  if (skin) {
    (state.passSkins ||= {})[skin.id]=skin;
    track.skin=skin;
  }
  return {stage,item,skin};
}
