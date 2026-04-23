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
let starredIds = new Set();

const BOOKMARK_KEY_PREFIX = "bm_";
const BOOKMARK_SCHEMA_VERSION = 2;

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
  bookmarkSchemaVersion: BOOKMARK_SCHEMA_VERSION,
};

// formatDate and getRelativeTime are loaded from utils.js

function extractStarredIdSet(allStorage) {
  const set = new Set();
  for (const key in allStorage) {
    if (
      key.startsWith(BOOKMARK_KEY_PREFIX) &&
      allStorage[key] &&
      typeof allStorage[key] === "object"
    ) {
      set.add(key.slice(BOOKMARK_KEY_PREFIX.length));
    }
  }
  return set;
}

// Idempotent migration: v1 starredChats -> v2 per-bookmark bm_<id> items.
function migrateBookmarksIfNeeded(all, done) {
  if (all.bookmarkSchemaVersion >= BOOKMARK_SCHEMA_VERSION) {
    done(all);
    return;
  }

  const oldStarred =
    all.starredChats && typeof all.starredChats === "object"
      ? all.starredChats
      : {};
  const bmItems = {};
  const now = new Date().toISOString();
  for (const id in oldStarred) {
    const entry = oldStarred[id] || {};
    bmItems[BOOKMARK_KEY_PREFIX + id] = {
      id,
      starredAt: entry.starredAt || now,
      titleSnapshot: entry.titleSnapshot || "",
      folderId: null,
      note: "",
      updatedAt: entry.starredAt || now,
    };
  }

  const patch = {
    ...bmItems,
    bookmarkFolders: all.bookmarkFolders || {},
    bookmarkSchemaVersion: BOOKMARK_SCHEMA_VERSION,
  };

  chrome.storage.sync.set(patch, () => {
    if (chrome.runtime.lastError) {
      console.warn(
        "[chatgpt-chats-timestamp] popup migration set failed:",
        chrome.runtime.lastError.message,
      );
      done(all);
      return;
    }

    const finish = () => chrome.storage.sync.get(null, done);

    if ("starredChats" in all) {
      chrome.storage.sync.remove("starredChats", finish);
    } else {
      finish();
    }
  });
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

// Load saved settings (migrations: v1 hoverEnabled bool + v1 starredChats shape)
chrome.storage.sync.get(null, (raw) => {
  migrateBookmarksIfNeeded(raw, (all) => {
    const result = { ...storageDefaults, ...all };
    if ("hoverEnabled" in result && !result.hoverMode) {
      result.hoverMode = result.hoverEnabled ? "swap" : "disabled";
      chrome.storage.sync.remove("hoverEnabled");
      chrome.storage.sync.set({ hoverMode: result.hoverMode });
    }
    starredIds = extractStarredIdSet(all);
    applySettings(result);
    initialHoverMode = result.hoverMode;
    refreshStarUi();
    loadCurrentChatContext();
    if (typeof onBookmarksStorageChanged === "function") {
      onBookmarksStorageChanged(all);
    }
  });
});

// Keep starredIds (and any open bookmark view) in sync with storage changes
// from other extension contexts.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  const touchesBookmarks = Object.keys(changes).some(
    (k) =>
      k.startsWith(BOOKMARK_KEY_PREFIX) ||
      k === "bookmarkFolders" ||
      k === "bookmarkSchemaVersion",
  );
  if (!touchesBookmarks) return;
  chrome.storage.sync.get(null, (all) => {
    starredIds = extractStarredIdSet(all);
    refreshStarUi();
    if (typeof onBookmarksStorageChanged === "function") {
      onBookmarksStorageChanged(all);
    }
  });
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

function showTransientStatus(el, message, type = "", baseClass = "") {
  if (!el) return;
  const cls = baseClass || el.dataset.baseClass || el.className.split(" ")[0];
  if (!el.dataset.baseClass) el.dataset.baseClass = cls;
  el.textContent = message;
  el.className = type ? `${cls} ${type}` : cls;
  if (el._transientTimer) {
    clearTimeout(el._transientTimer);
    el._transientTimer = null;
  }
  if (type === "success") {
    el._transientTimer = setTimeout(() => {
      el.textContent = "";
      el.className = cls;
      el._transientTimer = null;
    }, 2000);
  }
}

function showStarStatus(message, type = "") {
  showTransientStatus(starStatusEl, message, type, "star-status");
}

function setStarStateAppearance(label, stateClass) {
  starStateEl.textContent = label;
  starStateEl.className = `star-state ${stateClass}`.trim();
}

