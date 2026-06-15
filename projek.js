const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = 780;
const H = 580;
canvas.width  = W;
canvas.height = H;
canvas.style.width  = '100%';
canvas.style.height = '100%';

const SPRITES = {};
const SPRITE_FILES = {
  goblin:      'assets/goblin.png',
  tower_panah: 'assets/tower_panah.png',
  tower_es: 'assets/tower_es.png',
  tower_api: 'assets/tower_api.png'
};
let spritesLoaded = 0;
const totalSprites = Object.keys(SPRITE_FILES).length;

Object.entries(SPRITE_FILES).forEach(([key, file]) => {
  const img = new Image();
  img.onload  = () => { spritesLoaded++; };
  img.onerror = () => { spritesLoaded++; console.warn('Sprite not found:', file); };
  img.src = file;
  SPRITES[key] = img;
});

function drawSprite(key, x, y, size, flipX) {
  const img = SPRITES[key];
  if (!img || !img.complete || img.naturalWidth === 0) return false;
  ctx.save();
  ctx.translate(x, y);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, -size/2, -size/2, size, size);
  ctx.restore();
  return true;
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let sfxMuted = false;

function unlockAudio() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  document.removeEventListener('click', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
}
document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);

function playTone(opts) {
  if (sfxMuted) return;
  try {
    const { type = 'sine', freq = 440, freq2 = null, duration = 0.15,
            vol = 0.18, attack = 0.01, decay = 0.04, detune = 0 } = opts;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (freq2) osc.frequency.linearRampToValueAtTime(freq2, audioCtx.currentTime + duration);
    osc.detune.value = detune;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration + 0.05);
  } catch (e) {}
}

function playNoise(opts) {
  if (sfxMuted) return;
  try {
    const { duration = 0.1, vol = 0.12, filterFreq = 800 } = opts;
    const bufSize = Math.floor(audioCtx.sampleRate * duration);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.5;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
    src.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

const SFX = {
  shoot_panah() {
    playTone({ type: 'sawtooth', freq: 900, freq2: 400, duration: 0.08, vol: 0.1 });
  },
  shoot_api() {
    playNoise({ duration: 0.12, vol: 0.15, filterFreq: 600 });
    playTone({ type: 'sawtooth', freq: 200, freq2: 80, duration: 0.15, vol: 0.08 });
  },
  shoot_es() {
    playTone({ type: 'sine', freq: 1200, freq2: 1800, duration: 0.12, vol: 0.09 });
    playTone({ type: 'sine', freq: 1400, freq2: 2000, duration: 0.12, vol: 0.07, detune: 7 });
  },
  enemy_spawn() {
    playTone({ type: 'triangle', freq: 180, freq2: 120, duration: 0.2, vol: 0.12 });
  },
  enemy_spawn_boss() {
    playTone({ type: 'sawtooth', freq: 90, freq2: 50, duration: 0.5, vol: 0.2 });
    playNoise({ duration: 0.4, vol: 0.1, filterFreq: 200 });
  },
  enemy_die() {
    playTone({ type: 'square', freq: 320, freq2: 80, duration: 0.18, vol: 0.12 });
    playNoise({ duration: 0.1, vol: 0.08, filterFreq: 1200 });
  },
  enemy_reach_end() {
    playTone({ type: 'sawtooth', freq: 150, freq2: 80, duration: 0.4, vol: 0.22 });
    setTimeout(() => playTone({ type: 'sawtooth', freq: 120, freq2: 60, duration: 0.4, vol: 0.18 }), 180);
  },
  place_tower() {
    playTone({ type: 'sine', freq: 440, freq2: 660, duration: 0.2, vol: 0.14 });
    setTimeout(() => playTone({ type: 'sine', freq: 550, freq2: 880, duration: 0.15, vol: 0.1 }), 80);
  },
  upgrade_tower() {
    [0, 80, 160].forEach((delay, i) => {
      setTimeout(() => playTone({ type: 'sine', freq: 440 + i * 220, duration: 0.15, vol: 0.13 }), delay);
    });
  },
  sell_tower() {
    playTone({ type: 'triangle', freq: 600, freq2: 300, duration: 0.2, vol: 0.12 });
  },
  wave_start() {
    [0, 120, 240].forEach((delay, i) => {
      setTimeout(() => playTone({ type: 'triangle', freq: 220 + i * 110, duration: 0.25, vol: 0.14 }), delay);
    });
  },
  wave_complete() {
    [0, 100, 200, 320].forEach((delay, i) => {
      setTimeout(() => playTone({ type: 'sine', freq: 330 + i * 165, duration: 0.3, vol: 0.14 }), delay);
    });
  },
  game_over() {
    [0, 200, 400].forEach((delay, i) => {
      setTimeout(() => playTone({ type: 'sawtooth', freq: 200 - i * 50, duration: 0.5, vol: 0.18 }), delay);
    });
  },
  victory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => playTone({ type: 'sine', freq: f, duration: 0.35, vol: 0.15 }), i * 130);
    });
  },
  click_btn() {
    playTone({ type: 'sine', freq: 500, freq2: 600, duration: 0.07, vol: 0.08 });
  },
  error() {
    playTone({ type: 'square', freq: 200, freq2: 180, duration: 0.15, vol: 0.1 });
  },
  pause_open() {
    playTone({ type: 'sine', freq: 660, freq2: 440, duration: 0.18, vol: 0.1 });
  },
  pause_close() {
    playTone({ type: 'sine', freq: 440, freq2: 660, duration: 0.18, vol: 0.1 });
  },
  powerup() {
    [0, 80, 160, 240].forEach((delay, i) => {
      setTimeout(() => playTone({ type: 'sine', freq: 600 + i * 150, duration: 0.15, vol: 0.12 }), delay);
    });
  },
};

const TOWER_DEFS = {
  panah: {
    name: 'Pemanah Hutan', cost: 40, damage: 18, range: 130, fireRate: 60,
    projSpeed: 6, color: '#4e8c4e', emoji: '🏹', upgradeCost: 30,
    aoe: false, slow: false, spriteKey: 'tower_panah',
  },
  api: {
    name: 'Pembawa Obor', cost: 70, damage: 40, range: 100, fireRate: 90,
    projSpeed: 4, color: '#c85028', emoji: '🔥', upgradeCost: 50,
    aoe: true, aoeRadius: 40, slow: false, spriteKey: 'tower_api',
  },
  es: {
    name: 'Penyihir Es', cost: 90, damage: 12, range: 115, fireRate: 75,
    projSpeed: 5, color: '#3c8cdc', emoji: '❄️', upgradeCost: 60,
    aoe: false, slow: true, slowAmount: 0.4, slowDuration: 120, spriteKey: 'tower_es',
  },
};

const ENEMY_DEFS = {
  biasa: { name: 'Goblin', hp: 80,  speed: 1.2, reward: 12, size: 14, color: '#5a7a20', emoji: '👺', damage: 1, spriteKey: 'goblin' },
  cepat: { name: 'Goblin Cepat', hp: 45,  speed: 2.4, reward: 18, size: 10, color: '#4b0082', emoji: '👻', damage: 1, spriteKey: 'goblin' },
  lapis: { name: 'Goblin Besar', hp: 200, speed: 1.0, reward: 35, size: 17, color: '#2f2f4f', emoji: '🛡️', damage: 2, spriteKey: 'goblin' },
  bos:   { name: 'Raja Goblin',  hp: 400, speed: 0.7, reward: 80, size: 22, color: '#1a0000', emoji: '💀', damage: 3, spriteKey: 'goblin' },
};

