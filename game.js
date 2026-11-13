const c = document.getElementById('c');
const ctx = c.getContext('2d');
let W = 900, H = 500, lvl = 0, tool = 'road', run = false, spent = 0;
let nodes = new Array();
let beams = new Array();
let car = null, drag = null, mx = 0, my = 0;

const MAT = {
  road:  { cost: 1.0, max: 0.18, stiff: 0.90, col: '#334155', w: 8, road: true },
  wood:  { cost: 0.6, max: 0.15, stiff: 0.85, col: '#92400e', w: 5, road: false },
  steel: { cost: 1.5, max: 0.30, stiff: 0.98, col: '#64748b', w: 6, road: false }
};

const LVLS = [
  { cash: 2200, g1: 0.25, g2: 0.75, gy: 0.65, pts: [[0.25,0.65],[0.75,0.65],[0.22,0.78],[0.78,0.78]] },
  { cash: 3500, g1: 0.20, g2: 0.80, gy: 0.65, pts: [[0.20,0.65],[0.80,0.65],[0.50,0.82],[0.18,0.80],[0.82,0.80]] },
  { cash: 4500, g1: 0.18, g2: 0.82, gy: 0.62, pts: [[0.18,0.62],[0.82,0.62],[0.18,0.45],[0.82,0.45]] }
];

function size() {
  W = c.width = Math.min(window.innerWidth, 900);
  H = c.height = Math.max(300, window.innerHeight - document.getElementById('bar').offsetHeight);
}

function pick(t) {
  if (run) return;
  tool = t;
  document.querySelectorAll('#bar button').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('b-' + t);
  if (el) el.classList.add('active');
}

function msg(t) { document.getElementById('tip').innerText = t; }

function hud() {
  const b = LVLS[lvl].cash;
  document.getElementById('lvl').innerText = 'Level ' + (lvl + 1) + '/3';
  const el = document.getElementById('cash');
  el.innerText = 'Budget: $' + Math.max(0, Math.round(b - spent));
  el.style.color = spent > b ? '#ef4444' : '#34d399';
}

function load(n) {
  lvl = n % LVLS.length;
  run = false;
  const sb = document.getElementById('b-sim');
  sb.innerText = '▶ Test';
  sb.className = 'go';
  nodes = new Array();
  beams = new Array();
  spent = 0;
  car = null;
  const pts = LVLS[lvl].pts;
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0] * W, y = pts[i][1] * H;
    nodes.push({ x: x, y: y, ox: x, oy: y, sx: x, sy: y, pin: true });
  }
  hud();
  msg('Level ' + (lvl + 1) + ': Drag from red dots to build a road across!');
}
function toggle() {
  const sb = document.getElementById('b-sim');
  if (!run) {
    if (spent > LVLS[lvl].cash) return msg('Over budget! Erase some pieces first.');
    run = true; sb.innerText = '■ Stop'; sb.className = 'stop';
    nodes.forEach(n => { n.sx = n.x; n.sy = n.y; n.ox = n.x; n.oy = n.y; });
    beams.forEach(b => { b.dead = false; b.str = 0; });
    car = { x: 40, y: LVLS[lvl].gy * H - 14, vx: 2.3, vy: 0, r: 14, win: false };
    msg('Testing bridge...');
  } else {
    run = false; sb.innerText = '▶ Test'; sb.className = 'go';
    nodes.forEach(n => { n.x = n.sx; n.y = n.sy; });
    beams.forEach(b => { b.dead = false; b.str = 0; });
    car = null;
    msg('Edit mode: Drag to modify your bridge.');
  }
}

function getXY(e) {
  const r = c.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function near(x, y, d) {
  return nodes.find(n => Math.hypot(n.x - x, n.y - y) < d);
}

c.addEventListener('pointerdown', e => {
  if (run) return;
  const p = getXY(e); mx = p.x; my = p.y;
  if (tool === 'erase') {
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      if (Math.hypot((b.a.x + b.b.x) / 2 - p.x, (b.a.y + b.b.y) / 2 - p.y) < 28) {
        spent -= b.cost; beams.splice(i, 1);
      }
    }
    nodes = nodes.filter(n => n.pin || beams.some(b => b.a === n || b.b === n));
    return hud();
  }
  drag = near(p.x, p.y, 26);
});

c.addEventListener('pointermove', e => { const p = getXY(e); mx = p.x; my = p.y; });

c.addEventListener('pointerup', e => {
  if (run || !drag) return;
  const p = getXY(e), dx = p.x - drag.x, dy = p.y - drag.y, d = Math.hypot(dx, dy);
  if (d > 25) {
    const ex = d > 135 ? drag.x + (dx / d) * 135 : p.x;
    const ey = d > 135 ? drag.y + (dy / d) * 135 : p.y;
    let end = near(ex, ey, 26);
    if (!end) { end = { x: ex, y: ey, ox: ex, oy: ey, sx: ex, sy: ey, pin: false }; nodes.push(end); }
    if (end !== drag && !beams.some(b => (b.a === drag && b.b === end) || (b.a === end && b.b === drag))) {
      const len = Math.hypot(end.x - drag.x, end.y - drag.y);
      const cost = Math.round(len * MAT[tool].cost);
      beams.push({ a: drag, b: end, len: len, t: tool, cost: cost, dead: false, str: 0 });
      spent += cost; hud();
    }
  }
  drag = null;
});

