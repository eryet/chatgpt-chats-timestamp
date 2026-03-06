const formatSelect = document.getElementById("dateFormat");
const displayModeSelect = document.getElementById("displayMode");
const hoverModeSelect = document.getElementById("hoverMode");
const chatTimestampCheckbox = document.getElementById("chatTimestampEnabled");
const chatTimestampPositionSelect = document.getElementById(
  "chatTimestampPosition",
);
const sidebarFilterModeSelect = document.getElementById("sidebarFilterMode");
const previewPrimary = document.getElementById("previewPrimary");
const previewSecondary = document.getElementById("previewSecondary");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const hoverModeHint = document.getElementById("hoverModeHint");
const starStateEl = document.getElementById("starState");
const starToggleBtn = document.getElementById("starToggleBtn");
const starToggleLabelEl = document.getElementById("starToggleLabel");
const starStatusEl = document.getElementById("starStatus");
const starChatTitleEl = document.getElementById("starChatTitle");
const tabButtons = document.querySelectorAll("[data-tab-target]");
const tabPanels = document.querySelectorAll(".tab-panel");

let initialHoverMode = null;
let currentChatId = null;
let currentChatTitle = "";
let starredChats = {};

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
  hoverMode: "swap",
  chatTimestampEnabled: true,
  chatTimestampPosition: "center",
  sidebarFilterMode: "all",
};

const storageDefaults = {
  ...defaultSettings,
  starredChats: {},
};

// formatDate and getRelativeTime are loaded from utils.js

function normalizeStarredChats(value) {
  return value && typeof value === "object" ? value : {};
}

function stripChatSuffix(title) {
  if (!title) return "";
  return title.replace(/\s+-\s+ChatGPT$/i, "").trim();
}

function getConversationIdFromUrl(urlString) {
  if (!urlString) return null;

  try {
    const url = new URL(urlString);
    if (
      url.hostname !== "chatgpt.com" &&
      url.hostname !== "chat.openai.com"
    ) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const chatIndex = segments.indexOf("c");
    if (chatIndex === -1 || !segments[chatIndex + 1]) {
      return null;
    }

    return decodeURIComponent(segments[chatIndex + 1]);
  } catch {
    return null;
  }
}

function setActiveTab(targetId) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === targetId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === targetId);
  });
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tabTarget);
  });
});

function updatePreview() {
  const format = formatSelect.value;
  const displayMode = displayModeSelect.value;
  const hoverMode = hoverModeSelect.value;
  const hoverActive = hoverMode !== "disabled";

  const createdDate = new Date();
  createdDate.setDate(createdDate.getDate() - 5);
  const updatedDate = new Date();
  updatedDate.setHours(updatedDate.getHours() - 2);

  const createdText = formatDate(createdDate, format);
  const updatedText = formatDate(updatedDate, format);

  if (displayMode === "updated") {
    previewPrimary.textContent = updatedText;
    previewSecondary.textContent = hoverActive
      ? t("previewHover", [createdText]) || `(hover: ${createdText})`
      : "";
  } else {
    previewPrimary.textContent = createdText;
    previewSecondary.textContent = hoverActive
      ? t("previewHover", [updatedText]) || `(hover: ${updatedText})`
      : "";
  }

  previewSecondary.style.display = hoverActive ? "block" : "none";
}

function showStatus() {
  statusEl.classList.add("show");
  setTimeout(() => statusEl.classList.remove("show"), 1500);
}

function saveSettings() {
  const settings = {
    dateFormat: formatSelect.value,
    displayMode: displayModeSelect.value,
    hoverMode: hoverModeSelect.value,
    chatTimestampEnabled: chatTimestampCheckbox.checked,
    chatTimestampPosition: chatTimestampPositionSelect.value,
    sidebarFilterMode: sidebarFilterModeSelect.value,
  };
  chrome.storage.sync.set(settings, () => {
    updatePreview();
    showStatus();
  });
}

function applySettings(settings) {
  formatSelect.value = settings.dateFormat;
  displayModeSelect.value = settings.displayMode;
  hoverModeSelect.value = settings.hoverMode;
  chatTimestampCheckbox.checked = settings.chatTimestampEnabled;
  chatTimestampPositionSelect.value = settings.chatTimestampPosition;
  sidebarFilterModeSelect.value = settings.sidebarFilterMode;
  updatePreview();
}

// Load saved settings (with migration for old hoverEnabled boolean)
chrome.storage.sync.get(storageDefaults, (result) => {
  if ("hoverEnabled" in result && !result.hoverMode) {
    result.hoverMode = result.hoverEnabled ? "swap" : "disabled";
    chrome.storage.sync.remove("hoverEnabled");
    chrome.storage.sync.set({ hoverMode: result.hoverMode });
  }
  starredChats = normalizeStarredChats(result.starredChats);
  applySettings(result);
  initialHoverMode = result.hoverMode;
  refreshStarUi();
  loadCurrentChatContext();
});

// Save on change
formatSelect.addEventListener("change", saveSettings);
displayModeSelect.addEventListener("change", saveSettings);
hoverModeSelect.addEventListener("change", () => {
  saveSettings();
  if (initialHoverMode !== null && hoverModeSelect.value !== initialHoverMode) {
    hoverModeHint.style.display = "block";
  } else {
    hoverModeHint.style.display = "none";
  }
});
chatTimestampCheckbox.addEventListener("change", saveSettings);
chatTimestampPositionSelect.addEventListener("change", saveSettings);
sidebarFilterModeSelect.addEventListener("change", saveSettings);

