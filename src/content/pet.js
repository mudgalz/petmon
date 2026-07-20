(function () {
  // Sprite templates can use separate sheets, rows within a sheet, rectangular
  // frames, or animations that start partway through a longer strip.
  const TEMPLATES = {
    cat: spriteTemplate(48, 48, "assets/sprites/cat-idle.png", 4, "assets/sprites/cat-walk.png", 6),
    dog: spriteTemplate(48, 48, "assets/sprites/dog-idle.png", 4, "assets/sprites/dog-walk.png", 6),
    ducky: spriteTemplate(48, 48, "assets/sprites/ducky-idle.png", 2, "assets/sprites/ducky-walk.png", 4),
    monster: spriteTemplate(32, 32, "assets/sprites/monster-idle.png", 4, "assets/sprites/monster-walk.png", 6),
    punk: spriteTemplate(48, 48, "assets/sprites/punk-idle.png", 4, "assets/sprites/punk-walk.png", 6),
    tard: { ...spriteTemplate(24, 24, "assets/sprites/tard-idle.png", 4, "assets/sprites/tard-walk.png", 6), groundOffset: 3 },
    finn: { ...spriteTemplate(32, 32, "assets/sprites/finn-idle.png", 9, "assets/sprites/finn-walk.png", 7), groundOffset: 6 },
    gorgon: spriteTemplate(128, 128, "assets/sprites/gorgon-idle.png", 7, "assets/sprites/gorgon-walk.png", 7),
  };

  function animation(file, frames, sheetWidth, sheetHeight, startX = 0, startY = 0) {
    return { file, frames, sheetWidth, sheetHeight, startX, startY };
  }

  function spriteTemplate(frameWidth, frameHeight, idleFile, idleFrames, walkFile, walkFrames) {
    return {
      frameWidth,
      frameHeight,
      idle: animation(idleFile, idleFrames, frameWidth * idleFrames, frameHeight),
      walk: animation(walkFile, walkFrames, frameWidth * walkFrames, frameHeight),
    };
  }

  const TARGET_DISPLAY_SIZE = 56; // baseline rendered height in px before user scale is applied

  // ---- Built-in presets (non-deletable) ----
  const BUILTIN_PRESETS = [
    { id: "builtin_whiskers", name: "Whiskers", template: "cat", color: 0, sound: "assets/sounds/cat.wav", builtin: true, words: ["Meow!", "Meow~", "Mrow!"] },
    { id: "builtin_quackers", name: "Quackers", template: "ducky", color: 0, sound: "assets/sounds/duck.mp3", builtin: true, words: ["Quack!", "QUACK!", "Quack quack!"] },
  ];

  let container, facingLayer, sprite, spriteSheet;
  let posX = 0;
  let direction = 1;
  const MOVE_SPEED = 72; // px per second (equivalent to the old 1.2px at 60fps)
  const BASE_FRAME_MS = 1000 / 60;
  let idleRemainingMs = 0;
  let isIdle = false;
  let running = false;
  let rafId = null;
  let lastTickTime = 0;
  let movementAnimation = null;
  let facingAnimation = null;
  let movementMaxX = 0;
  let movementDuration = 0;
  let mountObserver = null;
  let spriteAnimation = null;

  let allPresets = [...BUILTIN_PRESETS];
  let activePreset = BUILTIN_PRESETS[0];
  let soundOnPetOnly = true;
  let petScale = 1;

  function getPresetById(id) {
    return allPresets.find((p) => p.id === id) || BUILTIN_PRESETS[0];
  }

  function spriteUrl(path) {
    try {
      return chrome.runtime.getURL(path);
    } catch (e) {
      return "";
    }
  }

  function currentDisplayDimensions() {
    const tmpl = TEMPLATES[activePreset.template] || TEMPLATES.cat;
    const height = TARGET_DISPLAY_SIZE * petScale;
    return { width: (tmpl.frameWidth / tmpl.frameHeight) * height, height };
  }

  function buildDom() {
    container = document.createElement("div");
    container.id = "desktop-pet-container";

    sprite = document.createElement("div");
    sprite.id = "desktop-pet-sprite";

    facingLayer = document.createElement("div");
    facingLayer.id = "desktop-pet-facing";

    spriteSheet = document.createElement("div");
    spriteSheet.id = "desktop-pet-sheet";
    sprite.appendChild(spriteSheet);
    facingLayer.appendChild(sprite);
    container.appendChild(facingLayer);
    document.documentElement.appendChild(container);

    const dimensions = currentDisplayDimensions();
    posX = Math.random() * Math.max(0, window.innerWidth - dimensions.width);
    direction = Math.random() > 0.5 ? 1 : -1;
    layoutContainer();
    applySpriteVisual();
  }

  function removeDom() {
    if (movementAnimation) movementAnimation.cancel();
    if (facingAnimation) facingAnimation.cancel();
    if (spriteAnimation) spriteAnimation.cancel();
    movementAnimation = null;
    facingAnimation = null;
    spriteAnimation = null;
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    facingLayer = null;
    sprite = null;
    spriteSheet = null;
  }

  function layoutContainer() {
    if (!container) return;
    const dimensions = currentDisplayDimensions();
    posX = Math.min(posX, Math.max(0, window.innerWidth - dimensions.width));
    container.style.width = `${dimensions.width}px`;
    container.style.height = `${dimensions.height}px`;
    container.style.bottom = "0px";
    container.style.transform = `translate3d(${posX}px, 0, 0)`;
  }

  function applySpriteVisual() {
    if (!sprite) return;
    const tmpl = TEMPLATES[activePreset.template] || TEMPLATES.cat;
    const dimensions = currentDisplayDimensions();
    const scaleFactor = dimensions.height / tmpl.frameHeight;

    sprite.style.width = `${tmpl.frameWidth}px`;
    sprite.style.height = `${tmpl.frameHeight}px`;
    sprite.style.position = "absolute";
    sprite.style.left = "50%";
    sprite.style.overflow = "hidden";
    // Some source sheets include transparent canvas below the character's
    // feet. Move that padding below the viewport edge so visible pixels, not
    // the sprite canvas, sit on the ground.
    sprite.style.bottom = `${-(tmpl.groundOffset || 0) * scaleFactor}px`;
    sprite.style.imageRendering = "pixelated";
    sprite.dataset.scaleFactor = scaleFactor;

    if (activePreset.color) {
      sprite.style.filter = `hue-rotate(${activePreset.color}deg) saturate(1.2)`;
    } else {
      sprite.style.filter = "none";
    }

    playSpriteAnimation(isIdle);
    updateFacingTransform();
  }

  function playSpriteAnimation(idle) {
    if (!spriteSheet) return;
    const tmpl = TEMPLATES[activePreset.template] || TEMPLATES.cat;
    const anim = idle ? tmpl.idle : tmpl.walk;
    const interval = idle ? 220 : 110;

    if (spriteAnimation) spriteAnimation.cancel();

    spriteSheet.style.width = `${anim.sheetWidth}px`;
    spriteSheet.style.height = `${anim.sheetHeight}px`;
    spriteSheet.style.backgroundImage = `url("${spriteUrl(anim.file)}")`;
    spriteSheet.style.backgroundSize = `${anim.sheetWidth}px ${anim.sheetHeight}px`;

    const keyframes = [];
    for (let index = 0; index < anim.frames; index++) {
      const x = anim.startX + index * tmpl.frameWidth;
      keyframes.push({
        offset: index / anim.frames,
        transform: `translate3d(-${x}px, -${anim.startY}px, 0)`,
        easing: "steps(1, end)",
      });
    }
    keyframes.push({
      offset: 1,
      transform: `translate3d(-${anim.startX}px, -${anim.startY}px, 0)`,
    });

    spriteAnimation = spriteSheet.animate(keyframes, {
      duration: interval * anim.frames,
      iterations: Infinity,
    });
  }

  function updateFacingTransform() {
    if (!sprite) return;
    const scaleFactor = parseFloat(sprite.dataset.scaleFactor || "1");
    sprite.style.transformOrigin = "bottom center";
    sprite.style.transform = `translateX(-50%) scale(${scaleFactor})`;

    // This inline value is a fallback for zero-width viewports and browsers
    // without an active movement animation. Normally the synchronized
    // compositor animation below controls the facing direction.
    if (facingLayer && !facingAnimation) {
      facingLayer.style.transform = `scaleX(${direction === -1 ? -1 : 1})`;
    }
  }

  // A transform animation can be handled by Chrome's compositor thread. It
  // therefore keeps travelling even while the page's main JavaScript thread
  // is busy rendering an infinite-scroll batch or navigating.
  function createMovementAnimation() {
    if (!container) return;

    if (movementAnimation) {
      syncMovementSnapshot();
      movementAnimation.cancel();
    }
    if (facingAnimation) facingAnimation.cancel();
    facingAnimation = null;

    const dimensions = currentDisplayDimensions();
    movementMaxX = Math.max(0, window.innerWidth - dimensions.width);
    posX = Math.min(Math.max(0, posX), movementMaxX);

    if (movementMaxX === 0) {
      movementAnimation = null;
      movementDuration = 0;
      container.style.transform = "translate3d(0, 0, 0)";
      updateFacingTransform();
      return;
    }

    movementDuration = (movementMaxX / MOVE_SPEED) * 1000;
    movementAnimation = container.animate(
      [
        { transform: "translate3d(0, 0, 0)" },
        { transform: `translate3d(${movementMaxX}px, 0, 0)` },
      ],
      {
        duration: movementDuration,
        iterations: Infinity,
        direction: "alternate",
        easing: "linear",
      }
    );

    const progress = posX / movementMaxX;
    const startingTime = direction === 1
      ? progress * movementDuration
      : movementDuration + (1 - progress) * movementDuration;
    movementAnimation.currentTime = startingTime;

    // Match the forward/backward halves of the movement cycle with instant
    // facing changes at each wall. Transform animations remain compositor-run.
    facingAnimation = facingLayer.animate(
      [
        { offset: 0, transform: "scaleX(1)", easing: "steps(1, end)" },
        { offset: 0.5, transform: "scaleX(-1)", easing: "steps(1, end)" },
        { offset: 1, transform: "scaleX(1)" },
      ],
      {
        duration: movementDuration * 2,
        iterations: Infinity,
      }
    );
    facingAnimation.currentTime = startingTime;

    if (isIdle) {
      movementAnimation.pause();
      facingAnimation.pause();
    }
  }

  function syncMovementSnapshot() {
    if (!movementAnimation || !movementDuration || movementAnimation.currentTime == null) {
      return;
    }

    const currentTime = movementAnimation.currentTime;
    const iteration = Math.floor(currentTime / movementDuration);
    const progress = (currentTime % movementDuration) / movementDuration;
    const nextDirection = iteration % 2 === 0 ? 1 : -1;

    posX = nextDirection === 1
      ? progress * movementMaxX
      : (1 - progress) * movementMaxX;

    if (direction !== nextDirection) {
      direction = nextDirection;
      updateFacingTransform();
    }
  }

  function tick(timestamp) {
    if (!running || !container) return;

    // Keep behavior timers stable when Chrome reduces main-thread frame
    // frequency. Travel and sprite frames run separately on the compositor.
    const elapsedMs = lastTickTime
      ? Math.min(timestamp - lastTickTime, 100)
      : BASE_FRAME_MS;
    lastTickTime = timestamp;
    syncMovementSnapshot();
    if (!isIdle) {
      if (chanceForElapsedTime(0.003, elapsedMs)) {
        isIdle = true;
        idleRemainingMs = 1000 + Math.random() * 2000;
        playSpriteAnimation(true);
        if (movementAnimation) movementAnimation.pause();
        if (facingAnimation) facingAnimation.pause();
      }

    } else {
      idleRemainingMs -= elapsedMs;
      if (idleRemainingMs <= 0) {
        isIdle = false;
        playSpriteAnimation(false);
        if (movementAnimation) movementAnimation.play();
        if (facingAnimation) facingAnimation.play();
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function chanceForElapsedTime(chancePerFrame, elapsedMs) {
    return Math.random() < 1 - Math.pow(1 - chancePerFrame, elapsedMs / BASE_FRAME_MS);
  }

  window.addEventListener("resize", () => {
    if (!container) return;
    createMovementAnimation();
  });

  // ---- Sound playback (routed through an offscreen document so it's never
  // blocked by the current page's Content-Security-Policy) ----
  function playSound(preset) {
    let src = preset.sound;
    if (src && !src.startsWith("data:")) {
      src = spriteUrl(src);
    }
    try {
      chrome.runtime.sendMessage({ type: "PLAY_PET_SOUND", src, volume: 0.6 });
    } catch (e) {
      // Ignore (e.g. extension context invalidated on reload).
    }
  }

  function hopSprite() {
    if (!sprite) return;
    const base = sprite.style.transform;
    sprite.style.transition = "transform 0.15s ease";
    sprite.style.transform = base + " translateY(-8px)";
    setTimeout(() => {
      if (sprite) sprite.style.transform = base;
    }, 150);
  }

  function isClickOnPet(x, y) {
    if (!container) return false;
    const rect = container.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function onPageClick(e) {
    if (!running || !sprite) return;

    if (soundOnPetOnly && !isClickOnPet(e.clientX, e.clientY)) {
      return;
    }

    playSound(activePreset);
    hopSprite();
  }

  document.addEventListener("click", onPageClick, true);

  function start() {
    if (running) return;
    running = true;
    lastTickTime = 0;
    mountPet();
  }

  function mountPet() {
    if (!running || container) return;

    if (!document.documentElement) {
      mountObserver = new MutationObserver(() => {
        if (!document.documentElement) return;
        mountObserver.disconnect();
        mountObserver = null;
        mountPet();
      });
      mountObserver.observe(document, { childList: true });
      return;
    }

    buildDom();
    createMovementAnimation();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (mountObserver) mountObserver.disconnect();
    mountObserver = null;
    removeDom();
  }

  function applyActivePreset(id) {
    activePreset = getPresetById(id);
    if (sprite) {
      layoutContainer();
      applySpriteVisual();
      createMovementAnimation();
    }
  }

  function applyAppearanceSettings() {
    if (!container) return;
    layoutContainer();
    applySpriteVisual();
    createMovementAnimation();
  }

  // ---- Init from stored settings ----
  chrome.storage.local.get(
    {
      enabled: true,
      activePetId: "builtin_whiskers",
      soundOnPetOnly: true,
      customPets: [],
      petScale: 1,
    },
    (settings) => {
      allPresets = [...BUILTIN_PRESETS, ...(settings.customPets || [])];
      activePreset = getPresetById(settings.activePetId);
      soundOnPetOnly = !!settings.soundOnPetOnly;
      petScale = settings.petScale || 1;
      if (settings.enabled) start();
    }
  );

  // ---- React live to popup changes ----
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    if (changes.customPets) {
      allPresets = [...BUILTIN_PRESETS, ...(changes.customPets.newValue || [])];
      if (!allPresets.find((p) => p.id === activePreset.id)) {
        activePreset = BUILTIN_PRESETS[0];
      }
    }

    if (changes.activePetId) {
      applyActivePreset(changes.activePetId.newValue);
    }

    if (changes.soundOnPetOnly) {
      soundOnPetOnly = !!changes.soundOnPetOnly.newValue;
    }

    if (changes.petScale) {
      petScale = changes.petScale.newValue || 1;
      applyAppearanceSettings();
    }

    if (changes.enabled) {
      if (changes.enabled.newValue) {
        start();
      } else {
        stop();
      }
    }
  });
})();
