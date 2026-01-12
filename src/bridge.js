// Bridge script - runs in ISOLATED world with access to chrome.storage
// Communicates with main.js via window messages

const defaultSettings = {
  dateFormat: "locale",
  displayMode: "created",
  hoverEnabled: true,
  chatTimestampEnabled: true,
  chatTimestampPosition: "center",
};

const i18nTemplates = {
  scrollToTurnSuccessTemplate: chrome.i18n.getMessage(
    "scrollToTurnSuccessTemplate"
  ),
  scrollToTurnNotFoundTemplate: chrome.i18n.getMessage(
    "scrollToTurnNotFoundTemplate"
  ),
  exportChatContainerMissing: chrome.i18n.getMessage(
    "exportChatContainerMissing"
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
    "exportPlaceholderFileTemplate"
  ),
};

const requestTimedOutMessage = chrome.i18n.getMessage("requestTimedOut");

function sendSettingsToPage(settings) {
  window.postMessage(
    {
      type: "TIMESTAMP_SETTINGS_UPDATE",
      settings: settings,
      i18n: i18nTemplates,
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
      window.location.origin
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
      window.location.origin
    );

    // Return true to indicate async response
    return true;
  }
});
