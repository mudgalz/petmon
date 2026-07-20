const TEMPLATES = {
  cat: { previewFile: "assets/sprites/cat-idle.png", frameSize: 48, previewFrames: 4 },
  dog: { previewFile: "assets/sprites/dog-idle.png", frameSize: 48, previewFrames: 4 },
  ducky: { previewFile: "assets/sprites/ducky-idle.png", frameSize: 48, previewFrames: 2 },
  monster: { previewFile: "assets/sprites/monster-idle.png", frameSize: 32, previewFrames: 4 },
  punk: { previewFile: "assets/sprites/punk-idle.png", frameSize: 48, previewFrames: 4 },
  tard: { previewFile: "assets/sprites/tard-idle.png", frameSize: 24, previewFrames: 4 },
  finn: { previewFile: "assets/sprites/finn-idle.png", frameSize: 32, previewFrames: 9 },
  gorgon: { previewFile: "assets/sprites/gorgon-idle.png", frameSize: 128, previewFrames: 7 },
};

const BUILTIN_PRESETS = [
  { id: "builtin_whiskers", name: "Whiskers", template: "cat", color: 0, sound: "assets/sounds/cat.wav", builtin: true, words: ["Meow!", "Meow~", "Mrow!"] },
  { id: "builtin_quackers", name: "Quackers", template: "ducky", color: 0, sound: "assets/sounds/duck.mp3", builtin: true, words: ["Quack!", "QUACK!", "Quack quack!"] },
];

const enabledToggle = document.getElementById("enabled-toggle");
const anywhereSoundToggle = document.getElementById("anywhere-sound-toggle");
const sizeSlider = document.getElementById("size-slider");
const sizeValue = document.getElementById("size-value");
const petGrid = document.getElementById("pet-grid");
const toggleAddFormBtn = document.getElementById("toggle-add-form");

let currentCustomPets = [];
let currentActiveId = "builtin_whiskers";

function applyPreviewStyle(el, templateKey, colorDeg) {
  const tmpl = TEMPLATES[templateKey] || TEMPLATES.cat;
  const frameWidth = tmpl.frameWidth || tmpl.frameSize;
  const frameHeight = tmpl.frameHeight || tmpl.frameSize;
  const sheetWidth = tmpl.sheetWidth || tmpl.frameSize * tmpl.previewFrames;
  const sheetHeight = tmpl.sheetHeight || tmpl.frameSize;
  el.style.backgroundImage = `url("${chrome.runtime.getURL(tmpl.previewFile)}")`;
  el.style.backgroundSize = `${sheetWidth}px ${sheetHeight}px`;
  el.style.backgroundPosition = "0px 0px";
  el.style.width = `${frameWidth}px`;
  el.style.height = `${frameHeight}px`;
  el.style.filter = colorDeg ? `hue-rotate(${colorDeg}deg) saturate(1.2)` : "none";

  return { frameWidth, frameHeight };
}

// ---- Opens the add-pet form as a full tab (native file picker closes popups,
// but never closes a normal tab) ----
toggleAddFormBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/add-pet/add-pet.html") });
});

// ---- Pet grid rendering ----
function renderPetGrid() {
  const allPresets = [...BUILTIN_PRESETS, ...currentCustomPets];
  petGrid.innerHTML = "";

  allPresets.forEach((preset) => {
    const card = document.createElement("div");
    card.className = "pet-card";
    if (preset.id === currentActiveId) card.classList.add("selected");

    const thumb = document.createElement("div");
    thumb.className = "sprite-thumb";
    const preview = applyPreviewStyle(thumb, preset.template, preset.color);
    thumb.style.transform = `scale(${54 / preview.frameHeight})`;

    const label = document.createElement("span");
    label.textContent = preset.name;

    card.appendChild(thumb);
    card.appendChild(label);

    if (!preset.builtin) {
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.textContent = "\u00D7";
      delBtn.title = "Delete this pet";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        currentCustomPets = currentCustomPets.filter((p) => p.id !== preset.id);
        chrome.storage.local.set({ customPets: currentCustomPets }, () => {
          if (currentActiveId === preset.id) {
            currentActiveId = BUILTIN_PRESETS[0].id;
            chrome.storage.local.set({ activePetId: currentActiveId });
          }
          renderPetGrid();
        });
      });
      card.appendChild(delBtn);
    }

    card.addEventListener("click", () => {
      currentActiveId = preset.id;
      chrome.storage.local.set({ activePetId: currentActiveId }, renderPetGrid);
    });

    petGrid.appendChild(card);
  });
}

// ---- Load current settings ----
chrome.storage.local.get(
  {
    enabled: true,
    activePetId: "builtin_whiskers",
    soundOnPetOnly: true,
    customPets: [],
    petScale: 1,
    petLift: 0,
  },
  (settings) => {
    enabledToggle.checked = settings.enabled;
    anywhereSoundToggle.checked = !settings.soundOnPetOnly;
    currentCustomPets = settings.customPets || [];
    currentActiveId = settings.activePetId;
    sizeSlider.value = settings.petScale;
    sizeValue.textContent = `${parseFloat(settings.petScale).toFixed(1)}x`;
    if (settings.petLift !== 0) {
      chrome.storage.local.set({ petLift: 0 });
    }
    renderPetGrid();
  }
);

// Keep the grid fresh if storage changes while the popup happens to stay open
// (e.g. a pet was added in the add-pet tab).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.customPets) {
    currentCustomPets = changes.customPets.newValue || [];
    renderPetGrid();
  }
});

enabledToggle.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: enabledToggle.checked });
});

anywhereSoundToggle.addEventListener("change", () => {
  chrome.storage.local.set({ soundOnPetOnly: !anywhereSoundToggle.checked });
});

sizeSlider.addEventListener("input", () => {
  sizeValue.textContent = `${parseFloat(sizeSlider.value).toFixed(1)}x`;
});
sizeSlider.addEventListener("change", () => {
  chrome.storage.local.set({ petScale: parseFloat(sizeSlider.value) });
});
