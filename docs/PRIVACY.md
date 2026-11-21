# Privacy: what we claim and how we tested it

## The claim

**While Leave a Map reads your mailbox, the page that reads it makes no network requests.** Your mail is read in your browser, in a Worker, on the scan site. Gemini Nano (lane 2) runs on the device. The only thing that ever leaves is a sender's web address, such as `forkyard.example`, and only after you tick it in a separate consent window on a second site (lane 3).

That is the whole claim. It doesn't cover your browser's own background traffic, such as updates and sign-in, which happens with or without this page. It doesn't cover the second site after you approve a lookup either.

## How the scan page is locked down

| Layer | What it does |
|---|---|
| **CSP** `connect-src 'none'` | Blocks `fetch`, XHR, WebSocket, EventSource and beacons from the page and its Worker |
| **CSP** `frame-src 'none'; object-src 'none'; form-action 'none'` | No embedded pages, plugins or form posts |
| **CSP** `require-trusted-types-for 'script'; trusted-types default` | HTML strings can't become DOM (`innerHTML`, `DOMParser`, `document.write`, `srcdoc`). The only policy allows same-origin script URLs, which the scan Worker needs |
| **`lockdown.ts`**, the first import | Deletes `RTCPeerConnection`, `webkitRTCPeerConnection` and `RTCDataChannel`, because CSP has no working WebRTC rule. Refuses to create `iframe`, `frame`, `object`, `embed` and similar elements: a same-origin `about:blank` frame would bring a fresh copy of WebRTC. Lets `window.open` open only other sites (the consent window) |
| **No reporting** | The CSP has no `report-uri` or `report-to`, so violations are logged on the page only and never sent |

`tests/unit/lockdown.test.ts` checks that `lockdown.ts` is the first import and that the CSP keeps these rules.

## The test (T25), Sat 21 Nov 2026

Run with `tools/capture-test.mjs` on the Nano machine (kaakserver: Ubuntu, Chrome 158, Gemini Nano available). It serves the built scan site with the exact Firebase Hosting headers. Chrome records its own network log (`--log-net-log`). A UDP listener on port 3478 stands in for a STUN server and counts packets. No root access is needed.

### WebRTC (STUN packets to the listener)

| Case | Before the fix | After |
|---|---:|---:|
| Plain page with no CSP (control: proves the listener works) | 4 | 4 |
| Scan page, `new RTCPeerConnection(...)` | 0 (constructor removed) | 0 |
| Scan page, through a same-origin `about:blank` iframe | **4** | **0** (iframe refused) |
| Same, with CSP `webrtc 'block'` added | **4** (Chrome ignores the rule) | 0 |
| Other routes to a fresh window: `innerHTML`, `DOMParser`, `createElementNS`, another document, `window.open('about:blank')` | not tested | all refused |
| **During a full scan of the sample plus on-device labelling** | – | **0** |

### Network capture of a full run

The sample mailbox (55 emails) scanned in 27 ms. Then Gemini Nano labelled 21 of 21 accounts on-device (median 841 ms each).

| Measure | Result |
|---|---:|
| Requests the scan page made to anything other than itself (Chrome's net log, by network isolation key) | **0** |
| Same, seen by DevTools (one `data:` icon, which isn't a network request) | 0 |
| Control: a test page's single request to `example.com` was found and attributed to that page | yes |
| Chrome's own background requests in the same window (not from the page) | 17, to Chrome's update, sign-in, autofill and model-component services |

## Known limit

A window that the scan page opens on another site could, in principle, be sent to `about:blank` by script on the scan page and then used for WebRTC. Doing that needs code running in the scan page. The CSP allows only our own bundled scripts (`script-src 'self'`, no inline script), and the open needs a click. We don't claim protection against a malicious build of this app itself. The code is public, so anyone can check it.

## Reproduce

```bash
npm run build
node tools/capture-test.mjs dist/scan firebase.json <a Chrome profile dir> [--no-nano]
```

It prints a JSON summary. The raw net log is deleted at the end.
