import { initWheel, wheelCats } from './wheel.js';
import { initCapybara } from './capy.js';
import { initFeedback } from './effects.js';
import { maxLives, replay, runScore } from './game.js';

const byId = id => document.getElementById(id);
const board = byId('board');
const colors = ['#eabd49','#eb91ba','#67b9d9','#a78ada','#8ec66f','#48a9a4','#f4a877','#b1c6da','#ad7958','#f5b8ce','#91a88a','#d6c0ec'];
const colorNames = ['geel','roze','blauw','paars','groen','turkoois','oranje','grijsblauw','bruin','lichtroze','saliegroen','lichtlila'];
const scoreText = value => value.toLocaleString('nl-NL');
const prefix = 'kattentuin.v1.' + new URL('./', import.meta.url).pathname + '.';
let lastTap = null;
let stroke = null;
const doubleTapMs = 310;
let levels = [], level, attempts, marks, cells, regionIcons;
let best = new Map();
let profile;
let flash;
let awardedCoins = 0;
let elapsedMs = 0;
let clockStarted = null;
let speedBonus = 0;
let lastWallet;
let walletSync;

function pauseClock() {
  if (clockStarted === null) return;
  elapsedMs += performance.now() - clockStarted;
  clockStarted = null;
}
function playedTime() {
  return Math.round(elapsedMs + (clockStarted === null ? 0 : performance.now() - clockStarted));
}
function nextLevel() {
  return levels.find(item => !best.has(item.id) && !read('level.' + item.id, {}).completed);
}
function transact(change) {
  return navigator.locks ? navigator.locks.request(prefix + 'shop', change) : change();
}