function refreshStarUi() {
  const starCard = starToggleBtn.closest(".star-card");
  if (!currentChatId) {
    setStarStateAppearance(
      t("starUnsupportedPage") || "Open a specific ChatGPT conversation first",
      "is-disabled",
    );
    starToggleLabelEl.textContent = t("starButtonStar") || "Star this chat";
    starToggleBtn.disabled = true;
    starChatTitleEl.textContent =
      currentChatTitle ||
      t("starNoConversationSelected") ||
      "No conversation selected";
    starCard?.classList.add("is-no-chat");
    return;
  }
  starCard?.classList.remove("is-no-chat");

  const isStarred = starredIds.has(currentChatId);
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

  const key = BOOKMARK_KEY_PREFIX + currentChatId;
  const isCurrentlyStarred = starredIds.has(currentChatId);
  starToggleBtn.disabled = true;

  const handleResult = () => {
    if (chrome.runtime.lastError) {
      starToggleBtn.disabled = false;
      showStarStatus(
        chrome.runtime.lastError.message ||
          (t("starSaveFailed") || "Could not update starred chats"),
        "error",
      );
      return;
    }

    if (isCurrentlyStarred) {
      starredIds.delete(currentChatId);
    } else {
      starredIds.add(currentChatId);
    }
    refreshStarUi();
    showStarStatus(
      isCurrentlyStarred
        ? t("starRemovedSuccess") || "Chat removed from starred"
        : t("starAddedSuccess") || "Chat added to starred",
      "success",
    );
  };

  if (isCurrentlyStarred) {
    chrome.storage.sync.remove(key, handleResult);
  } else {
    const now = new Date().toISOString();
    const item = {
      id: currentChatId,
      starredAt: now,
      titleSnapshot: currentChatTitle,
      folderId: null,
      note: "",
      updatedAt: now,
    };
    chrome.storage.sync.set({ [key]: item }, handleResult);
  }
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

// =============== Bookmark Manager ===============

const bmBannerEl = document.getElementById("bmBanner");
const bmFolderListBody = document.getElementById("bmFolderListBody");
const bmFoldersInlineArea = document.getElementById("bmFoldersInlineArea");
const bmListTitle = document.getElementById("bmListTitle");
const bmListBody = document.getElementById("bmListBody");
const bmListInlineArea = document.getElementById("bmListInlineArea");
const bmListFooter = document.getElementById("bmListFooter");
const bmUnstarAllBtn = document.getElementById("bmUnstarAllBtn");
const bmListOverflowWrap = document.getElementById("bmListOverflowWrap");
const bmListOverflowBtn = document.getElementById("bmListOverflowBtn");
const bmListOverflowMenu = document.getElementById("bmListOverflowMenu");
const bmNewFolderBtn = document.getElementById("bmNewFolderBtn");
const bmDetailTitle = document.getElementById("bmDetailTitle");
const bmDetailMeta = document.getElementById("bmDetailMeta");
const bmDetailFolder = document.getElementById("bmDetailFolder");
const bmDetailNote = document.getElementById("bmDetailNote");
const bmDetailOpenChatBtn = document.getElementById("bmDetailOpenChat");
const bmNoteCounter = document.getElementById("bmNoteCounter");
const bmNoteStatus = document.getElementById("bmNoteStatus");
const bmDetailStatus = document.getElementById("bmDetailStatus");
const bmUnstarBtn = document.getElementById("bmUnstarBtn");
const bmManageShortcutBtn = document.getElementById("bmManageShortcut");
const bmScreens = document.querySelectorAll("[data-bm-screen]");

const VIRTUAL_ALL = "__all__";
const VIRTUAL_UNCAT = "__uncategorized__";
const NOTE_MAX = 500;
const FOLDER_NAME_MAX = 60;
const NOTE_DEBOUNCE_MS = 800;
const UNSTAR_CONFIRM_MS = 3000;
const FOLDER_ID_PREFIX = "fld_";

const ICON_CHEVRON_RIGHT = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.22 11.78a.75.75 0 0 1 0-1.06L7.94 8 5.22 5.28a.75.75 0 1 1 1.06-1.06l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0Z"/></svg>`;
const ICON_FOLDER = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4a1.5 1.5 0 0 1 1.5-1.5h2.69a1.5 1.5 0 0 1 1.06.44l.97.97h4.28A1.5 1.5 0 0 1 14 5.41v6.09A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5V4Z"/></svg>`;
const ICON_STAR_OUTLINE = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z"/></svg>`;
const ICON_NOTE = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.75A1.75 1.75 0 0 1 4.75 1h6.5A1.75 1.75 0 0 1 13 2.75v10.5A1.75 1.75 0 0 1 11.25 15h-6.5A1.75 1.75 0 0 1 3 13.25V2.75ZM5 5a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5Zm0 2.5a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5Zm0 2.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H5Z"/></svg>`;
const ICON_STACK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.75A.75.75 0 0 1 2.75 4h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 3.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm.75 2.5a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H2.75Z"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7 7a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06L6.25 10.69l6.47-6.47a.75.75 0 0 1 1.06 0Z"/></svg>`;
const ICON_X = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22Z"/></svg>`;
const ICON_EXTERNAL = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.25 2.5a.75.75 0 0 0 0 1.5h1.69L6.22 8.72a.75.75 0 1 0 1.06 1.06L12 5.06v1.69a.75.75 0 0 0 1.5 0V3.25a.75.75 0 0 0-.75-.75H9.25ZM3.25 4A1.25 1.25 0 0 0 2 5.25v7.5A1.25 1.25 0 0 0 3.25 14h7.5A1.25 1.25 0 0 0 12 12.75V9.5a.75.75 0 0 0-1.5 0v3h-7v-7h3a.75.75 0 0 0 0-1.5h-3.25Z"/></svg>`;

let bmFolders = {};
let bmBookmarks = {};

let bmState = {
  screen: "folders",
  folderId: null,
  bookmarkId: null,
  returnFolderId: null, // folder we came from when opening detail (for back nav)
};

let bmNoteDebounceTimer = null;
let bmNoteInFlight = false;
let bmUnstarConfirmActive = false;
let bmUnstarConfirmTimer = null;

function isVirtualFolder(id) {
  return id === VIRTUAL_ALL || id === VIRTUAL_UNCAT;
}

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function genFolderId() {
  const uuid =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return FOLDER_ID_PREFIX + uuid;
}

function getFolderDepth(folderId) {
  if (!folderId || isVirtualFolder(folderId)) return 0;
  let depth = 1;
  let cur = bmFolders[folderId];
  let guard = 0;
  while (cur?.parentId) {
    depth++;
    cur = bmFolders[cur.parentId];
    if (++guard > 10) break;
  }
  return depth;
}

function getRootFolders() {
  return Object.values(bmFolders)
    .filter((f) => !f.parentId)
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        (a.createdAt || "").localeCompare(b.createdAt || ""),
    );
}