const LEVELS = [
  {
    wave: 1,
    path: [{ x:0,y:200},{x:200,y:200},{x:200,y:390},{x:500,y:390},{x:500,y:150},{x:780,y:150}],
    obstacles: [{x:250,y:100,w:60,h:60},{x:350,y:300,w:50,h:80}],
    enemies: [{type:'biasa',count:8,interval:90}],
    goldBonus: 30,
  },
  {
    wave: 2,
    path: [{x:0,y:100},{x:150,y:100},{x:150,y:440},{x:400,y:440},{x:400,y:200},{x:620,y:200},{x:620,y:490},{x:780,y:490}],
    obstacles: [{x:200,y:150,w:80,h:50},{x:450,y:250,w:60,h:120},{x:320,y:50,w:70,h:60}],
    enemies: [{type:'biasa',count:6,interval:80},{type:'cepat',count:5,interval:60}],
    goldBonus: 50,
  },
  {
    wave: 3,
    path: [{x:0,y:280},{x:120,y:280},{x:120,y:80},{x:350,y:80},{x:350,y:470},{x:580,y:470},{x:580,y:170},{x:780,y:170}],
    obstacles: [{x:160,y:130,w:90,h:50},{x:390,y:300,w:60,h:100},{x:470,y:80,w:70,h:60},{x:620,y:350,w:80,h:80}],
    enemies: [{type:'biasa',count:6,interval:75},{type:'cepat',count:6,interval:55},{type:'lapis',count:3,interval:110}],
    goldBonus: 70,
  },
  {
    wave: 4,
    path: [{x:0,y:480},{x:200,y:480},{x:200,y:80},{x:450,y:80},{x:450,y:340},{x:650,y:340},{x:650,y:80},{x:780,y:80}],
    obstacles: [{x:250,y:130,w:100,h:60},{x:330,y:380,w:80,h:80},{x:500,y:200,w:60,h:100},{x:100,y:200,w:70,h:70}],
    enemies: [{type:'biasa',count:8,interval:70},{type:'cepat',count:8,interval:50},{type:'lapis',count:4,interval:100},{type:'bos',count:1,interval:200}],
    goldBonus: 100,
  },
  {
    wave: 5,
    path: [{x:0,y:150},{x:100,y:150},{x:100,y:490},{x:300,y:490},{x:300,y:240},{x:500,y:240},{x:500,y:490},{x:670,y:490},{x:670,y:90},{x:780,y:90}],
    obstacles: [{x:140,y:200,w:100,h:80},{x:340,y:80,w:80,h:100},{x:540,y:300,w:90,h:80},{x:220,y:380,w:60,h:100},{x:420,y:400,w:70,h:70}],
    enemies: [{type:'biasa',count:10,interval:60},{type:'cepat',count:10,interval:45},{type:'lapis',count:5,interval:90},{type:'bos',count:2,interval:180}],
    goldBonus: 150,
  },
];

let state = {
  life: 10, gold: 150, wave: 1,
  running: false, paused: false, speed: 1,
  selectedTower: null,
  waveClearing: false,
  towers: [], enemies: [], projectiles: [], particles: [], spawnQueue: [],
  spawnTimer: 0, currentLevel: null,
  gameOver: false, victory: false,
  dragTower: null, movingTower: null, mouseX: 0, mouseY: 0,
  floatingTexts: [],
  countdown: 0, countdownActive: false,
  powerups: { petir: 2, beku: 2, emas: 1 },
  lifeTree: { hp: 100, maxHp: 100 },
  totalGoldEarned: 0,
  killCount: 0,
  enemiesLeaked: 0,
  goldSpent: 0,
  abilityUsedCount: 0
};

let started    = false;
let highScore  = parseInt(localStorage.getItem('phn_highscore') || '0');
let saveExists = !!localStorage.getItem('phn_save');

function getLevelData(wave) {
  let targetWave = wave;
  if (targetWave < 1) targetWave = 1;
  
  const JALUR_TETAP = [
    { x: 0, y: 100 },
    { x: 250, y: 100 },
    { x: 250, y: 250 },
    { x: 100, y: 250 },
    { x: 100, y: 440 },
    { x: 380, y: 440 },
    { x: 380, y: 300 },
    { x: 240, y: 300 },
    { x: 240, y: 520 },
    { x: 580, y: 520 },
    { x: 580, y: 200 },
    { x: 460, y: 200 },
    { x: 460, y: 60 },
    { x: 700, y: 60 },
    { x: 700, y: 380 },
    { x: 780, y: 380 }
  ];
  
  const RINTANGAN_TETAP = [
    { x: 170, y: 170, w: 45, h: 45 },
    { x: 510, y: 350, w: 45, h: 45 }
  ];
  
  let enemyList = [];
  if (targetWave === 1) {
    enemyList = [{ type: 'biasa', count: 8, interval: 90 }];
  } else if (targetWave === 2) {
    enemyList = [
      { type: 'biasa', count: 10, interval: 80 },
      { type: 'cepat', count: 5, interval: 60 }
    ];
  } else if (targetWave === 3) {
    enemyList = [
      { type: 'biasa', count: 12, interval: 70 },
      { type: 'cepat', count: 8, interval: 55 },
      { type: 'lapis', count: 3, interval: 100 }
    ];
  } else {
    const scale = 1 + (targetWave - 3) * 0.25;
    enemyList = [
      { type: 'biasa', count: Math.floor(12 * scale), interval: Math.max(40, 70 - targetWave) },
      { type: 'cepat', count: Math.floor(8 * scale), interval: Math.max(35, 55 - targetWave) },
      { type: 'lapis', count: Math.floor(4 * scale), interval: Math.max(60, 90 - targetWave) },
      { type: 'bos', count: Math.floor(targetWave / 4) || 1, interval: 180 }
    ];
  }

  return {
    wave: targetWave,
    path: JALUR_TETAP,
    obstacles: RINTANGAN_TETAP,
    enemies: enemyList,
    goldBonus: 30 + targetWave * 20
  };
}

function setPaused(val) {
  state.paused = val;
  const overlay = document.getElementById('pauseOverlay');
  if (val) {
    overlay.classList.add('open');
    SFX.pause_open();
  } else {
    overlay.classList.remove('open');
    SFX.pause_close();
  }
}

function startWave() {
  if (state.running || state.gameOver || state.countdownActive) return;
  state.countdownActive = true;
  state.countdown = 3;
  setStatus('Bersiap...');
  const tick = setInterval(() => {
    if (state.countdown <= 0) {
      clearInterval(tick);
      state.countdownActive = false;
      _doStartWave();
    } else {
      state.countdown--;
    }
  }, 1000);
}

function _doStartWave() {
  const lvl = getLevelData(state.wave);
  state.currentLevel = lvl;
  state.spawnQueue   = [];
  state.waveReached  = Math.max(state.waveReached, state.wave);
  lvl.enemies.forEach(group => {
    for (let i = 0; i < group.count; i++)
      state.spawnQueue.push({ type: group.type, delay: i * group.interval });
  });
  state.spawnQueue.sort((a, b) => a.delay - b.delay);
  state.spawnTimer = 0;
  state.running    = true;
  showWaveBanner(state.wave);
  setStatus('Gelombang ' + state.wave + ' dimulai!');
  SFX.wave_start();
}

function spawnEnemy(type) {
  const def = ENEMY_DEFS[type];
  const path = state.currentLevel.path;
  const hpMultiplier = 1 + (state.wave - 1) * 0.25;
  const scaledHp = Math.floor(def.hp * hpMultiplier);
  
  state.enemies.push({
    type,
    x: path[0].x,
    y: path[0].y,
    hp: scaledHp,
    maxHp: scaledHp,
    speed: def.speed,
    reward: def.reward,
    size: def.size,
    color: def.color,
    emoji: def.emoji,
    spriteKey: def.spriteKey,
    damage: def.damage,
    pathIndex: 0,
    slowTimer: 0,
    slowAmount: 1,
    _pathFacing: 1,
    id: Math.random()
  });
  if (type === 'bos') SFX.enemy_spawn_boss();
  else SFX.enemy_spawn();
}

function showWaveBanner(num) {
  const banner = document.getElementById('waveBanner');
  document.getElementById('waveBannerNum').textContent = num;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 2000);
}

function setStatus(msg) {
  const el = document.getElementById('gameStatus');
  if (el) el.textContent = msg;
}

function updateHUD() {
  document.getElementById('life').textContent = state.life;
  document.getElementById('gold').textContent = state.gold;
  document.getElementById('wave').textContent = state.wave;
  const ec = document.getElementById('enemyCount');
  const tc = document.getElementById('towerCount');
  if (ec) ec.textContent = state.enemies.length + state.spawnQueue.length;
  if (tc) tc.textContent = state.towers.length;
}

function addGold(amount) {
  state.gold += amount;
  spawnFloatingText('+' + amount + '💰', 40, 30, '#f0c040');
}

function spawnFloatingText(text, x, y, color) {
  state.floatingTexts.push({ text, x, y, color, life: 80, vy: -1.2 });
}

function spawnParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 2.5;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color, life: 40 + Math.random() * 20, maxLife: 60,
      size: 2 + Math.random() * 3,
    });
  }
}

function placeTower(type, x, y, levelOverride) {
  const def = TOWER_DEFS[type];
  if (!levelOverride) {
    if (state.gold < def.cost) {
      spawnFloatingText('Emas tidak cukup!', x, y, '#ff4444');
      SFX.error(); return false;
    }
    if (isOnPath(x, y) || isOnObstacle(x, y)) {
      spawnFloatingText('Tidak bisa di sini!', x, y, '#ff4444');
      SFX.error(); return false;
    }
    state.gold -= def.cost;
  }
  const lv = levelOverride || 1;
  state.towers.push({
    type, x, y, level: lv,
    damage:   Math.floor(def.damage   * (1 + 0.5*(lv-1))),
    range:    def.range   + 20*(lv-1),
    fireRate: Math.max(20, def.fireRate - 10*(lv-1)),
    fireCooldown: 0,
    color: def.color, emoji: def.emoji, spriteKey: def.spriteKey,
    aoe: def.aoe, aoeRadius: def.aoeRadius||0,
    slow: def.slow, slowAmount: def.slowAmount||1, slowDuration: def.slowDuration||0,
    id: Math.random(), selected: false, shootAnim: 0,
  });
  if (!levelOverride) {
    spawnParticles(x, y, def.color, 10);
    spawnFloatingText('-' + def.cost + '💰', x, y - 20, '#d4a017');
    SFX.place_tower();
  }
  return true;
}

function usePowerup(type) {
  if (state.powerups[type] <= 0) { SFX.error(); return; }
  state.powerups[type]--;
  if (type === 'petir') {
    const arr = [...state.enemies];
    arr.forEach(e => killEnemy(e));
    spawnFloatingText('⚡ BADAI PETIR!', W/2, H/2 - 60, '#ffe066');
    spawnParticles(W/2, H/2, '#ffe066', 30);
  } else if (type === 'beku') {
    state.enemies.forEach(e => { e.slowAmount = 0.1; e.slowTimer = 300; });
    spawnFloatingText('❄️ BEKUKAN SEMUA!', W/2, H/2 - 60, '#88ddff');
    spawnParticles(W/2, H/2, '#88ddff', 20);
  } else if (type === 'emas') {
    const bonus = 100 + state.wave * 10;
    addGold(bonus);
    state.totalGoldEarned += bonus;
    spawnFloatingText('💰 HUJAN EMAS! +' + bonus, W/2, H/2 - 60, '#f0c040');
    spawnParticles(W/2, H/2, '#f0c040', 20);
  }
  SFX.powerup && SFX.powerup();
  updatePowerupUI();
}

function updatePowerupUI() {
  const el = document.getElementById('powerupBar');
  if (!el) return;
  const p = state.powerups;
  el.innerHTML = `
    <button class="pu-btn" onclick="usePowerup('petir')" ${p.petir<=0?'disabled':''} title="Badai Petir">⚡ <span class="pu-count">${p.petir}</span></button>
    <button class="pu-btn" onclick="usePowerup('beku')"  ${p.beku <=0?'disabled':''} title="Bekukan Semua">❄️ <span class="pu-count">${p.beku}</span></button>
    <button class="pu-btn gold" onclick="usePowerup('emas')"  ${p.emas <=0?'disabled':''} title="Hujan Emas">💰 <span class="pu-count">${p.emas}</span></button>
  `;
}

function saveGame() {
  try {
    localStorage.setItem('phn_save', JSON.stringify({
      wave: state.wave, life: state.life, gold: state.gold,
      killCount: state.killCount, totalGoldEarned: state.totalGoldEarned,
      powerups: state.powerups,
      towers: state.towers.map(t => ({ type:t.type, x:t.x, y:t.y, level:t.level })),
    }));
    if (state.wave > highScore) {
      highScore = state.wave;
      localStorage.setItem('phn_highscore', String(highScore));
    }
    saveExists = true;
    spawnFloatingText('💾 Tersimpan', 50, 50, '#88cc88');
  } catch(e) {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem('phn_save');
    if (!raw) return;
    const d = JSON.parse(raw);
    resetGame();
    state.wave            = d.wave  || 1;
    state.life            = d.life  || 10;
    state.gold            = d.gold  || 150;
    state.killCount       = d.killCount       || 0;
    state.totalGoldEarned = d.totalGoldEarned || 0;
    state.powerups        = d.powerups || { petir:2, beku:2, emas:1 };
    state.currentLevel    = getLevelData(state.wave);
    (d.towers || []).forEach(t => placeTower(t.type, t.x, t.y, t.level));
    started = true;
    document.getElementById('wave').textContent = state.wave;
    updateHUD(); updatePowerupUI();
    setStatus('Game dilanjutkan dari Gelombang ' + state.wave);
  } catch(e) {}
}

function isOnPath(x, y) {
  if (!state.currentLevel) return false;
  const path = state.currentLevel.path;
  for (let i = 0; i < path.length - 1; i++) {
    if (distToSegment(x, y, path[i].x, path[i].y, path[i+1].x, path[i+1].y) < 28) return true;
  }
  return false;
}

function isOnObstacle(x, y) {
  if (!state.currentLevel) return false;
  for (const obs of state.currentLevel.obstacles) {
    if (x > obs.x-20 && x < obs.x+obs.w+20 && y > obs.y-20 && y < obs.y+obs.h+20) return true;
  }
  return false;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx-ax, dy = by-ay;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return Math.hypot(px-ax, py-ay);
  let t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / lenSq));
  return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}

function upgradeTower(tower) {
  const def = TOWER_DEFS[tower.type];
  const cost = def.upgradeCost * tower.level;
  if (state.gold < cost) {
    spawnFloatingText('Emas tidak cukup!', tower.x, tower.y - 30, '#ff4444');
    SFX.error();
    return;
  }
  state.gold -= cost;
  tower.level += 1;
  tower.damage = Math.floor(def.damage * (1 + 0.5 * (tower.level - 1)));
  tower.range = def.range + 20 * (tower.level - 1);
  tower.fireRate = Math.max(20, def.fireRate - 10 * (tower.level - 1));
  spawnParticles(tower.x, tower.y, '#f0c040', 14);
  spawnFloatingText('Level ' + tower.level + '!', tower.x, tower.y - 30, '#f0c040');
  SFX.upgrade_tower();
  updateSelectedInfo(tower);
}

function sellTower(tower) {
  const def = TOWER_DEFS[tower.type];
  const sellValue = Math.floor(def.cost * 0.6);
  state.gold += sellValue;
  spawnFloatingText('+' + sellValue + '💰', tower.x, tower.y - 20, '#f0c040');
  spawnParticles(tower.x, tower.y, tower.color, 8);
  state.towers = state.towers.filter(t => t !== tower);
  state.selectedTower = null;
  updateSelectedInfo(null);
  SFX.sell_tower();
}

function updateSelectedInfo(tower) {
  const hint  = document.getElementById('selectedHint');
  const popup = document.getElementById('towerPopup');
  if (!popup) return;

  if (!tower) {
    popup.classList.remove('show');
    if (hint) hint.style.opacity = '1';
    return;
  }

  if (hint) hint.style.opacity = '0';

  const def     = TOWER_DEFS[tower.type];
  const upgCost = def.upgradeCost * tower.level;
  const sellVal = Math.floor(def.cost * 0.6);

  document.getElementById('tpEmoji').textContent  = tower.emoji;
  document.getElementById('tpName').textContent   = def.name;
  document.getElementById('tpLevel').textContent  = 'Lv.' + tower.level;
  document.getElementById('tpDmg').textContent    = tower.damage;
  document.getElementById('tpRange').textContent  = tower.range;
  document.getElementById('tpBtnUpgrade').textContent = '⬆ ' + upgCost + ' Emas';
  document.getElementById('tpBtnSell').textContent    = '💸 ' + sellVal + ' Emas';

  const moveBtn = document.getElementById('tpBtnMove');
  if (moveBtn) {
    moveBtn.style.display = '';
  }

  const rect   = canvas.getBoundingClientRect();
  const scaleX = rect.width  / canvas.width;
  const scaleY = rect.height / canvas.height;
  const wrapper = document.querySelector('.canvas-wrapper');
  const wRect   = wrapper.getBoundingClientRect();

  const popupX = (rect.left - wRect.left) + tower.x * scaleX;
  const popupY = (rect.top  - wRect.top)  + tower.y * scaleY - 36;

  popup.style.left = popupX + 'px';
  popup.style.top  = '0px';

  popup.classList.remove('show');
  void popup.offsetWidth;
  popup.classList.add('show');

  requestAnimationFrame(() => {
    const ph = popup.offsetHeight;
    popup.style.top = (popupY - ph) + 'px';
  });
}

