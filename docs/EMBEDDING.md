# Embedding Slotwell on another site

## Link (works today)

```html
<a href="https://slotwell.app/iamprashanta/30min?theme=dark&topic=cloud-migration">Book a call</a>
```

## Iframe (inline or in a modal)

```html
<iframe src="https://slotwell.app/embed/iamprashanta/30min?theme=dark" title="Book a call" style="width:100%;border:0;height:720px"></iframe>
```

Requirements:

- The host origin must be listed in Slotwell's `EMBED_ALLOWED_ORIGINS` (sent as CSP `frame-ancestors` on `/embed/*` only).
- The host must allow Slotwell in its own `frame-src` CSP.

## Messages to the host page

The embed posts these with `window.parent.postMessage`. Check `event.origin` before trusting them.

| Message | When |
| --- | --- |
| `{ type: "booking:height", height }` | Whenever the content height changes — resize the iframe |
| `{ type: "booking:confirmed" }` | After a successful booking |

## prashanta.dev

Already wired: `src/config/site.ts` → `booking.url` and `booking.embedEnabled`. Once Slotwell is live on its final domain, set `embedEnabled: true` and update `frame-src` in prashanta.dev's `next.config.ts` if the domain changed.
