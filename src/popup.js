const formatSelect = document.getElementById("dateFormat");
const displayModeSelect = document.getElementById("displayMode");
const hoverEnabledCheckbox = document.getElementById("hoverEnabled");
const chatTimestampCheckbox = document.getElementById("chatTimestampEnabled");
const chatTimestampPositionSelect = document.getElementById(
  "chatTimestampPosition"
);
const previewPrimary = document.getElementById("previewPrimary");
const previewSecondary = document.getElementById("previewSecondary");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");

function t(key, substitutions) {
  if (typeof chrome === "undefined" || !chrome.i18n?.getMessage) {
    return "";
  }
  return chrome.i18n.getMessage(key, substitutions);
}

function localizePopup() {
  if (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage) {
    const uiLang = chrome.i18n.getUILanguage();
    if (uiLang) {
      document.documentElement.lang = uiLang;
    }
  }

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    const message = t(key);
    if (message) {
      el.textContent = message;
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;
    const message = t(key);
    if (message) {
      el.setAttribute("placeholder", message);
    }
  });
}

localizePopup();

// Default settings
const defaultSettings = {
  dateFormat: "locale",
  displayMode: "created",
  hoverEnabled: true,
  chatTimestampEnabled: true,
  chatTimestampPosition: "center",
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
      ? t("previewHover", [createdText]) || `(hover: ${createdText})`
      : "";
  } else {
    previewPrimary.textContent = createdText;
    previewSecondary.textContent = hoverEnabled
      ? t("previewHover", [updatedText]) || `(hover: ${updatedText})`
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
    chatTimestampPosition: chatTimestampPositionSelect.value,
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
  chatTimestampPositionSelect.value = settings.chatTimestampPosition;
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
chatTimestampPositionSelect.addEventListener("change", saveSettings);

// Reset to defaults
resetBtn.addEventListener("click", () => {
  chrome.storage.sync.set(defaultSettings, () => {
    applySettings(defaultSettings);
    showStatus();
  });
});

// Scroll to turn functionality
const turnIndexInput = document.getElementById("turnIndexInput");
const scrollToTurnBtn = document.getElementById("scrollToTurnBtn");
const scrollStatusEl = document.getElementById("scrollStatus");

function showScrollStatus(message, type = "") {
  scrollStatusEl.textContent = message;
  scrollStatusEl.className = "scroll-status " + type;
  if (type === "success") {
    setTimeout(() => {
      scrollStatusEl.textContent = "";
      scrollStatusEl.className = "scroll-status";
    }, 2000);
  }
}

scrollToTurnBtn.addEventListener("click", () => {
  const turnIndex = parseInt(turnIndexInput.value, 10);
  if (isNaN(turnIndex) || turnIndex <= 0) {
    showScrollStatus(t("scrollInvalidTurn") || "Please enter a valid turn number", "error");
    return;
  }

  // Send message to content script to scroll
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: "SCROLL_TO_TURN", turnIndex: turnIndex },
        (response) => {
          if (chrome.runtime.lastError) {
            showScrollStatus(t("scrollConnectError") || "Could not connect to page", "error");
            return;
          }
          if (response?.success) {
            showScrollStatus(
              response?.message ||
                t("scrollSuccess", [turnIndex]) ||
                `Scrolled to turn #${turnIndex}`,
              "success"
            );
          } else {
            showScrollStatus(
              response?.message || t("scrollTurnNotFound") || "Turn not found",
              "error"
            );
          }
        }
      );
    }
  });
});

// Allow Enter key to trigger scroll
turnIndexInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    scrollToTurnBtn.click();
  }
});

// Export chat functionality
const exportFormatSelect = document.getElementById("exportFormat");
const exportBtn = document.getElementById("exportBtn");
const exportStatusEl = document.getElementById("exportStatus");

function showExportStatus(message, type = "") {
  exportStatusEl.textContent = message;
  exportStatusEl.className = "export-status " + type;
  if (type === "success") {
    setTimeout(() => {
      exportStatusEl.textContent = "";
      exportStatusEl.className = "export-status";
    }, 3000);
  }
}

exportBtn.addEventListener("click", () => {
  const format = exportFormatSelect.value;
  exportBtn.disabled = true;
  showExportStatus(t("exportExporting") || "Exporting...");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) {
      showExportStatus(t("exportNoActiveTab") || "Could not find active tab", "error");
      exportBtn.disabled = false;
      return;
    }

    chrome.tabs.sendMessage(
      tabs[0].id,
      { type: "EXPORT_CHAT", format: format },
      (response) => {
        exportBtn.disabled = false;

        if (chrome.runtime.lastError) {
          showExportStatus(t("exportConnectError") || "Could not connect to page", "error");
          return;
        }

        if (response?.success) {
          // Copy to clipboard
          navigator.clipboard
            .writeText(response.content)
            .then(() => {
              showExportStatus(
                t("exportCopySuccess", [response.messageCount]) ||
                  `Copied ${response.messageCount} messages!`,
                "success"
              );
            })
            .catch(() => {
              showExportStatus(
                t("exportCopyFailed") || "Failed to copy to clipboard",
                "error"
              );
            });
        } else {
          showExportStatus(
            response?.message || t("exportFailed") || "Export failed",
            "error"
          );
        }
      }
    );
  });
});