function step() {
  if (!run) return;
  nodes.forEach(n => {
    if (n.pin) return;
    const vx = (n.x - n.ox) * 0.99, vy = (n.y - n.oy) * 0.99;
    n.ox = n.x; n.oy = n.y; n.x += vx; n.y += vy + 0.18;
  });
  if (car) {
    car.vy += 0.25; car.x += car.vx; car.y += car.vy;
    const L = LVLS[lvl], gy = L.gy * H;
    if ((car.x < L.g1 * W + 10 || car.x > L.g2 * W - 10) && car.y + car.r > gy) { car.y = gy - car.r; car.vy = 0; }
    beams.forEach(b => {
      if (b.dead || !MAT[b.t].road) return;
      const abx = b.b.x - b.a.x, aby = b.b.y - b.a.y, sq = abx * abx + aby * aby;
      if (!sq) return;
      const t = Math.max(0, Math.min(1, ((car.x - b.a.x) * abx + (car.y - b.a.y) * aby) / sq));
      const d = Math.hypot(car.x - (b.a.x + t * abx), car.y - (b.a.y + t * aby));
      if (d < car.r + 4) {
        car.y -= (car.r + 4) - d; car.vy = 0;
        if (!b.a.pin) b.a.y += 1.6 * (1 - t);
        if (!b.b.pin) b.b.y += 1.6 * t;
      }
    });
    if (car.y > H + 30) msg('Splash! Bridge collapsed. Tap Stop to fix it.');
    else if (car.x > W - 50 && !car.win) { car.win = true; msg('Success! Next level...'); setTimeout(() => load(lvl + 1), 1600); }
  }
  for (let k = 0; k < 8; k++) {
    beams.forEach(b => {
      if (b.dead) return;
      const dx = b.b.x - b.a.x, dy = b.b.y - b.a.y, d = Math.hypot(dx, dy) || 0.001;
      const st = Math.abs(d - b.len) / b.len, m = MAT[b.t];
      b.str = Math.min(1, st / m.max);
      if (st > m.max && k === 0) { b.dead = true; return; }
      const df = (b.len - d) / d, ox = dx * df * 0.5 * m.stiff, oy = dy * df * 0.5 * m.stiff;
      if (!b.a.pin && !b.b.pin) { b.a.x -= ox; b.a.y -= oy; b.b.x += ox; b.b.y += oy; }
      else if (!b.a.pin) { b.a.x -= ox * 2; b.a.y -= oy * 2; }
      else if (!b.b.pin) { b.b.x += ox * 2; b.b.y += oy * 2; }
    });
  }
}

function loop() {
  ctx.clearRect(0, 0, W, H);
  const L = LVLS[lvl], gy = L.gy * H;
  ctx.fillStyle = '#15803d'; ctx.fillRect(0, gy, L.g1 * W, H - gy); ctx.fillRect(L.g2 * W, gy, W - L.g2 * W, H - gy);
  ctx.fillStyle = '#78350f'; ctx.fillRect(0, gy + 14, L.g1 * W, H - gy); ctx.fillRect(L.g2 * W, gy + 14, W - L.g2 * W, H - gy);
  ctx.fillStyle = '#ef4444'; ctx.fillRect(W - 60, gy - 40, 4, 40); ctx.fillRect(W - 56, gy - 40, 24, 15);
  beams.forEach(b => {
    if (b.dead) return;
    const m = MAT[b.t];
    ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y); ctx.lineTo(b.b.x, b.b.y); ctx.lineWidth = m.w;
    if (run && b.str > 0.4) { const r = Math.min(255, Math.round(b.str * 255)); ctx.strokeStyle = 'rgb(' + r + ',' + (255 - r) + ',40)'; }
    else ctx.strokeStyle = m.col;
    ctx.stroke();
  });
  if (drag && !run) {
    const dx = mx - drag.x, dy = my - drag.y, d = Math.min(135, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    ctx.beginPath(); ctx.moveTo(drag.x, drag.y); ctx.lineTo(drag.x + Math.cos(a) * d, drag.y + Math.sin(a) * d);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4; ctx.stroke();
  }
  nodes.forEach(n => {
    ctx.beginPath(); ctx.arc(n.x, n.y, n.pin ? 8 : 5, 0, Math.PI * 2);
    ctx.fillStyle = n.pin ? '#ef4444' : '#f8fafc'; ctx.fill();
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.stroke();
  });
  if (car) {
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(car.x - 18, car.y - 12, 36, 16);
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(car.x - 10, car.y + 6, 6, 0, Math.PI * 2); ctx.arc(car.x + 10, car.y + 6, 6, 0, Math.PI * 2); ctx.fill();
  }
  step(); requestAnimationFrame(loop);
}

window.addEventListener('resize', size);
size(); load(0); loop();
