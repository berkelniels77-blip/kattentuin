const ns='http://www.w3.org/2000/svg';
const asset='./assets/';
const accessories={
  crown:[220,8,134,100], bow:[150,57,110,91], orange:[252,9,112,100],
  'star-glasses':[252,53,209,142], 'flower-wreath':[189,36,190,80],
  eikelhoed:[229,8,126,102], esdoornstrik:[153,49,99,94], oogstkroon:[210,14,160,105],
  sterrenhaarspeld:[166,56,85,66], planeetbril:[252,54,216,137], noorderlichtkroon:[220,2,142,105]
};
const effects={
  pet:{marks:['♡','♥','✦'],color:'#d56891'},
  play:{marks:['✷','●','✦'],color:'#b879bf'},
  food:{marks:['✦','•','◆'],color:'#bf754e'},
  water:{marks:['◊','●','◦'],color:'#59a7bb'},
  clean:{marks:['○','◌','◦'],color:'#5eabb5'},
  sleep:{marks:['z','Z','✦'],color:'#8870af'},
  wake:{marks:['✦','☀','✧'],color:'#c68b42'},
  outfit:{marks:['✧','✦','✧'],color:'#bc8847'}
};
const needColors={food:'#c57558',water:'#4a92ad',clean:'#538b79',joy:'#a45e91'};
const categories=[
  ['all','Alles',[]],['food','Eten',['Eten']],['drinks','Drinken',['Drinken']],
  ['care','Verzorging',['Verzorging']],['house','Inrichting',['Speelgoed','Meubel']],['looks','Accessoires',['Accessoire']]
];
const descriptions={
  ball:'Speelgoed voor de woonkamer', duck:'Speelgoed voor de badkamer',
  rug:'Kleed voor de woonkamer', pillow:'Kussen voor de slaapkamer', plant:'Plant voor de keuken'
};

function html(tag,name,text) {
  const element=document.createElement(tag);
  if (name) element.className=name;
  if (text) element.textContent=text;
  return element;
}

function art(file,symbol,box,viewport) {
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',box.join(' '));
  svg.setAttribute('aria-hidden','true');
  if (viewport) svg.setAttribute('preserveAspectRatio','none');
  const use=document.createElementNS(ns,'use');
  use.setAttribute('href',asset+file+'#'+symbol);
  const dimensions=file==='capy-rooms.svg' ? [420,270] : [600,600];
  use.setAttribute('width',dimensions[0]);
  use.setAttribute('height',dimensions[1]);
  svg.append(use);
  return svg;
}

function accessoryArt(item,small=false) {
  if (!item) return null;
  const key=item.id.replace(/^pass-\d{4}-\d{2}-\d{2}-/,'');
  if (Object.hasOwn(accessories,key)) return art('capy-accessories.svg',key,small?accessories[key]:[0,0,600,600]);
  return html('span','capy-pin'+(small?' thumb':''),item.icon);
}