function getChildFolders(parentId) {
  return Object.values(bmFolders)
    .filter((f) => f.parentId === parentId)
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        (a.createdAt || "").localeCompare(b.createdAt || ""),
    );
}

function getFolderHierarchyList() {
  const result = [];
  for (const root of getRootFolders()) {
    result.push({ folder: root, depth: 0 });
    for (const child of getChildFolders(root.id)) {
      result.push({ folder: child, depth: 1 });
    }
  }
  return result;
}

function countBookmarksInFolder(folderId) {
  if (folderId === VIRTUAL_ALL) return Object.keys(bmBookmarks).length;
  if (folderId === VIRTUAL_UNCAT) {
    return Object.values(bmBookmarks).filter((b) => !b.folderId).length;
  }
  return Object.values(bmBookmarks).filter((b) => b.folderId === folderId).length;
}

function getBookmarksInFolder(folderId) {
  const list = Object.values(bmBookmarks);
  let filtered;
  if (folderId === VIRTUAL_ALL) {
    filtered = list;
  } else if (folderId === VIRTUAL_UNCAT) {
    filtered = list.filter((b) => !b.folderId);
  } else {
    filtered = list.filter((b) => b.folderId === folderId);
  }
  return filtered.sort((a, b) =>
    (b.starredAt || "").localeCompare(a.starredAt || ""),
  );
}

function getNextFolderOrder(parentId) {
  const siblings = Object.values(bmFolders).filter(
    (f) => (f.parentId || null) === (parentId || null),
  );
  if (!siblings.length) return 0;
  return Math.max(...siblings.map((f) => f.order ?? 0)) + 1;
}

function getFolderName(folderId) {
  if (folderId === VIRTUAL_ALL)
    return t("bmAllBookmarks") || "All bookmarks";
  if (folderId === VIRTUAL_UNCAT)
    return t("bmUncategorized") || "Uncategorized";
  return bmFolders[folderId]?.name || "";
}

function handleStorageError() {
  const err = chrome.runtime.lastError;
  if (!err) return false;
  const msg = err.message || "";
  if (/QUOTA|MAX_ITEMS/i.test(msg)) {
    bmBannerEl?.classList.add("is-active");
  }
  return true;
}

function onBookmarksStorageChanged(all) {
  bmFolders =
    all && typeof all.bookmarkFolders === "object" && all.bookmarkFolders
      ? { ...all.bookmarkFolders }
      : {};
  bmBookmarks = {};
  for (const key in all) {
    if (
      key.startsWith(BOOKMARK_KEY_PREFIX) &&
      all[key] &&
      typeof all[key] === "object"
    ) {
      const id = key.slice(BOOKMARK_KEY_PREFIX.length);
      bmBookmarks[id] = { ...all[key], id };
    }
  }

  // If the currently open detail view was deleted externally, bounce to list.
  if (
    bmState.screen === "detail" &&
    bmState.bookmarkId &&
    !bmBookmarks[bmState.bookmarkId]
  ) {
    navTo("list", { folderId: bmState.returnFolderId || VIRTUAL_ALL });
    return;
  }
  // If the currently open folder was deleted, bounce to folders root.
  if (
    bmState.screen === "list" &&
    bmState.folderId &&
    !isVirtualFolder(bmState.folderId) &&
    !bmFolders[bmState.folderId]
  ) {
    navTo("folders", { folderId: null });
    return;
  }

  renderBookmarkScreen();
}

