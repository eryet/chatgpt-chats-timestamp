const formatSelect = document.getElementById("dateFormat");
const displayModeSelect = document.getElementById("displayMode");
const hoverEnabledCheckbox = document.getElementById("hoverEnabled");
const previewPrimary = document.getElementById("previewPrimary");
const previewSecondary = document.getElementById("previewSecondary");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");

// Default settings
const defaultSettings = {
  dateFormat: "locale",
  displayMode: "created",
  hoverEnabled: true,
};

// Format a date according to the selected format
function formatDate(date, format) {
  switch (format) {
    case "iso":
      return date.toISOString().slice(0, 19).replace("T", " ");
    case "us":
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    case "eu":
      return date.toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    case "uk":
      return date.toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    case "relative":
      return getRelativeTime(date);
    case "short":
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    case "dateOnly":
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    case "timeOnly":
      return date.toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    case "locale":
    default:
      return date.toLocaleString().replace(",", "");
  }
}

function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${diffYear}y ago`;
}

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

// Reset to defaults
resetBtn.addEventListener("click", () => {
  chrome.storage.sync.set(defaultSettings, () => {
    applySettings(defaultSettings);
    showStatus();
  });
});
