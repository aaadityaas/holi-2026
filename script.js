/* ================================================================
   Holi Gift Box — script.js
   Single scene. Heavy zoom so box fills screen.
   ================================================================ */

const CONFIG = {
  userName: 'Anoop',
  introDelay: 0.5,
  sprayParticleCount: 80,
  pitchkariSuspensionAssetCandidates: [
    'assets/pichkari-suspension.png',
    'assets/pitchkari-suspension.png',
    'assets/pichkari_suspension.png',
  ],
};

// Force 2D transforms so Safari recalculates vector bounds during scaling
gsap.config({ force3D: false });

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const boxWrapper = $('#boxWrapper');
const boxLid = $('#boxLid');
const cancelBtn = $('#cancelBtn');
const sprayCanvas = $('#sprayCanvas');
const assetGulal = $('#assetGulal');

const SHAKE_CONFIG = {
  minIntervalMs: 90,
  speedThreshold: 26,
  cooldownMs: 1400,
};

let shakeListenerStarted = false;
let shakePermissionRequested = false;
let shakeLastMotion = { x: 0, y: 0, z: 0, time: 0 };
let shakeLastTriggerAt = 0;

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
    ease: 'back.out(1.2)',
  });

  // Step 2: Box shakes twice
  tl.to(boxWrapper, { rotation: 3, x: 5, duration: 0.08, yoyo: true, repeat: 5, ease: 'sine.inOut' });
  tl.to({}, { duration: 0.25 }); // brief pause
  tl.to(boxWrapper, { rotation: -3, x: -5, duration: 0.08, yoyo: true, repeat: 5, ease: 'sine.inOut' });
  tl.to({}, { duration: 0.4 }); // pause before opening lid

  // Step 3: Strap slides down and scales down slightly
  tl.to('.box-strap', {
    y: 140,
    rotationX: 90,
    scale: 0.85,
    opacity: 0,
    duration: 0.65,
    ease: 'power2.in',
  });

  // Step 4: Lid rotates and slides off to the left
  tl.to(boxLid, {
    rotation: -25,
    x: '-120vw',
    duration: 0.9,
    ease: 'back.in(1.5)',
  });

  // Step 4: Big zoom — box fills most of the screen. No fade.
  tl.to(boxWrapper, {
    scale: targetScale,
    duration: 1.2,
    ease: 'back.out(2)',
  }, '+=0.5');

  // Move assets to "viewport fit" positions during the zoom
  tl.to('#assetGujiya', {
    left: '8%',
    bottom: '22%',
    rotation: 33,
    scale: 0.7,
    duration: 1.2,
    ease: 'back.out(2)',
  }, '<');

  tl.to('#assetGujiya2', {
    left: '13%',
    bottom: '28%',
    rotation: 33,
    scale: 0.7,
    duration: 1.2,
    ease: 'back.out(2)',
  }, '<');

  tl.to('#assetPichkari', {
    right: '20%',
    top: '25%',
    rotation: 0,
    scale: 0.72,
    duration: 1.2,
    ease: 'back.out(2)',
  }, '<');

  tl.to('#assetGulal', {
    right: '5%',
    bottom: '3%',
    scale: 0.6,
    duration: 1.2,
    ease: 'back.out(2)',
  }, '<');

  // Fade in the text message on the letter after the zoom completes
  tl.to('#letterContent', {
    opacity: 1,
    y: 0,
    duration: 0.6,
    ease: 'power1.out',
    onComplete: startIdleAnimations,
  });
}

let idleGulalAnim = null;

function startIdleAnimations() {
  if (idleGulalAnim) return;

  // Rotates a tiny bit (3deg), stops, then starts rotating again
  idleGulalAnim = gsap.to('#assetGulal', {
    rotation: '+=3',
    duration: 1.8,
    ease: 'power2.inOut',
    repeat: -1,
    repeatDelay: 2.2, // Waits 2.2 seconds before turning again
  });
}

/* ================================================================
   PRELOADER
   ================================================================ */
const preloaderEl = document.getElementById('preloader');

window.addEventListener('load', () => {
  // Give it a minimum visibility time so it looks intentional
  setTimeout(() => {
    preloaderEl.style.opacity = '0';
    setTimeout(() => {
      preloaderEl.remove();
      playIntro();
    }, 500); // Match CSS opacity transition duration
  }, 600);
});


/* ================================================================
   SPRAY PARTICLE SYSTEM (for Pichkari)
   ================================================================ */
const sprayCtx = sprayCanvas.getContext('2d');
let sprayParticles = [];
let sprayAnimId = null;