function setActiveBmScreen(name) {
  bmScreens.forEach((el) => {
    el.classList.toggle(
      "is-active",
      el.getAttribute("data-bm-screen") === name,
    );
  });
}

function navTo(screen, opts = {}) {
  if (bmState.screen === "detail") {
    flushNoteDebounce();
    resetUnstarConfirm();
  }
  closeOverflowMenu();
  clearInlineArea();

  bmState = {
    screen,
    folderId:
      opts.folderId !== undefined ? opts.folderId : bmState.folderId,
    bookmarkId:
      opts.bookmarkId !== undefined ? opts.bookmarkId : bmState.bookmarkId,
    returnFolderId:
      opts.returnFolderId !== undefined
        ? opts.returnFolderId
        : bmState.returnFolderId,
  };
  renderBookmarkScreen();
}

function goBack() {
  if (bmState.screen === "detail") {
    navTo("list", {
      folderId: bmState.returnFolderId || VIRTUAL_ALL,
      bookmarkId: null,
    });
  } else if (bmState.screen === "list") {
    navTo("folders", { folderId: null, bookmarkId: null });
  }
}

function renderBookmarkScreen() {
  setActiveBmScreen(bmState.screen);
  if (bmState.screen === "folders") renderFolderListScreen();
  else if (bmState.screen === "list") renderBookmarkListScreen();
  else if (bmState.screen === "detail") renderBookmarkDetailScreen();
}

function renderFolderListScreen() {
  const rows = [];
  const allCount = countBookmarksInFolder(VIRTUAL_ALL);
  const uncatCount = countBookmarksInFolder(VIRTUAL_UNCAT);

  rows.push(makeVirtualRow(VIRTUAL_ALL, t("bmAllBookmarks") || "All bookmarks", allCount));
  rows.push(
    makeVirtualRow(
      VIRTUAL_UNCAT,
      t("bmUncategorized") || "Uncategorized",
      uncatCount,
    ),
  );

  for (const { folder, depth } of getFolderHierarchyList()) {
    rows.push(makeFolderRow(folder, depth));
  }

  bmFolderListBody.innerHTML = "";
  rows.forEach((el) => bmFolderListBody.appendChild(el));

  if (allCount === 0 && Object.keys(bmFolders).length === 0) {
    const empty = document.createElement("div");
    empty.className = "bm-empty";
    empty.innerHTML = `
      <div class="bm-empty-title">${escapeHtml(t("bmEmptyStateTitle") || "No bookmarks yet")}</div>
      <div class="bm-empty-hint">${escapeHtml(t("bmEmptyStateHint") || "Star a chat to get started.")}</div>
    `;
    bmFolderListBody.appendChild(empty);
  }
}

function makeVirtualRow(id, label, count) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "bm-row is-virtual";
  btn.innerHTML = `
    <span class="bm-row-icon">${ICON_STACK}</span>
    <span class="bm-row-body">
      <span class="bm-row-title">${escapeHtml(label)}</span>
    </span>
    <span class="bm-row-suffix">
      <span class="bm-count">${count}</span>
    </span>
  `;
  btn.addEventListener("click", () => {
    navTo("list", { folderId: id, returnFolderId: id });
  });
  return btn;
}

function makeFolderRow(folder, depth) {
  const count = countBookmarksInFolder(folder.id);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "bm-row is-folder" + (depth > 0 ? " is-subfolder" : "");
  btn.innerHTML = `
    <span class="bm-row-icon">${ICON_FOLDER}</span>
    <span class="bm-row-body">
      <span class="bm-row-title">${escapeHtml(folder.name)}</span>
    </span>
    <span class="bm-row-suffix">
      <span class="bm-count">${count}</span>
      ${ICON_CHEVRON_RIGHT}
    </span>
  `;
  btn.addEventListener("click", () => {
    navTo("list", { folderId: folder.id, returnFolderId: folder.id });
  });
  return btn;
}

