/* ================================================================
   Holi Gift Box — script.js
   Single scene. Heavy zoom so box fills screen.
   ================================================================ */

const CONFIG = {
  userName: 'Anoop',
  introDelay: 0.5,
  sprayParticleCount: 80,
};

const HOLI_COLORS = [
  '#FF1493', '#FF6B35', '#FFD700', '#00E676',
  '#E040FB', '#FF4081', '#00BCD4', '#FFEB3B',
  '#F44336', '#7C4DFF', '#FF9800', '#4CAF50',
];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const boxWrapper = $('#boxWrapper');
const boxLid = $('#boxLid');
const assetBackdrop = $('#assetBackdrop');
const cancelBtn = $('#cancelBtn');
const sprayCanvas = $('#sprayCanvas');

// ===== Cancel =====
cancelBtn.addEventListener('click', () => {
  try {
    if (window.webkit?.messageHandlers?.close) {
      window.webkit.messageHandlers.close.postMessage('close');
    } else if (window.Android?.close) {
      window.Android.close();
    } else {
      window.close();
    }
  } catch (e) {
    window.close();
  }
});


/* ================================================================
   TARGET SCALE — box should fill most of the screen height
   ================================================================ */
function getTargetScale() {
  const screenH = window.innerHeight;
  const boxH = 326; // approx box height in px at base size
  // Fill ~90% of screen height
  const targetH = screenH * 1.1;
  return targetH / boxH;
}


/* ================================================================
   INTRO SEQUENCE
   ================================================================ */
function playIntro() {
  const targetScale = getTargetScale();

  const tl = gsap.timeline({ delay: CONFIG.introDelay });

  // Step 1: Zoom toward the box
  tl.to(boxWrapper, {
    scale: 1,
    duration: 2.0,
    ease: 'power2.inOut',
  });

  // Step 2: Brief pause
  tl.to({}, { duration: 0.5 });

  // Step 3: Lid rotates and slides off to the left
  tl.to(boxLid, {
    rotation: -25,
    x: '-120vw',
    opacity: 0,
    duration: 0.9,
    ease: 'power2.in',
  });

  // Step 4: Big zoom — box fills most of the screen. No fade.
  tl.to(boxWrapper, {
    scale: targetScale,
    duration: 1.2,
    ease: 'power2.inOut',
  }, '-=0.3');

  // Move assets to "viewport fit" positions during the zoom
  tl.to('#assetGujiya', {
    left: '2%',
    bottom: '25%',
    scale: 1.05,
    duration: 1.2,
    ease: 'power2.inOut',
  }, '<');

  tl.to('#assetPichkari', {
    right: '2%',
    top: '22%',
    rotation: -10,
    scale: 1.1,
    duration: 1.2,
    ease: 'power2.inOut',
  }, '<');

  tl.to('#assetGulal', {
    right: '5%',
    bottom: '5%',
    scale: 1.1,
    duration: 1.2,
    ease: 'power2.inOut',
  }, '<');

  // Fade in the text message on the letter after the zoom completes
  tl.to('#letterContent', {
    opacity: 1,
    y: 0,
    duration: 0.6,
    ease: 'power1.out',
  });
}

playIntro();


/* ================================================================
   SPRAY PARTICLE SYSTEM (for Pichkari)
   ================================================================ */
const sprayCtx = sprayCanvas.getContext('2d');
let sprayParticles = [];
let sprayAnimId = null;

