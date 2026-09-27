importScripts("policy.js");

async function guardNavigation(details) {
  if (details.frameId !== 0 || !InboxOnly.isInstagram(details.url) || InboxOnly.isAllowed(details.url)) return;
  try {
    // Recheck the tab: a queued event may belong to a previous navigation.
    const tab = await chrome.tabs.get(details.tabId);
    const url = tab.pendingUrl || tab.url;
    if (InboxOnly.isInstagram(url) && !InboxOnly.isAllowed(url)) {
      await chrome.tabs.update(details.tabId, { url: InboxOnly.inbox });
    }
  } catch {
    // A closed tab needs no redirect.
  }
}

const filter = { url: [{ hostEquals: "instagram.com" }, { hostSuffix: ".instagram.com" }] };
chrome.webNavigation.onHistoryStateUpdated.addListener(guardNavigation, filter);
chrome.webNavigation.onCommitted.addListener(guardNavigation, filter);
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: InboxOnly.inbox });
});
