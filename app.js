// Hearthly: mock smart-home dashboard. All state is local; nothing talks to real devices.
const OUTSIDE = 9;
const BASE_W = 280; // fridge, router, standby

const state = {
  mode: 'home',
  room: 'living',
  target: 21,
  scene: null,
  rooms: [
    { id: 'living', name: 'Living', icon: 'sofa', temp: 21.5, hum: 44, devices: [
      { id: 'lamp', name: 'Floor lamp', icon: 'lamp-floor', type: 'dimmer', on: true, level: 40, w: 60 },
      { id: 'tv', name: 'TV', icon: 'tv', type: 'switch', on: false, w: 120 },
      { id: 'speaker', name: 'Speaker', icon: 'speaker', type: 'switch', on: true, w: 15 },
    ] },
    { id: 'kitchen', name: 'Kitchen', icon: 'chef-hat', temp: 22, hum: 48, devices: [
      { id: 'pendants', name: 'Pendants', icon: 'lightbulb', type: 'dimmer', on: true, level: 80, w: 45 },
      { id: 'coffee', name: 'Coffee maker', icon: 'coffee', type: 'switch', on: true, w: 900, onText: 'Ready' },
      { id: 'hood', name: 'Hood', icon: 'wind', type: 'switch', on: false, w: 150, cool: true },
    ] },
    { id: 'bedroom', name: 'Bedroom', icon: 'bed', temp: 19.5, hum: 41, devices: [
      { id: 'bedlights', name: 'Lights', icon: 'lightbulb', type: 'dimmer', on: true, level: 20, w: 40 },
      { id: 'blinds', name: 'Blinds', icon: 'blinds', type: 'blinds', on: false, level: 0, w: 0, cool: true },
      { id: 'fan', name: 'Fan', icon: 'fan', type: 'switch', on: true, w: 35, cool: true, onText: 'Auto' },
    ] },
    { id: 'bath', name: 'Bathroom', icon: 'bath', temp: 23, hum: 61, devices: [
      { id: 'bathlights', name: 'Lights', icon: 'lightbulb', type: 'switch', on: false, w: 30 },
      { id: 'floor', name: 'Heated floor', icon: 'flame', type: 'switch', on: true, w: 400 },
      { id: 'extract', name: 'Extractor', icon: 'wind', type: 'switch', on: false, w: 25, cool: true },
    ] },
    { id: 'garden', name: 'Garden', icon: 'trees', temp: OUTSIDE, hum: 78, devices: [
      { id: 'path', name: 'Path lights', icon: 'lamp', type: 'switch', on: false, w: 40 },
      { id: 'sprinkler', name: 'Sprinkler', icon: 'droplets', type: 'switch', on: false, w: 0, cool: true },
      { id: 'gate', name: 'Garden gate', icon: 'lock', type: 'lock', on: true },
    ] },
  ],
  locks: [
    { id: 'front', name: 'Front door', on: true },
    { id: 'back', name: 'Back door', on: true },
    { id: 'garage', name: 'Garage', on: false },
  ],
  autos: [
    { name: 'Sunset', does: 'Warm lights on at 40%', icon: 'sunset', on: true },
    { name: 'Leaving home', does: 'Lock doors, heat to 17°', icon: 'door-open', on: true },
    { name: 'Night motion', does: 'Hallway lights to 10%', icon: 'footprints', on: true },
    { name: 'Weekdays 6:30', does: 'Run Morning Rise', icon: 'alarm-clock', on: false },
  ],
};

const SCENES = [
  { id: 'cozy', name: 'Cozy Glow', hint: 'Warm lights 40%', icon: 'sparkles' },
  { id: 'morning', name: 'Morning Rise', hint: 'Blinds up, coffee on', icon: 'sunrise' },
  { id: 'movie', name: 'Movie Night', hint: 'Dim, TV on', icon: 'clapperboard' },
  { id: 'off', name: 'All Off', hint: 'Every light off', icon: 'power' },
];

const $ = (s) => document.querySelector(s);
const allDevices = () => state.rooms.flatMap((r) => r.devices);
const dev = (id) => allDevices().find((d) => d.id === id);
const isLight = (d) => /light|lamp|pendant/i.test(d.name) || d.id === 'lamp';
const icons = () => window.lucide && lucide.createIcons();