function resizeSprayCanvas() {
  const dpr = window.devicePixelRatio || 1;
  sprayCanvas.width = window.innerWidth * dpr;
  sprayCanvas.height = window.innerHeight * dpr;
  sprayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createSprayParticle(originX, originY, angle) {
  const speed = 6 + Math.random() * 12;
  const spread = (Math.random() - 0.5) * 0.6;
  const finalAngle = angle + spread;
  const colors = ['#00BCD4', '#4FC3F7', '#B3E5FC', '#E0F7FA', '#26C6DA'];
  return {
    x: originX, y: originY,
    vx: Math.cos(finalAngle) * speed,
    vy: Math.sin(finalAngle) * speed,
    size: 1 + Math.random() * 2.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 0.7 + Math.random() * 0.3,
    gravity: 0.08 + Math.random() * 0.06,
    friction: 0.985,
    life: 1,
    decay: 0.012 + Math.random() * 0.015,
  };
}

function animateSpray() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  sprayCtx.clearRect(0, 0, w, h);

  for (let i = sprayParticles.length - 1; i >= 0; i--) {
    const p = sprayParticles[i];
    p.vy += p.gravity;
    p.vx *= p.friction;
    p.vy *= p.friction;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    p.alpha = Math.max(0, p.life * 0.8);

    if (p.life <= 0) { sprayParticles.splice(i, 1); continue; }

    sprayCtx.globalAlpha = p.alpha;
    sprayCtx.fillStyle = p.color;
    sprayCtx.beginPath();
    sprayCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    sprayCtx.fill();
  }
  sprayCtx.globalAlpha = 1;

  if (sprayParticles.length > 0) {
    sprayAnimId = requestAnimationFrame(animateSpray);
  } else {
    sprayAnimId = null;
  }
}

function sprayWater(originX, originY, angle) {
  resizeSprayCanvas();
  for (let i = 0; i < CONFIG.sprayParticleCount; i++) {
    sprayParticles.push(createSprayParticle(originX, originY, angle));
  }
  if (!sprayAnimId) animateSpray();
}


/* ================================================================
   COLOR BURST (for Gulal)
   ================================================================ */
let burstParticles = [];
let burstAnimId = null;

function createBurstParticle(cx, cy) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 3 + Math.random() * 15;
  const color = HOLI_COLORS[Math.floor(Math.random() * HOLI_COLORS.length)];
  return {
    x: cx + (Math.random() - 0.5) * 40,
    y: cy + (Math.random() - 0.5) * 40,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - Math.random() * 4,
    size: 1.5 + Math.random() * 4,
    color, alpha: 0.8 + Math.random() * 0.2,
    gravity: 0.04 + Math.random() * 0.04,
    friction: 0.98, life: 1,
    decay: 0.004 + Math.random() * 0.008,
  };
}

function animateBurst() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  sprayCtx.clearRect(0, 0, w, h);

  for (let i = burstParticles.length - 1; i >= 0; i--) {
    const p = burstParticles[i];
    p.vy += p.gravity;
    p.vx *= p.friction;
    p.vy *= p.friction;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    p.alpha = Math.max(0, p.life);

    if (p.life <= 0) { burstParticles.splice(i, 1); continue; }

    sprayCtx.globalAlpha = p.alpha;
    sprayCtx.fillStyle = p.color;
    sprayCtx.beginPath();
    sprayCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    sprayCtx.fill();
  }
  sprayCtx.globalAlpha = 1;

  if (burstParticles.length > 0) {
    burstAnimId = requestAnimationFrame(animateBurst);
  } else {
    burstAnimId = null;
  }
}

function triggerColorBurst(element) {
  resizeSprayCanvas();
  const rect = element.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 3000; i++) {
    burstParticles.push(createBurstParticle(cx, cy));
  }
  if (!burstAnimId) animateBurst();
}


/* ================================================================
   Z-INDEX MANAGEMENT
   ================================================================ */
let activeAsset = null;

function bringToFront(asset) {
  if (activeAsset && activeAsset !== asset) return;
  activeAsset = asset;
  asset.style.zIndex = 50;
  asset.classList.add('interacting');
  assetBackdrop.classList.add('active');
}

function resetAsset(asset) {
  asset.style.zIndex = '';
  asset.classList.remove('interacting');
  assetBackdrop.classList.remove('active');
  activeAsset = null;
}


/* ================================================================
   ASSET: PICHKARI
   ================================================================ */