window.upgradeTowerSelected = function() { if (state.selectedTower) upgradeTower(state.selectedTower); };
window.sellTowerSelected    = function() { if (state.selectedTower) sellTower(state.selectedTower); };

document.addEventListener('click', e => {
  if (e.target.closest('#tpBtnUpgrade')) {
    if (state.selectedTower) upgradeTower(state.selectedTower);
    return;
  }
  if (e.target.closest('#tpBtnSell')) {
    if (state.selectedTower) sellTower(state.selectedTower);
    return;
  }
  if (e.target.closest('#tpBtnMove')) {
    if (!state.selectedTower) return;
    
    state.movingTower = state.selectedTower;
    
    const popup = document.getElementById('towerPopup');
    if (popup) popup.classList.remove('show');
    
    if (typeof spawnFloatingText === 'function') {
      spawnFloatingText('Pilih lokasi baru', state.movingTower.x, state.movingTower.y - 28, '#88ccff');
    }
    return;
  }
});

function findTarget(tower) {
  let best = null, bestDist = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (d <= tower.range && d < bestDist) { best = e; bestDist = d; }
  }
  return best;
}

function fireProjectile(tower, enemy) {
  const def = TOWER_DEFS[tower.type];
  tower.shootAnim = 12;
  state.projectiles.push({
    x: tower.x, y: tower.y,
    targetId: enemy.id, damage: tower.damage,
    speed: def.projSpeed, color: tower.color,
    aoe: tower.aoe, aoeRadius: tower.aoeRadius,
    slow: tower.slow, slowAmount: tower.slowAmount, slowDuration: tower.slowDuration,
    size: tower.aoe ? 6 : 4,
    towerType: tower.type,
    trail: [],
  });
  SFX['shoot_' + tower.type]?.();
}

function updateEnemies() {
  const path = state.currentLevel ? state.currentLevel.path : [];
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.slowTimer > 0) {
      e.slowTimer -= state.speed;
      if (e.slowTimer <= 0) e.slowAmount = 1;
    }
    const spd = e.speed * e.slowAmount * state.speed;
    if (e.pathIndex < path.length - 1) {
      const target = path[e.pathIndex + 1];
      const dx = target.x - e.x, dy = target.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < spd + 1) { e.x = target.x; e.y = target.y; e.pathIndex++; }
      else {
        e.x += (dx/dist)*spd;
        e.y += (dy/dist)*spd;
        e._pathFacing = dx < 0 ? -1 : 1;
      }
    } else {
      state.life -= e.damage;
      state.lifeTree.hp = Math.max(0, state.lifeTree.hp - e.damage * 5);
      spawnParticles(e.x, e.y, '#ff4444', 6);
      spawnFloatingText('-' + e.damage + '❤️', e.x, e.y - 20, '#ff4444');
      state.enemies.splice(i, 1);
      SFX.enemy_reach_end();
      if (state.life <= 0) {
        state.life = 0;
        state.gameOver = true;
        state.running  = false;
        localStorage.removeItem('phn_save');
        setStatus('Game Over! Hutan hancur...');
        SFX.game_over();
      }
    }
  }
}

function updateProjectiles() {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    const enemy = state.enemies.find(e => e.id === p.targetId);
    if (!enemy) { state.projectiles.splice(i, 1); continue; }
    const dx = enemy.x - p.x, dy = enemy.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < p.speed * state.speed + 4) {
      hitEnemy(p, enemy);
      state.projectiles.splice(i, 1);
      continue;
    }
    if (!p.trail) p.trail = [];
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 6) p.trail.shift();
    p.x += (dx/dist)*p.speed*state.speed;
    p.y += (dy/dist)*p.speed*state.speed;
  }
}

function hitEnemy(proj, enemy) {
  if (proj.aoe) {
    for (const e of state.enemies) {
      if (Math.hypot(e.x - enemy.x, e.y - enemy.y) <= proj.aoeRadius) {
        dealDamage(e, proj);
        spawnParticles(e.x, e.y, '#ff6622', 4);
      }
    }
    spawnParticles(enemy.x, enemy.y, '#ff8800', 12);
  } else {
    dealDamage(enemy, proj);
    spawnParticles(enemy.x, enemy.y, proj.color, 5);
  }
}

function dealDamage(enemy, proj) {
  enemy.hp -= proj.damage;
  if (proj.slow && proj.slowAmount) {
    enemy.slowAmount = proj.slowAmount;
    enemy.slowTimer = proj.slowDuration;
  }
  if (enemy.hp <= 0) killEnemy(enemy);
}

function killEnemy(enemy) {
  addGold(enemy.reward);
  state.killCount++;
  state.totalGoldEarned += enemy.reward;
  spawnParticles(enemy.x, enemy.y, '#f0c040', 10);
  spawnFloatingText('💀', enemy.x, enemy.y - 16, '#fff');
  state.enemies = state.enemies.filter(e => e !== enemy);
  SFX.enemy_die();
}

function updateTowers() {
  for (const tower of state.towers) {
    if (tower.shootAnim > 0) tower.shootAnim -= state.speed;
    if (tower.fireCooldown > 0) { tower.fireCooldown -= state.speed; continue; }
    const target = findTarget(tower);
    if (target) { fireProjectile(tower, target); tower.fireCooldown = tower.fireRate; }
  }
}

function updateParticles() {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * state.speed; p.y += p.vy * state.speed;
    p.vy += 0.08 * state.speed; p.life -= state.speed;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function updateFloatingTexts() {
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.y += ft.vy * state.speed; ft.life -= state.speed;
    if (ft.life <= 0) state.floatingTexts.splice(i, 1);
  }
}

function updateSpawnQueue() {
  if (state.spawnQueue.length === 0) return;
  state.spawnTimer += state.speed;
  while (state.spawnQueue.length > 0 && state.spawnTimer >= state.spawnQueue[0].delay) {
    spawnEnemy(state.spawnQueue[0].type);
    state.spawnQueue.shift();
  }
}

function checkWaveEnd() {
  if (!state.running || state.waveClearing) return;
  if (state.spawnQueue.length > 0 || state.enemies.length > 0) return;
  
  state.waveClearing = true;
  state.running = false;

  const lvl = getLevelData(state.wave);
  addGold(lvl.goldBonus);
  state.totalGoldEarned += lvl.goldBonus;
  
  if (typeof SFX !== 'undefined' && SFX.wave_complete) SFX.wave_complete();
  
  saveGame();
  
  if (state.wave % 5 === 0) {
    state.powerups.petir = Math.min(state.powerups.petir + 1, 5);
    state.powerups.beku  = Math.min(state.powerups.beku  + 1, 5);
    if (typeof spawnFloatingText === 'function') {
      spawnFloatingText('⚡ Power-up diisi ulang!', W/2, H/2 - 70, '#ffe066');
    }
  }
  updatePowerupUI();
  
  showWaveClearMenu();
}