// Preload dust images for spray particles
const sprayDustSources = ['assets/yellow dust.png', 'assets/pink dust.png', 'assets/blue dust.png'];
const sprayDustImgs = sprayDustSources.map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

function resizeSprayCanvas() {
  const dpr = window.devicePixelRatio || 1;
  sprayCanvas.width = window.innerWidth * dpr;
  sprayCanvas.height = window.innerHeight * dpr;
  sprayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createSprayParticle(originX, originY, angle, opts = {}) {
  const {
    arcSpread = 0.6,
    minSpeed = 12,
    maxSpeed = 30,
    sizeMin = 18,
    sizeMax = 42,
    alphaMin = 0.72,
    alphaMax = 1,
    gravityMin = 0.08,
    gravityMax = 0.14,
    decayMin = 0.011,
    decayMax = 0.018,
    friction = 0.985,
    drift = 0.02,
    stretchMin = 1,
    stretchMax = 1,
  } = opts;

  const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
  const spread = (Math.random() - 0.5) * arcSpread;
  const finalAngle = angle + spread;

  return {
    x: originX,
    y: originY,
    vx: Math.cos(finalAngle) * speed,
    vy: Math.sin(finalAngle) * speed,
    size: sizeMin + Math.random() * (sizeMax - sizeMin),
    img: sprayDustImgs[Math.floor(Math.random() * sprayDustImgs.length)],
    alpha: alphaMin + Math.random() * (alphaMax - alphaMin),
    gravity: gravityMin + Math.random() * (gravityMax - gravityMin),
    friction,
    life: 1,
    decay: decayMin + Math.random() * (decayMax - decayMin),
    drift: (Math.random() - 0.5) * drift,
    stretch: stretchMin + Math.random() * (stretchMax - stretchMin),
  };
}

function animateSpray() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  sprayCtx.clearRect(0, 0, w, h);

  for (let i = sprayParticles.length - 1; i >= 0; i--) {
    const p = sprayParticles[i];
    p.vx += p.drift;
    p.drift *= 0.985;
    p.vy += p.gravity;
    p.vx *= p.friction;
    p.vy *= p.friction;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    p.alpha = Math.max(0, p.life * 0.8);

    if (p.life <= 0) { sprayParticles.splice(i, 1); continue; }

    sprayCtx.globalAlpha = p.alpha;

    if (p.img && p.img.complete && p.img.naturalWidth > 0) {
      const s = p.size;
      sprayCtx.drawImage(p.img, p.x - s / 2, p.y - s / 2, s, s);
    } else {
      sprayCtx.fillStyle = '#E91E63';
      sprayCtx.beginPath();
      sprayCtx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      sprayCtx.fill();
    }
  }
  sprayCtx.globalAlpha = 1;

  if (sprayParticles.length > 0) {
    sprayAnimId = requestAnimationFrame(animateSpray);
  } else {
    sprayAnimId = null;
  }
}

function sprayWater(originX, originY, angle, opts = {}) {
  const { count = CONFIG.sprayParticleCount, ...particleOpts } = opts;
  resizeSprayCanvas();
  for (let i = 0; i < count; i++) {
    sprayParticles.push(createSprayParticle(originX, originY, angle, particleOpts));
  }
  if (!sprayAnimId) animateSpray();
}

const PITCHKARI_SHOTS = [
  {
    anchorX: 0.15,
    anchorY: 0.68,
    rotation: 52,
    scale: 1.34,
    recoil: 13,
    thrust: 22,
    splash: {
      src: 'assets/pink dust.png',
      size: 280,
      travel: 72,
      scaleTo: 0.65,
      opacity: 0.92,
    },
  },
  {
    anchorX: 0.5,
    anchorY: 0.91,
    rotation: 0,
    scale: 1.38,
    recoil: 15,
    thrust: 24,
    splash: {
      src: 'assets/yellow dust.png',
      size: 280,
      travel: 76,
      scaleTo: 0.65,
      opacity: 0.94,
    },
  },
  {
    anchorX: 0.85,
    anchorY: 0.67,
    rotation: -72,
    scale: 1.34,
    recoil: 13,
    thrust: 21,
    splash: {
      src: 'assets/blue dust.png',
      size: 290,
      travel: 225,
      scaleTo: 0.65,
      opacity: 0.9,
    },
  },
];
const PITCHKARI_OVERLAY_SCALE_FACTOR = 0.8;

