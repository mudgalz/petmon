const TEMPLATES = {
  cat: { previewFile: "sprites/cat-idle.png", frameSize: 48, previewFrames: 4 },
  dog: { previewFile: "sprites/dog-idle.png", frameSize: 48, previewFrames: 4 },
  ducky: { previewFile: "sprites/ducky-idle.png", frameSize: 48, previewFrames: 2 },
  monster: { previewFile: "sprites/monster-idle.png", frameSize: 32, previewFrames: 4 },
  pinkmonster: { previewFile: "sprites/pinkmonster-idle.png", frameSize: 32, previewFrames: 4 },
};

const BUILTIN_PRESETS = [
  { id: "builtin_whiskers", name: "Whiskers", template: "cat", color: 0, sound: "sounds/cat.wav", builtin: true, words: ["Meow!", "Meow~", "Mrow!"] },
  { id: "builtin_quackers", name: "Quackers", template: "ducky", color: 0, sound: "sounds/duck.mp3", builtin: true, words: ["Quack!", "QUACK!", "Quack quack!"] },
];

const enabledToggle = document.getElementById("enabled-toggle");
const petOnlyToggle = document.getElementById("pet-only-toggle");
const sizeSlider = document.getElementById("size-slider");
const sizeValue = document.getElementById("size-value");
const liftSlider = document.getElementById("lift-slider");
const liftValue = document.getElementById("lift-value");
const petGrid = document.getElementById("pet-grid");
const toggleAddFormBtn = document.getElementById("toggle-add-form");

let currentCustomPets = [];
let currentActiveId = "builtin_whiskers";

function applyPreviewStyle(el, templateKey, colorDeg) {
  const tmpl = TEMPLATES[templateKey];
  el.style.backgroundImage = `url("${chrome.runtime.getURL(tmpl.previewFile)}")`;
  el.style.backgroundSize = `${tmpl.frameSize * tmpl.previewFrames}px ${tmpl.frameSize}px`;
  el.style.backgroundPosition = "0px 0px";
  el.style.width = `${tmpl.frameSize}px`;
  el.style.height = `${tmpl.frameSize}px`;
  el.style.filter = colorDeg ? `hue-rotate(${colorDeg}deg) saturate(1.2)` : "none";
}

// ---- Opens the add-pet form as a full tab (native file picker closes popups,
// but never closes a normal tab) ----
toggleAddFormBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("add-pet.html") });
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
    applyPreviewStyle(thumb, preset.template, preset.color);
    thumb.style.transform = `scale(${56 / TEMPLATES[preset.template].frameSize})`;

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
    soundOnPetOnly: false,
    customPets: [],
    petScale: 1,
    petLift: 0,
  },
  (settings) => {
    enabledToggle.checked = settings.enabled;
    petOnlyToggle.checked = settings.soundOnPetOnly;
    currentCustomPets = settings.customPets || [];
    currentActiveId = settings.activePetId;
    sizeSlider.value = settings.petScale;
    sizeValue.textContent = `${parseFloat(settings.petScale).toFixed(1)}x`;
    liftSlider.value = settings.petLift;
    liftValue.textContent = `${settings.petLift}px`;
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

petOnlyToggle.addEventListener("change", () => {
  chrome.storage.local.set({ soundOnPetOnly: petOnlyToggle.checked });
});

sizeSlider.addEventListener("input", () => {
  sizeValue.textContent = `${parseFloat(sizeSlider.value).toFixed(1)}x`;
});
sizeSlider.addEventListener("change", () => {
  chrome.storage.local.set({ petScale: parseFloat(sizeSlider.value) });
});

liftSlider.addEventListener("input", () => {
  liftValue.textContent = `${liftSlider.value}px`;
});
liftSlider.addEventListener("change", () => {
  chrome.storage.local.set({ petLift: parseInt(liftSlider.value, 10) });
});