function renderBookmarkListScreen() {
  const fid = bmState.folderId;
  bmListTitle.textContent = getFolderName(fid);

  // Overflow menu: only shown for real folders (rename / new-subfolder / delete).
  // The "Unstar all" action lives in the list footer, visible for all views.
  const isVirtual = isVirtualFolder(fid);
  const isRealFolder = fid && !isVirtual && bmFolders[fid];
  const depth = isRealFolder ? getFolderDepth(fid) : 0;
  bmListOverflowWrap.style.display = isRealFolder ? "" : "none";
  const subBtn = bmListOverflowMenu.querySelector(
    '[data-bm-action="new-subfolder"]',
  );
  if (subBtn) subBtn.style.display = depth >= 1 ? "none" : "";

  // Body
  const items = getBookmarksInFolder(fid);
  bmListBody.innerHTML = "";

  // Footer: "Unstar all (N)" — hidden when no items
  if (items.length > 0) {
    bmUnstarAllBtn.textContent =
      t("bmUnstarAllButtonTemplate", [String(items.length)]) ||
      `Unstar all (${items.length})`;
    bmListFooter.hidden = false;
  } else {
    bmListFooter.hidden = true;
  }

  // Child folders (only when in a real folder at depth 0)
  if (fid && !isVirtualFolder(fid) && getFolderDepth(fid) === 0) {
    for (const child of getChildFolders(fid)) {
      bmListBody.appendChild(makeFolderRow(child, 1));
    }
  }

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "bm-empty";
    const title = fid
      ? t("bmFolderEmptyTitle") || "No bookmarks in this folder"
      : t("bmEmptyStateTitle") || "No bookmarks yet";
    const hint = fid
      ? t("bmFolderEmptyHint") ||
        "Move a bookmark here from its detail view."
      : t("bmEmptyStateHint") || "Star a chat to get started.";
    empty.innerHTML = `
      <div class="bm-empty-title">${escapeHtml(title)}</div>
      <div class="bm-empty-hint">${escapeHtml(hint)}</div>
    `;
    bmListBody.appendChild(empty);
    return;
  }

  for (const bm of items) {
    bmListBody.appendChild(makeBookmarkRow(bm));
  }
}

function makeBookmarkRow(bm) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "bm-row is-bookmark";
  const title = bm.titleSnapshot || t("starUntitledConversation") || "Untitled conversation";
  const formatted = formatStarredAt(bm.starredAt);
  const hasNote = bm.note && bm.note.trim().length > 0;
  btn.innerHTML = `
    <span class="bm-row-icon">${ICON_STAR_OUTLINE}</span>
    <span class="bm-row-body">
      <span class="bm-row-title">${escapeHtml(title)}</span>
      <span class="bm-row-sub">${escapeHtml(formatted)}</span>
    </span>
    <span class="bm-row-suffix">
      ${hasNote ? ICON_NOTE : ""}
      ${ICON_CHEVRON_RIGHT}
    </span>
  `;
  btn.addEventListener("click", () => {
    navTo("detail", {
      bookmarkId: bm.id,
      returnFolderId: bmState.folderId,
    });
  });
  return btn;
}

function formatStarredAt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return formatDate(d, formatSelect.value);
  } catch {
    return d.toLocaleString();
  }
}

function renderBookmarkDetailScreen() {
  const bm = bmBookmarks[bmState.bookmarkId];
  if (!bm) {
    navTo("list", { folderId: bmState.returnFolderId || VIRTUAL_ALL });
    return;
  }

  bmDetailTitle.textContent =
    bm.titleSnapshot || t("starUntitledConversation") || "Untitled conversation";
  const formatted = formatStarredAt(bm.starredAt);
  bmDetailMeta.textContent =
    t("bmDetailStarredOnTemplate", [formatted]) || `Starred on ${formatted}`;

  populateFolderDropdown(bm.folderId);
  bmDetailNote.value = bm.note || "";
  updateNoteCounter();

  resetUnstarConfirm();
  bmDetailStatus.textContent = "";
  bmDetailStatus.className = "bm-status";
  bmNoteStatus.textContent = "";
  bmNoteStatus.className = "bm-status";
}

function populateFolderDropdown(selectedId) {
  bmDetailFolder.innerHTML = "";
  const uncatOpt = document.createElement("option");
  uncatOpt.value = "";
  uncatOpt.textContent = t("bmUncategorized") || "Uncategorized";
  bmDetailFolder.appendChild(uncatOpt);

  for (const { folder, depth } of getFolderHierarchyList()) {
    const opt = document.createElement("option");
    opt.value = folder.id;
    const indent = depth > 0 ? "    " : "";
    opt.textContent = indent + folder.name;
    bmDetailFolder.appendChild(opt);
  }

  bmDetailFolder.value = selectedId || "";
}

function updateNoteCounter() {
  const len = bmDetailNote.value.length;
  bmNoteCounter.textContent =
    t("bmDetailNoteCharCountTemplate", [String(len)]) || `${len} / ${NOTE_MAX}`;
  bmNoteCounter.classList.toggle("is-over", len >= NOTE_MAX);
}

// Inline create/rename area — placed on the currently visible screen
function getCurrentInlineArea() {
  if (bmState.screen === "folders") return bmFoldersInlineArea;
  if (bmState.screen === "list") return bmListInlineArea;
  return null;
}

function clearInlineArea() {
  if (bmFoldersInlineArea) bmFoldersInlineArea.innerHTML = "";
  if (bmListInlineArea) bmListInlineArea.innerHTML = "";
}