export function initCapyPresentation($,listItems) {
  const scene=$('capy-scene'), petButton=$('capy-pet'), actor=$('capy-avatar');
  const layers=$('capy-furniture'), layer=$('capy-accessory-model'), particles=$('capy-fx');
  const preview=$('capy-preview'), previewLayer=$('capy-preview-accessory');
  const avatarImage=actor.querySelector('.capy-portrait');
  const meterCards=new Map();
  let previousRoom, previousAccessory, reactionTimer;
  let shopFilter='all', shopData;

  function portrait(pet) {
    const accessory=listItems().find(item=>item.id===pet.accessory);
    if (previousAccessory!==pet.accessory) {
      const graphic=accessoryArt(accessory);
      layer.replaceChildren(...(graphic?[graphic]:[]));
      layer.dataset.accessory=accessory?.id || '';
      previousAccessory=pet.accessory;
    }
  }
  function room(roomId,items) {
    if (previousRoom!==roomId) {
      layers.replaceChildren(art('capy-rooms.svg',roomId,[0,0,420,270],true));
      scene.classList.remove('room-entering');
      void scene.offsetWidth;
      scene.classList.add('room-entering');
      previousRoom=roomId;
    }
    const signature=items.map(item=>item.id).join(',');
    const decor=$('capy-decor');
    if (decor.dataset.items===signature) return;
    decor.dataset.items=signature;
    decor.replaceChildren(...items.map(item=>{
      const icon=html('span','capy-decor-chip',item.icon);
      icon.title=item.label;
      return icon;
    }));
  }
  function stats(pet,needs) {
    for (const [key,need] of Object.entries(needs)) {
      if (!meterCards.has(key)) {
        const card=html('div','need-card');
        const header=html('div','need-caption');
        const icon=html('span','need-icon',need.icon);
        icon.setAttribute('aria-hidden','true');
        const value=html('b','need-value');
        header.append(icon,html('span','need-name',need.label),value);
        const meter=html('div','need-meter');
        meter.setAttribute('role','meter');
        meter.setAttribute('aria-label',need.label);
        meter.setAttribute('aria-valuemin','0');
        meter.setAttribute('aria-valuemax','100');
        const fill=html('i');
        fill.style.backgroundColor=needColors[key];
        meter.append(fill);
        card.append(header,meter);
        $('capy-needs').append(card);
        meterCards.set(key,{value,meter,fill});
      }
      const {value,meter,fill}=meterCards.get(key);
      const amount=Math.round(pet.needs[key]);
      if (meter.getAttribute('aria-valuenow')!==String(amount)) {
        value.textContent=amount+'%';
        meter.setAttribute('aria-valuenow',amount);
        fill.style.width=amount+'%';
      }
    }
  }
  function updatePreview() {
    preview.dataset.coat=$('capy-color').value;
    preview.dataset.pattern=$('capy-pattern').value;
    const graphic=accessoryArt(listItems().find(item=>item.id===$('capy-accessory').value));
    previewLayer.replaceChildren(...(graphic?[graphic]:[]));
    preview.classList.remove('outfit-preview-pop');
    void preview.offsetWidth;
    preview.classList.add('outfit-preview-pop');
  }
  for (const name of ['capy-color','capy-pattern','capy-accessory']) $(name).addEventListener('change',updatePreview);
  function react(kind) {
    const effect=effects[kind];
    if (!effect || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    clearTimeout(reactionTimer);
    petButton.removeAttribute('data-motion');
    void petButton.offsetWidth;
    petButton.dataset.motion=kind;
    particles.replaceChildren(...Array.from({length:7},(_,i)=>{
      const piece=html('span','capy-fx-piece',effect.marks[i%effect.marks.length]);
      piece.style.setProperty('--dx',((i-3)*25)+'px');
      piece.style.setProperty('--dy',(-34-Math.abs(i-3)*8)+'px');
      piece.style.setProperty('--lag',i*35+'ms');
      piece.style.color=effect.color;
      return piece;
    }));
    reactionTimer=setTimeout(()=>{
      delete petButton.dataset.motion;
      particles.replaceChildren();
    },1250);
  }
  function purchase(item) {
    const status=$('capy-shop-status');
    status.classList.remove('capy-purchased');
    void status.offsetWidth;
    status.classList.add('capy-purchased');
    if (item.type==='Accessoire') {
      const graphic=accessoryArt(item,true);
      if (graphic) status.prepend(graphic);
    }
  }
  function shopCategory(category) {
    shopFilter=categories.some(([key])=>key===category) ? category : 'all';
    $('capy-store').scrollTop=0;
  }
  const filterButtons=new Map(categories.map(([key,label])=>{
    const control=html('button','capy-shop-filter',label);
    control.type='button';
    control.onclick=()=>{
      shopCategory(key);
      $('capy-shop-status').replaceChildren();
      renderShop();
    };
    $('capy-shop-filters').append(control);
    return [key,control];
  }));
  function shop(items,stock,balance,buy) {
    shopData={items,stock,balance,buy};
    renderShop();
  }
  function renderShop() {
    const {items,stock,balance,buy}=shopData;
    const [, , types]=categories.find(([key])=>key===shopFilter);
    for (const [key,control] of filterButtons) control.setAttribute('aria-pressed',key===shopFilter);
    const shelf=$('capy-products');
    const focused=shelf.contains(document.activeElement) ? document.activeElement.dataset.buy : null;
    shelf.replaceChildren(...items.filter(item=>!types.length || types.includes(item.type)).map(item=>{
      const amount=stock[item.id] || 0;
      const owned=!item.effect && amount>0;
      const shortfall=Math.max(0,item.cost-balance);
      const card=html('article','capy-product');
      const image=html('span','capy-product-art');
      image.setAttribute('aria-hidden','true');
      image.append(item.type==='Accessoire'?accessoryArt(item,true):html('span','',item.icon));
      const effect=item.effect?({food:'Voeding',water:'Hydratatie',clean:'Hygiëne'})[item.effect]+' +'+item.gain+' punten':
        descriptions[item.id] || 'Draagbaar accessoire';
      const title=html('strong','capy-product-title',item.label);
      const detail=html('small','capy-product-detail',effect);
      const footer=html('div','capy-product-meta');
      footer.append(html('span','capy-product-price','🪙 '+item.cost),html('span','capy-product-stock',
        item.effect?'Voorraad '+amount:owned?'In bezit':'Eenmalige aankoop'));
      const control=html('button','capy-button capy-buy',
        owned?'In bezit':shortfall?'Nog '+shortfall+' muntjes nodig':'Kopen');
      control.type='button';
      control.dataset.buy=item.id;
      control.disabled=owned || shortfall>0;
      control.setAttribute('aria-label',owned?item.label+' in bezit':
        shortfall?item.label+' · nog '+shortfall+' muntjes nodig':item.label+' kopen voor '+item.cost+' muntjes');
      control.onclick=()=>buy(item);
      card.append(image,title,detail,footer,control);
      return card;
    }));
    if (focused) {
      const control=shelf.querySelector('[data-buy="'+focused+'"]');
      (control && !control.disabled ? control : filterButtons.get(shopFilter)).focus({preventScroll:true});
    }
  }
  avatarImage.draggable=false;
  return {portrait,room,stats,updatePreview,react,purchase,shop,shopCategory};
}