/* ---------- derived numbers ---------- */
function deviceWatts(d) {
  if (!d.on || !d.w) return 0;
  return d.type === 'dimmer' ? d.w * d.level / 100 : d.w;
}
function hvacWatts() {
  return state.mode === 'away' ? 250 : Math.max(0, state.target - OUTSIDE) * 75;
}
function watts() {
  return BASE_W + hvacWatts() + allDevices().reduce((s, d) => s + deviceWatts(d), 0);
}
function lockList() {
  return [...state.locks, dev('gate')];
}
function pulse() {
  const kw = watts() / 1000;
  const energy = Math.max(0, Math.min(100, 100 - (kw - 0.6) * 22));
  const comfort = state.mode === 'away' ? 100 : Math.max(0, 100 - Math.abs(state.target - 21) * 14);
  const open = lockList().filter((l) => !l.on).length;
  const security = 100 - open * 18;
  return Math.round(energy * 0.4 + comfort * 0.3 + security * 0.3);
}
function tip() {
  const open = lockList().filter((l) => !l.on);
  if (open.length) return `${open[0].name} is unlocked. Lock it before night.`;
  if (dev('floor').on) return 'Heated floor draws 400 W. Run it 6–7 am only to save ~€9/month.';
  if (dev('coffee').on) return 'Coffee maker is on standby heat. Switch it off after brewing.';
  if (state.target > 22) return 'Each degree under 22° cuts heating use by about 7%.';
  return 'Everything looks balanced. Nice work.';
}

/* ---------- energy series (mock, seeded so it's stable) ---------- */
const HOURS = Array.from({ length: 24 }, (_, h) => {
  const solar = h >= 7 && h <= 18 ? Math.sin(((h - 7) / 11) * Math.PI) * 2.1 : 0;
  const use = 0.35 + (h >= 6 && h <= 8 ? 1.4 : 0) + (h >= 17 && h <= 22 ? 1.6 : 0) + ((h * 37) % 10) / 25;
  return { solar, use };
});

/* ---------- render ---------- */
function renderTop() {
  const now = new Date();
  const h = now.getHours();
  $('#greet').textContent = state.mode === 'away' ? 'Home is guarded'
    : state.mode === 'night' ? 'Sleep well'
    : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('#date').textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    + ' · ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  document.querySelectorAll('.modes button').forEach((b) => b.setAttribute('aria-checked', b.dataset.mode === state.mode));
  const active = $(`.modes [data-mode="${state.mode}"]`);
  const ind = $('#modeInd');
  ind.style.width = active.offsetWidth + 'px';
  ind.style.transform = `translateX(${active.offsetLeft}px)`;
  document.documentElement.dataset.theme = state.mode === 'night' ? 'night' : '';
}

function renderHero() {
  const p = pulse();
  $('#pulseScore').textContent = p;
  const ring = $('#pulseRing');
  ring.style.strokeDashoffset = 314.16 * (1 - p / 100);
  const tone = p >= 75 ? 'var(--leaf)' : p >= 55 ? 'var(--amber)' : 'var(--red)';
  ring.style.stroke = tone;
  const word = $('#pulseWord');
  word.textContent = p >= 85 ? 'Excellent' : p >= 75 ? 'Good' : p >= 55 ? 'Fair' : 'Needs care';
  word.style.color = tone;
  $('#pulseTip').textContent = tip();
  $('#statIn').textContent = state.rooms[0].temp.toFixed(1) + '°';
  $('#statPower').textContent = (watts() / 1000).toFixed(2) + ' kW';
  const open = lockList().filter((l) => !l.on).length;
  $('#statLocks').textContent = open ? `${open} open` : 'Locked';
}

function renderScenes() {
  $('#scenes').innerHTML = SCENES.map((s) => `
    <button class="scene ${state.scene === s.id ? 'on' : ''}" data-scene="${s.id}">
      <span class="ic"><i data-lucide="${s.icon}"></i></span>
      <span><b>${s.name}</b><small>${s.hint}</small></span>
    </button>`).join('');
}

function devState(d) {
  if (d.type === 'lock') return d.on ? 'Locked' : 'Unlocked';
  if (d.type === 'blinds') return d.level ? `Open ${d.level}%` : 'Closed';
  if (!d.on) return 'Off';
  if (d.type === 'dimmer') return `${d.level}% · ${Math.round(deviceWatts(d))} W`;
  return (d.onText || 'On') + (d.w ? ` · ${d.w} W` : '');
}

