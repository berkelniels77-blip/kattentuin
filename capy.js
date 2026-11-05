const rooms = {
  living: {label:'Woonkamer', icon:'🛋️', actions:['pet','play']},
  kitchen: {label:'Keuken', icon:'🥕', actions:['drink']},
  bath: {label:'Badkamer', icon:'🫧', actions:['wash']},
  bedroom: {label:'Slaapkamer', icon:'🌙', actions:['sleep']}
};
const needs = {
  food:{label:'Honger', rate:3.5, icon:'🥕'},
  water:{label:'Dorst', rate:4.5, icon:'💧'},
  clean:{label:'Hygiëne', rate:2.5, icon:'🫧'},
  joy:{label:'Blijheid', rate:2.8, icon:'♡'}
};
const items = [
  {id:'berry', label:'Bessenmix', icon:'🫐', cost:8, type:'Eten', effect:'food', gain:38, room:'kitchen'},
  {id:'melon', label:'Watermeloen', icon:'🍉', cost:12, type:'Eten', effect:'food', gain:48, room:'kitchen'},
  {id:'juice', label:'Appelsap', icon:'🧃', cost:8, type:'Drinken', effect:'water', gain:36, room:'kitchen'},
  {id:'bubbles', label:'Bubbelschuim', icon:'🫧', cost:10, type:'Verzorging', effect:'clean', gain:46, room:'bath'},
  {id:'ball', label:'Strandbal', icon:'🏐', cost:35, type:'Speelgoed', room:'living'},
  {id:'duck', label:'Badeend', icon:'🐤', cost:28, type:'Speelgoed', room:'bath'},
  {id:'rug', label:'Bloemenkleed', icon:'🌼', cost:55, type:'Meubel', room:'living'},
  {id:'pillow', label:'Sterrenkussen', icon:'⭐', cost:65, type:'Meubel', room:'bedroom'},
  {id:'plant', label:'Vensterplant', icon:'🪴', cost:45, type:'Meubel', room:'kitchen'},
  {id:'bow', label:'Lavendelstrik', icon:'🎀', cost:48, type:'Accessoire'},
  {id:'crown', label:'Kroontje', icon:'👑', cost:85, type:'Accessoire'},
  {id:'orange', label:'Mandarijntje', icon:'🍊', cost:32, type:'Accessoire'}
];
const actions = {
  drink:['💧','Drinken geven','water',27,'Slurp! Lekker fris.'],
  wash:['🫧','Wassen','clean',30,'Helemaal schoon en zacht.'],
  pet:['♡','Aaien','joy',14,'Dat voelt fijn.'],
  play:['🏐','Spelen','joy',26,'Nog een keertje?'],
  sleep:['🌙','Laten slapen','joy',12,'Welterusten!']
};

export function settlePet(pet, now = Date.now()) {
  const elapsed = Math.max(0, now - pet.updated);
  const asleep = Math.max(0, Math.min(now, pet.sleepUntil || 0) - pet.updated);
  const awakeHours = (elapsed - asleep * .72) / 3600000;
  const next = {...pet, updated:now, needs:{...pet.needs}};
  for (const [key, need] of Object.entries(needs)) {
    next.needs[key] = Math.max(18, Math.min(100, pet.needs[key] - awakeHours * need.rate +
      (key === 'joy' ? asleep / 3600000 * 6 : 0)));
  }
  return next;
}