function showInlineFolderInput({
  initialValue = "",
  placeholderKey = "bmNewFolderPlaceholder",
  onCommit,
}) {
  clearInlineArea();
  const host = getCurrentInlineArea();
  if (!host) return;
  const wrap = document.createElement("div");
  wrap.className = "bm-inline-row";
  wrap.innerHTML = `
    <input
      type="text"
      class="bm-inline-input"
      maxlength="${FOLDER_NAME_MAX}"
      placeholder="${escapeHtml(t(placeholderKey) || "Folder name")}"
    />
    <button type="button" class="bm-inline-commit" disabled aria-label="Save">${ICON_CHECK}</button>
    <button type="button" class="bm-inline-cancel" aria-label="Cancel">${ICON_X}</button>
  `;
  host.appendChild(wrap);

  const input = wrap.querySelector(".bm-inline-input");
  const commitBtn = wrap.querySelector(".bm-inline-commit");
  const cancelBtn = wrap.querySelector(".bm-inline-cancel");
  input.value = initialValue;
  const updateEnabled = () => {
    commitBtn.disabled = input.value.trim().length === 0;
  };
  updateEnabled();
  input.focus();
  input.select();
  input.addEventListener("input", updateEnabled);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !commitBtn.disabled) {
      e.preventDefault();
      onCommit(input.value.trim());
    } else if (e.key === "Escape") {
      e.preventDefault();
      clearInlineArea();
    }
  });
  commitBtn.addEventListener("click", () => {
    if (!commitBtn.disabled) onCommit(input.value.trim());
  });
  cancelBtn.addEventListener("click", clearInlineArea);
}

function createFolder(name, parentId) {
  const trimmed = name.trim().slice(0, FOLDER_NAME_MAX);
  if (!trimmed) return;
  const id = genFolderId();
  const folder = {
    id,
    name: trimmed,
    parentId: parentId || null,
    order: getNextFolderOrder(parentId),
    createdAt: new Date().toISOString(),
  };
  const nextFolders = { ...bmFolders, [id]: folder };
  chrome.storage.sync.set({ bookmarkFolders: nextFolders }, () => {
    if (handleStorageError()) {
      showTransientStatus(
        bmDetailStatus,
        t("bmSaveFailed") || "Could not save changes",
        "error",
        "bm-status",
      );
      return;
    }
    bmFolders = nextFolders;
    clearInlineArea();
    renderBookmarkScreen();
  });
}

function renameFolder(folderId, name) {
  const trimmed = name.trim().slice(0, FOLDER_NAME_MAX);
  if (!trimmed) return;
  const existing = bmFolders[folderId];
  if (!existing) return;
  const nextFolders = {
    ...bmFolders,
    [folderId]: { ...existing, name: trimmed },
  };
  chrome.storage.sync.set({ bookmarkFolders: nextFolders }, () => {
    if (handleStorageError()) return;
    bmFolders = nextFolders;
    clearInlineArea();
    renderBookmarkScreen();
  });
}

function showFolderDeleteConfirm(folderId) {
  clearInlineArea();
  const host = getCurrentInlineArea();
  if (!host) return;
  const folder = bmFolders[folderId];
  if (!folder) return;
  const wrap = document.createElement("div");
  wrap.className = "bm-delete-confirm";
  const question =
    t("bmFolderDeleteConfirm", [folder.name]) ||
    `Delete '${folder.name}'? Bookmarks will move to Uncategorized.`;
  wrap.innerHTML = `
    <div>${escapeHtml(question)}</div>
    <div class="bm-delete-confirm-actions">
      <button type="button" class="bm-btn-sm" data-bm-confirm="cancel" data-i18n="bmFolderCancelButton">Cancel</button>
      <button type="button" class="bm-btn-sm is-danger" data-bm-confirm="delete" data-i18n="bmFolderDeleteButton">Delete</button>
    </div>
  `;
  // Localize inner text
  wrap.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = t(el.getAttribute("data-i18n"));
    if (msg) el.textContent = msg;
  });
  host.appendChild(wrap);
  wrap.querySelector('[data-bm-confirm="cancel"]').addEventListener(
    "click",
    clearInlineArea,
  );
  wrap.querySelector('[data-bm-confirm="delete"]').addEventListener(
    "click",
    () => commitDeleteFolder(folderId),
  );
}

function showUnstarAllConfirm(folderId) {
  clearInlineArea();
  const host = getCurrentInlineArea();
  if (!host) return;
  const items = getBookmarksInFolder(folderId);
  if (items.length === 0) return;

  const wrap = document.createElement("div");
  wrap.className = "bm-delete-confirm";
  const question =
    t("bmUnstarAllConfirmTemplate", [String(items.length)]) ||
    `Unstar all ${items.length} bookmarks? This cannot be undone.`;
  wrap.innerHTML = `
    <div>${escapeHtml(question)}</div>
    <div class="bm-delete-confirm-actions">
      <button type="button" class="bm-btn-sm" data-bm-confirm="cancel" data-i18n="bmFolderCancelButton">Cancel</button>
      <button type="button" class="bm-btn-sm is-danger" data-bm-confirm="unstar-all" data-i18n="bmUnstarAll">Unstar all</button>
    </div>
  `;
  wrap.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = t(el.getAttribute("data-i18n"));
    if (msg) el.textContent = msg;
  });
  host.appendChild(wrap);
  wrap.querySelector('[data-bm-confirm="cancel"]').addEventListener(
    "click",
    clearInlineArea,
  );
  wrap.querySelector('[data-bm-confirm="unstar-all"]').addEventListener(
    "click",
    () => commitUnstarAll(folderId),
  );
}

