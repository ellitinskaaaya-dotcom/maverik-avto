// Блок с формой (финал): анимация «перегон» по референсу Д1 Phalcon.
// Слои сгенерированы в ChatGPT (docs/promty.md): ч/б трасса сверху, оранжевая машина, серые машины.
// Это иллюстрация, не фото заказчика.
const box = document.querySelector('.fin-road');
if (box) init(box);

async function init(box) {
  const q = new URLSearchParams(location.search);
  const STATIC = q.has('static') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = box.dataset.base || 'img/';
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = base + src; });
  let road, ours, sheet;
  try { [road, ours, sheet] = await Promise.all([load('trassa-sverhu-chb.webp'), load('mashina-oranzhevaya-sverhu.webp'), load('mashiny-serye-sverhu.webp')]); }
  catch (e) { return; } // нет картинок — остаётся фото

  /* ---------- трасса: координаты из картинки 1024×1536 (замерено по разметке) ---------- */
  const TILE = road.height;                       // 1536
  const OURS_X = 628;                             // средняя полоса нашего направления
  const LANES = [                                 // x центра полосы, скорость относительно нашей (доля)
    { x: 561, k: 1.35 }, { x: 694, k: 0.72 },     // наше направление: левая обгоняет, правая отстаёт
    { x: 468, k: -1.0 }, { x: 403, k: -1.1 }, { x: 335, k: -0.9 }, // встречка
  ];
  const CAR_LEN = 86;                             // ≈ 4,5 м при полосе 67 px = 3,5 м

  /* ---------- спрайты: обрезка по непрозрачным пикселям + запечённая тень ---------- */
  function alphaBox(img, sx, sy, sw, sh) {
    const c = document.createElement('canvas'); c.width = sw; c.height = sh;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const d = g.getImageData(0, 0, sw, sh).data; let x0 = sw, y0 = sh, x1 = 0, y1 = 0;
    for (let y = 0; y < sh; y += 2) for (let x = 0; x < sw; x += 2) if (d[(y * sw + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x: sx + x0, y: sy + y0, w: x1 - x0 + 2, h: y1 - y0 + 2 };
  }
  function sprite(img, b) { // машина длиной CAR_LEN с мягкой тенью, отрисованная один раз
    const sc = CAR_LEN / b.h, w = b.w * sc, h = CAR_LEN, pad = 22;
    const c = document.createElement('canvas'); const R = 3; // запас чёткости
    c.width = Math.ceil((w + pad * 2) * R); c.height = Math.ceil((h + pad * 2) * R);
    const g = c.getContext('2d'); g.scale(R, R);
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 12; g.shadowOffsetX = 5; g.shadowOffsetY = 7;
    g.drawImage(img, b.x, b.y, b.w, b.h, pad, pad, w, h);
    return { c, w: w + pad * 2, h: h + pad * 2 };
  }
  const oursS = sprite(ours, alphaBox(ours, 0, 0, ours.width, ours.height));
  // серые: лист 1536×1024, машины в ряд — делим по пустым столбцам
  const greys = [];
  {
    const c = document.createElement('canvas'); c.width = sheet.width; c.height = sheet.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(sheet, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, cols = [];
    for (let x = 0; x < c.width; x++) { let s = 0; for (let y = 0; y < c.height; y += 4) s += d[(y * c.width + x) * 4 + 3] > 40 ? 1 : 0; cols.push(s > 2); }
    let x = 0;
    while (x < cols.length) { if (cols[x]) { let e = x; while (e + 1 < cols.length && cols[e + 1]) e++; if (e - x > 40) greys.push(sprite(sheet, alphaBox(sheet, x, 0, e - x + 1, c.height))); x = e + 1; } else x++; }
  }
  if (!greys.length) return;

  /* ---------- холст ---------- */
  const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
  box.appendChild(cv); box.classList.add('ok');
  const g = cv.getContext('2d');
  const VIEW_W = 600;                 // ширина видимой части мира (px картинки трассы)
  const VIEW_X0 = OURS_X - 330;       // левый край вида: видно всю трассу и немного леса
  let s = 1, W = 0, H = 0;
  function resize() {
    // размер без учёта наклона (getBoundingClientRect вернул бы сжатую проекцию — машины вытянулись бы)
    const w = cv.offsetWidth, h = cv.offsetHeight; if (!w) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    s = cv.width / VIEW_W; W = VIEW_W; H = cv.height / s;
  }

  /* ---------- поток ---------- */
  const V = 170; // скорость трассы, px картинки в секунду
  const cars = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function spawnAll() {
    cars.length = 0;
    for (const L of LANES) {
      let y = rnd(-120, 40);
      while (y < H + 120) {
        cars.push({ x: L.x + rnd(-4, 4), y, k: L.k, sp: greys[(Math.random() * greys.length) | 0], ph: rnd(0, 6) });
        y += rnd(170, 330);
      }
    }
  }
  let off = 0, myY = 0;
  function step(dt) {
    off += V * dt;
    for (const c of cars) {
      // скорость на экране: наше направление — V·(1−k) вниз; встречка — V·(1+|k|) вниз
      const vy = c.k > 0 ? V * (1 - c.k) : V * (1 - c.k);
      c.y += vy * dt;
      const span = H + 420;
      if (c.y > H + 150) c.y -= span; else if (c.y < -270) c.y += span;
    }
  }
  function draw(t) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    g.setTransform(s, 0, 0, s, -VIEW_X0 * s, 0);
    // трасса: плитки по очереди прямая и отражённая — шов не виден
    const n = Math.floor(off / TILE), fr = off - n * TILE;
    for (let i = -1; i * TILE + fr < H + TILE; i++) {
      const idx = i - n, y = i * TILE + fr;
      // перекрытие в 2 px, чтобы на стыке не было тонкой линии
      if (idx & 1) { g.save(); g.translate(0, y + TILE + 1); g.scale(1, -1); g.drawImage(road, 0, 0, road.width, TILE + 2); g.restore(); }
      else g.drawImage(road, 0, y - 1, road.width, TILE + 2);
    }
    // машины
    for (const c of cars) {
      const sp = c.sp, x = c.x + Math.sin(t * .5 + c.ph) * .8;
      if (c.k < 0) { g.save(); g.translate(x, c.y); g.rotate(Math.PI); g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h); g.restore(); }
      else g.drawImage(sp.c, x - sp.w / 2, c.y - sp.h / 2, sp.w, sp.h);
    }
    myY = H * .6;
    const mx = OURS_X + Math.sin(t * .35) * 1.6;
    g.drawImage(oursS.c, mx - oursS.w / 2, myY - oursS.h / 2, oursS.w, oursS.h);
  }

  resize(); spawnAll();
  new ResizeObserver(() => { const h0 = H; resize(); if (Math.abs(H - h0) > 40) spawnAll(); if (!running) draw(last / 1000); }).observe(cv);

  let running = false, last = 0, visible = true;
  if (STATIC) { for (let i = 0; i < 60; i++) step(1 / 30); draw(2); return; }
  function frame(now) {
    if (!running) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    step(dt); draw(now / 1000);
    requestAnimationFrame(frame);
  }
  const start = () => { if (running || !visible || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(frame); };
  new IntersectionObserver(e => { visible = e[0].isIntersecting; visible ? start() : (running = false); }, { rootMargin: '100px' }).observe(box);
  document.addEventListener('visibilitychange', () => document.hidden ? (running = false) : start());
  draw(0); start();
}
