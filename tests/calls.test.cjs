const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const source = name => readFileSync(path.join(root, name), "utf8");
const context = vm.createContext({ URL });
vm.runInContext(source("policy.js"), context);
const policy = context.InboxOnly;
const rules = JSON.parse(source("rules.json"));
const origin = "https://www.instagram.com";
const allowedPaths = [
  "/direct/inbox/", "/direct/t/123/", "/direct/new/", "/direct/requests/",
  "/call", "/call/", "/call/?has_video=false", "/call/?has_video=true&thread_id=123",
  "/call/123/?has_video=true", "/call#controls",
  "/accounts/login/", "/accounts/two_factor_login/", "/challenge/", "/checkpoint/"
];
const blockedPaths = [
  "/", "/explore/", "/reels/", "/stories/user/", "/p/123/", "/some_profile/",
  "/calling/", "/callback/", "/call-me/", "/Call/", "/directly/", "/accounts/edit/"
];
function networkAction(url, resourceType = "main_frame") {
  const host = new URL(url).hostname;
  return rules.filter(({ condition: c }) =>
    c.resourceTypes.includes(resourceType) &&
    c.requestDomains.some(domain => host === domain || host.endsWith(`.${domain}`)) &&
    (!c.regexFilter || new RegExp(c.regexFilter, c.isUrlFilterCaseSensitive ? "" : "i").test(url))
  ).sort((a, b) => b.priority - a.priority)[0]?.action.type;
}

test("call, message and authentication routes survive every navigation policy", () => {
  for (const pathname of allowedPaths) {
    const url = origin + pathname;
    assert.equal(policy.isAllowed(url), true, url);
    assert.equal(networkAction(url), "allow", url);
  }
});

test("feed, profiles and call-like prefixes stay blocked", () => {
  for (const pathname of blockedPaths) {
    const url = origin + pathname;
    assert.equal(policy.isAllowed(url), false, url);
    assert.equal(networkAction(url), "redirect", url);
  }
});

test("calls are messaging destinations but retain a separate page mode", () => {
  assert.equal(policy.isCall(origin + "/call/?has_video=true"), true);
  assert.equal(policy.isMessaging(origin + "/call/?has_video=false"), true);
  assert.equal(policy.isDirect(origin + "/call/"), false);
  assert.equal(policy.isCall("https://instagram.com.evil.example/call/"), false);
  assert.equal(policy.isCall("https://example.com/call/"), false);
  assert.equal(policy.isAllowed("https://instagram.com.evil.example/call/"), false);
  assert.equal(policy.isAllowed("not a URL"), false);
  assert.equal(policy.isCall("not a URL"), false);
});

test("network rules leave external sites, subframes and call API requests alone", () => {
  assert.equal(networkAction("https://example.com/call/"), undefined);
  assert.equal(networkAction(origin + "/api/v1/video_call/", "xmlhttprequest"), undefined);
  assert.equal(networkAction(origin + "/call/", "sub_frame"), undefined);
});

async function backgroundNavigation(eventUrl, currentUrl = eventUrl, frameId = 0) {
  const handlers = {}, updates = [];
  const chrome = {
    tabs: { get: async () => ({ url: currentUrl }), update: async (...args) => updates.push(args) },
    webNavigation: {
      onCommitted: { addListener: fn => { handlers.committed = fn; } },
      onHistoryStateUpdated: { addListener: fn => { handlers.history = fn; } }
    },
    action: { onClicked: { addListener() {} } }
  };
  const ctx = vm.createContext({ URL, chrome });
  ctx.importScripts = name => vm.runInContext(source(name), ctx);
  vm.runInContext(source("background.js"), ctx);
  for (const handler of Object.values(handlers)) await handler({ tabId: 7, frameId, url: eventUrl });
  return updates;
}

test("popup and SPA call navigations are not redirected by the service worker", async () => {
  for (const pathname of ["/call/", "/call/?has_video=false", "/call/?has_video=true"]) {
    assert.deepEqual(await backgroundNavigation(origin + pathname), []);
  }
  // A stale feed event must not interrupt a newer call popup navigation.
  assert.deepEqual(await backgroundNavigation(origin + "/", origin + "/call/"), []);
  assert.deepEqual(await backgroundNavigation(origin + "/", origin + "/", 1), []);
  assert.equal((await backgroundNavigation(origin + "/reels/")).length, 2);
});

function contentPage(pagePath, linkPath) {
  const events = {}, redirects = [];
  class Element {
    constructor(href) { this.attributes = new Map(href ? [["href", href]] : []); }
    get href() { return new URL(this.getAttribute("href"), origin + pagePath).href; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    matches(selector) { return selector === "a[href]" && this.hasAttribute("href"); }
    closest(selector) {
      if (selector.startsWith("nav")) return {};
      return selector.startsWith("a,") && this.hasAttribute("href") ? this : null;
    }
    querySelectorAll() { return []; }
  }
  const html = new Element(), link = new Element(linkPath);
  html.querySelectorAll = () => [link];
  const ctx = vm.createContext({
    URL, Element, location: { href: origin + pagePath, replace: url => redirects.push(url) },
    document: { documentElement: html, addEventListener: (name, fn) => { events[name] = fn; } },
    window: { addEventListener() {} }, MutationObserver: class { observe() {} }
  });
  vm.runInContext(source("policy.js"), ctx);
  vm.runInContext(source("content.js"), ctx);
  function click(type = "click") {
    const result = { prevented: false, stopped: false };
    events[type]({ composedPath: () => [link], preventDefault: () => { result.prevented = true; }, stopImmediatePropagation: () => { result.stopped = true; } });
    return result;
  }
  return { html, link, redirects, click };
}

test("voice/video call links in the inbox remain visible and clickable", () => {
  for (const path of ["/call/?has_video=false", "/call/?has_video=true"]) {
    const page = contentPage("/direct/t/123/", path);
    assert.equal(page.link.hasAttribute("data-inbox-only-hidden"), false);
    assert.deepEqual(page.click(), { prevented: false, stopped: false });
    assert.deepEqual(page.click("auxclick"), { prevented: false, stopped: false });
    assert.deepEqual(page.redirects, []);
  }
});

test("call pages retain their controls while profile links in conversations stay blocked", () => {
  const call = contentPage("/call/?has_video=true", "/");
  assert.equal(call.html.getAttribute("data-inbox-only-mode"), "call");
  assert.equal(call.link.hasAttribute("data-inbox-only-hidden"), false);
  assert.deepEqual(call.redirects, []);
  const profile = contentPage("/direct/t/123/", "/some_profile/");
  assert.deepEqual(profile.click(), { prevented: true, stopped: true });
  const blocked = contentPage("/reels/", "/direct/inbox/");
  assert.equal(blocked.html.getAttribute("data-inbox-only-mode"), "blocked");
  assert.deepEqual(blocked.redirects, [policy.inbox]);
});
