chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "OFFSCREEN_PLAY") {
    try {
      const audio = new Audio(message.src);
      audio.volume = typeof message.volume === "number" ? message.volume : 0.6;
      audio.play().catch(() => {
        // Ignore playback errors (e.g. malformed data URL).
      });
    } catch (e) {
      // Ignore.
    }
  }
});