function getPichkariNozzlePoint(el, angleOffset = 0) {
  const rect = el.getBoundingClientRect();
  const centerX = rect.left + rect.width * 0.5;
  const centerY = rect.top + rect.height * 0.5;
  const rotationDeg = Number(gsap.getProperty(el, 'rotation')) || 0;
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const dirX = Math.sin(rotationRad);
  const dirY = -Math.cos(rotationRad);
  const nozzleDistance = rect.height * 0.42;

  return {
    x: centerX + (dirX * nozzleDistance),
    y: centerY + (dirY * nozzleDistance),
    angle: Math.atan2(dirY, dirX) + angleOffset,
    dirX,
    dirY,
  };
}

function spawnImageSplash(x, y, angle, opts = {}) {
  const {
    src = '',
    size = 340,
    travel = 70,
    scaleFrom = 0.2,
    scaleTo = 0.94,
    opacity = 0.92,
    fadeIn = 0.08,
    hold = 0.06,
    fadeOut = 0.24,
    rotateJitter = 14,
  } = opts;
  if (!src) return;

  const splash = document.createElement('img');
  splash.className = 'splash';
  splash.src = src;
  splash.alt = '';
  splash.setAttribute('aria-hidden', 'true');
  splash.style.left = `${x}px`;
  splash.style.top = `${y}px`;
  splash.style.width = `${size}px`;
  splash.style.height = `${size}px`;
  document.body.appendChild(splash);

  const moveX = Math.cos(angle) * travel;
  const moveY = Math.sin(angle) * travel;
  const baseRotation = (Math.random() - 0.5) * rotateJitter;

  gsap.set(splash, {
    xPercent: -50,
    yPercent: -50,
    rotation: baseRotation,
    scale: scaleFrom,
    opacity: 0,
  });

  const tl = gsap.timeline({ onComplete: () => splash.remove() });
  tl.to(splash, {
    opacity,
    scale: scaleTo,
    duration: fadeIn,
    ease: 'power2.out',
  });
  tl.to(splash, {
    x: moveX,
    y: moveY,
    duration: fadeIn + hold + fadeOut,
    ease: 'power2.out',
  }, 0);
  tl.to(splash, {
    opacity: 0,
    scale: scaleTo * 1.06,
    duration: fadeOut,
    ease: 'power2.in',
  }, fadeIn + hold);
}

function triggerPitchkariSplash(el, splashConfig = {}) {
  // Play water splash sound for this shot
  const splashSound = new Audio('assets/powder air.mp3');
  splashSound.currentTime = 0;
  splashSound.play().catch(() => { });

  const { x, y, angle } = getPichkariNozzlePoint(el);
  spawnImageSplash(x, y, angle, splashConfig);
  spawnImageSplash(x, y, angle - 0.24, {
    ...splashConfig,
    size: Math.round((splashConfig.size || 340) * 0.68),
    travel: (splashConfig.travel || 70) * 0.85,
    scaleTo: (splashConfig.scaleTo || 0.94) * 0.82,
    opacity: Math.min(1, (splashConfig.opacity || 0.92) * 0.8),
    fadeIn: 0.06,
    hold: 0.04,
    fadeOut: 0.2,
    rotateJitter: 20,
  });
}

function getPichkariShotTarget(sourceRect, shot) {
  const sourceCx = sourceRect.left + sourceRect.width * 0.5;
  const sourceCy = sourceRect.top + sourceRect.height * 0.5;
  return {
    x: window.innerWidth * shot.anchorX - sourceCx,
    y: window.innerHeight * shot.anchorY - sourceCy,
  };
}

