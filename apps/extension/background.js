// apps/extension/background.js: the toolbar button opens Leave a Map in its own tab.
chrome.action.onClicked.addListener(() => { chrome.tabs.create({ url: chrome.runtime.getURL('index.html') }); });
