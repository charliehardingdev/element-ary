// Create context menu item on extension install
chrome.runtime.onInstalled.addListener(() => {
  // Remove existing menu if it exists (handles reloads)
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
      console.error("Error removing context menus:", errorMsg);
    }
    
    chrome.contextMenus.create({
      id: "copyElementInfo",
      title: "Element-ary Copy",
      contexts: ["all"]
    }, () => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
        console.error("Error creating context menu:", errorMsg);
      } else {
        console.log("Context menu created successfully");
      }
    });
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  try {
    if (info.menuItemId === "copyElementInfo") {
      // Safely check if tab is valid and has required properties
      if (!tab) {
        console.error("Invalid tab: tab object is null or undefined");
        return;
      }
      
      if (typeof tab.id === 'undefined' || tab.id === null) {
        console.error("Invalid tab: tab.id is missing");
        return;
      }
      
      if (!tab.url || typeof tab.url !== 'string') {
        console.error("Invalid tab: tab.url is missing or invalid");
        return;
      }
      
      // Filter out pages where content scripts cannot run
      const restrictedUrls = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'moz-extension://'];
      if (restrictedUrls.some(prefix => tab.url.startsWith(prefix))) {
        console.warn("Content scripts cannot run on this page type:", tab.url);
        return;
      }
      
      // Safely extract coordinates (may be undefined)
      const clickX = typeof info.pageX !== 'undefined' ? info.pageX : undefined;
      const clickY = typeof info.pageY !== 'undefined' ? info.pageY : undefined;
      
      // Send message to content script to get element info and copy it
      chrome.tabs.sendMessage(tab.id, {
        action: "getElementInfo",
        clickX: clickX,
        clickY: clickY
      }, (response) => {
      if (chrome.runtime.lastError) {
        // chrome.runtime.lastError.message is always a string when lastError exists
        const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
        console.error("Error sending message to content script:", errorMsg);
        
        // Common error: content script not loaded (e.g., chrome:// pages, extensions pages)
        if (errorMsg.includes("Could not establish connection") || 
            errorMsg.includes("Receiving end does not exist")) {
          console.warn("Content script may not be loaded on this page. Try refreshing the page.");
        }
        return;
      }
      
      if (response && response.success) {
        console.log("Element info copied successfully", response.fallback ? "(using fallback method)" : "");
      } else {
        // Safely extract error message (handle both string and object errors)
        let errorMsg = "Unknown error";
        if (response?.error) {
          if (typeof response.error === 'string') {
            errorMsg = response.error;
          } else if (response.error.message) {
            errorMsg = response.error.message;
          } else {
            errorMsg = JSON.stringify(response.error);
          }
        }
        console.error("Failed to get element info:", errorMsg);
      }
    });
    }
  } catch (error) {
    // Catch any unexpected errors and log them safely
    const errorMsg = error instanceof Error ? error.message : 
                     (typeof error === 'string' ? error : JSON.stringify(error));
    console.error("Unexpected error in context menu handler:", errorMsg);
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
  }
});