function saveGame() {
  try {
    const data = {
      wave: state.wave, life: state.life, gold: state.gold,
      killCount: state.killCount, totalGoldEarned: state.totalGoldEarned,
      towers: state.towers.map(t => ({ type:t.type, x:t.x, y:t.y, level:t.level })),
    };
    localStorage.setItem('phn_save', JSON.stringify(data));
    if (state.wave > highScore) {
      highScore = state.wave;
      localStorage.setItem('phn_highscore', highScore);
    }
    saveExists = true;
  } catch(e) {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem('phn_save');
    if (!raw) return;
    const d = JSON.parse(raw);
    resetGame();
    state.wave  = d.wave  || 1;
    state.life  = d.life  || 10;
    state.gold  = d.gold  || 150;
    state.killCount       = d.killCount       || 0;
    state.totalGoldEarned = d.totalGoldEarned || 0;
    state.currentLevel = getLevelData(state.wave);
    (d.towers || []).forEach(t => placeTower(t.type, t.x, t.y, t.level));
    started = true;
    document.getElementById('wave').textContent = state.wave;
    setStatus('Game dilanjutkan dari Gelombang ' + state.wave);
    updateHUD();
  } catch(e) {}
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,   '#0f2010');
  grad.addColorStop(0.4, '#142814');
  grad.addColorStop(1,   '#0c1a0c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = 'rgba(60,120,50,0.05)';
  ctx.lineWidth = 0.5;
  const cellSize = 48;
  for (let x = 0; x <= W; x += cellSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += cellSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.85);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawPath(path) {
  if (!path || path.length < 2) return;
  ctx.save();

  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(60,40,20,0.7)';
  ctx.lineWidth = 46;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const dirtGrad = ctx.createLinearGradient(0, 0, W, H);
  dirtGrad.addColorStop(0,   '#5c3c18');
  dirtGrad.addColorStop(0.5, '#7a5228');
  dirtGrad.addColorStop(1,   '#5c3c18');
  ctx.strokeStyle = dirtGrad;
  ctx.lineWidth = 40;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(160,120,60,0.22)';
  ctx.lineWidth = 38;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(100,75,35,0.35)';
  ctx.lineWidth = 36;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(200,165,90,0.08)';
  ctx.lineWidth = 18;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(180,140,70,0.12)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 14]);
  ctx.lineDashOffset = 0;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