function addPitchkariShot(tl, overlayEl, suspensionEl, shot) {
  const baseScale = (shot.scale || 1.34) * PITCHKARI_OVERLAY_SCALE_FACTOR;
  const rotationRad = (shot.rotation * Math.PI) / 180;
  const dirX = Math.sin(rotationRad);
  const dirY = -Math.cos(rotationRad);
  const recoil = shot.recoil ?? 13;
  const thrust = shot.thrust ?? 22;

  const recoilX = shot.x - (dirX * recoil);
  const recoilY = shot.y - (dirY * recoil);
  const thrustX = shot.x + (dirX * thrust);
  const thrustY = shot.y + (dirY * thrust);

  tl.to(overlayEl, {
    x: recoilX,
    y: recoilY,
    rotation: shot.rotation,
    scaleX: baseScale * 1.08,
    scaleY: baseScale * 0.86,
    duration: 0.15,
    ease: 'power2.in',
  });

  if (suspensionEl) {
    tl.to(suspensionEl, {
      scaleY: 0.76,
      y: 10,
      duration: 0.15,
      ease: 'power2.in',
      transformOrigin: '50% 100%',
    }, '<');
  }

  tl.to(overlayEl, {
    x: thrustX,
    y: thrustY,
    rotation: shot.rotation,
    scaleX: baseScale * 0.96,
    scaleY: baseScale * 1.08,
    duration: 0.14,
    ease: 'power3.out',
    onStart: () => triggerPitchkariSplash(overlayEl, shot.splash),
  });

  if (suspensionEl) {
    tl.to(suspensionEl, {
      scaleY: 1.1,
      y: -3,
      duration: 0.14,
      ease: 'power2.out',
      transformOrigin: '50% 100%',
    }, '<');
  }

  tl.to(overlayEl, {
    x: shot.x,
    y: shot.y,
    rotation: shot.rotation,
    scaleX: baseScale,
    scaleY: baseScale,
    duration: 0.17,
    ease: 'sine.out',
  });

  if (suspensionEl) {
    tl.to(suspensionEl, {
      scaleY: 1,
      y: 0,
      duration: 0.17,
      ease: 'sine.out',
      transformOrigin: '50% 100%',
    }, '<');
  }

  tl.to({}, { duration: 0.06 });
}

function addPitchkariSuspensionImage(overlayEl) {
  const candidates = CONFIG.pitchkariSuspensionAssetCandidates || [];
  if (!candidates.length) return null;

  const suspension = document.createElement('img');
  suspension.className = 'pitchkari-overlay-suspension';
  suspension.alt = '';
  suspension.setAttribute('aria-hidden', 'true');

  let index = 0;
  const tryNext = () => {
    if (index >= candidates.length) {
      suspension.remove();
      return;
    }
    suspension.src = candidates[index];
    index += 1;
  };

  suspension.onerror = () => tryNext();
  overlayEl.appendChild(suspension);
  tryNext();
  return suspension;
}

function createPitchkariOverlay(sourceEl) {
  const sourceRect = sourceEl.getBoundingClientRect();
  const sourceImg = sourceEl.querySelector('.asset-img');

  const overlayEl = document.createElement('div');
  overlayEl.className = 'pitchkari-overlay-clone';
  overlayEl.style.left = `${sourceRect.left}px`;
  overlayEl.style.top = `${sourceRect.top}px`;
  overlayEl.style.width = `${sourceRect.width}px`;
  overlayEl.style.height = `${sourceRect.height}px`;

  const suspensionEl = addPitchkariSuspensionImage(overlayEl);

  const img = document.createElement('img');
  img.className = 'pitchkari-overlay-img';
  img.src = sourceImg?.getAttribute('src') || 'assets/pichkari.png';
  img.alt = 'Pichkari';
  overlayEl.appendChild(img);

  document.body.appendChild(overlayEl);
  return { overlayEl, suspensionEl, sourceRect };
}


/* ================================================================
   GULAL DUST CLOUD (pink dust sprite animation)
   ================================================================ */
const GULAL_DUST_SOURCES = [
  'assets/pinkdust.png',
  'assets/yellow dust.png',
  'assets/blue dust.png',
];
const gulalDustPreloadImgs = GULAL_DUST_SOURCES.map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

