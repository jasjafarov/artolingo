# Artolingo

A Duolingo-style course in art literacy, built as a Telegram Mini App. Starts with one unit of paintings: Impressionism to Post-Impressionism (5 lessons + checkpoint), in Russian and English.

- `content/lessons.json` — all lesson cards (edit text here).
- `content/paintings.json` — painting catalog; images are fetched from Wikimedia Commons into `images/` by the GitHub Action.
- `index.html`, `app.js`, `style.css` — the app (no build step).
- Progress is saved in Telegram Cloud Storage (and the browser), so no server is needed.
- Every push publishes the site to GitHub Pages via `.github/workflows/deploy.yml`.
