// Background script for the Chrome extension
// This handles events when the extension is not open

// Listen for tab updates to keep the open tabs list current
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Send a message to the newtab page if it's open
    chrome.runtime.sendMessage({
      type: 'TAB_UPDATED',
      payload: tab
    }).catch(() => {
      // Newtab page is not open, ignore the error
    });
  }
});

// Listen for tab removals
chrome.tabs.onRemoved.addListener((tabId) => {
  // Send a message to the newtab page if it's open
  chrome.runtime.sendMessage({
    type: 'TAB_REMOVED',
    payload: { tabId }
  }).catch(() => {
    // Newtab page is not open, ignore the error
  });
});

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First time installation
    chrome.storage.local.set({
      linkSaverData: JSON.stringify({
        workspaces: [
          {
            name: 'Default Workspace',
            categories: [
              {
                name: 'General',
                links: []
              }
            ]
          }
        ],
        activeWorkspace: 0,
        activeCategory: 0,
        theme: 'light'
      })
    });
  }
});