function drawObstacles(obstacles) {
  if (!obstacles) return;
  for (const obs of obstacles) {
    ctx.save();

    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    const og = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.h);
    og.addColorStop(0,   'rgba(45,72,35,0.95)');
    og.addColorStop(0.5, 'rgba(30,52,24,0.95)');
    og.addColorStop(1,   'rgba(20,36,16,0.95)');
    ctx.fillStyle = og;
    roundRect(ctx, obs.x, obs.y, obs.w, obs.h, 10);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    ctx.strokeStyle = 'rgba(78,140,58,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(120,200,90,0.12)';
    ctx.lineWidth = 0.8;
    roundRect(ctx, obs.x+2, obs.y+2, obs.w-4, obs.h-4, 8);
    ctx.stroke();

    const treeSize = Math.min(obs.w, obs.h) * 0.55;
    const cx = obs.x + obs.w/2, cy = obs.y + obs.h/2;

    ctx.fillStyle = 'rgba(20,36,16,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx+2, cy + treeSize*0.45 + 4, treeSize*0.28, treeSize*0.1, 0, 0, Math.PI*2);
    ctx.fill();

    const trunkW = treeSize*0.1, trunkH = treeSize*0.35;
    const tg = ctx.createLinearGradient(cx-trunkW, 0, cx+trunkW, 0);
    tg.addColorStop(0, '#3a2008'); tg.addColorStop(0.5, '#5a3410'); tg.addColorStop(1, '#3a2008');
    ctx.fillStyle = tg;
    ctx.fillRect(cx - trunkW/2, cy + treeSize*0.1, trunkW, trunkH);

    const layers = 3;
    for (let l = 0; l < layers; l++) {
      const ls  = treeSize * (1 - l*0.2);
      const ly  = cy - treeSize*0.3 - l*treeSize*0.22;
      const lg  = ctx.createRadialGradient(cx - ls*0.15, ly - ls*0.1, 0, cx, ly, ls*0.7);
      lg.addColorStop(0, l===0 ? 'rgba(80,160,55,0.95)' : l===1 ? 'rgba(60,130,42,0.9)' : 'rgba(40,105,30,0.85)');
      lg.addColorStop(1, l===0 ? 'rgba(30,80,20,0.9)'  : l===1 ? 'rgba(20,60,14,0.85)' : 'rgba(12,44,8,0.8)');
      ctx.fillStyle = lg;
      ctx.shadowColor = 'rgba(0,30,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(cx, ly - ls*0.75);
      ctx.bezierCurveTo(cx + ls*0.15, ly - ls*0.4, cx + ls*0.55, ly + ls*0.1, cx + ls*0.5, ly + ls*0.28);
      ctx.bezierCurveTo(cx + ls*0.15, ly + ls*0.35, cx - ls*0.15, ly + ls*0.35, cx - ls*0.5, ly + ls*0.28);
      ctx.bezierCurveTo(cx - ls*0.55, ly + ls*0.1, cx - ls*0.15, ly - ls*0.4, cx, ly - ls*0.75);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}

function drawTowers() {
  for (const tower of state.towers) {
    const pulse    = tower.shootAnim > 0 ? (tower.shootAnim / 12) * 0.15 : 0;
    const scale    = 1 + pulse;
    const selected = state.selectedTower === tower;
    const isMoving = state.movingTower  === tower;

    ctx.save();
    ctx.translate(tower.x, tower.y);

    if (selected || isMoving) {
      const t = Date.now() / 1000;
      ctx.beginPath();
      ctx.arc(0, 0, tower.range, 0, Math.PI * 2);
      ctx.strokeStyle = isMoving
        ? `rgba(80,160,255,${0.25 + 0.1*Math.sin(t*3)})`
        : `rgba(240,192,64,${0.2  + 0.08*Math.sin(t*2)})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = isMoving
        ? 'rgba(80,160,255,0.05)'
        : 'rgba(240,192,64,0.05)';
      ctx.fill();
    }

    ctx.scale(scale, scale);

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 26, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (selected) {
      ctx.beginPath();
      ctx.arc(0, -4, 26, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(240,192,64,0.18)';
      ctx.strokeStyle = 'rgba(240,192,64,0.7)';
      ctx.lineWidth   = 2;
      ctx.fill();
      ctx.stroke();
    }

    const target = findTarget(tower);
    let flipHorizontal = false;

    if (target && target.x < tower.x) {
      flipHorizontal = true;
    }

    ctx.save();
    if (flipHorizontal) {
      ctx.scale(-1, 1);
    }

    const drawn = drawSprite(tower.spriteKey, flipHorizontal ? 0 : 0, -4, 52);
    if (!drawn) {
      ctx.font             = '30px serif';
      ctx.textAlign        = 'center';
      ctx.textBaseline     = 'middle';
      ctx.fillText(tower.emoji, 0, 0);
    }
    ctx.restore();

    if (tower.level > 1) {
      for (let s = 0; s < tower.level - 1; s++) {
        const ang = -Math.PI/2 + s * (Math.PI * 2 / (tower.level - 1));
        ctx.beginPath();
        ctx.arc(Math.cos(ang)*30, Math.sin(ang)*30, 4, 0, Math.PI*2);
        ctx.fillStyle = '#f0c040';
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    const spriteSize = enemy.type === 'bos'   ? 58
                     : enemy.type === 'lapis'  ? 48
                     : enemy.type === 'cepat'  ? 32
                     : 40;

    const isFacingLeft = enemy._pathFacing < 0;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, spriteSize/2 - 2, spriteSize*0.3, spriteSize*0.09, 0, 0, Math.PI*2);
    ctx.fill();

    if (enemy.slowTimer > 0) {
      const t = Date.now() / 600;
      ctx.beginPath();
      ctx.arc(0, 0, spriteSize/2 + 6, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(100,200,255,${0.4 + 0.15*Math.sin(t)})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    if (enemy.type === 'bos') {
      const t = Date.now() / 800;
      const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, spriteSize);
      aura.addColorStop(0, `rgba(180,20,20,${0.2 + 0.1*Math.sin(t)})`);
      aura.addColorStop(1, 'rgba(80,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, spriteSize, 0, Math.PI*2);
      ctx.fill();
    }

    const drawn = drawSprite(enemy.spriteKey, 0, 0, spriteSize, isFacingLeft);
    if (!drawn) {
      ctx.font        = (spriteSize * 0.7) + 'px serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(enemy.emoji, 0, 0);
    }

    const barW    = spriteSize * 1.1;
    const barH    = 5;
    const barY    = -spriteSize/2 - 10;
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, -barW/2 - 1, barY - 1, barW + 2, barH + 2, 3);
    ctx.fill();

    const hpColor = hpRatio > 0.6 ? '#44cc44' : hpRatio > 0.3 ? '#e8a020' : '#dd2222';
    const hpGrad  = ctx.createLinearGradient(-barW/2, 0, barW/2, 0);
    hpGrad.addColorStop(0, hpColor);
    hpGrad.addColorStop(1, 'rgba(255,255,255,0.25)');
    ctx.fillStyle = hpGrad;
    if (hpRatio > 0) {
      roundRect(ctx, -barW/2, barY, barW * hpRatio, barH, 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth   = 0.5;
    roundRect(ctx, -barW/2, barY, barW, barH, 2);
    ctx.stroke();

    ctx.restore();
  }
}

function drawProjectiles() {
  for (const p of state.projectiles) {
    ctx.save();

    if (p.trail && p.trail.length > 1) {
      for (let i = 1; i < p.trail.length; i++) {
        const a = (i / p.trail.length) * 0.4;
        ctx.beginPath();
        ctx.moveTo(p.trail[i-1].x, p.trail[i-1].y);
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
        ctx.strokeStyle = p.color.replace(')', `,${a})`).replace('rgb', 'rgba');
        ctx.lineWidth = p.size * (i / p.trail.length);
        ctx.stroke();
      }
    }

    const outerGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.5);
    outerGlow.addColorStop(0, p.color + 'cc');
    outerGlow.addColorStop(1, p.color + '00');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI*2);
    ctx.fill();

    ctx.shadowColor = p.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(p.x - p.size*0.3, p.y - p.size*0.3, p.size*0.35, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();

    ctx.restore();
  }
}

function drawParticles() {
  for (const p of state.particles) {
    const alpha = Math.pow(p.life / p.maxLife, 0.6);
    ctx.save();
    ctx.globalAlpha = alpha;

    const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * alpha + 1);
    pg.addColorStop(0, '#ffffff');
    pg.addColorStop(0.4, p.color);
    pg.addColorStop(1, p.color + '00');
    ctx.fillStyle = pg;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha + 1, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  }
}

function drawFloatingTexts() {
  for (const ft of state.floatingTexts) {
    const alpha = Math.min(1, ft.life / 35);
    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.font = 'bold 14px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(ft.text, ft.x, ft.y);

    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);

    ctx.restore();
  }
}

function drawGhostTower() {
  const isMoving = !!state.movingTower;
  const isDragging = !!state.dragTower;
  if (!isMoving && !isDragging) return;

  const tower    = isMoving ? state.movingTower : null;
  const type     = isMoving ? tower.type : state.dragTower;
  const def      = TOWER_DEFS[type];
  const emoji    = isMoving ? tower.emoji : def.emoji;
  const range    = isMoving ? tower.range : def.range;
  const canPlace = !isOnPath(state.mouseX, state.mouseY) && !isOnObstacle(state.mouseX, state.mouseY);
  const t        = Date.now() / 800;
  const pulse    = 0.5 + 0.15 * Math.sin(t);

  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.arc(state.mouseX, state.mouseY, range, 0, Math.PI * 2);
  ctx.strokeStyle = canPlace ? 'rgba(78,220,78,0.55)' : 'rgba(220,60,60,0.55)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([6, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = canPlace ? 'rgba(78,220,78,0.05)' : 'rgba(220,60,60,0.05)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.shadowColor = canPlace ? 'rgba(78,200,78,0.8)' : 'rgba(220,60,60,0.8)';
  ctx.shadowBlur  = isMoving ? 20 : 16;
  ctx.beginPath();
  ctx.arc(state.mouseX, state.mouseY, 21, 0, Math.PI * 2);
  ctx.fillStyle = canPlace
    ? (isMoving ? 'rgba(40,100,30,0.8)' : 'rgba(30,80,30,0.75)')
    : 'rgba(80,20,20,0.75)';
  ctx.fill();
  ctx.strokeStyle = canPlace ? (isMoving ? '#70dd50' : '#5eba5e') : '#cc4444';
  ctx.lineWidth   = isMoving ? 2.5 : 2;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  ctx.font             = '20px serif';
  ctx.textAlign        = 'center';
  ctx.textBaseline     = 'middle';
  ctx.globalAlpha      = 0.9;
  ctx.fillText(emoji, state.mouseX, state.mouseY);

  if (isMoving && canPlace) {
    ctx.font      = 'bold 10px Cinzel, serif';
    ctx.fillStyle = '#90ee60';
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 2);
    ctx.fillText('Klik untuk pindah', state.mouseX, state.mouseY + 32);
  }
  ctx.restore();
}

function drawPausedOverlayOnCanvas() {
  if (!state.paused) return;
  ctx.save();
  ctx.fillStyle = 'rgba(4,10,4,0.5)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawEndScreen() {
  ctx.save();
  const overlay = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.8);
  overlay.addColorStop(0, 'rgba(40,0,0,0.93)');
  overlay.addColorStop(1, 'rgba(10,0,0,0.87)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  const cx = W/2, cy = H/2;
  const cw = 360, ch = 260;
  const cardBg = ctx.createLinearGradient(cx-cw/2, cy-ch/2, cx-cw/2, cy+ch/2);
  cardBg.addColorStop(0, 'rgba(30,8,8,0.95)');
  cardBg.addColorStop(1, 'rgba(16,4,4,0.97)');
  ctx.fillStyle = cardBg;
  roundRect(ctx, cx-cw/2, cy-ch/2, cw, ch, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,60,40,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 32px Cinzel, serif';
  ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 24;
  ctx.fillStyle = '#ff6655';
  ctx.fillText('💀 Hutan Hancur!', cx, cy - 90);

  ctx.shadowBlur = 0;
  ctx.font = '14px Crimson Pro, serif';
  ctx.fillStyle = '#cc9988';
  ctx.fillText('Makhluk kegelapan berhasil menembus pertahanan...', cx, cy - 58);

  const stats = [
    ['🌊 Gelombang Dicapai', state.wave],
    ['💀 Musuh Dikalahkan',  state.killCount],
    ['💰 Total Emas Diraih', state.totalGoldEarned],
    ['🏆 Rekor Tertinggi',   highScore],
  ];
  stats.forEach(([label, val], i) => {
    const row = cy - 28 + i * 30;
    ctx.font = '12px Cinzel, serif';
    ctx.fillStyle = '#886666';
    ctx.textAlign = 'left';
    ctx.fillText(label, cx - 150, row);
    ctx.font = 'bold 13px Cinzel, serif';
    ctx.fillStyle = '#f0c040';
    ctx.textAlign = 'right';
    ctx.fillText(val, cx + 150, row);
  });

  const t = Date.now() / 1000;
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2);
  ctx.font = '12px Cinzel, serif';
  ctx.fillStyle = '#aa8888';
  ctx.textAlign = 'center';
  ctx.fillText('Klik untuk main ulang', cx, cy + 108);
  ctx.restore();
}

function drawStartScreen() {
  const t  = Date.now() / 1000;
  const cx = W / 2;
  const cy = H / 2;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   '#040c04');
  bg.addColorStop(0.5, '#081408');
  bg.addColorStop(1,   '#040c04');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const lvl = getLevelData(1);
  ctx.save();
  ctx.globalAlpha = 0.18;
  drawPath(lvl.path);
  drawObstacles(lvl.obstacles);
  ctx.restore();

  const vignette = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.75);
  vignette.addColorStop(0,   'rgba(0,0,0,0)');
  vignette.addColorStop(0.5, 'rgba(0,0,0,0.4)');
  vignette.addColorStop(1,   'rgba(0,0,0,0.88)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 28; i++) {
    const px  = (i * 173.7 + t * 6)  % W;
    const py  = (i * 113.1 + t * 9)  % H;
    const pa  = (0.08 + 0.08 * Math.sin(t * 1.8 + i)) ;
    ctx.beginPath();
    ctx.arc(px, py, 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(100,200,60,${pa})`;
    ctx.fill();
  }

  const cardW = 340;
  const cardH = 280;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur  = 40;
  const cardBg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardBg.addColorStop(0,   'rgba(10,22,8,0.82)');
  cardBg.addColorStop(1,   'rgba(6,14,4,0.88)');
  ctx.fillStyle = cardBg;
  roundRect(ctx, cardX, cardY, cardW, cardH, 16);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = `rgba(90,160,50,${0.3 + 0.12 * Math.sin(t)})`;
  ctx.lineWidth   = 1.5;
  roundRect(ctx, cardX, cardY, cardW, cardH, 16);
  ctx.stroke();
  ctx.strokeStyle = `rgba(200,150,20,${0.2 + 0.08 * Math.sin(t * 0.8)})`;
  ctx.lineWidth   = 1;
  roundRect(ctx, cardX + 5, cardY + 5, cardW - 10, cardH - 10, 13);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  const treeY = cardY + 54;
  const treePulse = 1 + 0.025 * Math.sin(t * 2.2);
  ctx.font        = `${Math.floor(42 * treePulse)}px serif`;
  ctx.shadowColor = `rgba(80,220,60,${0.5 + 0.2 * Math.sin(t * 2)})`;
  ctx.shadowBlur  = 20 + 8 * Math.sin(t * 2);
  ctx.fillText('🌳', cx, treeY);

  const sep1Y = treeY + 32;
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = `rgba(90,160,50,0.3)`;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, sep1Y);
  ctx.lineTo(cardX + cardW - 24, sep1Y);
  ctx.stroke();

  const titleY = sep1Y + 28;
  ctx.font        = 'bold 28px Cinzel, serif';
  ctx.shadowColor = `rgba(200,140,10,${0.5 + 0.2 * Math.sin(t * 1.2)})`;
  ctx.shadowBlur  = 16 + 6 * Math.sin(t * 1.2);
  const tg = ctx.createLinearGradient(cx - 130, 0, cx + 130, 0);
  tg.addColorStop(0,   '#a06800');
  tg.addColorStop(0.35,'#f0c040');
  tg.addColorStop(0.65,'#ffe07a');
  tg.addColorStop(1,   '#a06800');
  ctx.fillStyle = tg;
  ctx.fillText('Penjaga Hutan', cx, titleY);

  const subtitleY = titleY + 30;
  ctx.font        = '13px Cinzel, serif';
  ctx.shadowBlur  = 6;
  ctx.shadowColor = 'rgba(100,180,50,0.4)';
  ctx.fillStyle   = '#80aa55';
  ctx.fillText('N U S A N T A R A', cx, subtitleY);

  const sep2Y = subtitleY + 20;
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = `rgba(90,160,50,0.25)`;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, sep2Y);
  ctx.lineTo(cardX + cardW - 24, sep2Y);
  ctx.stroke();
  ctx.font      = '10px serif';
  ctx.fillStyle = 'rgba(100,180,60,0.4)';
  ctx.fillText('✦', cx, sep2Y);

  const desc1Y = sep2Y + 22;
  ctx.font        = '13px Crimson Pro, serif';
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = '#6a9850';
  ctx.fillText('Pilih menara · Klik peta · Mulai Gelombang', cx, desc1Y);

  const desc2Y = desc1Y + 20;
  ctx.font      = 'italic 12px Crimson Pro, serif';
  ctx.fillStyle = '#4a7038';
  ctx.fillText('"Lindungi Pohon Kehidupan dari kegelapan"', cx, desc2Y);

  const btnW  = 180;
  const btnH  = 34;
  const btnX  = cx - btnW / 2;
  const btnY  = cardY + cardH - btnH - 20;
  const pulse = 0.75 + 0.25 * Math.sin(t * 2.5);

  ctx.shadowBlur = 0;
  const btnBg = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
  btnBg.addColorStop(0, `rgba(50,100,30,${0.65 + 0.15 * pulse})`);
  btnBg.addColorStop(1, `rgba(28,60,16,${0.65 + 0.15 * pulse})`);
  ctx.fillStyle = btnBg;
  roundRect(ctx, btnX, btnY, btnW, btnH, 9);
  ctx.fill();

  ctx.strokeStyle = `rgba(100,190,55,${0.4 + 0.3 * pulse})`;
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  ctx.font        = 'bold 12px Cinzel, serif';
  ctx.fillStyle   = `rgba(200,240,120,${0.8 + 0.2 * pulse})`;
  ctx.shadowColor = `rgba(100,220,50,${0.3 * pulse})`;
  ctx.shadowBlur  = 8 * pulse;
  ctx.fillText('▶  Mulai Gelombang', cx, btnY + btnH / 2 + 1);

  ctx.restore();
}