// Reset to defaults
resetBtn.addEventListener("click", () => {
  chrome.storage.sync.set(defaultSettings, () => {
    applySettings(defaultSettings);
    refreshStarUi();
    showStatus();
  });
});

function showStarStatus(message, type = "") {
  starStatusEl.textContent = message;
  starStatusEl.className = "star-status " + type;
  if (type === "success") {
    setTimeout(() => {
      starStatusEl.textContent = "";
      starStatusEl.className = "star-status";
    }, 2000);
  }
}

function setStarStateAppearance(label, stateClass) {
  starStateEl.textContent = label;
  starStateEl.className = `star-state ${stateClass}`.trim();
}

function refreshStarUi() {
  if (!currentChatId) {
    setStarStateAppearance(
      t("starStateUnavailable") || "Open a specific chat to use starring",
      "is-disabled",
    );
    starToggleLabelEl.textContent = t("starButtonStar") || "Star this chat";
    starToggleBtn.disabled = true;
    starChatTitleEl.textContent =
      currentChatTitle ||
      t("starNoConversationSelected") ||
      "No conversation selected";
    return;
  }

  const isStarred = Boolean(starredChats[currentChatId]);
  const stateValue = isStarred
    ? t("starStateStarred") || "Starred"
    : t("starStateNotStarred") || "Not starred";
  setStarStateAppearance(stateValue, isStarred ? "is-starred" : "is-idle");
  starToggleLabelEl.textContent =
    isStarred
      ? t("starButtonUnstar") || "Unstar this chat"
      : t("starButtonStar") || "Star this chat";
  starToggleBtn.disabled = false;
  starChatTitleEl.textContent =
    currentChatTitle || t("starUntitledConversation") || "Untitled conversation";
}

function loadCurrentChatContext() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab?.id) {
      currentChatId = null;
      currentChatTitle = "";
      showStarStatus(
        t("starUnsupportedPage") || "Open a specific ChatGPT conversation first",
        "error",
      );
      refreshStarUi();
      return;
    }

    chrome.tabs.sendMessage(
      activeTab.id,
      { type: "GET_CHAT_CONTEXT" },
      (response) => {
        const fallbackId = getConversationIdFromUrl(activeTab.url || "");
        const fallbackTitle = stripChatSuffix(activeTab.title || "");

        if (chrome.runtime.lastError) {
          currentChatId = fallbackId;
          currentChatTitle = fallbackTitle;
        } else {
          currentChatId = getConversationIdFromUrl(response?.href || "") || fallbackId;
          currentChatTitle = stripChatSuffix(response?.title || "") || fallbackTitle;
        }

        if (!currentChatId) {
          showStarStatus(
            t("starUnsupportedPage") ||
              "Open a specific ChatGPT conversation first",
            "error",
          );
        } else {
          starStatusEl.textContent = "";
          starStatusEl.className = "star-status";
        }

        refreshStarUi();
      },
    );
  });
}

starToggleBtn.addEventListener("click", () => {
  if (!currentChatId) return;

  const nextStarredChats = { ...starredChats };
  const isCurrentlyStarred = Boolean(nextStarredChats[currentChatId]);

  if (isCurrentlyStarred) {
    delete nextStarredChats[currentChatId];
  } else {
    nextStarredChats[currentChatId] = {
      starredAt: new Date().toISOString(),
      titleSnapshot: currentChatTitle,
    };
  }

  starToggleBtn.disabled = true;
  chrome.storage.sync.set({ starredChats: nextStarredChats }, () => {
    if (chrome.runtime.lastError) {
      starToggleBtn.disabled = false;
      showStarStatus(
        chrome.runtime.lastError.message ||
          (t("starSaveFailed") || "Could not update starred chats"),
        "error",
      );
      return;
    }

    starredChats = nextStarredChats;
    refreshStarUi();
    showStarStatus(
      isCurrentlyStarred
        ? t("starRemovedSuccess") || "Chat removed from starred"
        : t("starAddedSuccess") || "Chat added to starred",
      "success",
    );
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
    showScrollStatus(
      t("scrollInvalidTurn") || "Please enter a valid turn number",
      "error",
    );
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
            showScrollStatus(
              t("scrollConnectError") || "Could not connect to page",
              "error",
            );
            return;
          }
          if (response?.success) {
            showScrollStatus(
              response?.message ||
                t("scrollSuccess", [turnIndex]) ||
                `Scrolled to turn #${turnIndex}`,
              "success",
            );
          } else {
            showScrollStatus(
              response?.message || t("scrollTurnNotFound") || "Turn not found",
              "error",
            );
          }
        },
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
      showExportStatus(
        t("exportNoActiveTab") || "Could not find active tab",
        "error",
      );
      exportBtn.disabled = false;
      return;
    }

    chrome.tabs.sendMessage(
      tabs[0].id,
      { type: "EXPORT_CHAT", format: format },
      (response) => {
        exportBtn.disabled = false;

        if (chrome.runtime.lastError) {
          showExportStatus(
            t("exportConnectError") || "Could not connect to page",
            "error",
          );
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
                "success",
              );
            })
            .catch(() => {
              showExportStatus(
                t("exportCopyFailed") || "Failed to copy to clipboard",
                "error",
              );
            });
        } else {
          showExportStatus(
            response?.message || t("exportFailed") || "Export failed",
            "error",
          );
        }
      },
    );
  });
});