function commitUnstarAll(folderId) {
  const items = getBookmarksInFolder(folderId);
  if (items.length === 0) {
    clearInlineArea();
    return;
  }
  const keys = items.map((b) => BOOKMARK_KEY_PREFIX + b.id);
  chrome.storage.sync.remove(keys, () => {
    if (handleStorageError()) return;
    for (const b of items) {
      delete bmBookmarks[b.id];
      starredIds.delete(b.id);
    }
    refreshStarUi();
    clearInlineArea();
    renderBookmarkScreen();
  });
}

function commitDeleteFolder(folderId) {
  const folder = bmFolders[folderId];
  if (!folder) return;

  const nextFolders = { ...bmFolders };
  delete nextFolders[folderId];
  // Promote any child folders to root
  for (const id in nextFolders) {
    if (nextFolders[id].parentId === folderId) {
      nextFolders[id] = { ...nextFolders[id], parentId: null };
    }
  }

  // Reassign bookmarks in the deleted folder to Uncategorized
  const bookmarkPatch = {};
  const now = new Date().toISOString();
  for (const id in bmBookmarks) {
    if (bmBookmarks[id].folderId === folderId) {
      bookmarkPatch[BOOKMARK_KEY_PREFIX + id] = {
        ...bmBookmarks[id],
        folderId: null,
        updatedAt: now,
      };
    }
  }

  const patch = { bookmarkFolders: nextFolders, ...bookmarkPatch };
  chrome.storage.sync.set(patch, () => {
    if (handleStorageError()) return;
    bmFolders = nextFolders;
    for (const key in bookmarkPatch) {
      const id = key.slice(BOOKMARK_KEY_PREFIX.length);
      bmBookmarks[id] = bookmarkPatch[key];
    }
    navTo("folders", { folderId: null });
  });
}

function moveBookmarkToFolder(bookmarkId, folderIdOrEmpty) {
  const bm = bmBookmarks[bookmarkId];
  if (!bm) return;
  const folderId = folderIdOrEmpty || null;
  const next = {
    ...bm,
    folderId,
    updatedAt: new Date().toISOString(),
  };
  chrome.storage.sync.set(
    { [BOOKMARK_KEY_PREFIX + bookmarkId]: next },
    () => {
      if (handleStorageError()) {
        showTransientStatus(
          bmDetailStatus,
          t("bmSaveFailed") || "Could not save changes",
          "error",
          "bm-status",
        );
        return;
      }
      bmBookmarks[bookmarkId] = next;
      const label = folderId
        ? bmFolders[folderId]?.name || ""
        : t("bmUncategorized") || "Uncategorized";
      showTransientStatus(
        bmDetailStatus,
        t("bmDetailMovedTemplate", [label]) || `Moved to ${label}`,
        "success",
        "bm-status",
      );
    },
  );
}

function flushNoteDebounce() {
  if (bmNoteDebounceTimer) {
    clearTimeout(bmNoteDebounceTimer);
    bmNoteDebounceTimer = null;
    commitNoteNow();
  }
}

function scheduleNoteSave() {
  if (bmNoteDebounceTimer) clearTimeout(bmNoteDebounceTimer);
  showTransientStatus(
    bmNoteStatus,
    t("bmDetailNoteSaving") || "Saving…",
    "",
    "bm-status",
  );
  bmNoteDebounceTimer = setTimeout(() => {
    bmNoteDebounceTimer = null;
    commitNoteNow();
  }, NOTE_DEBOUNCE_MS);
}

function commitNoteNow() {
  const id = bmState.bookmarkId;
  if (!id) return;
  const bm = bmBookmarks[id];
  if (!bm) return;
  const value = bmDetailNote.value.slice(0, NOTE_MAX);
  if (value === (bm.note || "")) {
    bmNoteStatus.textContent = "";
    bmNoteStatus.className = "bm-status";
    return;
  }
  const next = {
    ...bm,
    note: value,
    updatedAt: new Date().toISOString(),
  };
  bmNoteInFlight = true;
  chrome.storage.sync.set({ [BOOKMARK_KEY_PREFIX + id]: next }, () => {
    bmNoteInFlight = false;
    if (chrome.runtime.lastError) {
      handleStorageError();
      showTransientStatus(
        bmNoteStatus,
        t("bmDetailNoteSaveFailed") || "Could not save note",
        "error",
        "bm-status",
      );
      return;
    }
    bmBookmarks[id] = next;
    showTransientStatus(
      bmNoteStatus,
      t("bmDetailNoteSaved") || "Saved",
      "success",
      "bm-status",
    );
  });
}