function drawLifeTree() {
  const lvl = state.currentLevel || getLevelData(state.wave);
  const path = lvl.path;
  const end  = path[path.length - 1];
  const t    = Date.now() / 1000;
  const hp   = state.lifeTree.hp / state.lifeTree.maxHp;

  ctx.save();
  ctx.shadowColor = hp > 0.5 ? `rgba(80,220,60,${0.4+0.2*Math.sin(t*2)})` : 'rgba(220,80,60,0.5)';
  ctx.shadowBlur  = 16 + 6*Math.sin(t*2);
  ctx.font        = '28px serif';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🌳', end.x, end.y);
  ctx.shadowBlur = 0;

  const bw = 40, bh = 5;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, end.x - bw/2 - 1, end.y + 18, bw + 2, bh + 2, 3);
  ctx.fill();
  const hpColor = hp > 0.5 ? '#44dd44' : hp > 0.25 ? '#eeaa20' : '#ee3322';
  ctx.fillStyle = hpColor;
  roundRect(ctx, end.x - bw/2, end.y + 19, bw * hp, bh, 2);
  ctx.fill();
  ctx.restore();
}

function drawCountdown() {
  if (!state.countdownActive || state.countdown <= 0) return;
  const t = Date.now() / 1000;
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = 'bold 80px Cinzel, serif';
  ctx.fillStyle    = `rgba(240,192,64,${0.7 + 0.3*Math.sin(t*6)})`;
  ctx.shadowColor  = '#d4a017';
  ctx.shadowBlur   = 30;
  ctx.fillText(state.countdown, W/2, H/2);
  ctx.restore();
}

function gameLoop() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  const lvl = state.currentLevel || getLevelData(state.wave);
  drawPath(lvl.path);
  drawObstacles(lvl.obstacles);

  if (!started) {
    drawStartScreen();
    requestAnimationFrame(gameLoop);
    return;
  }

  drawLifeTree();

  if (state.running && !state.paused) {
    updateSpawnQueue();
    updateEnemies();
    updateTowers();
    updateProjectiles();
    checkWaveEnd();
  }

  updateParticles();
  updateFloatingTexts();

  drawTowers();
  drawGhostTower();
  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawFloatingTexts();
  drawCountdown();
  drawPausedOverlayOnCanvas();

  if (state.gameOver) drawEndScreen();

  updateHUD();
  requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (W / rect.width);
  const my = (e.clientY - rect.top) * (H / rect.height);
  state.mouseX = mx;
  state.mouseY = my;

  if (state.movingTower) {
    state.movingTower.x = mx;
    state.movingTower.y = my;
  }
});

canvas.addEventListener('click', e => {
  if (state.paused) return;
  if (state.gameOver || state.victory) { resetGame(); return; }

  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width  / rect.width);
  const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
  started = true;

  if (state.dragTower) { placeTower(state.dragTower, mx, my); return; }

  if (state.movingTower) {
    const clicked = state.towers.find(t => Math.hypot(t.x - mx, t.y - my) < 24);
    if (clicked === state.movingTower) {
      state.movingTower = null;
      updateSelectedInfo(state.selectedTower);
      return;
    }
    
    const hitOtherTower = state.towers.find(t => t !== state.movingTower && Math.hypot(t.x - mx, t.y - my) < 24);
    if (isOnPath(mx, my) || isOnObstacle(mx, my) || hitOtherTower) {
      if (typeof spawnFloatingText === 'function') spawnFloatingText('Tidak bisa di sini!', mx, my, '#ff4444');
      if (typeof SFX !== 'undefined' && SFX.error) SFX.error();
      return;
    }
    
    state.movingTower.x = mx;
    state.movingTower.y = my;
    if (typeof spawnParticles === 'function') spawnParticles(mx, my, state.movingTower.color, 8);
    if (typeof spawnFloatingText === 'function') spawnFloatingText('✔ Dipindahkan!', mx, my - 24, '#90c860');
    if (typeof SFX !== 'undefined' && SFX.place_tower) SFX.place_tower();
    
    state.movingTower = null;
    state.selectedTower = null;
    state.towers.forEach(t => t.selected = false);
    updateSelectedInfo(null);
    return;
  }

  const clicked = state.towers.find(t => Math.hypot(t.x - mx, t.y - my) < 24);
  if (clicked) {
    state.towers.forEach(t => t.selected = false);
    if (state.selectedTower === clicked) {
      state.selectedTower = null;
      updateSelectedInfo(null);
    } else {
      state.selectedTower = clicked;
      clicked.selected    = true;
      updateSelectedInfo(clicked);
    }
    if (typeof SFX !== 'undefined' && SFX.click_btn) SFX.click_btn();
    return;
  }

  state.selectedTower = null;
  state.towers.forEach(t => t.selected = false);
  updateSelectedInfo(null);
});

