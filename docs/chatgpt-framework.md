# ChatGPT web framework

Checked on 2026-10-13. chatgpt.com runs on **React Router v7 in framework mode**
(version 7.15.1 at the time of checking), with server-side rendering. It no
longer runs on Remix itself. React Router v7 is Remix's successor: Remix v2 was
merged into React Router v7 in November 2024, so the architecture is the same
but the globals and package names changed.

OpenAI has not announced its frontend stack. Everything below comes from the
public page source and third-party analysis.

## What the page shows

Taken from the logged-out `https://chatgpt.com/` HTML and the scripts it loads.
`window.__remixContext` was also `false` in the console on a signed-in page.

| Check | Result |
| --- | --- |
| `window.__remixContext`, `window.__remixManifest` | Not present |
| `window.__NEXT_DATA__`, `/_next/static/` assets | Not present |
| `window.__reactRouterContext` | Set inline in the HTML, with `"ssr": true` and `"isSpaMode": false` |
| `window.__reactRouterRouteModules` | `root`, `routes/_conversation`, `routes/_conversation._index` (logged-out home page) |
| `window.__reactRouterVersion` | `"7.15.1"`, set by a shared chunk that `/cdn/assets/entry.client-*.js` imports |
| Build assets | `/cdn/assets/entry.client-*.js` and `/cdn/assets/manifest-*.js` (Remix/React Router naming) |

Asset file names are content-hashed and change with every deploy.

## Timeline

| When | Framework | Evidence |
| --- | --- | --- |
| Nov 2022 (launch) | Next.js 12, Pages Router | A December 2022 `_buildManifest.js`, cited by performance.dev |
| Late Aug to Sep 4, 2024 | Remix, on an Express server | Tibor Blaho noticed a Remix build served to some users; it then rolled out to everyone. Data was serialized into `window.__remixContext`, but little UI was rendered on the server. |
| Nov 2024 onward | React Router v7 framework mode | Remix v2 merged into React Router v7, and ChatGPT followed. The globals became `window.__reactRouter*`. |

The common explanation for leaving Next.js is that ChatGPT is mostly a
client-side app, so a server-first framework was a poor fit. This is a
third-party theory.

## How to check again

Run this in the DevTools console on chatgpt.com:

```js
({
  reactRouter: window.__reactRouterVersion,       // e.g. "7.15.1" → React Router v7
  rrContext: !!window.__reactRouterContext,       // true → React Router framework mode
  remix: !!window.__remixContext,                 // true → classic Remix
  next: !!window.__NEXT_DATA__ || !!window.next,  // true → Next.js
})
```

Or, without DevTools:

- **View source:** search for `__reactRouterContext`, `__remixContext`, or
  `__NEXT_DATA__`. Next.js assets load from `/_next/static/`.
- **Network tab:** requests with `?_data=routes/...` mean classic Remix loader
  fetches. `.data` URLs mean single fetch, which is the default in React
  Router v7.

## What this means for the extension

The extension does not read any framework globals. It reads React fiber props
from the DOM (`src/page-data.js`) and copies of the `/backend-api/` responses
ChatGPT already fetches (`src/response-data.js`). A framework change can still
rename components or change the fiber depths described in
[info.md](info.md#september-2026-react-fiber-update).

performance.dev quotes Ryan Florence (Remix co-creator) as saying ChatGPT does
most of its data loading with TanStack Query rather than React Router loaders.
That would explain why `__reactRouterContext` carries little chat data and why
reading `/backend-api/` responses is the more stable source. The original
statement could not be found, so treat it as secondhand.

## Sources

- [performance.dev: ChatGPT](https://performance.dev/chatgpt), by Dennis
  Brotzky, July 2, 2026. The most detailed teardown of the stack and its
  history. Only the parts that match the page-source check above could be
  confirmed.
- [The New Stack: Why ChatGPT Shifted From Next.js To Remix: Some
  Theories](https://thenewstack.io/why-chatgpt-shifted-from-next-js-to-remix-some-theories/),
  September 2024. News coverage of the Remix migration.
- [Remix: React Router v7](https://remix.run/blog/react-router-v7). The
  official post on merging Remix into React Router v7.
- [bytes.dev #321](https://bytes.dev/archives/321) and
  [DEV Community](https://dev.to/asif_1122se/openais-transition-from-nextjs-to-remix-a-strategic-move-in-web-development-5029).
  Lighter commentary on the 2024 switch.