$('#assetPichkari').addEventListener('click', () => {
  if (activeAsset) return;
  const el = $('#assetPichkari');
  bringToFront(el);

  const rect = el.getBoundingClientRect();
  const nozzleX = rect.left + rect.width * 0.8;
  const nozzleY = rect.top + rect.height * 0.3;

  const tl = gsap.timeline({ onComplete: () => resetAsset(el) });

  tl.to(el, { scale: 1.3, rotation: 0, duration: 0.3, ease: 'back.out(1.5)' });

  tl.call(() => sprayWater(nozzleX, nozzleY, Math.PI));
  tl.to(el, { rotation: -15, duration: 0.2 });
  tl.to(el, { x: -5, duration: 0.1 });
  tl.to(el, { x: 0, duration: 0.1 });
  tl.to({}, { duration: 0.3 });

  tl.call(() => sprayWater(nozzleX, nozzleY, -Math.PI * 0.7));
  tl.to(el, { rotation: 10, duration: 0.25 });
  tl.to(el, { x: -5, duration: 0.1 });
  tl.to(el, { x: 0, duration: 0.1 });
  tl.to({}, { duration: 0.3 });

  tl.call(() => sprayWater(nozzleX, nozzleY, -Math.PI / 2));
  tl.to(el, { rotation: -5, duration: 0.2 });
  tl.to(el, { x: -5, duration: 0.1 });
  tl.to(el, { x: 0, duration: 0.1 });
  tl.to({}, { duration: 0.5 });

  tl.to(el, { scale: 1, rotation: -15, x: 0, y: 0, duration: 0.4, ease: 'power2.inOut' });
});


/* ================================================================
   ASSET: GUJIYA
   ================================================================ */
$('#assetGujiya').addEventListener('click', () => {
  if (activeAsset) return;
  const el = $('#assetGujiya');
  bringToFront(el);

  const rect = el.getBoundingClientRect();
  const centerX = window.innerWidth / 2 - rect.left - rect.width / 2;
  const centerY = window.innerHeight / 2 - rect.top - rect.height / 2;

  const tl = gsap.timeline({ onComplete: () => resetAsset(el) });

  tl.to(el, { x: centerX, y: centerY, scale: 1.8, duration: 0.5, ease: 'power2.out' });

  tl.to(el, { rotation: -5, duration: 0.08 });
  tl.to(el, { rotation: 5, duration: 0.08 });
  tl.to(el, { rotation: 0, duration: 0.08 });
  tl.to(el, { clipPath: 'inset(0 25% 0 0)', duration: 0.2 });
  tl.to({}, { duration: 0.4 });

  tl.to(el, { rotation: -4, duration: 0.08 });
  tl.to(el, { rotation: 4, duration: 0.08 });
  tl.to(el, { rotation: 0, duration: 0.08 });
  tl.to(el, { clipPath: 'inset(0 55% 0 0)', duration: 0.2 });
  tl.to({}, { duration: 0.4 });

  tl.to(el, { rotation: -3, duration: 0.08 });
  tl.to(el, { rotation: 3, duration: 0.08 });
  tl.to(el, { rotation: 0, duration: 0.08 });
  tl.to(el, { clipPath: 'inset(0 85% 0 0)', duration: 0.2 });
  tl.to({}, { duration: 0.3 });

  tl.to(el, { opacity: 0, scale: 0.5, duration: 0.3 });
  tl.set(el, { x: 0, y: 0, scale: 1, rotation: 0, clipPath: 'inset(0 0 0 0)', opacity: 0 });
  tl.to(el, { opacity: 1, duration: 0.5, ease: 'back.out(1.5)' });
});


/* ================================================================
   ASSET: GULAL
   ================================================================ */
$('#assetGulal').addEventListener('click', () => {
  if (activeAsset) return;
  const el = $('#assetGulal');
  bringToFront(el);

  const tl = gsap.timeline({ onComplete: () => resetAsset(el) });

  tl.to(el, { scale: 1.15, duration: 0.15, ease: 'power2.out' });
  tl.call(() => triggerColorBurst(el));

  tl.to(el, { rotation: -8, duration: 0.06 });
  tl.to(el, { rotation: 8, duration: 0.06 });
  tl.to(el, { rotation: -5, duration: 0.06 });
  tl.to(el, { rotation: 5, duration: 0.06 });
  tl.to(el, { rotation: 0, duration: 0.08 });

  tl.to({}, { duration: 1.5 });
  tl.to(el, { scale: 1, rotation: 0, duration: 0.3, ease: 'power2.inOut' });
});


/* ================================================================
   RESIZE
   ================================================================ */
window.addEventListener('resize', resizeSprayCanvas);
resizeSprayCanvas();
