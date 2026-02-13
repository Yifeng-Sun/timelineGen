# Duckline

Get your ducks in a row. A visual timeline generator that turns events into beautiful, exportable graphics.

## Features

- **Timeline visualization** — Events, periods, and notes rendered on an SVG canvas
- **Multiple themes** — Modern Clean, Midnight Sky, Rose Gold, Emerald Forest
- **Font selection** — Inter, Playfair, Space Mono, Caveat, Georgia, System
- **Aspect ratio presets** — 16:9, 3:2, 4:3, 1:1, 4:5, 9:16
- **Social media carousel** — Split your timeline into multiple slides for Instagram, etc.
- **Smart date labels** — Automatically simplifies dates when all items share a day or year
- **Gap compression** — Shrinks long empty stretches to keep things readable
- **Export** — Download as PNG, SVG, or carousel slides
- **Inline editing** — Click any label to rename it directly on the preview
- **Persistent storage** — Timeline data saved to your browser automatically

## Run Locally

**Prerequisites:** Node.js

```
npm install
npm run dev
```

## Deploy

Build for production:

```
npm run build
```

Output goes to `dist/`. Works with Cloudflare Pages, Vercel, Netlify, or any static host.

## Author

**Yifeng Sun** — [yifengsun.com](https://yifengsun.com)
