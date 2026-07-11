(function () {
  // Sprite templates can use separate sheets, rows within a sheet, rectangular
  // frames, or animations that start partway through a longer strip.
  const TEMPLATES = {
    cat: spriteTemplate(48, 48, "assets/sprites/cat-idle.png", 4, "assets/sprites/cat-walk.png", 6),
    dog: spriteTemplate(48, 48, "assets/sprites/dog-idle.png", 4, "assets/sprites/dog-walk.png", 6),
    ducky: spriteTemplate(48, 48, "assets/sprites/ducky-idle.png", 2, "assets/sprites/ducky-walk.png", 4),
    monster: spriteTemplate(32, 32, "assets/sprites/monster-idle.png", 4, "assets/sprites/monster-walk.png", 6),
    pinkmonster: spriteTemplate(32, 32, "assets/sprites/pinkmonster-idle.png", 4, "assets/sprites/pinkmonster-walk.png", 6),
    punk: spriteTemplate(48, 48, "assets/sprites/punk-idle.png", 4, "assets/sprites/punk-walk.png", 6),
    tard: { ...spriteTemplate(24, 24, "assets/sprites/tard-idle.png", 4, "assets/sprites/tard-walk.png", 6), groundOffset: 3 },
    wally: spriteTemplate(32, 32, "assets/sprites/wally-idle.png", 2, "assets/sprites/wally-walk.png", 6),
    finn: { ...spriteTemplate(32, 32, "assets/sprites/finn-idle.png", 9, "assets/sprites/finn-walk.png", 7), groundOffset: 6 },
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

  let container, sprite;
  let posX = 0;
  let direction = 1;
  let speed = 1.2;
  let idleTicks = 0;
  let isIdle = false;
  let running = false;
  let rafId = null;
  let frameStep = 0;
  let lastFrameTime = 0;

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

    container.appendChild(sprite);
    document.documentElement.appendChild(container);

    const dimensions = currentDisplayDimensions();
    posX = Math.random() * Math.max(0, window.innerWidth - dimensions.width);
    direction = Math.random() > 0.5 ? 1 : -1;
    layoutContainer();
    applySpriteVisual();
  }

  function removeDom() {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    sprite = null;
  }

  function layoutContainer() {
    if (!container) return;
    const dimensions = currentDisplayDimensions();
    posX = Math.min(posX, Math.max(0, window.innerWidth - dimensions.width));
    container.style.width = `${dimensions.width}px`;
    container.style.height = `${dimensions.height}px`;
    container.style.bottom = "0px";
    container.style.transform = `translateX(${posX}px)`;
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
    // Some source sheets include transparent canvas below the character's
    // feet. Move that padding below the viewport edge so visible pixels, not
    // the sprite canvas, sit on the ground.
    sprite.style.bottom = `${-(tmpl.groundOffset || 0) * scaleFactor}px`;
    sprite.style.imageRendering = "pixelated";
    sprite.style.backgroundRepeat = "no-repeat";
    sprite.dataset.scaleFactor = scaleFactor;

    if (activePreset.color) {
      sprite.style.filter = `hue-rotate(${activePreset.color}deg) saturate(1.2)`;
    } else {
      sprite.style.filter = "none";
    }

    frameStep = 0;
    setFrame(false, 0);
    updateFacingTransform();
  }

  function setFrame(walking, index) {
    if (!sprite) return;
    const tmpl = TEMPLATES[activePreset.template] || TEMPLATES.cat;
    const anim = walking ? tmpl.walk : tmpl.idle;
    const clamped = index % anim.frames;
    const x = anim.startX + clamped * tmpl.frameWidth;
    sprite.style.backgroundImage = `url("${spriteUrl(anim.file)}")`;
    sprite.style.backgroundSize = `${anim.sheetWidth}px ${anim.sheetHeight}px`;
    sprite.style.backgroundPosition = `-${x}px -${anim.startY}px`;
  }

  function updateFacingTransform() {
    if (!sprite) return;
    const scaleFactor = parseFloat(sprite.dataset.scaleFactor || "1");
    const flip = direction === -1 ? -1 : 1;
    sprite.style.transformOrigin = "bottom center";
    sprite.style.transform = `translateX(-50%) scale(${scaleFactor * flip}, ${scaleFactor})`;
  }

  function tick(timestamp) {
    if (!running || !container) return;

    const dimensions = currentDisplayDimensions();

    if (!isIdle) {
      posX += speed * direction;
      const maxX = Math.max(0, window.innerWidth - dimensions.width);

      if (posX <= 0) {
        posX = 0;
        direction = 1;
        updateFacingTransform();
      } else if (posX >= maxX) {
        posX = maxX;
        direction = -1;
        updateFacingTransform();
      }

      container.style.transform = `translateX(${posX}px)`;

      if (timestamp - lastFrameTime > 110) {
        lastFrameTime = timestamp;
        frameStep++;
        setFrame(true, frameStep);
      }

      if (Math.random() < 0.003) {
        isIdle = true;
        idleTicks = 60 + Math.floor(Math.random() * 120);
        frameStep = 0;
        setFrame(false, 0);
      }

      if (Math.random() < 0.002) {
        direction *= -1;
        updateFacingTransform();
      }
    } else {
      if (timestamp - lastFrameTime > 220) {
        lastFrameTime = timestamp;
        frameStep++;
        setFrame(false, frameStep);
      }
      idleTicks--;
      if (idleTicks <= 0) {
        isIdle = false;
        frameStep = 0;
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  window.addEventListener("resize", () => {
    if (!container) return;
    const dimensions = currentDisplayDimensions();
    const maxX = Math.max(0, window.innerWidth - dimensions.width);
    if (posX > maxX) {
      posX = maxX;
      container.style.transform = `translateX(${posX}px)`;
    }
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
    buildDom();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    removeDom();
  }

  function applyActivePreset(id) {
    activePreset = getPresetById(id);
    if (sprite) {
      layoutContainer();
      applySpriteVisual();
    }
  }

  function applyAppearanceSettings() {
    if (!container) return;
    layoutContainer();
    applySpriteVisual();
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
