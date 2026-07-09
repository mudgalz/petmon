const TEMPLATES = {
  cat: { previewFile: "assets/sprites/cat-idle.png", frameSize: 48, previewFrames: 4 },
  dog: { previewFile: "assets/sprites/dog-idle.png", frameSize: 48, previewFrames: 4 },
  ducky: { previewFile: "assets/sprites/ducky-idle.png", frameSize: 48, previewFrames: 2 },
  monster: { previewFile: "assets/sprites/monster-idle.png", frameSize: 32, previewFrames: 4 },
  pinkmonster: { previewFile: "assets/sprites/pinkmonster-idle.png", frameSize: 32, previewFrames: 4 },
};

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

function applyPreviewStyle(el, templateKey, colorDeg) {
  const tmpl = TEMPLATES[templateKey];
  el.style.backgroundImage = `url("${chrome.runtime.getURL(tmpl.previewFile)}")`;
  el.style.backgroundSize = `${tmpl.frameSize * tmpl.previewFrames}px ${tmpl.frameSize}px`;
  el.style.backgroundPosition = "0px 0px";
  el.style.width = `${tmpl.frameSize}px`;
  el.style.height = `${tmpl.frameSize}px`;
  el.style.filter = colorDeg ? `hue-rotate(${colorDeg}deg) saturate(1.2)` : "none";
}

function refreshTemplatePreviews() {
  document.querySelectorAll(".template-preview").forEach((el) => {
    applyPreviewStyle(el, el.dataset.preview, parseInt(colorSlider.value, 10));
  });
}

templateButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedTemplate = btn.dataset.template;
    templateButtons.forEach((b) => b.classList.toggle("selected", b === btn));
    refreshTemplatePreviews();
  });
});

colorSlider.addEventListener("input", refreshTemplatePreviews);

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
refreshTemplatePreviews();