function bounce(element, cat) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  element.animate([
    {transform:'scale(1)'},
    {transform:cat ? 'scale(.78) rotate(-8deg)' : 'scale(.88)'},
    {transform:cat ? 'scale(1.13) rotate(5deg)' : 'scale(1.08)'},
    {transform:'scale(1)'}
  ], {duration:cat ? 180 : 140, easing:'cubic-bezier(.2,.8,.2,1)'});
}
function celebrate() {
  board.classList.add('won');
  bounce(byId('game-score'), true);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = byId('celebration');
  layer.replaceChildren();
  for (let i = 0; i < 32; i++) {
    const piece = document.createElement('i');
    piece.style.background = colors[i % colors.length];
    piece.style.left = (8 + Math.random() * 84) + '%';
    layer.append(piece);
    const animation = piece.animate([
      {transform:'translateY(-25px) rotate(0deg)', opacity:0},
      {opacity:1, offset:.12},
      {transform:'translateY(85vh) rotate(' + (240 + Math.random()*360) + 'deg)', opacity:0}
    ], {duration:1600+Math.random()*900, delay:Math.random()*300, easing:'cubic-bezier(.2,.6,.5,1)'});
    animation.onfinish = () => piece.remove();
  }
}

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(prefix + key)) ?? fallback; }
  catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(prefix + key, JSON.stringify(value)); return true; }
  catch { byId('storage').hidden = false; return false; }
}
function image(file, directory = './assets/') {
  const img = document.createElement('img');
  img.src = directory + file;
  img.alt = '';
  return img;
}
function score() {
  return [...best.values()].reduce((sum, run) => sum + run.score, 0);
}
function clearTaps() {
  if (stroke) saveRun();
  stroke = null;
  lastTap = null;
}
function showHome(moveFocus = true) {
  pauseClock();
  clearTaps();
  if (level && !byId('game').hidden) saveRun();
  byId('game').hidden = true;
  byId('home').hidden = false;
  const next = nextLevel();
  const play = byId('play');
  play.textContent = next ? 'Speel level ' + next.id : 'Alle katten thuis!';
  play.disabled = !next;
  play.onclick = () => { if (next) openLevel(next); };
  byId('home-score').textContent = scoreText(score());
  const bonus = levels.reduce((total, item) => total + (read('level.' + item.id, {}).speedBonus || 0), 0);
  byId('home-speed').hidden = !bonus;
  byId('home-speed').textContent = '⚡ ' + scoreText(bonus) + ' snelheidspunten';
  refreshWallet();
  if (moveFocus) { play.focus(); visitWheel(); }
}
function openLevel(next, reset = false) {
  pauseClock();
  clearTaps();
  clearTimeout(flash);
  byId('celebration').replaceChildren();
  board.classList.remove('won');
  level = next;
  awardedCoins = 0;
  const saved = reset ? {} : read('level.' + level.id, {});
  elapsedMs = saved.elapsedMs || 0;
  speedBonus = 0;
  byId('speed-award').hidden = true;
  const size = level.n ** 2;
  marks = Array.isArray(saved.marks) && saved.marks.length === size
    ? saved.marks.map(mark => mark === 2 ? 2 : 0)
    : Array(size).fill(0);
  // Older saves stored cats directly. Keep only cats that match this solution.
  const legacyCats = level.solution.filter(index => saved.marks?.[index] === 1);
  attempts = replay(level, saved.attempts) ? saved.attempts : legacyCats;
  for (const cat of replay(level, attempts).cats) marks[cat] = 1;
  byId('level-number').textContent = level.id;
  board.style.setProperty('--n', level.n);
  cells = [...level.regions].map((region, index) => {
    const cell = document.createElement('button');
    cell.className = 'cell';
    cell.type = 'button';
    cell.style.setProperty('--delay', ((Math.floor(index / next.n) + index % next.n) * 22) + 'ms');
    cell.tabIndex = index ? -1 : 0;
    cell.style.setProperty('--tile', colors[parseInt(region, 36)]);
    cell.dataset.index = index;
    cell.onclick = event => { if (event.detail === 0) cross(index); };
    cell.onkeydown = event => keyCell(event, index);
    return cell;
  });
  regionIcons = Array.from({length:level.n}, (_, index) => {
    const span = document.createElement('span');
    span.style.setProperty('--tile', colors[index]);
    return span;
  });
  byId('region-strip').replaceChildren(...regionIcons);
  board.replaceChildren(...cells);
  byId('home').hidden = true;
  byId('game').hidden = false;
  write('active', level.id);
  if (reset) saveRun();
  render();
  const state = replay(level, attempts);
  if (!state.won && state.lives && !document.hidden) clockStarted = performance.now();
  byId('back').focus();
}
function saveRun() {
  const previous = read('level.' + level.id, {});
  const {won, lives} = replay(level, attempts);
  const alreadyCompleted = previous.completed === true || best.has(level.id);
  const reward = won && !alreadyCompleted ? 6 + 2 * lives : 0;
  write('level.' + level.id, {
    marks, attempts, completed: alreadyCompleted || won,
    elapsedMs: playedTime(), speedBonus: previous.speedBonus ?? (speedBonus || undefined),
    coinReward: previous.coinReward ?? (alreadyCompleted ? 10 : reward || undefined)
  });
  return reward;
}
function focusCell(index, focus) {
  const tabStop = board.querySelector('[tabindex="0"]');
  if (tabStop) tabStop.tabIndex = -1;
  cells[index].tabIndex = 0;
  if (focus) cells[index].focus();
}
function keyCell(event, index) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (event.repeat) return;
    lastTap = null;
    if (event.key === 'Enter') placeCat(index);
    else cross(index);
    return;
  }
  const n = level.n;
  const offsets = {
    ArrowLeft: index % n ? -1 : 0,
    ArrowRight: index % n < n - 1 ? 1 : 0,
    ArrowUp: index >= n ? -n : 0,
    ArrowDown: index < n * (n - 1) ? n : 0
  };
  if (!Object.hasOwn(offsets, event.key)) return;
  event.preventDefault();
  focusCell(index + offsets[event.key], true);
}
// Pointer input paints immediately. Pointer capture keeps a stroke alive outside the board.
board.onpointerdown = event => {
  if (!event.isPrimary || event.button !== 0 || stroke) return;
  const cell = event.target.closest('.cell');
  if (!cell || !board.contains(cell)) return;
  event.preventDefault();
  const index = Number(cell.dataset.index);
  focusCell(index, false);
  const now = performance.now();
  if (lastTap?.index === index && now - lastTap.time <= doubleTapMs) {
    if (canPlay(index)) {
      marks[index] = lastTap.before;
      renderCell(index);
      placeCat(index);
    }
    lastTap = null;
    return;
  }
  lastTap = null;
  if (!canPlay(index)) return;
  const before = marks[index];
  stroke = {id:event.pointerId, index, before, value:before === 2 ? 0 : 2,
    visited:new Set(), dragged:false, x:event.clientX, y:event.clientY};
  board.setPointerCapture(event.pointerId);
  paint(index);
};
function paint(index) {
  if (stroke.visited.has(index)) return;
  stroke.visited.add(index);
  if (!canPlay(index)) return;
  if (marks[index] === stroke.value) return;
  marks[index] = stroke.value;
  renderCell(index);
  if (stroke.value === 2) feedback('cross');
}
board.onpointermove = event => {
  if (!stroke || event.pointerId !== stroke.id) return;
  const distance = Math.hypot(event.clientX - stroke.x, event.clientY - stroke.y);
  const step = Math.max(4, board.clientWidth / level.n / 3);
  const steps = Math.ceil(distance / step);
  for (let part = 1; part <= steps; part++) {
    const x = stroke.x + (event.clientX - stroke.x) * part / steps;
    const y = stroke.y + (event.clientY - stroke.y) * part / steps;
    const cell = document.elementFromPoint(x, y)?.closest('.cell');
    if (!cell || !board.contains(cell)) continue;
    const index = Number(cell.dataset.index);
    if (index !== stroke.index) stroke.dragged = true;
    paint(index);
  }
  stroke.x = event.clientX;
  stroke.y = event.clientY;
};
function endStroke(event) {
  if (!stroke || event.pointerId !== stroke.id) return;
  if (event.type === 'pointerup' && !stroke.dragged) {
    lastTap = {index:stroke.index, before:stroke.before, time:performance.now()};
  }
  saveRun();
  stroke = null;
}
board.onpointerup = endStroke;
board.onpointercancel = endStroke;
board.onlostpointercapture = endStroke;
window.addEventListener('pagehide', () => {
  pauseClock();
  if (level && !byId('game').hidden) saveRun();
});
document.addEventListener('visibilitychange', () => {
  if (!level || byId('game').hidden) return;
  if (document.hidden) {
    pauseClock();
    saveRun();
  } else {
    const state = replay(level, attempts);
    if (!state.won && state.lives && clockStarted === null) clockStarted = performance.now();
  }
});
function canPlay(index) {
  const state = replay(level, attempts);
  return !state.won && state.lives > 0 && marks[index] !== 1;
}
function cross(index) {
  if (!canPlay(index)) return;
  marks[index] = marks[index] === 2 ? 0 : 2;
  if (marks[index] === 2) feedback('cross');
  saveRun();
  renderCell(index);

}
function placeCat(index) {
  if (!canPlay(index)) return;
  attempts.push(index);
  const state = replay(level, attempts);
  const hit = state.cats.has(index);
  marks[index] = hit ? 1 : 2;
  feedback(hit ? 'cat' : 'miss');
  if (state.won || !state.lives) pauseClock();
  if (state.won && !best.has(level.id) && !read('level.' + level.id, {}).completed) {
    const seconds = playedTime() / 1000;
    if (seconds <= level.n * 7) speedBonus = 30;
    else if (seconds <= level.n * 12) speedBonus = 15;
  }
  awardedCoins = saveRun();
  if (state.won) {
    const points = runScore(level, attempts);
    if (points > (best.get(level.id)?.score ?? 0)) {
      best.set(level.id, {score:points, attempts:attempts.slice()});
      write('best.' + level.id, attempts);
      if (profile) syncRanking().catch(() => {});
    }
  }
  render(hit ? '' : 'Daar kan geen kat zitten. Eén visje kwijt.');
  if (hit) bounce(cells[index].firstElementChild, true);
  else {
    bounce(byId('lives').children[state.lives], false);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) board.animate(
      [{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(6px)'},{transform:'translateX(-3px)'},{transform:'translateX(0)'}],
      {duration:330});
  }
  if (state.won) {
    refreshWallet();
    celebrate();
    feedback('win');
    if (awardedCoins) setTimeout(() => feedback('coin'), 330);
    if (speedBonus) {
      const award = byId('speed-award');
      award.textContent = '⚡ Snelheidsbonus +' + speedBonus + ' punten!';
      award.hidden = false;
      setTimeout(() => feedback('speed'), 600);
    }
  }
  if (!hit) {
    clearTimeout(flash);
    board.querySelector('.miss')?.classList.remove('miss');
    const cell = cells[index];
    cell.classList.add('miss');
    flash = setTimeout(() => cell.classList.remove('miss'), 360);
  }
}
function renderCell(index) {
  const mark = marks[index];
  const cell = cells[index];
  const wrong = mark === 2 && attempts.includes(index) && !level.solution.includes(index);
  const skin = mark === 1 ? selectedSkin() : '';
  const signature = mark + ':' + (skin || (wrong ? 'wrong' : ''));
  if (cell.dataset.mark === signature) return;
  cell.dataset.mark = signature;
  const description = wrong ? 'rood kruisje' : ['leeg','kat','kruisje'][mark];
  const color = colorNames[parseInt(level.regions[index], 36)];
  cell.setAttribute('aria-label', `Rij ${Math.floor(index / level.n) + 1}, kolom ${index % level.n + 1}, ${color}, ${description}`);
  if (mark === 0) cell.replaceChildren();
  else {
    const icon = skin ? image('skin-' + skin + '.svg', wheelCats.some(cat => cat.id === skin) ? './' : './assets/')
      : image('cross.svg');
    if (mark === 2) icon.className = wrong ? 'cross wrong-cross' : 'cross';
    cell.replaceChildren(icon);
  }
}
function render(message = '') {
  const {lives, won, cats} = replay(level, attempts);
  for (const [index] of cells.entries()) renderCell(index);
  for (const icon of regionIcons) icon.classList.remove('placed');
  for (const index of cats) regionIcons[parseInt(level.regions[index], 36)].classList.add('placed');
  byId('lives').setAttribute('aria-label', lives + ' van ' + maxLives + ' levens');
  for (const [index, icon] of [...byId('lives').children].entries()) icon.classList.toggle('spent', index >= lives);
  byId('game-score').textContent = scoreText(score());
  byId('next').hidden = !(won && level.id < levels.length);
  byId('done').hidden = !(won && level.id === levels.length);
  byId('retry').hidden = lives !== 0;
  byId('feedback').textContent = won
    ? 'Alle katten zitten goed. +' + runScore(level, attempts) + ' punten.' + (awardedCoins ? ' +' + awardedCoins + ' muntjes!' : '')
    : !lives ? 'Je visjes zijn op. Nog een keer?' : message || 'Tik of sleep voor kruisjes. Dubbeltik voor een kat.';
}

byId('back').onclick = byId('done').onclick = () => showHome();
byId('next').onclick = () => { if (replay(level, attempts).won) { const next = nextLevel(); if (next) openLevel(next); else showHome(); } };
byId('retry').onclick = () => openLevel(level, true);
function showHelp() {
  byId('restart').hidden = byId('game').hidden;
  if (!byId('game').hidden) {
    pauseClock();
    saveRun();
  }
  byId('help-dialog').showModal();
}
byId('help-dialog').addEventListener('close', () => {
  if (byId('game').hidden || document.hidden || clockStarted !== null) return;
  const state = replay(level, attempts);
  if (!state.won && state.lives) clockStarted = performance.now();
});
byId('home-help').onclick = byId('game-help').onclick = showHelp;
byId('restart').onclick = () => {
  byId('help-dialog').close();
  openLevel(level, true);
};

const skins = [
  {id:'miso', name:'Miso', price:0, description:'Een zonnig snoetje.'},
  {id:'pixel', name:'Pixel', price:90, previousPrice:30, description:'Zacht zwart, grote ogen.'},
  {id:'mochi', name:'Mochi', price:180, previousPrice:60, description:'Een wolkje van een kat.'},
  {id:'luna', name:'Luna', price:270, previousPrice:90, description:'Een beetje maanmagie.'},
  {id:'kaneel', name:'Kaneel', price:480, previousPrice:160, description:'Rode vacht en sproetjes.'},
  {id:'mint', name:'Mint', price:720, previousPrice:240, description:'Met een klavertje op het oor.'},
  {id:'parel', name:'Parel', price:1080, previousPrice:360, description:'Een glimmend kroontje.'},
  {id:'nova', name:'Nova', price:1560, previousPrice:520, description:'Sterren in haar vacht.'}
];
function inventory() {
  const saved = read('wardrobe', {});
  const owned = skins.filter(skin => skin.price === 0 || saved.owned?.includes(skin.id)).map(skin => skin.id);
  for (const cat of wheelCats) {
    if (read('wheel', {}).cats?.includes(cat.id)) owned.push(cat.id);
  }
  const paid = Object.fromEntries(skins.filter(skin => owned.includes(skin.id)).map(skin =>
    [skin.id, saved.paid?.[skin.id] ?? skin.previousPrice ?? 0]
  ));
  return {owned, paid, selected:owned.includes(saved.selected) ? saved.selected : 'miso'};
}
function selectedSkin() { return inventory().selected; }
function coins(wardrobe = inventory()) {
  const earned = levels.reduce((total, item) => {
    const saved = read('level.' + item.id, {});
    if (!saved.completed && !best.has(item.id)) return total;
    return total + (saved.coinReward ?? 10);
  }, 0);
  return earned + (read('wheel', {}).coins || 0) - Object.values(wardrobe.paid).reduce((sum, amount) => sum + amount, 0) - (read('capybara', null)?.spent || 0);
}
function refreshWallet() {
  const amount = coins();
  if (profile && lastWallet !== undefined && lastWallet !== amount) {
    clearTimeout(walletSync);
    walletSync = setTimeout(() => syncRanking().catch(() => {}), 600);
  }
  lastWallet = amount;
  byId('home-coins').textContent = amount;
  byId('shop-coins').textContent = amount;
}
function renderShop() {
  refreshWallet();
  const wardrobe = inventory();
  const balance = coins(wardrobe);
  byId('shop-items').replaceChildren(...skins.map(skin => {
    const card = document.createElement('article');
    card.className = 'skin-card';
    const portrait = image('skin-' + skin.id + '.svg');
    const title = document.createElement('h3');
    title.textContent = skin.name;
    const description = document.createElement('p');
    description.textContent = skin.description;
    const button = document.createElement('button');
    const owned = wardrobe.owned.includes(skin.id);
    const active = wardrobe.selected === skin.id;
    button.textContent = active ? 'Gekozen' : owned ? 'Gebruik' : skin.price + ' muntjes';
    button.disabled = active || (!owned && balance < skin.price);
    button.onclick = () => chooseSkin(skin);
    card.classList.toggle('selected', active);
    card.append(portrait, title, description, button);
    return card;
  }));
}
async function chooseSkin(skin) {
  const change = () => {
    const wardrobe = inventory();
    const owned = wardrobe.owned.includes(skin.id);
    if (!owned && (skin.price === undefined || coins(wardrobe) < skin.price)) return;
    if (!owned) {
      wardrobe.owned.push(skin.id);
      wardrobe.paid[skin.id] = skin.price;
    }
    wardrobe.selected = skin.id;
    try {
      localStorage.setItem(prefix + 'wardrobe', JSON.stringify(wardrobe));
      byId('shop-status').textContent = skin.name + ' is gekozen.';
      if (!owned) feedback('coin');
    } catch {
      byId('shop-status').textContent = 'Opslaan lukte niet. Probeer het nog eens.';
    }
    renderShop();
    if (level) cells.forEach((_, index) => renderCell(index));
  };
  await transact(change);
}
function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#231d27' : '#f7f1e9';
  byId('theme-toggle').setAttribute('aria-pressed', dark);
  byId('theme-toggle').textContent = dark ? '☀' : '☾';
}
applyTheme(read('dark-mode', false));
byId('theme-toggle').onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  applyTheme(dark);
  write('dark-mode', dark);
};

