// Bridge script - runs in ISOLATED world with access to chrome.storage
// Communicates with main.js via window messages

const defaultSettings = {
  dateFormat: "locale",
  displayMode: "created",
  hoverMode: "swap",
  chatTimestampEnabled: true,
  chatTimestampPosition: "center",
  sidebarFilterMode: "all",
  bookmarkSchemaVersion: 2,
};

const BOOKMARK_KEY_PREFIX = "bm_";
const BOOKMARK_SCHEMA_VERSION = 2;

const i18nTemplates = {
  scrollToTurnSuccessTemplate: chrome.i18n.getMessage(
    "scrollToTurnSuccessTemplate",
  ),
  scrollToTurnNotFoundTemplate: chrome.i18n.getMessage(
    "scrollToTurnNotFoundTemplate",
  ),
  exportChatContainerMissing: chrome.i18n.getMessage(
    "exportChatContainerMissing",
  ),
  exportNoMessages: chrome.i18n.getMessage("exportNoMessages"),
  exportExtractFailed: chrome.i18n.getMessage("exportExtractFailed"),
  exportFailedTemplate: chrome.i18n.getMessage("exportFailedTemplate"),
  untitledChat: chrome.i18n.getMessage("untitledChat"),
  exportCreatedLabel: chrome.i18n.getMessage("exportCreatedLabel"),
  exportRoleYou: chrome.i18n.getMessage("exportRoleYou"),
  exportRoleChatgpt: chrome.i18n.getMessage("exportRoleChatgpt"),
  exportPlaceholderImage: chrome.i18n.getMessage("exportPlaceholderImage"),
  exportPlaceholderFileTemplate: chrome.i18n.getMessage(
    "exportPlaceholderFileTemplate",
  ),
};

const requestTimedOutMessage = chrome.i18n.getMessage("requestTimedOut");

function sendSettingsToPage(settings, starredIds) {
  window.postMessage(
    {
      type: "TIMESTAMP_SETTINGS_UPDATE",
      settings: { ...settings, starredIds },
      i18n: i18nTemplates,
    },
    window.location.origin,
  );
}

function extractStarredIds(allStorage) {
  const ids = [];
  for (const key in allStorage) {
    if (
      key.startsWith(BOOKMARK_KEY_PREFIX) &&
      allStorage[key] &&
      typeof allStorage[key] === "object"
    ) {
      ids.push(key.slice(BOOKMARK_KEY_PREFIX.length));
    }
  }
  return ids;
}

// Migrate old hoverEnabled boolean to new hoverMode string
function migrateHoverEnabled(result) {
  if ("hoverEnabled" in result) {
    if (!("hoverMode" in result) || result.hoverMode === undefined) {
      result.hoverMode = result.hoverEnabled ? "swap" : "disabled";
    }
    delete result.hoverEnabled;
    chrome.storage.sync.remove("hoverEnabled");
    chrome.storage.sync.set({ hoverMode: result.hoverMode });
  }
  return result;
}

// Migrate v1 starredChats -> v2 per-bookmark bm_<id> items.
// Idempotent: if bookmarkSchemaVersion === 2 (or higher), returns same result.
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
        "[chatgpt-chats-timestamp] bookmark migration set failed:",
        chrome.runtime.lastError.message,
      );
      done(all);
      return;
    }

    const finish = () => {
      chrome.storage.sync.get(null, (fresh) => done(fresh));
    };

    if ("starredChats" in all) {
      chrome.storage.sync.remove("starredChats", finish);
    } else {
      finish();
    }
  });
}

function readAndDispatch() {
  chrome.storage.sync.get(null, (all) => {
    migrateBookmarksIfNeeded(all, (result) => {
      const withDefaults = { ...defaultSettings, ...result };
      migrateHoverEnabled(withDefaults);
      const starredIds = extractStarredIds(result);
      sendSettingsToPage(withDefaults, starredIds);
    });
  });
}

// Load and send initial settings
readAndDispatch();

// Listen for changes and forward to page
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    readAndDispatch();
  }
});

// Listen for scroll-to-turn requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_CHAT_CONTEXT") {
    sendResponse({
      success: true,
      href: window.location.href,
      title: document.title || "",
    });
    return false;
  }

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
      sendResponse({
        success: false,
        message: requestTimedOutMessage || "Request timed out",
      });
    }, 5000);

    window.addEventListener("message", responseHandler);

    window.postMessage(
      {
        type: "SCROLL_TO_TURN",
        turnIndex: message.turnIndex,
      },
      window.location.origin,
    );

    // Return true to indicate async response
    return true;
  }

  if (message.type === "EXPORT_CHAT") {
    // Forward to main.js via window message and wait for response
    const responseHandler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type === "EXPORT_CHAT_RESULT") {
        clearTimeout(timeoutId);
        window.removeEventListener("message", responseHandler);
        sendResponse(event.data.result);
      }
    };

    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", responseHandler);
      sendResponse({
        success: false,
        message: requestTimedOutMessage || "Request timed out",
      });
    }, 5000);

    window.addEventListener("message", responseHandler);

    window.postMessage(
      {
        type: "EXPORT_CHAT",
        format: message.format,
      },
      window.location.origin,
    );

    // Return true to indicate async response
    return true;
  }
});
