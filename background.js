let creatingOffscreenPromise = null;

async function hasOffscreenDocument() {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    return contexts.length > 0;
  }
  return false;
}

async function setupOffscreenDocument() {
  if (await hasOffscreenDocument()) return;

  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }

  creatingOffscreenPromise = chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification:
      "Play desktop pet sound effects reliably, regardless of the current page's Content-Security-Policy.",
  });

  try {
    await creatingOffscreenPromise;
  } finally {
    creatingOffscreenPromise = null;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "PLAY_PET_SOUND") {
    setupOffscreenDocument().then(() => {
      chrome.runtime.sendMessage({
        type: "OFFSCREEN_PLAY",
        src: message.src,
        volume: message.volume,
      });
    });
  }
  // No async response needed.
  return false;
});
