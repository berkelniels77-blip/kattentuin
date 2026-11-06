const checkpoints=[4,8,12,16,20,24,30,38];

// Fallbacks preserve the first two planned collections in saves created before this update.
const planned={
  '2026-11-02':[
    ['eikelhoed','Eikelhoed','🌰','Accessoire'],
    ['pompoenkussen','Pompoenkussen','🎃','Meubel','bedroom'],
    ['dennenappelspeeltje','Dennenappelspeeltje','🪵','Speelgoed','living'],
    ['paddenstoellamp','Paddenstoellamp','🍄','Meubel','living'],
    ['esdoornstrik','Esdoornstrik','🍁','Accessoire'],
    ['kastanjemand','Kastanjemand','🧺','Meubel','kitchen'],
    ['eikenbladkleed','Eikenbladkleed','🍂','Meubel','bath'],
    ['oogstkroon','Oogstkroon','🌾','Accessoire']
  ],
  '2026-11-09':[
    ['sterrenhaarspeld','Sterrenhaarspeld','🌟','Accessoire'],
    ['maankussen','Maankussen','🌙','Meubel','bedroom'],
    ['komeetbal','Komeetbal','☄️','Speelgoed','living'],
    ['melkweglamp','Melkweglamp','🌌','Meubel','living'],
    ['planeetbril','Planeetbril','🪐','Accessoire'],
    ['nachttelescoop','Nachttelescoop','🔭','Meubel','kitchen'],
    ['sterrenbadmat','Sterrenbadmat','✨','Meubel','bath'],
    ['noorderlichtkroon','Noorderlichtkroon','🌠','Accessoire']
  ]
};

export function itemForStage(week,stage) {
  const {start,passItems}=week.theme;
  const rows=planned[start];
  const index=checkpoints.indexOf(stage);
  const definition=passItems
    ? passItems.find(item=>item.stage===stage)
    : rows?.[index] && Object.fromEntries(['id','label','icon','type','room'].map((key,i)=>[key,rows[index][i]]));
  if (!definition) return null;
  return {...definition,id:'pass-'+start+'-'+definition.id,week:start};
}