function createGulalDustCloudTimeline(originEl) {
  const rect = originEl?.getBoundingClientRect?.();
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const viewportMin = Math.min(window.innerWidth, window.innerHeight);
  const layer = document.createElement('div');
  layer.className = 'gulal-dust-layer';
  document.body.appendChild(layer);

  const baseWidth = rect?.width || viewportMin * 0.25;
  const baseSize = Math.max(viewportMin * 0.45, baseWidth * 1.55);
  const coverAnchors = [
    { x: 0.08, y: 0.1 }, { x: 0.5, y: 0.04 }, { x: 0.92, y: 0.12 },
    { x: 0.04, y: 0.46 }, { x: 0.95, y: 0.45 }, { x: 0.08, y: 0.86 },
    { x: 0.48, y: 0.94 }, { x: 0.92, y: 0.88 }, { x: 0.5, y: 0.5 },
  ];
  const clouds = [];

  coverAnchors.forEach((anchor, index) => {
    const sprite = document.createElement('img');
    sprite.className = 'gulal-dust-cloud';
    sprite.src = GULAL_DUST_SOURCES[index % GULAL_DUST_SOURCES.length];
    sprite.alt = '';
    sprite.setAttribute('aria-hidden', 'true');

    const size = baseSize * (0.72 + Math.random() * 0.42);
    const baseX = -size / 2;
    const baseY = -size / 2;
    const targetX = window.innerWidth * anchor.x - cx - size / 2;
    const targetY = window.innerHeight * anchor.y - cy - size / 2;

    sprite.style.left = `${cx}px`;
    sprite.style.top = `${cy}px`;
    sprite.style.width = `${size}px`;
    sprite.style.height = `${size}px`;
    layer.appendChild(sprite);

    gsap.set(sprite, {
      x: baseX,
      y: baseY,
      scale: 0.16,
      opacity: 0,
      rotation: (Math.random() - 0.5) * 18,
      transformOrigin: '50% 50%',
    });

    clouds.push({
      sprite,
      coverX: targetX,
      coverY: targetY,
      coverScale: 1.92 + Math.random() * 0.72,
    });
  });

  const tl = gsap.timeline({ onComplete: () => layer.remove() });

  clouds.forEach((cloud, index) => {
    tl.to(cloud.sprite, {
      opacity: 0.82,
      scale: 0.94,
      duration: 0.18,
      ease: 'power2.out',
    }, index * 0.026);
  });

  clouds.forEach((cloud, index) => {
    tl.to(cloud.sprite, {
      x: cloud.coverX,
      y: cloud.coverY,
      scale: cloud.coverScale,
      opacity: 0.84,
      duration: 0.56,
      ease: 'power2.inOut',
    }, 0.14 + index * 0.01);
  });

  tl.to({}, { duration: 0.14 });

  clouds.forEach((cloud, index) => {
    tl.to(cloud.sprite, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
    }, 0.84 + index * 0.012);
  });

  return tl;
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
}

function resetAsset(asset) {
  asset.style.zIndex = '';
  asset.classList.remove('interacting');
  activeAsset = null;
}

function triggerPinkDustPopupFromShake() {
  if (activeAsset) return;
  const now = Date.now();
  if (now - shakeLastTriggerAt < SHAKE_CONFIG.cooldownMs) return;
  shakeLastTriggerAt = now;
  createGulalDustCloudTimeline(assetGulal);
}

function handleDeviceMotion(event) {
  const acc = event.accelerationIncludingGravity || event.acceleration;
  if (!acc) return;

  const x = Number.isFinite(acc.x) ? acc.x : 0;
  const y = Number.isFinite(acc.y) ? acc.y : 0;
  const z = Number.isFinite(acc.z) ? acc.z : 0;
  const now = event.timeStamp || performance.now();

  if (!shakeLastMotion.time) {
    shakeLastMotion = { x, y, z, time: now };
    return;
  }

  const dt = now - shakeLastMotion.time;
  if (dt < SHAKE_CONFIG.minIntervalMs) return;

  const delta = Math.abs(x - shakeLastMotion.x) + Math.abs(y - shakeLastMotion.y) + Math.abs(z - shakeLastMotion.z);
  const speed = (delta / dt) * 1000;
  shakeLastMotion = { x, y, z, time: now };

  if (speed > SHAKE_CONFIG.speedThreshold) {
    triggerPinkDustPopupFromShake();
  }
}

function startShakeListener() {
  if (shakeListenerStarted || !window.DeviceMotionEvent) return;
  window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
  shakeListenerStarted = true;
}

function requestMotionPermissionAndStart() {
  if (!window.DeviceMotionEvent || shakePermissionRequested || shakeListenerStarted) return;
  shakePermissionRequested = true;

  if (typeof window.DeviceMotionEvent.requestPermission !== 'function') {
    startShakeListener();
    return;
  }

  window.DeviceMotionEvent.requestPermission()
    .then((state) => {
      if (state === 'granted') startShakeListener();
    })
    .catch(() => {
      // Permission denied or unavailable; keep interaction silent.
    });
}

function setupShakeDetection() {
  if (!window.DeviceMotionEvent) return;

  if (typeof window.DeviceMotionEvent.requestPermission === 'function') {
    const tryEnable = () => requestMotionPermissionAndStart();
    window.addEventListener('pointerdown', tryEnable, { once: true, passive: true });
    window.addEventListener('touchstart', tryEnable, { once: true, passive: true });
    return;
  }

  startShakeListener();
}


/* ================================================================
   ASSET: PICHKARI
   ================================================================ */