byId('shop-open').onclick = () => {
  byId('shop-status').textContent = '';
  renderShop();
  byId('shop-dialog').showModal();
};
window.addEventListener('storage', event => {
  if (!event.key?.startsWith(prefix)) return;
  refreshWallet();
  if (byId('shop-dialog').open) renderShop();
  if (level) cells.forEach((_, index) => renderCell(index));
});

const feedback = initFeedback(read, write);
const updateSleep = initCapybara({read, write, coins, refreshWallet, transact, feedback});
const visitWheel = initWheel({read, write, transact, refreshWallet, chooseSkin, selectedSkin, feedback});
const news = byId('news-dialog');
byId('news-open').onclick = () => news.showModal();
news.addEventListener('close', () => write('seen-news-002', true));

const rankingUrl = location.origin === 'https://berkelniels77-blip.github.io'
  ? 'https://kattentuin-klassement.kattentuin-berkelniels77.workers.dev/api/leaderboard'
  : './api/leaderboard';
async function rankingRequest(options) {
  const response = await fetch(rankingUrl, {...options, signal:AbortSignal.timeout(6500)});
  if (!response.ok) throw Error('Klassement onbereikbaar');
  return response.json();
}
function syncRanking(player = profile) {
  return rankingRequest({
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({...player, currentLevel:nextLevel()?.id ?? levels.length, coins:Math.max(0, coins()), runs: [...best].map(([id, run]) => ({id, attempts:run.attempts}))})
  });
}
function renderRanking({players}, message) {
  byId('ranking-list').replaceChildren(...players.map(player => {
    const li = document.createElement('li');
    const points = document.createElement('strong');
    points.textContent = scoreText(player.score);
    const details = document.createElement('small');
    details.className = 'player-meta';
    details.textContent = 'Level ' + player.currentLevel + ' · ' +
      (player.coins == null ? 'saldo volgt na synchronisatie' : scoreText(player.coins) + ' muntjes');
    li.append(points, player.name, details);
    return li;
  }));
  byId('ranking-status').textContent = message || (players.length ? '' : 'Er staan nog geen scores.');
  byId('ranking-form').hidden = false;
}
byId('ranking-open').onclick = async () => {
  byId('ranking-status').textContent = 'Klassement laden…';
  byId('ranking-form').hidden = true;
  byId('ranking-list').replaceChildren();
  byId('nickname').value = profile?.name ?? '';
  byId('ranking-dialog').showModal();
  try {
    const result = profile ? await syncRanking() : await rankingRequest();
    renderRanking(result);
  } catch {
    byId('ranking-status').textContent = 'Het gedeelde klassement is hier niet bereikbaar. Je kunt wel gewoon spelen.';
  }
};
byId('ranking-form').onsubmit = async event => {
  event.preventDefault();
  const name = byId('nickname').value.trim();
  if (!name) return;
  const token = profile?.token ?? [...crypto.getRandomValues(new Uint8Array(16))]
    .map(byte => byte.toString(16).padStart(2,'0')).join('');
  const player = {name, token};
  const button = event.submitter;
  button.disabled = true;
  try {
    const result = await syncRanking(player);
    profile = player;
    write('ranking', profile);
    renderRanking(result, best.size ? 'Je score is gedeeld.' : 'Je doet mee. Speel een level om een score te delen.');
  } catch {
    byId('ranking-status').textContent = 'Delen lukte niet. Probeer het opnieuw als je verbinding hebt.';
  } finally {
    button.disabled = false;
  }
};
window.addEventListener('online', () => { if (profile) syncRanking().catch(() => {}); });
let installer;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installer = event;
  byId('install').hidden = false;
});
byId('install').onclick = async () => {
  if (!installer) return;
  const prompt = installer;
  installer = undefined;
  byId('install').hidden = true;
  await prompt.prompt();
};

