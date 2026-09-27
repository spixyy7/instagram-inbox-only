# Instagram — Inbox Only

A simple local extension for Chrome and Edge. No build step or dependencies required.

## Installation

1. Open `chrome://extensions` in Chrome (or `edge://extensions` in Edge).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `instagram-inbox-only` folder containing `manifest.json`.
5. Refresh any open Instagram tabs.

Click the extension icon to open https://www.instagram.com/direct/inbox/.

## Behavior

- Allows `/direct/*`: your inbox, conversations, message requests, and new conversations.
- Allows `/call/*`: separate audio and video call windows, without redirecting them to the inbox or hiding call controls.
- Redirects other Instagram pages, including the feed, Reels, Explore, posts, Stories, and profiles, to the inbox.
- Hides links to those sections and common main navigation buttons.
- Clicking an Instagram post or profile link within a conversation keeps you in that conversation.
- External links and message content remain accessible.
- Login, logout, password recovery, and account verification pages remain accessible so you can sign in.
- Redirect rules only apply to main-frame navigation; they do not block API requests, images, or attachments needed for messaging.
- The extension does not store or transmit messages or data. Its access is limited to Instagram domains.
- To temporarily disable the extension, use its toggle on the extensions page.

Navigation hiding uses link URLs and accessible control labels in English and Serbian.
Instagram may change its layout or labels; page redirects work independently of them.
Media and post previews shared in a conversation remain visible as part of the message.
This is a focus aid, not a safeguard against manually disabling the extension.

## Testing and updating

After changing the local extension, click **Reload** on `chrome://extensions`
(or `edge://extensions`), then refresh your Instagram tab and reopen the call window.

Run the regression checks without additional dependencies: `node --test tests/*.test.cjs`.
They check allowed routes, network rules, navigation events, and clicks.
Test actual audio and video calls while signed in to an Instagram account.

## Sources

- https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
- https://developer.chrome.com/docs/extensions/reference/api/webNavigation
- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts

## License

Licensed under the [MIT License](LICENSE). You may use, modify, and redistribute this extension, including commercially, provided you retain the copyright and license notice.