$('#assetPichkari').addEventListener('click', () => {
  if (activeAsset) return;
  const el = $('#assetPichkari');
  bringToFront(el);

  const { overlayEl, suspensionEl, sourceRect } = createPitchkariOverlay(el);
  const sourceOpacity = el.style.opacity;
  el.style.opacity = '0';

  const shots = PITCHKARI_SHOTS.map((shot) => ({
    ...shot,
    ...getPichkariShotTarget(sourceRect, shot),
  }));

  const tl = gsap.timeline({
    onComplete: () => {
      overlayEl.remove();
      el.style.opacity = sourceOpacity;
      resetAsset(el);
    },
  });

  gsap.set(overlayEl, {
    scaleX: PITCHKARI_OVERLAY_SCALE_FACTOR,
    scaleY: PITCHKARI_OVERLAY_SCALE_FACTOR,
  });

  shots.forEach((shot, index) => {
    tl.to(overlayEl, {
      x: shot.x,
      y: shot.y,
      rotation: shot.rotation,
      scaleX: shot.scale * PITCHKARI_OVERLAY_SCALE_FACTOR,
      scaleY: shot.scale * PITCHKARI_OVERLAY_SCALE_FACTOR,
      duration: index === 0 ? 0.26 : 0.22,
      ease: index === 0 ? 'power3.out' : 'power2.inOut',
    });

    if (suspensionEl) {
      tl.to(suspensionEl, {
        scaleY: 1,
        y: 0,
        duration: 0.12,
        ease: 'power1.out',
        transformOrigin: '50% 100%',
      }, '<');
    }

    addPitchkariShot(tl, overlayEl, suspensionEl, shot);
  });

  tl.to({}, { duration: 0.12 });
  tl.to(overlayEl, {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    duration: 0.34,
    ease: 'power2.inOut',
  });
});


/* ================================================================
   ASSET: GUJIYA  — circle-mask eat animation
   ================================================================ */

/**
 * Draws the current bite state onto the overlay canvas.
 * bites = [{ x, y, r }]  — all in canvas-pixel space (already × dpr)
 */