export function initCapybara({read, write, coins, refreshWallet, transact, feedback}) {
  const $ = id => document.getElementById(id);
  const dialog = $('capy-dialog');
  const setup = $('capy-setup');
  const store = $('capy-store');
  let view = 'room';
  let reaction = '';
  let reactionTimer;
  const roomProps = {living:'🛋️', kitchen:'🧺', bath:'🛁', bedroom:'🛏️'};
  dialog.addEventListener('close', () => {
    clearTimeout(reactionTimer);
    reaction = '';
  });
  const get = () => read('capybara', null);
  function save(pet) {
    if (write('capybara', pet) === false) return false;
    refreshWallet();
    return true;
  }
  function react(message, sound = 'care') {
    reaction = message;
    feedback(sound);
    render();
    $('capy-message').textContent = message;
    $('capy-pet').classList.add('reacting');
    clearTimeout(reactionTimer);
    reactionTimer = setTimeout(() => { reaction = ''; render(); }, 2300);
  }
  function button(label, fn, disabled = false) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'capy-button';
    el.textContent = label;
    el.disabled = disabled;
    el.onclick = fn;
    return el;
  }
  function portrait(pet) {
    const portrait = $('capy-pet');
    portrait.dataset.coat = pet.color;
    portrait.dataset.pattern = pet.pattern;
    $('capy-accessory-model').textContent = items.find(item => item.id === pet.accessory)?.icon ?? '';
    $('capy-sleep-model').hidden = !(Date.now() < pet.sleepUntil);
  }
  function render() {
    const saved = get();
    const pet = saved && settlePet(saved);
    $('capy-wallet').textContent = coins();
    $('capy-room').hidden = !pet || view !== 'room';
    setup.hidden = !!pet && view !== 'setup';
    store.hidden = !pet || view !== 'shop';
    $('capy-options').hidden = !pet;
    $('capy-shop').disabled = view === 'shop';
    $('capy-title').textContent = pet?.name || 'Het capibarahuis';
    if (!pet) return;
    if (view === 'shop') {
      const balance = coins();
      $('capy-products').replaceChildren(...items.map(item => {
        const owned = (pet.stock[item.id] || 0) > 0;
        const el = document.createElement('article');
        const label = document.createElement('strong');
        label.textContent = item.icon + ' ' + item.label;
        const detail = document.createElement('small');
        detail.textContent = item.type + (item.effect && owned ? ' · ' + pet.stock[item.id] + ' in voorraad' : '');
        el.append(label, detail, button(!item.effect && owned ? 'In bezit' : item.cost + ' muntjes',
          () => buy(item), (!item.effect && owned) || balance < item.cost));
        return el;
      }));
      return;
    }
    if (view !== 'room') return;
    const room = rooms[pet.room];
    $('capy-scene').dataset.room = pet.room;
    $('capy-room-name').textContent = room.icon + ' ' + room.label;
    $('capy-furniture').textContent = roomProps[pet.room];
    $('capy-decor').textContent = items.filter(item => item.room === pet.room && !item.effect && pet.stock[item.id])
      .map(item => item.icon).join(' ');
    portrait(pet);
    $('capy-pet').classList.toggle('reacting', !!reaction);
    $('capy-message').textContent = reaction || (Date.now() < pet.sleepUntil ? 'Even lekker slapen…' :
      pet.needs.food < 35 ? 'Tijd voor een hapje.' : pet.needs.water < 35 ? 'Een slokje zou fijn zijn.' :
      pet.needs.clean < 35 ? 'Zullen we in bad?' : pet.needs.joy < 35 ? 'Zullen we samen spelen?' : 'Gezellig dat je er bent!');
    $('capy-needs').replaceChildren(...Object.entries(needs).map(([key, need]) => {
      const label = document.createElement('label');
      label.append(need.icon + ' ' + need.label);
      const bar = document.createElement('meter');
      bar.min = 0;
      bar.max = 100;
      bar.low = 35;
      bar.optimum = 85;
      bar.value = Math.round(pet.needs[key]);
      label.append(bar);
      return label;
    }));
    $('capy-rooms').replaceChildren(...Object.entries(rooms).map(([id, info]) => {
      const el = button(info.icon + ' ' + info.label, () => mutate(pet => { pet.room = id; }));
      el.setAttribute('aria-pressed', pet.room === id);
      return el;
    }));
    const stocked = items.filter(item => item.room === pet.room && item.effect && pet.stock[item.id]);
    const controls = room.actions.map(id =>
      button(actions[id][0] + ' ' + (id === 'sleep' && Date.now() < pet.sleepUntil ? 'Wakker maken' : actions[id][1]), () => care(id))
    );
    if (pet.room === 'kitchen' && !stocked.some(item => item.type === 'Eten')) {
      controls.unshift(button('🛒 Eten kopen', openShop));
    }
    $('capy-pantry').hidden = pet.room !== 'kitchen';
    if (pet.room === 'kitchen') {
      const meals = stocked.filter(item => item.type === 'Eten').reduce((total, item) => total + pet.stock[item.id], 0);
      $('capy-pantry').textContent = meals ? 'Voorraad · ' + meals + (meals === 1 ? ' portie eten' : ' porties eten') : 'Voorraad · geen eten';
    }
    $('capy-actions').replaceChildren(...controls, ...stocked.map(item =>
      button(item.icon + ' ' + (item.type === 'Eten' ? 'Voer ' + item.label.toLowerCase() : item.label) + ' · ' + pet.stock[item.id],
        () => use(item))));

  }
  function mutate(change, message) {
    return transact(() => {
      const saved = get();
      if (!saved) return;
      const pet = settlePet(saved);
      if (change(pet) === false) return;
      if (!save(pet)) return;
      if (message) react(typeof message === 'function' ? message() : message);
      else render();
    });
  }
  function care(id) {
    let message = actions[id][4];
    return mutate(pet => {
      const [, , need, gain] = actions[id];
      const wasSleeping = Date.now() < pet.sleepUntil;
      pet.sleepUntil = id === 'sleep' && !wasSleeping ? Date.now() + 45 * 60000 : 0;
      if (id === 'sleep' && wasSleeping) message = 'Goedemorgen, slaapkop!';
      else pet.needs[need] = Math.min(100, pet.needs[need] + gain + (id === 'play' && pet.stock.ball ? 8 : 0));
    }, () => message);
  }
  function use(item) {
    return mutate(pet => {
      if (!pet.stock[item.id]) return false;
      pet.stock[item.id]--;
      pet.sleepUntil = 0;
      pet.needs[item.effect] = Math.min(100, pet.needs[item.effect] + item.gain);
    }, item.label + ' gebruikt!');
  }
  function buy(item) {
    return transact(() => {
      const pet = settlePet(get());
      if (coins() < item.cost || (!item.effect && pet.stock[item.id])) return;
      pet.spent += item.cost;
      pet.stock[item.id] = (pet.stock[item.id] || 0) + 1;
      if (item.type === 'Accessoire') pet.accessory = item.id;
      pet.needs.joy = Math.min(100, pet.needs.joy + 5);
      if (save(pet)) {
        feedback('coin');
        $('capy-shop-status').textContent = item.icon + ' ' + pet.name + ' is blij met ' + item.label + '!';
        render();
      }
    });
  }
  function edit() {
    const pet = get();
    view = 'setup';
    $('capy-name').value = pet?.name || '';
    $('capy-color').value = pet?.color || 'honey';
    $('capy-pattern').value = pet?.pattern || 'plain';
    const accessory = $('capy-accessory');
    accessory.replaceChildren(new Option('Geen', ''), ...items.filter(item => item.type === 'Accessoire' && pet?.stock[item.id])
      .map(item => new Option(item.label, item.id)));
    accessory.value = pet?.accessory || '';
    render();
  }
  setup.onsubmit = event => {
    event.preventDefault();
    const name = $('capy-name').value.trim();
    if (!name) { $('capy-name').focus(); return; }
    transact(() => {
      const old = get();
      const pet = old ? settlePet(old) : {needs:{food:80, water:80, clean:85, joy:85}, stock:{}, spent:0,
        room:'living', updated:Date.now(), sleepUntil:0};
      Object.assign(pet, {name, color:$('capy-color').value, pattern:$('capy-pattern').value, accessory:$('capy-accessory').value});
      if (!save(pet)) return;
      view = 'room';
      react(old ? 'Een frisse nieuwe look!' : 'Welkom thuis, ' + name + '!');
    });
  };
  function openCapy(firstView) {
    view = firstView;
    if (!get()) edit();
    dialog.showModal();
    render();
  }
  $('capy-open').onclick = () => openCapy('room');
  $('shop-capy').onclick = () => {
    $('shop-dialog').close();
    openCapy('shop');
  };
  $('capy-edit').onclick = edit;
  function openShop() {
    view = 'shop';
    $('capy-shop-status').textContent = '';
    render();
  }
  $('capy-shop').onclick = openShop;
  $('capy-return').onclick = () => { view = 'room'; render(); };
  $('capy-pet').onclick = () => care('pet');
  window.addEventListener('storage', () => { if (dialog.open) render(); });
  setInterval(() => { if (dialog.open && view === 'room') render(); }, 60000);
}
