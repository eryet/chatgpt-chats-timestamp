const formatSelect = document.getElementById("dateFormat");
const displayModeSelect = document.getElementById("displayMode");
const hoverEnabledCheckbox = document.getElementById("hoverEnabled");
const chatTimestampCheckbox = document.getElementById("chatTimestampEnabled");
const previewPrimary = document.getElementById("previewPrimary");
const previewSecondary = document.getElementById("previewSecondary");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");

// Default settings
const defaultSettings = {
  dateFormat: "locale",
  displayMode: "created",
  hoverEnabled: true,
  chatTimestampEnabled: true,
};

// formatDate and getRelativeTime are loaded from utils.js

function updatePreview() {
  const format = formatSelect.value;
  const displayMode = displayModeSelect.value;
  const hoverEnabled = hoverEnabledCheckbox.checked;

  const createdDate = new Date();
  createdDate.setDate(createdDate.getDate() - 5);
  const updatedDate = new Date();
  updatedDate.setHours(updatedDate.getHours() - 2);

  const createdText = formatDate(createdDate, format);
  const updatedText = formatDate(updatedDate, format);

  if (displayMode === "updated") {
    previewPrimary.textContent = updatedText;
    previewSecondary.textContent = hoverEnabled
      ? `(hover: ${createdText})`
      : "";
  } else {
    previewPrimary.textContent = createdText;
    previewSecondary.textContent = hoverEnabled
      ? `(hover: ${updatedText})`
      : "";
  }

  previewSecondary.style.display = hoverEnabled ? "block" : "none";
}

function showStatus() {
  statusEl.classList.add("show");
  setTimeout(() => statusEl.classList.remove("show"), 1500);
}

function saveSettings() {
  const settings = {
    dateFormat: formatSelect.value,
    displayMode: displayModeSelect.value,
    hoverEnabled: hoverEnabledCheckbox.checked,
    chatTimestampEnabled: chatTimestampCheckbox.checked,
  };
  chrome.storage.sync.set(settings, () => {
    updatePreview();
    showStatus();
  });
}

function applySettings(settings) {
  formatSelect.value = settings.dateFormat;
  displayModeSelect.value = settings.displayMode;
  hoverEnabledCheckbox.checked = settings.hoverEnabled;
  chatTimestampCheckbox.checked = settings.chatTimestampEnabled;
  updatePreview();
}

// Load saved settings
chrome.storage.sync.get(defaultSettings, (result) => {
  applySettings(result);
});

// Save on change
formatSelect.addEventListener("change", saveSettings);
displayModeSelect.addEventListener("change", saveSettings);
hoverEnabledCheckbox.addEventListener("change", saveSettings);
chatTimestampCheckbox.addEventListener("change", saveSettings);

// Reset to defaults
resetBtn.addEventListener("click", () => {
  chrome.storage.sync.set(defaultSettings, () => {
    applySettings(defaultSettings);
    showStatus();
  });
});
