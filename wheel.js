export const wheelCats = [
  {id:'aurora', name:'Aurora'},
  {id:'saffier', name:'Saffier'}
];
const prizes = [
  {label:'10 muntjes', icon:'10', coins:10, weight:12, color:'#f6cfa4'},
  {label:'25 muntjes', icon:'25', coins:25, weight:18, color:'#edacc6'},
  {label:'45 muntjes', icon:'45', coins:45, weight:25, color:'#c1acd9'},
  {label:'65 muntjes', icon:'65', coins:65, weight:31, color:'#a6d6c1'},
  {label:'Sterrenbril', icon:'🕶️', accessory:'star-glasses', weight:4, color:'#f9d983'},
  {label:'Bloemenkrans', icon:'🌸', accessory:'flower-wreath', weight:4, color:'#f591ad'},
  {label:'Aurora', icon:'✦', cat:'aurora', weight:3, color:'#8ccfda'},
  {label:'Saffier', icon:'◆', cat:'saffier', weight:3, color:'#9c9ae7'}
];
export const spinDelay = 4 * 3600000;

function calendarDay(date = new Date()) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}
export function dailyVisit(state, day = calendarDay()) {
  if (day <= (state.visitDay ?? -Infinity)) return state;
  const streak = day === state.visitDay + 1 ? (state.streak || 0) + 1 : 1;
  return {...state, visitDay:day, streak};
}
export function drawPrize(state, now = Date.now(), random = crypto) {
  if (now < (state.nextSpin || 0)) return null;
  const sample = new Uint32Array(1);
  const ceiling = Math.floor(2 ** 32 / 100) * 100;
  do { random.getRandomValues(sample); } while (sample[0] >= ceiling);
  const roll = sample[0] % 100;
  let start = 0;
  for (const prize of prizes) {
    if (roll < start + prize.weight) {
      const cats = [...(state.cats || [])];
      const accessories = [...(state.accessories || [])];
      const duplicate = cats.includes(prize.cat) || accessories.includes(prize.accessory);
      if (prize.cat && !duplicate) cats.push(prize.cat);
      if (prize.accessory && !duplicate) accessories.push(prize.accessory);
      const coins = duplicate ? 65 : prize.coins || 0;
      return {...state, nextSpin:now + spinDelay, coins:(state.coins || 0) + coins, cats, accessories,
        last:{label:duplicate ? 'Dubbel gewonnen · 65 muntjes' : prize.label, angle:(start + prize.weight / 2) * 3.6}};
    }
    start += prize.weight;
  }
}

export function initWheel({read, write, transact, refreshWallet, chooseSkin, selectedSkin, feedback}) {
  const $ = id => document.getElementById(id);
  const dialog = $('wheel-dialog');
  const disk = $('wheel-disk');
  const saved = () => read('wheel', {});
  let spinning = false;
  let angle = saved().last ? 360 - saved().last.angle : 0;
  disk.style.transform = 'rotate(' + angle + 'deg)';
  let stop = 0;
  const stops = prizes.map(prize => {
    const start = stop;
    stop += prize.weight;
    const label = document.createElement('span');
    label.style.setProperty('--at', (start + prize.weight / 2) * 3.6 + 'deg');
    if (prize.coins || prize.cat) {
      const icon = document.createElement('img');
      icon.src = prize.cat ? './skin-' + prize.cat + '.svg' : './assets/coin.svg';
      icon.alt = '';
      label.append(icon);
    }
    if (!prize.cat) label.append(prize.icon);
    disk.append(label);
    return prize.color + ' ' + start + '% ' + stop + '%';
  });
  disk.style.background = 'conic-gradient(' + stops.join(',') + ')';
  $('wheel-odds').replaceChildren(...prizes.map(prize => {
    const row = document.createElement('li');
    row.textContent = prize.label + ' · ' + prize.weight + '%';
    return row;
  }));

  function update() {
    const state = saved();
    const days = state.streak || 0;
    $('wheel-streak').textContent = days + (days === 1 ? ' dag op rij' : ' dagen op rij');
    const remaining = Math.max(0, (state.nextSpin || 0) - Date.now());
    const minutes = Math.ceil(remaining / 60000);
    $('wheel-spin').disabled = spinning || !!remaining;
    $('wheel-spin').textContent = spinning ? 'Het rad draait…' : remaining
      ? 'Volgende draai over ' + (minutes >= 60 ? Math.floor(minutes / 60) + 'u ' : '') + (minutes % 60) + 'm'
      : 'Draai aan het rad';
    if (!spinning) $('wheel-result').textContent = state.last ? 'Laatste prijs · ' + state.last.label : 'Je eerste draai staat klaar.';
    $('wheel-cats').replaceChildren(...wheelCats.filter(cat => state.cats?.includes(cat.id)).map(cat => {
      const button = document.createElement('button');
      button.className = 'capy-button';
      const art = document.createElement('img');
      art.src = './skin-' + cat.id + '.svg';
      art.alt = '';
      button.append(art, cat.name + (selectedSkin() === cat.id ? ' · Gekozen' : ' · Gebruik'));
      button.disabled = selectedSkin() === cat.id;
      button.onclick = async () => { await chooseSkin(cat); update(); };
      return button;
    }));
  }
  function visit(manual = false) {
    if (document.hidden || (!manual && ($('home').hidden || document.querySelector('dialog[open]')))) return;
    transact(() => {
      if (!manual && ($('home').hidden || document.querySelector('dialog[open]'))) return;
      const state = saved();
      const next = dailyVisit(state);
      if (next !== state && !write('wheel', next)) return;
      if (!manual && next === state) return;
      update();
      if (!dialog.open) dialog.showModal();
    });
  }
  $('wheel-open').onclick = () => visit(true);
  $('wheel-spin').onclick = async () => {
    if (spinning) return;
    const next = await transact(() => {
      const result = drawPrize(saved());
      return result && write('wheel', result) ? result : null;
    });
    if (!next) { update(); return; }
    spinning = true;
    update();
    $('wheel-result').textContent = 'Spannend…';
    const target = (360 - next.last.angle) % 360;
    const travel = 360 * 5 + (target - angle % 360 + 360) % 360;
    const finish = angle + travel;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const animation = disk.animate([{transform:'rotate('+angle+'deg)'},{transform:'rotate('+finish+'deg)'}],
        {duration:2700, easing:'cubic-bezier(.13,.73,.14,1)', fill:'forwards'});
      try { await animation.finished; } catch {}
      disk.style.transform = 'rotate(' + finish + 'deg)';
      animation.cancel();
    } else disk.style.transform = 'rotate(' + finish + 'deg)';
    angle = finish;
    spinning = false;
    refreshWallet();
    feedback('coin');
    update();
    $('wheel-result').textContent = 'Gewonnen · ' + next.last.label + '!';
  };
  setInterval(() => {
    if (dialog.open) {
      // Keep focus on the same control while the countdown updates.
      const minutes = Math.ceil(Math.max(0, (saved().nextSpin || 0) - Date.now()) / 60000);
      if (!spinning) {
        $('wheel-spin').disabled = !!minutes;
        $('wheel-spin').textContent = minutes ? 'Volgende draai over ' + Math.floor(minutes / 60) + 'u ' + (minutes % 60) + 'm' : 'Draai aan het rad';
      }
    } else visit();
  }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) visit(); });
  for (const other of document.querySelectorAll('dialog')) {
    if (other !== dialog) other.addEventListener('close', () => visit());
  }
  window.addEventListener('storage', event => { if (dialog.open && event.key?.endsWith('.wheel')) update(); });
  return visit;
}