function drawGujiyaFrame(ctx, img, w, h, bites, drawRectOverride = null) {
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  const drawRect = drawRectOverride || getGujiyaDrawRect(w, h, img);
  ctx.drawImage(img, drawRect.x, drawRect.y, drawRect.w, drawRect.h);

  if (bites.length === 0) return;

  ctx.globalCompositeOperation = 'destination-out';
  for (const b of bites) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function solveUnrotatedBounds(boundsW, boundsH, rotationDeg) {
  const normalized = Math.abs(rotationDeg % 180);
  const theta = normalized > 90 ? 180 - normalized : normalized;
  const rad = theta * (Math.PI / 180);
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const denom = (c * c) - (s * s);

  if (Math.abs(denom) < 0.001) return null;

  const rawW = ((boundsW * c) - (boundsH * s)) / denom;
  const rawH = ((boundsH * c) - (boundsW * s)) / denom;
  if (!Number.isFinite(rawW) || !Number.isFinite(rawH)) return null;
  if (rawW <= 0 || rawH <= 0) return null;

  return { w: rawW, h: rawH };
}

function getGujiyaDrawRect(containerW, containerH, img, rotationDeg = 0) {
  let targetW = containerW;
  let targetH = containerH;

  const solved = solveUnrotatedBounds(containerW, containerH, rotationDeg);
  if (solved) {
    targetW = Math.min(containerW, solved.w);
    targetH = Math.min(containerH, solved.h);
  }

  const sourceW = img.naturalWidth || targetW;
  const sourceH = img.naturalHeight || targetH;
  const sourceAspect = sourceW / sourceH;
  const targetAspect = targetW / targetH;

  let drawW;
  let drawH;
  if (sourceAspect > targetAspect) {
    drawW = targetW;
    drawH = targetW / sourceAspect;
  } else {
    drawH = targetH;
    drawW = targetH * sourceAspect;
  }

  return {
    x: (containerW - drawW) / 2,
    y: (containerH - drawH) / 2,
    w: drawW,
    h: drawH,
  };
}

function startCircleMaskAnimation(el, onComplete, sourceImgSrc = 'assets/gujiya.png') {
  const dpr = window.devicePixelRatio || 1;
  const rect = el.getBoundingClientRect();
  const cssW = rect.width;
  const cssH = rect.height;
  const currentRotation = Number(gsap.getProperty(el, 'rotation')) || 0;
  const pxW = Math.round(cssW * dpr);
  const pxH = Math.round(cssH * dpr);

  /* --- overlay canvas, exactly over the centred gujiya --- */
  const oc = document.createElement('canvas');
  oc.width = pxW;
  oc.height = pxH;
  oc.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top:  ${rect.top}px;
    width:  ${cssW}px;
    height: ${cssH}px;
    pointer-events: none;
    z-index: 55;
    transform-origin: 50% 50%;
  `;
  document.body.appendChild(oc);
  const ctx = oc.getContext('2d');
  if (!ctx) {
    oc.remove();
    onComplete();
    return;
  }
  ctx.scale(dpr, dpr);

  /* hide the real element — canvas is the visual now */
  el.style.opacity = '0';

  const img = new Image();
  img.onload = () => {
    const drawRect = getGujiyaDrawRect(cssW, cssH, img, currentRotation);

    /* initial draw */
    drawGujiyaFrame(ctx, img, cssW, cssH, [], drawRect);

    /* multiple smaller bites, then full final bite */
    const biteConfig = [
      {
        cx: drawRect.x + (drawRect.w * 0.85),
        cy: drawRect.y + (drawRect.h * 0.5),
        maxR: drawRect.w * 0.08,
        shakeX: 3,
        duration: 0.30,
        pauseAfter: 0.22,
      },
      {
        cx: drawRect.x + (drawRect.w * 0.72),
        cy: drawRect.y + (drawRect.h * 0.35),
        maxR: drawRect.w * 0.10,
        shakeX: -2,
        duration: 0.30,
        pauseAfter: 0.22,
      },
      {
        cx: drawRect.x + (drawRect.w * 0.58),
        cy: drawRect.y + (drawRect.h * 0.25),
        maxR: drawRect.w * 0.12,
        shakeX: 2,
        duration: 0.30,
        pauseAfter: 0.22,
      },
      {
        cx: drawRect.x + (drawRect.w * 0.40),
        cy: drawRect.y + (drawRect.h * 0.30),
        maxR: drawRect.w * 0.11,
        shakeX: -3,
        duration: 0.30,
        pauseAfter: 0.22,
      },
      {
        cx: drawRect.x + (drawRect.w * 0.4),
        cy: drawRect.y + (drawRect.h * 0.5),
        maxR: (Math.hypot(drawRect.w, drawRect.h) / 2) + 4,
        shakeX: 2,
        duration: 0.40,
        pauseAfter: 0.30,
      },
    ];
    const activeBites = [];
    const biteTimeline = gsap.timeline({
      delay: 0.36, // 300-500ms intact pause before munching starts
      onComplete: () => {
        oc.remove();
        onComplete();
      },
    });

    biteConfig.forEach((cfg, index) => {
      biteTimeline.call(() => {
        // Play nom nom sound for this bite
        const nomSound = new Audio('assets/nom nom.mp3');
        nomSound.currentTime = 0;
        nomSound.play().catch(() => { });
        // Stop sound after this bite's duration
        setTimeout(() => {
          nomSound.pause();
          nomSound.currentTime = 0;
        }, cfg.duration * 1000);

        const bite = { x: cfg.cx, y: cfg.cy, r: 0 };
        activeBites.push(bite);

        gsap.to(bite, {
          r: cfg.maxR,
          duration: cfg.duration,
          ease: 'power2.out',
          onUpdate: () => drawGujiyaFrame(ctx, img, cssW, cssH, activeBites, drawRect),
        });

        gsap.fromTo(
          oc,
          { x: 0, y: 0, scale: 1 },
          {
            x: cfg.shakeX,
            y: -2,
            scale: index === biteConfig.length - 1 ? 1.02 : 1.04,
            duration: 0.09,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: 1,
            immediateRender: false,
          },
        );
      });
      biteTimeline.to({}, { duration: cfg.duration + cfg.pauseAfter });
    });
  };

  img.onerror = () => {
    oc.remove();
    onComplete();
  };
  img.src = sourceImgSrc || 'assets/gujiya.png';
}

function bindGujiyaInteraction(el) {
  if (!el) return;

  el.addEventListener('click', () => {
    if (activeAsset) return;
    bringToFront(el);

    const sourceImgSrc = el.querySelector('.asset-img')?.getAttribute('src') || 'assets/gujiya.png';
    const baseRotation = Number(gsap.getProperty(el, 'rotation')) || 0;
    const baseScaleX = Number(gsap.getProperty(el, 'scaleX')) || 1;
    const baseScaleY = Number(gsap.getProperty(el, 'scaleY')) || 1;

    /* compensate for parent zoom scale so centre landing is accurate on screen */
    const startRect = el.getBoundingClientRect();
    const wrapperRect = boxWrapper.getBoundingClientRect();
    const wrapperScale = wrapperRect.width / (boxWrapper.offsetWidth || wrapperRect.width || 1);
    const centerX = (window.innerWidth / 2 - startRect.left - startRect.width / 2) / wrapperScale;
    const centerY = (window.innerHeight / 2 - startRect.top - startRect.height / 2) / wrapperScale;

    const tl = gsap.timeline();

    /* ── 1. Fly to centre, soft ease-out settle ── */
    tl.to(el, {
      x: centerX,
      y: centerY,
      rotation: 0,
      scale: 1.26,
      duration: 0.55,
      ease: 'back.out(1.5)',
    });
    tl.to(el, {
      scale: 1.296,
      duration: 0.18,
      ease: 'back.out(2.2)',
    }, '-=0.15');

    /* ── 2. Hand off to circle-mask canvas ── */
    tl.call(() => {
      startCircleMaskAnimation(el, () => {
        // Place it off-screen to slide back in
        gsap.set(el, {
          x: -120,
          y: 180,
          scaleX: baseScaleX,
          scaleY: baseScaleY,
          rotation: baseRotation - 120,
          opacity: 1,
        });

        // Slide and rotate back into its original resting spot
        gsap.to(el, {
          x: 0,
          y: 0,
          rotation: baseRotation,
          duration: 0.7,
          ease: 'back.out(0.5)',
          onComplete: () => resetAsset(el),
        });
      }, sourceImgSrc);
    });
  });
}

$$('.asset-gujiya').forEach(bindGujiyaInteraction);


/* ================================================================
   ASSET: GULAL
   ================================================================ */
$('#assetGulal').addEventListener('click', () => {
  if (activeAsset) return;
  const el = $('#assetGulal');
  bringToFront(el);

  if (idleGulalAnim) idleGulalAnim.pause();

  const currentRotation = Number(gsap.getProperty(el, 'rotation')) || 0;
  gsap.set(el, { rotation: 0 }); // Un-rotate briefly for accurate measurement

  const imgEl = el.querySelector('.asset-img');
  const startRect = el.getBoundingClientRect();
  const startCX = startRect.left + startRect.width / 2;
  const startCY = startRect.top + startRect.height / 2;

  gsap.set(el, { rotation: currentRotation }); // Restore visual rotation
  const targetCX = window.innerWidth / 2;
  const targetCY = window.innerHeight / 2;

  const overlay = document.createElement('img');
  overlay.className = 'gulal-overlay-clone';
  overlay.alt = '';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.src = imgEl?.currentSrc || imgEl?.src || 'assets/gulal.png';
  overlay.style.width = `${startRect.width}px`;
  overlay.style.height = `${startRect.height}px`;
  overlay.style.left = `${startCX}px`;
  overlay.style.top = `${startCY}px`;
  document.body.appendChild(overlay);
  gsap.set(overlay, { xPercent: -50, yPercent: -50 });

  el.style.opacity = '0';

  const reducedScale = 1.96 * 0.7 * 0.9; // 10% smaller than current centered size
  const maxFitScale = Math.min(
    (window.innerWidth * 0.72) / startRect.width,
    (window.innerHeight * 0.52) / startRect.height,
  );
  const centerScale = Math.max(0.9, Math.min(reducedScale, maxFitScale));
  const approachScale = centerScale * 0.95;

  const tl = gsap.timeline({
    onComplete: () => {
      overlay.remove();
      el.style.opacity = '';
      resetAsset(el);
      if (idleGulalAnim) {
        // Resume rotation loop exactly where it left off, cleanly continuing its path
        idleGulalAnim.play();
      }
    },
  });

  tl.to(overlay, {
    left: targetCX,
    top: targetCY,
    scale: approachScale,
    rotation: 0,
    duration: 0.55,
    ease: 'back.out(1.5)',
  });
  tl.to(overlay, { scale: centerScale, duration: 0.2, ease: 'back.out(1.9)' }, '-=0.15');

  tl.call(() => {
    createGulalDustCloudTimeline(overlay);
  });
  tl.to(overlay, { rotation: -7, duration: 0.08, ease: 'sine.inOut' }, '<0.04');
  tl.to(overlay, { rotation: 6, duration: 0.08, ease: 'sine.inOut' });
  tl.to(overlay, { rotation: 0, duration: 0.1, ease: 'sine.out' });

  tl.to({}, { duration: 0.08 });
  tl.to(overlay, {
    left: startCX,
    top: startCY,
    scale: 1,
    rotation: 0,
    duration: 0.75,
    ease: 'power3.inOut',
  });
});


/* ================================================================
   RESIZE
   ================================================================ */
window.addEventListener('resize', resizeSprayCanvas);
resizeSprayCanvas();
setupShakeDetection();