function renderRooms() {
  $('#roomTabs').innerHTML = state.rooms.map((r) => `
    <button class="chip" role="tab" aria-selected="${r.id === state.room}" data-room="${r.id}">
      <i data-lucide="${r.icon}"></i>${r.name}</button>`).join('');
  const room = state.rooms.find((r) => r.id === state.room);
  const onCount = room.devices.filter((d) => d.on && d.type !== 'lock').length;
  $('#roomMeta').innerHTML = `
    <span><i data-lucide="thermometer"></i>${room.temp.toFixed(1)}°</span>
    <span><i data-lucide="droplet"></i>${room.hum}%</span>
    <span><i data-lucide="power"></i>${onCount} of ${room.devices.length} on</span>`;
  $('#devices').innerHTML = room.devices.map((d) => {
    const lit = d.type === 'blinds' ? d.level > 0 : d.on;
    const cls = ['dev', lit ? 'on' : '', d.cool ? 'cool' : '', d.type === 'lock' ? 'safe' : ''].join(' ');
    const control = d.type === 'blinds' ? '' :
      `<button class="switch ${d.type === 'lock' ? 'leaf' : ''}" role="switch" aria-checked="${d.on}" aria-label="${d.name}" data-toggle="${d.id}"></button>`;
    const slider = d.type === 'dimmer' || d.type === 'blinds' ? `
      <label class="range-row"><input type="range" min="0" max="100" step="5" value="${d.level}" data-level="${d.id}"
        style="--p:${d.level}%" ${d.type === 'dimmer' && !d.on ? 'disabled' : ''} aria-label="${d.name} level"><span class="mono">${d.level}%</span></label>` : '';
    return `<div class="${cls}">
      <div class="dev-top"><span class="ic"><i data-lucide="${d.type === 'lock' && !d.on ? 'lock-open' : d.icon}"></i></span>${control}</div>
      <div><b>${d.name}</b><small>${devState(d)}</small></div>${slider}</div>`;
  }).join('');
}

function renderClimate() {
  const t = state.target;
  $('#target').textContent = t.toFixed(1) + '°';
  $('#inside').textContent = state.rooms[0].temp.toFixed(1) + '°';
  const frac = (t - 15) / (28 - 15);
  const arc = $('#dialArc');
  arc.style.strokeDashoffset = 377 * (1 - frac);
  arc.style.stroke = t >= 23 ? 'var(--red)' : t <= 18 ? 'var(--blue)' : 'var(--amber)';
  $('#hvacState').textContent = state.mode === 'away' ? `Eco ${t}°` : t > state.rooms[0].temp ? 'Heating' : 'Holding';
}

function renderEnergy() {
  const now = new Date().getHours();
  const done = HOURS.slice(0, now + 1);
  const used = done.reduce((s, h) => s + h.use, 0);
  const solar = done.reduce((s, h) => s + Math.min(h.use, h.solar), 0);
  const grid = used - solar;
  $('#eUsed').textContent = used.toFixed(1);
  $('#eSolar').textContent = solar.toFixed(1);
  $('#eCost').textContent = '€' + (grid * 0.27).toFixed(2);
  $('#solarSide').textContent = HOURS.reduce((s, h) => s + h.solar, 0).toFixed(1) + ' kWh';
  const max = 3.2, bw = 300 / 24;
  $('#chart').innerHTML = HOURS.map((h, i) => {
    const s = Math.min(h.use, h.solar), g = h.use - s;
    const x = i * bw + 1.5, w = bw - 3;
    const hs = (s / max) * 100, hg = (g / max) * 100;
    const fade = i > now ? ' opacity=".35"' : '';
    return `<g${fade}><rect x="${x}" y="${110 - hs}" width="${w}" height="${hs}" rx="2" fill="var(--leaf)"/>`
      + `<rect x="${x}" y="${110 - hs - hg}" width="${w}" height="${Math.max(0, hg - 1)}" rx="2" fill="var(--amber)"/></g>`;
  }).join('') + `<line class="now" x1="${(now + 0.5) * bw}" x2="${(now + 0.5) * bw}" y1="0" y2="110"/>`;
}

