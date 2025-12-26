// Bridge script - runs in ISOLATED world with access to chrome.storage
// Communicates with main.js via window messages

const defaultSettings = {
  dateFormat: "locale",
  displayMode: "created",
  hoverEnabled: true,
  chatTimestampEnabled: true,
  chatTimestampPosition: "center",
};

function sendSettingsToPage(settings) {
  window.postMessage(
    {
      type: "TIMESTAMP_SETTINGS_UPDATE",
      settings: settings,
    },
    window.location.origin
  );
}

// Load and send initial settings
chrome.storage.sync.get(defaultSettings, (result) => {
  sendSettingsToPage(result);
});

// Listen for changes and forward to page
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    chrome.storage.sync.get(defaultSettings, (result) => {
      sendSettingsToPage(result);
    });
  }
});

// Listen for scroll-to-turn requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCROLL_TO_TURN") {
    // Forward to main.js via window message and wait for response
    const responseHandler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type === "SCROLL_TO_TURN_RESULT") {
        clearTimeout(timeoutId);
        window.removeEventListener("message", responseHandler);
        sendResponse(event.data.result);
      }
    };

    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", responseHandler);
      sendResponse({ success: false, message: "Request timed out" });
    }, 5000);

    window.addEventListener("message", responseHandler);

    window.postMessage(
      {
        type: "SCROLL_TO_TURN",
        turnIndex: message.turnIndex,
      },
      window.location.origin
    );

    // Return true to indicate async response
    return true;
  }
});
