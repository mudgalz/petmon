(function () {
  // ---- Sprite templates: separate idle/walk sheets, each a row of square frames ----
  const TEMPLATES = {
    cat: { idleFile: "assets/sprites/cat-idle.png", walkFile: "assets/sprites/cat-walk.png", frameSize: 48, idleFrames: 4, walkFrames: 6 },
    dog: { idleFile: "assets/sprites/dog-idle.png", walkFile: "assets/sprites/dog-walk.png", frameSize: 48, idleFrames: 4, walkFrames: 6 },
    ducky: { idleFile: "assets/sprites/ducky-idle.png", walkFile: "assets/sprites/ducky-walk.png", frameSize: 48, idleFrames: 2, walkFrames: 4 },
    monster: { idleFile: "assets/sprites/monster-idle.png", walkFile: "assets/sprites/monster-walk.png", frameSize: 32, idleFrames: 4, walkFrames: 6 },
    pinkmonster: { idleFile: "assets/sprites/pinkmonster-idle.png", walkFile: "assets/sprites/pinkmonster-walk.png", frameSize: 32, idleFrames: 4, walkFrames: 6 },
  };

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

  function currentDisplaySize() {
    const tmpl = TEMPLATES[activePreset.template] || TEMPLATES.cat;
    const baseScale = TARGET_DISPLAY_SIZE / tmpl.frameSize;
    return tmpl.frameSize * baseScale * petScale;
  }

  function buildDom() {
    container = document.createElement("div");
    container.id = "desktop-pet-container";

    sprite = document.createElement("div");
    sprite.id = "desktop-pet-sprite";

    container.appendChild(sprite);
    document.documentElement.appendChild(container);

    const size = currentDisplaySize();
    posX = Math.random() * (window.innerWidth - size);
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
    const size = currentDisplaySize();
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.bottom = "0px";
    container.style.transform = `translateX(${posX}px)`;
  }

  function applySpriteVisual() {
    if (!sprite) return;
    const tmpl = TEMPLATES[activePreset.template] || TEMPLATES.cat;
    const size = currentDisplaySize();
    const scaleFactor = size / tmpl.frameSize;

    sprite.style.width = `${tmpl.frameSize}px`;
    sprite.style.height = `${tmpl.frameSize}px`;
    sprite.style.position = "absolute";
    sprite.style.left = "50%";
    sprite.style.bottom = "0";
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
    const file = walking ? tmpl.walkFile : tmpl.idleFile;
    const count = walking ? tmpl.walkFrames : tmpl.idleFrames;
    const clamped = index % count;
    sprite.style.backgroundImage = `url("${spriteUrl(file)}")`;
    sprite.style.backgroundSize = `${tmpl.frameSize * count}px ${tmpl.frameSize}px`;
    sprite.style.backgroundPosition = `-${clamped * tmpl.frameSize}px 0px`;
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

    const size = currentDisplaySize();

    if (!isIdle) {
      posX += speed * direction;
      const maxX = window.innerWidth - size;

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
    const size = currentDisplaySize();
    const maxX = window.innerWidth - size;
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
