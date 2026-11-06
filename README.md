# SignalSutra Guide

Installable PWA: static files only (index.html, privacy.html, manifest.webmanifest, sw.js, icons/). Data: Binance public market data, fetched by the visitor's browser. Educational tool, not financial advice. Not affiliated with Binance.

## Tests

The pure engine and view-model functions are extracted from `index.html` and tested in plain Node (22+), no dependencies:

```
node --test
```

- `tests/regression.test.js` proves `analyse` / `planCore` outputs and the protected calculation, alert and AI-request source are identical to base commit `eee5880` on fixed synthetic candles (`tests/fixtures/baseline-eee5880.json`, regenerate with `node tests/make-baseline.js`).
- `tests/explain.test.js` covers the read-only card model and plain-English explanation.
- `tests/ai-request.test.js` checks the AI quick-check request shape with a mocked `fetch` (the worker is never called).

## Privacy

See [privacy.html](privacy.html): settings stay on the device (localStorage), Binance public data is fetched by the browser, the optional AI quick check sends only the selected zone's values to the owner's Cloudflare Worker, and there are no accounts, ads or tracking. Fill in the contact line before publishing.

## Publishing to Google Play later

Nothing here has been submitted anywhere. When the owner decides to publish:

1. **Wrap the PWA as a Trusted Web Activity (TWA).** Use [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) (`npx @bubblewrap/cli init --manifest https://akshayd7.github.io/signalsutra/manifest.webmanifest`) or [PWABuilder](https://www.pwabuilder.com/) (Android package). Both read `manifest.webmanifest` (name, icons incl. maskable, colors, start URL, scope).
2. **Choose a package id** (for example `io.github.akshayd7.signalsutra`) and let the tool create the signing key. Keep the keystore and its passwords safe and private; never commit them.
3. **Digital Asset Links.** After the package id and signing key exist, publish `/.well-known/assetlinks.json` on the site with the package id and the SHA-256 fingerprint of the signing certificate (with Play App Signing, use the fingerprint shown in Play Console). This file is intentionally **not** in the repo yet. Note: on a GitHub Pages project site the file must be served from the domain root (`https://akshayd7.github.io/.well-known/assetlinks.json`, i.e. the `akshayd7.github.io` user-site repo) or from a custom domain, otherwise the app shows a browser address bar.
4. **Play Console.** Creating a developer account needs a one-time registration fee, paid by the owner. Then upload the signed `.aab`, add the store listing (screenshots, description), the privacy policy URL (`https://akshayd7.github.io/signalsutra/privacy.html`), the Data safety form (answer it accurately: no accounts, ads or analytics; the optional AI quick check sends the selected zone's market values, not personal data, to the owner's worker), and complete the financial-features and content declarations. Keep the "educational, not financial advice" positioning.