async function setupUpdates() {
  if (!('serviceWorker' in navigator)) return;
  let wasControlled = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (wasControlled && !reloading) {
      reloading = true;
      location.reload();
    }
    wasControlled = true;
  });
  const registration = await navigator.serviceWorker.register('./sw.js');
  function showUpdate() {
    const dialog = byId('update');
    if (registration.waiting && navigator.serviceWorker.controller) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }
  function watchInstallation() {
    registration.installing?.addEventListener('statechange', showUpdate);
  }
  watchInstallation();
  registration.addEventListener('updatefound', watchInstallation);
  byId('update-apply').onclick = () => registration.waiting?.postMessage('activate');
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      showUpdate();
      registration.update().catch(() => {});
    }
  });
  showUpdate();
}


try {
  const response = await fetch('./levels.json');
  if (!response.ok) throw Error('Puzzels ontbreken');
  levels = await response.json();
  for (const item of levels) {
    const attempts = read('best.' + item.id, null);
    const points = runScore(item, attempts);
    if (points) best.set(item.id, {score:points, attempts});
  }
  profile = read('ranking', null);
  byId('play').disabled = false;
  showHome(false);
  if (!read('seen-news-002', false)) news.showModal();
  updateSleep();
  visitWheel();
  setupUpdates().catch(error => console.warn('Offline modus kon niet worden gestart.', error));
} catch (error) {
  byId('load-error').hidden = false;
  console.error(error);
}