function renderSecurity() {
  const open = lockList().filter((l) => !l.on).length;
  $('#secPill').textContent = open ? `${open} unlocked` : 'All locked';
  $('#locks').innerHTML = lockList().map((l) => `
    <li class="${l.on ? '' : 'open'}"><span class="ic"><i data-lucide="${l.on ? 'lock' : 'lock-open'}"></i></span>
      <div><b>${l.name}</b><small>${l.on ? 'Locked' : 'Unlocked'}</small></div>
      <button class="switch leaf" role="switch" aria-checked="${l.on}" aria-label="${l.name} lock" data-lock="${l.id}"></button></li>`).join('');
  $('#autoPill').textContent = `${state.autos.filter((a) => a.on).length} of ${state.autos.length} active`;
  $('#autos').innerHTML = state.autos.map((a, i) => `
    <li><span class="ic"><i data-lucide="${a.icon}"></i></span><div><b>${a.name}</b><small>${a.does}</small></div>
      <button class="switch" role="switch" aria-checked="${a.on}" aria-label="${a.name}" data-auto="${i}"></button></li>`).join('');
}

function render() {
  renderHero(); renderScenes(); renderRooms(); renderClimate(); renderEnergy(); renderSecurity();
  icons();
  renderTop(); // after icons, so the mode indicator measures final button widths
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- actions ---------- */
function lightsOff(except = []) {
  allDevices().filter(isLight).forEach((d) => { if (!except.includes(d.id)) d.on = false; });
}
function lockAll() { lockList().forEach((l) => { l.on = true; }); }

const MODES = {
  home() { state.target = 21; toast('Welcome home. Heating back to 21°'); },
  away() {
    lightsOff(); lockAll();
    ['tv', 'speaker', 'coffee', 'floor'].forEach((id) => { dev(id).on = false; });
    state.target = 17;
    toast('Away: lights off, doors locked, heat to 17°');
  },
  night() {
    lightsOff(['bedlights']); lockAll();
    Object.assign(dev('bedlights'), { on: true, level: 10 });
    dev('blinds').level = 0; dev('tv').on = false;
    state.target = 19;
    toast('Night: doors locked, bedroom at 10%');
  },
};

const SCENE_FX = {
  cozy() { allDevices().filter(isLight).forEach((d) => { d.on = true; if (d.type === 'dimmer') d.level = 40; }); dev('path').on = true; },
  morning() { dev('blinds').level = 100; dev('coffee').on = true; Object.assign(dev('pendants'), { on: true, level: 100 }); dev('floor').on = true; },
  movie() { lightsOff(['lamp']); Object.assign(dev('lamp'), { on: true, level: 15 }); dev('tv').on = true; dev('blinds').level = 0; },
  off() { lightsOff(); },
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const ds = b.dataset;
  if (ds.mode && ds.mode !== state.mode) { state.mode = ds.mode; state.scene = null; MODES[ds.mode](); }
  else if (ds.scene) { state.scene = ds.scene; SCENE_FX[ds.scene](); toast(`Scene: ${SCENES.find((s) => s.id === ds.scene).name}`); }
  else if (ds.room) state.room = ds.room;
  else if (ds.toggle) { const d = dev(ds.toggle); d.on = !d.on; state.scene = null; }
  else if (ds.lock) { const l = lockList().find((x) => x.id === ds.lock); l.on = !l.on; toast(`${l.name} ${l.on ? 'locked' : 'unlocked'}`); }
  else if (ds.auto) { const a = state.autos[ds.auto]; a.on = !a.on; }
  else if (ds.temp) state.target = Math.min(28, Math.max(15, state.target + Number(ds.temp)));
  else return;
  render();
});

document.addEventListener('input', (e) => {
  const id = e.target.dataset.level;
  if (!id) return;
  const d = dev(id);
  d.level = Number(e.target.value);
  e.target.style.setProperty('--p', d.level + '%');
  e.target.nextElementSibling.textContent = d.level + '%';
  e.target.closest('.dev').querySelector('small').textContent = devState(d);
  if (d.type === 'blinds') e.target.closest('.dev').classList.toggle('on', d.level > 0);
  renderHero();
});
document.addEventListener('change', (e) => { if (e.target.dataset.level) render(); });

window.addEventListener('resize', renderTop);
setInterval(renderTop, 30000);
render();
document.fonts.ready.then(renderTop);
