// Bridge script - runs in ISOLATED world with access to chrome.storage
// Communicates with main.js via window messages

const defaultSettings = {
  dateFormat: "locale",
  displayMode: "created",
  hoverEnabled: true,
};

function sendSettingsToPage(settings) {
  window.postMessage(
    {
      type: "TIMESTAMP_SETTINGS_UPDATE",
      settings: settings,
    },
    "*"
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