function resetUnstarConfirm() {
  bmUnstarConfirmActive = false;
  if (bmUnstarConfirmTimer) {
    clearTimeout(bmUnstarConfirmTimer);
    bmUnstarConfirmTimer = null;
  }
  bmUnstarBtn.classList.remove("is-confirming");
  bmUnstarBtn.textContent = t("bmDetailUnstarButton") || "Unstar";
}

function handleUnstarClick() {
  if (!bmUnstarConfirmActive) {
    bmUnstarConfirmActive = true;
    bmUnstarBtn.classList.add("is-confirming");
    bmUnstarBtn.textContent =
      t("bmDetailUnstarConfirm") || "Tap again to unstar";
    bmUnstarConfirmTimer = setTimeout(
      resetUnstarConfirm,
      UNSTAR_CONFIRM_MS,
    );
    return;
  }
  resetUnstarConfirm();
  const id = bmState.bookmarkId;
  if (!id) return;
  chrome.storage.sync.remove(BOOKMARK_KEY_PREFIX + id, () => {
    if (handleStorageError()) {
      showTransientStatus(
        bmDetailStatus,
        t("bmSaveFailed") || "Could not save changes",
        "error",
        "bm-status",
      );
      return;
    }
    delete bmBookmarks[id];
    starredIds.delete(id);
    refreshStarUi();
    navTo("list", { folderId: bmState.returnFolderId || VIRTUAL_ALL });
  });
}

function openOverflowMenu() {
  bmListOverflowMenu.classList.add("is-open");
}
function closeOverflowMenu() {
  bmListOverflowMenu.classList.remove("is-open");
}

// Wire up static event listeners
bmNewFolderBtn.addEventListener("click", () => {
  showInlineFolderInput({
    placeholderKey: "bmNewFolderPlaceholder",
    onCommit: (name) => createFolder(name, null),
  });
});

bmListOverflowBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (bmListOverflowMenu.classList.contains("is-open")) {
    closeOverflowMenu();
  } else {
    openOverflowMenu();
  }
});

document.addEventListener("click", (e) => {
  if (
    bmListOverflowMenu.classList.contains("is-open") &&
    !bmListOverflowWrap.contains(e.target)
  ) {
    closeOverflowMenu();
  }
});

bmListOverflowMenu.addEventListener("click", (e) => {
  const action = e.target.closest("[data-bm-action]")?.getAttribute(
    "data-bm-action",
  );
  if (!action) return;
  closeOverflowMenu();
  const fid = bmState.folderId;
  if (!fid || isVirtualFolder(fid)) return;
  const folder = bmFolders[fid];
  if (!folder) return;

  if (action === "rename") {
    showInlineFolderInput({
      initialValue: folder.name,
      placeholderKey: "bmNewFolderPlaceholder",
      onCommit: (name) => renameFolder(fid, name),
    });
  } else if (action === "new-subfolder") {
    showInlineFolderInput({
      placeholderKey: "bmNewFolderPlaceholder",
      onCommit: (name) => createFolder(name, fid),
    });
  } else if (action === "delete") {
    showFolderDeleteConfirm(fid);
  }
});

document.querySelectorAll("[data-bm-nav-back]").forEach((btn) => {
  btn.addEventListener("click", goBack);
});

bmDetailFolder.addEventListener("change", () => {
  if (!bmState.bookmarkId) return;
  moveBookmarkToFolder(bmState.bookmarkId, bmDetailFolder.value);
});

bmDetailNote.addEventListener("input", () => {
  updateNoteCounter();
  scheduleNoteSave();
});
bmDetailNote.addEventListener("blur", () => {
  if (bmNoteDebounceTimer) {
    clearTimeout(bmNoteDebounceTimer);
    bmNoteDebounceTimer = null;
    commitNoteNow();
  }
});

bmDetailOpenChatBtn.addEventListener("click", () => {
  const id = bmState.bookmarkId;
  if (!id) return;
  chrome.tabs.create({ url: `https://chatgpt.com/c/${id}` });
});

bmUnstarBtn.addEventListener("click", handleUnstarClick);

bmUnstarAllBtn.addEventListener("click", () => {
  showUnstarAllConfirm(bmState.folderId);
});

bmManageShortcutBtn.addEventListener("click", () => {
  setActiveTab("bookmarksPanel");
  if (currentChatId && starredIds.has(currentChatId) && bmBookmarks[currentChatId]) {
    navTo("detail", {
      bookmarkId: currentChatId,
      returnFolderId:
        bmBookmarks[currentChatId].folderId || VIRTUAL_ALL,
    });
  } else {
    navTo("folders", { folderId: null, bookmarkId: null });
  }
});
