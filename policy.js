(() => {
  const allowed = new RegExp("^https?://([a-z0-9-]+\\.)*instagram\\.com/((direct|call)(/|[?#]|$)|accounts/(login|logout|password|two_factor_login|onetap|login_help)(/|[?#]|$)|challenge(/|[?#]|$)|checkpoint(/|[?#]|$))");
  globalThis.InboxOnly = Object.freeze({
    inbox: "https://www.instagram.com/direct/inbox/",
    isInstagram(value) {
      try {
        const url = new URL(value);
        return /^https?:$/.test(url.protocol) &&
          (url.hostname === "instagram.com" || url.hostname.endsWith(".instagram.com"));
      } catch { return false; }
    },
    isAllowed(value) { return allowed.test(value); },
    isMessaging(value) { return this.isDirect(value) || this.isCall(value); },
    isCall(value) {
      try { return this.isInstagram(value) && /^\/call(?:\/|$)/.test(new URL(value).pathname); }
      catch { return false; }
    },
    isDirect(value) {
      try { return this.isInstagram(value) && /^\/direct(?:\/|$)/.test(new URL(value).pathname); }
      catch { return false; }
    }
  });
})();
