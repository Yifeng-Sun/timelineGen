# Duckline

Get your ducks in a row. A visual timeline generator that turns events into beautiful, exportable graphics.

Built with React 19, D3.js, TypeScript, and Vite.

## Features

### Timeline Items
- **Events** — Single-point markers on the timeline
- **Periods** — Date ranges shown as rounded bars spanning start to end
- **Notes** — Lightweight annotations attached to a date

### Visual Customization
- **Themes** — Modern Clean, Midnight Sky, Rose Gold, Emerald Forest
- **Fonts** — Inter, Playfair Display, Space Mono, Caveat, Georgia, System
- **Aspect ratios** — 16:9, 3:2, 4:3, 1:1, 4:5, 9:16
- **Content size** — Scale all elements up or down (0.5x to 2.0x)
- **Content position** — Horizontal and vertical sliders to nudge the timeline within the canvas
- **Zoom** — Scroll to zoom the preview (0.5x to 3.0x)

### Social Media Carousel
- Split your timeline across 1-10 slides for Instagram, TikTok, LinkedIn, etc.
- Swipe or drag between slides in the live preview
- **No duck left behind** — Automatic label repositioning to prevent text from splitting across slide boundaries
- Exports each slide as an individual PNG

### Smart Layout
- **Collision avoidance** — Labels automatically stack to avoid overlapping
- **Smart date labels** — Automatically simplifies dates when all items share a common day or year
- **Gap compression** — Shrinks long empty stretches to keep things readable
- **Boundary snapping** — In carousel mode, labels snap to stay within slide edges

### Editing
- **Inline editing** — Click any label on the preview to rename it directly
- **Add items** — Quick form to create events, periods, and notes with date and time pickers
- **JSON editor** — Bulk-edit your entire timeline as JSON
- **Delete items** — Remove individual items or clear the whole timeline

### Export
- **PNG** — Single image download
- **SVG** — Vector format for further editing
- **Carousel** — Downloads each slide as a separate PNG

### Cloud Sync (Remote Pond)
- Sign in to save timelines to the cloud
- Push local timelines to your remote pond
- Pull saved timelines back to any browser
- Timelines are also saved to localStorage automatically

## Project Structure

```
timelineGen/           Frontend (this directory)
  App.tsx              Main app component, state management, carousel logic
  types.ts             TypeScript types, themes, fonts, aspect ratios
  components/
    TimelinePreview.tsx  SVG rendering, D3 scales, layout engine
    ControlPanel.tsx     Sidebar controls
    AddItemPanel.tsx     Item creation form + JSON editor
  utils/
    dateUtils.ts         Date parsing and formatting helpers
  lib/
    api.ts               Cloud sync API client

duckline-api/          Backend API (separate Next.js project)
```

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

## Future Work

- **Drag-to-adjust dates** — Drag items on the preview to change their date/time directly
- **AI voice input** — Add timeline items by speaking naturally (e.g. "meeting with Sarah last Tuesday at 3pm")
- **Collaborative editing** — Real-time multi-user editing on shared timelines
- **Custom themes** — User-defined color palettes and background images
- **Timeline templates** — Pre-built layouts for common use cases (project plans, historical events, trip itineraries)
- **Undo/redo** — Step back and forward through edits
- **Transparent background export** — Export PNGs with no background for easy layering in other design tools

## Tech Stack

- [React 19](https://react.dev) — UI framework
- [D3.js](https://d3js.org) — Date scales and data-driven layout
- [TypeScript](https://www.typescriptlang.org) — Type safety
- [Vite](https://vite.dev) — Dev server and build tooling
- [Tailwind CSS](https://tailwindcss.com) — Styling (via CDN)

## Author

**Yifeng Sun** — [yifengsun.com](https://yifengsun.com)

---

<sub>**Privacy** — Duckline stores timeline data in your browser's localStorage. Cloud sync requires sign-in and transmits data to our servers solely for storage and retrieval. We do not sell, share, or use your data for advertising. You may delete your account and all associated data at any time.</sub>

<sub>**Disclaimer** — Duckline is provided "as is" without warranty of any kind. The authors are not liable for any damages, data loss, or issues arising from the use of this software. Use at your own discretion.</sub>
