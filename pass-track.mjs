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

export function unlockMilestones(state,week) {
  const level=currentPassLevel(week);
  const previous=week.track?.awardedThrough || 0;
  if (previous>=level) return false;
  const track=week.track ||= {};
  const receipt={stage:level};
  for (let stage=previous+1;stage<=level;stage++) {
    const item=stageReward(week,stage);
    if (item) {
      track.prizes ||= {};
      track.prizes[stage]=item;
      state.passItems ||= {};
      if (!Object.hasOwn(state.passItems,item.id)) {
        state.passItems[item.id]=item;
        receipt.item=item;
        receipt.rewardStage=stage;
      }
    }
    const skin=stage===stageCount && trackSkin(week);
    if (skin) {
      state.passSkins ||= {};
      if (!Object.hasOwn(state.passSkins,skin.id)) {
        state.passSkins[skin.id]=skin;
        receipt.skin=skin;
        receipt.rewardStage=stage;
      }
      track.skin=state.passSkins[skin.id];
    }
  }
  track.awardedThrough=level;
  if (level>1 || receipt.item) track.receipt=receipt;
  return true;
}
