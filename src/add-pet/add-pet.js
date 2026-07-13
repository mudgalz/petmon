const TEMPLATES = {
  cat: previewTemplate("cat", 48, 4, 6),
  dog: previewTemplate("dog", 48, 4, 6),
  ducky: previewTemplate("ducky", 48, 2, 4),
  monster: previewTemplate("monster", 32, 4, 6),
  punk: previewTemplate("punk", 48, 4, 6),
  tard: previewTemplate("tard", 24, 4, 6),
  finn: previewTemplate("finn", 32, 9, 7),
};

function previewTemplate(key, frameSize, idleFrames, walkFrames) {
  return {
    frameSize,
    idle: { file: `assets/sprites/${key}-idle.png`, frames: idleFrames, interval: 220 },
    walk: { file: `assets/sprites/${key}-walk.png`, frames: walkFrames, interval: 110 },
  };
}

const nameInput = document.getElementById("new-pet-name");
const colorSlider = document.getElementById("color-slider");
const soundFileInput = document.getElementById("sound-file");
const soundFileName = document.getElementById("sound-file-name");
const formError = document.getElementById("form-error");
const successMsg = document.getElementById("success-msg");
const saveBtn = document.getElementById("save-pet-btn");
const cancelBtn = document.getElementById("cancel-btn");
const templateButtons = document.querySelectorAll(".template-option");

let selectedTemplate = "cat";
let pendingSoundDataUrl = null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function applyPreviewStyle(el, templateKey, colorDeg, walking) {
  const tmpl = TEMPLATES[templateKey];
  const state = walking ? tmpl.walk : tmpl.idle;
  const sheetWidth = tmpl.frameSize * state.frames;

  el.getAnimations().forEach((animation) => animation.cancel());
  el.style.backgroundImage = `url("${chrome.runtime.getURL(state.file)}")`;
  el.style.backgroundSize = `${sheetWidth}px ${tmpl.frameSize}px`;
  el.style.backgroundPosition = "0px 0px";
  el.style.width = `${tmpl.frameSize}px`;
  el.style.height = `${tmpl.frameSize}px`;
  el.style.filter = colorDeg ? `hue-rotate(${colorDeg}deg) saturate(1.2)` : "none";
  // Normalize different source frame sizes to one readable card preview size.
  el.style.transform = `scale(${64 / tmpl.frameSize})`;

  if (reducedMotion.matches) return;

  const keyframes = [];
  for (let index = 0; index < state.frames; index++) {
    keyframes.push({
      offset: index / state.frames,
      backgroundPosition: `-${index * tmpl.frameSize}px 0px`,
      easing: "steps(1, end)",
    });
  }
  keyframes.push({ offset: 1, backgroundPosition: "0px 0px" });
  el.animate(keyframes, {
    duration: state.frames * state.interval,
    iterations: Infinity,
  });
}

function refreshTemplatePreviews() {
  document.querySelectorAll(".template-preview").forEach((el) => {
    const button = el.closest(".template-option");
    const walking = button.matches(":hover");
    applyPreviewStyle(el, el.dataset.preview, parseInt(colorSlider.value, 10), walking);
  });
}

templateButtons.forEach((btn) => {
  btn.setAttribute("aria-pressed", "false");

  btn.addEventListener("click", () => {
    selectedTemplate = btn.dataset.template;
    templateButtons.forEach((b) => {
      const selected = b === btn;
      b.classList.toggle("selected", selected);
      b.setAttribute("aria-pressed", String(selected));
    });
    refreshTemplatePreviews();
  });

  btn.addEventListener("pointerenter", refreshTemplatePreviews);
  btn.addEventListener("pointerleave", refreshTemplatePreviews);
});

colorSlider.addEventListener("input", () => {
  const colorDeg = parseInt(colorSlider.value, 10);
  document.querySelectorAll(".template-preview").forEach((el) => {
    el.style.filter = colorDeg ? `hue-rotate(${colorDeg}deg) saturate(1.2)` : "none";
  });
});

reducedMotion.addEventListener("change", refreshTemplatePreviews);

soundFileInput.addEventListener("change", () => {
  const file = soundFileInput.files[0];
  if (!file) {
    pendingSoundDataUrl = null;
    soundFileName.textContent = "No file chosen";
    return;
  }
  soundFileName.textContent = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    pendingSoundDataUrl = reader.result;
  };
  reader.readAsDataURL(file);
});

saveBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  formError.textContent = "";

  if (!name) {
    formError.textContent = "Please enter a name.";
    return;
  }
  if (!pendingSoundDataUrl) {
    formError.textContent = "Please choose a sound file.";
    return;
  }

  const newPet = {
    id: `custom_${Date.now()}`,
    name,
    template: selectedTemplate,
    color: parseInt(colorSlider.value, 10),
    sound: pendingSoundDataUrl,
    builtin: false,
    words: ["!", "!!"],
  };

  chrome.storage.local.get({ customPets: [] }, (settings) => {
    const updated = [...(settings.customPets || []), newPet];
    chrome.storage.local.set({ customPets: updated }, () => {
      successMsg.hidden = false;
      saveBtn.disabled = true;
      nameInput.disabled = true;
      soundFileInput.disabled = true;
      colorSlider.disabled = true;
      templateButtons.forEach((b) => (b.disabled = true));
      setTimeout(() => window.close(), 1800);
    });
  });
});

cancelBtn.addEventListener("click", () => window.close());

// Default selection on load
templateButtons[0].classList.add("selected");
templateButtons[0].setAttribute("aria-pressed", "true");
refreshTemplatePreviews();