document.querySelectorAll('.tower-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    if (state.dragTower === type) {
      state.dragTower = null;
      btn.classList.remove('selected');
    } else {
      state.dragTower = type;
      state.selectedTower = null;
      state.towers.forEach(t => t.selected = false);
      updateSelectedInfo(null);
      document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    }
    SFX.click_btn();
  });
});

document.getElementById('btnStart').addEventListener('click', () => {
  started = true;
  state.currentLevel = getLevelData(state.wave);
  startWave();
  SFX.click_btn();
});

document.getElementById('btnSpeed').addEventListener('click', () => {
  state.speed = state.speed === 1 ? 2 : 1;
  document.getElementById('btnSpeed').textContent = state.speed === 2 ? '⏩ Normal ×1' : '⏩ Percepat ×2';
  SFX.click_btn();
});

document.addEventListener('click', e => {
  if (e.target.closest('#btnPauseTopbar')) {
    if (state.gameOver || state.victory) return;
    setPaused(!state.paused);
    return;
  }
  if (e.target.closest('#btnResume')) {
    setPaused(false);
    return;
  }
  if (e.target.closest('#btnPauseMenu')) {
    SFX.click_btn();
    window.location.href = 'menu.html';
    return;
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (state.gameOver || state.victory) return;
    setPaused(!state.paused);
  }
});

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect  = canvas.getBoundingClientRect();
  state.mouseX = (touch.clientX - rect.left) * (canvas.width  / rect.width);
  state.mouseY = (touch.clientY - rect.top)  * (canvas.height / rect.height);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect  = canvas.getBoundingClientRect();
  state.mouseX = (touch.clientX - rect.left) * (canvas.width  / rect.width);
  state.mouseY = (touch.clientY - rect.top)  * (canvas.height / rect.height);
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  const rect  = canvas.getBoundingClientRect();
  const simulatedClick = new MouseEvent('click', {
    clientX: touch.clientX,
    clientY: touch.clientY,
    bubbles: true,
  });
  canvas.dispatchEvent(simulatedClick);
}, { passive: false });

window.addEventListener('resize', () => {});

function resetGame() {
  state.life = 10; state.gold = 150; state.wave = 1;
  state.running = false; state.paused = false; state.speed = 1;
  state.selectedTower = null;
  state.towers = []; state.enemies = []; state.projectiles = [];
  state.particles = []; state.spawnQueue = []; state.spawnTimer = 0;
  state.currentLevel = null; state.gameOver = false; state.victory = false;
  state.dragTower = null; state.movingTower = null; state.floatingTexts = [];
  state.killCount = 0; state.totalGoldEarned = 0; state.waveReached = 1;
  state.countdown = 0; state.countdownActive = false;
  state.powerups = { petir:2, beku:2, emas:1 };
  state.lifeTree = { hp:100, maxHp:100 };
  started = false;
  document.getElementById('btnSpeed').textContent = '⏩ Percepat ×2';
  document.getElementById('wave').textContent = 1;
  document.getElementById('pauseOverlay').classList.remove('open');
  updateSelectedInfo(null);
  updatePowerupUI();
  setStatus('Menunggu perintah...');
  localStorage.removeItem('phn_save');
  saveExists = false;
}

gameLoop();

updatePowerupUI();

const hsBar = document.getElementById('highscoreBar');
if (hsBar) hsBar.textContent = highScore > 0 ? '🏆 Rekor: Gelombang ' + highScore : '';

document.getElementById('btnLanjutkan') && document.getElementById('btnLanjutkan').addEventListener('click', () => {
  if (saveExists) loadGame();
});

document.getElementById('tpBtnMove').addEventListener('click', () => {
  if (!state.selectedTower) return;
  
  state.movingTower = state.selectedTower;
  state.movingTower.oldX = state.selectedTower.x;
  state.movingTower.oldY = state.selectedTower.y;
  
  updateSelectedInfo(null);
  const popup = document.getElementById('towerPopup');
  if (popup) popup.classList.remove('show');
  
  spawnFloatingText('Pilih lokasi baru!', state.movingTower.x, state.movingTower.y - 24, '#88ccff');
});

function showWaveClearMenu() {
  const popup = document.getElementById('waveClearPopup');
  if (!popup) return;
  const title = document.getElementById('wcpTitle');
  if (title) {
    title.textContent = 'GELOMBANG ' + state.wave + ' SELESAI!';
  }
  popup.style.display = 'flex';
}

function hideWaveClearMenu() {
  const popup = document.getElementById('waveClearPopup');
  if (popup) popup.style.display = 'none';
}

document.getElementById('wcpBtnNext').addEventListener('click', (e) => {
  e.stopPropagation();
  e.preventDefault();
  
  hideWaveClearMenu();
  
  state.wave++;
  const waveUI = document.getElementById('wave');
  if (waveUI) waveUI.textContent = state.wave;
  
  state.waveClearing = false;
  state.running = false;
  state.countdownActive = false;
  
  setStatus('Gelombang ' + state.wave + ' akan datang...');
  
  if (typeof startWave === 'function') {
    startWave();
  }
});

document.getElementById('wcpBtnRestart').addEventListener('click', (e) => {
  e.stopPropagation();
  e.preventDefault();
  hideWaveClearMenu();
  if (typeof resetGame === 'function') {
    state.waveClearing = false;
    resetGame();
  }
});

document.getElementById('wcpBtnExit').addEventListener('click', (e) => {
  e.stopPropagation();
  e.preventDefault();
  hideWaveClearMenu();
  state.running = false;
  state.selectedTower = null;
  state.movingTower = null;
  updateSelectedInfo(null);
  
  window.location.href = 'menu.html';
});

function showBattleStats(isVictory) {
  const popup = document.getElementById('statsPopup');
  if (!popup) return;

  const title = document.getElementById('statsMainTitle');
  const subTitle = document.getElementById('statsSubTitle');
  
  if (isVictory) {
    title.textContent = 'KEMENANGAN AGUNG';
    title.style.color = '#f0c040';
    subTitle.textContent = 'Hutan Nusantara Damai di Tanganmu';
  } else {
    title.textContent = 'PERTAHANAN JEBOL';
    title.style.color = '#ff4444';
    subTitle.textContent = 'Kegelapan Menguasai Tanah Air';
  }

  document.getElementById('statWave').textContent = state.wave;
  document.getElementById('statGoldEarned').textContent = state.totalGoldEarned;
  document.getElementById('statKills').textContent = state.killCount;
  document.getElementById('statBears').textContent = state.enemiesLeaked;
  document.getElementById('statGoldSpent').textContent = state.goldSpent;
  document.getElementById('statAbilities').textContent = state.abilityUsedCount;

  const totalMusuh = state.killCount + state.enemiesLeaked;
  let efisiensi = 100;
  if (totalMusuh > 0) {
    efisiensi = Math.round((state.killCount / totalMusuh) * 100);
  }
  document.getElementById('statEfficiency').textContent = efisiensi + '%';

  let predikat = 'TARUNA HUTAN';
  if (isVictory && efisiensi === 100) {
    predikat = 'PENJAGA AGUNG';
  } else if (isVictory) {
    predikat = 'PAHLAWAN NUSA';
  } else if (state.wave >= 10) {
    predikat = 'KSATRIA GUGUR';
  } else {
    predikat = 'PEMULA HUTAN';
  }
  document.getElementById('statsBadge').textContent = predikat;

  let koinLokal = parseInt(localStorage.getItem('koinPermanen')) || 0;
  koinLokal += state.totalGoldEarned;
  localStorage.setItem('koinPermanen', koinLokal);

  popup.style.display = 'flex';
}

document.getElementById('statsBtnClose').addEventListener('click', (e) => {
  e.stopPropagation();
  e.preventDefault();
  document.getElementById('statsPopup').style.display = 'none';
  state.running = false;
  window.location.href = 'index.html';
});