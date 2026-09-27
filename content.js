(() => {
  const policy = globalThis.InboxOnly;
  let redirecting = false;
  const navigationLabels = new Set([
    "instagram", "home", "search", "explore", "reels", "notifications",
    "new post", "create", "profile", "settings", "more", "threads",
    "početna", "pocetna", "pretraga", "istraži", "istrazi",
    "obaveštenja", "obavestenja", "novi post", "kreiraj",
    "profil", "podešavanja", "podesavanja", "više", "vise",
    "почетна", "претрага", "истражи", "обавештења", "профил", "више"
  ]);

  function enforceLocation() {
    const allowed = policy.isAllowed(location.href);
    // A call popup needs its own mode: preserve every call control and layout.
    const mode = !allowed ? "blocked" : policy.isDirect(location.href) ? "direct" :
      policy.isCall(location.href) ? "call" : "auth";
    if (document.documentElement?.getAttribute("data-inbox-only-mode") !== mode) {
      document.documentElement?.setAttribute("data-inbox-only-mode", mode);
    }
    if (!allowed && !redirecting) {
      redirecting = true;
      location.replace(policy.inbox);
    }
    return mode === "direct";
  }

  function hide(element) {
    if (element && !element.hasAttribute("data-inbox-only-hidden")) {
      element.setAttribute("data-inbox-only-hidden", "");
    }
  }

  function inspect(element) {
    if (element.matches("a[href]")) {
      const url = new URL(element.getAttribute("href"), location.href);
      if (policy.isInstagram(url.href) && !policy.isMessaging(url.href)) {
        // Hide non-message/non-call destinations in navigation, but keep message cards readable.
        if (element.closest('nav, [role="navigation"], header') ||
            /^\/(explore|reels|create)\/?$/.test(url.pathname) ||
            url.pathname === "/") hide(element);
      }
    }
    const label = element.getAttribute("aria-label") || element.getAttribute("alt") || "";
    if (!navigationLabels.has(label.trim().toLowerCase())) return;
    const control = element.closest('a, button, [role="button"], [role="link"]');
    // Preserve search/profile controls inside a conversation.
    if (control && !control.closest('main, [role="main"], [role="dialog"]') &&
        !(control.matches("a[href]") && policy.isMessaging(control.href))) hide(control);
  }

  function scan(root) {
    if (!(root instanceof Element)) return;
    inspect(root);
    for (const element of root.querySelectorAll("a[href], [aria-label], img[alt]")) inspect(element);
  }

  function preventDistraction(event) {
    if (!policy.isDirect(location.href)) return;
    const link = event.composedPath().find(node => node instanceof Element && node.matches("a[href]"));
    if (!link) return;
    const url = new URL(link.getAttribute("href"), location.href);
    if (policy.isInstagram(url.href) && !policy.isMessaging(url.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      // Stay in the current conversation when a blocked link is clicked.
    }
  }

  document.addEventListener("click", preventDistraction, true);
  document.addEventListener("auxclick", preventDistraction, true);
  window.addEventListener("popstate", () => {
    if (enforceLocation()) scan(document.documentElement);
  });
  window.addEventListener("pageshow", () => {
    if (enforceLocation()) scan(document.documentElement);
  });

  const observer = new MutationObserver(records => {
    if (!enforceLocation()) return;
    for (const record of records) {
      if (record.type === "attributes") {
        const control = record.target.closest('a, button, [role="button"], [role="link"]');
        control?.removeAttribute("data-inbox-only-hidden");
        scan(control || record.target);
      }
      for (const node of record.addedNodes) scan(node);
    }
  });
  observer.observe(document, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ["href", "aria-label", "alt"]
  });
  if (enforceLocation()) scan(document.documentElement);
})();
