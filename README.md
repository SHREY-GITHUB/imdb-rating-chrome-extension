# StreamDB — IMDB Ratings for Prime Video & Hotstar

> Hover any title on Prime Video or JioHotstar and instantly see its IMDB rating — right on the thumbnail.

![StreamDB Banner](docs/banner.png)

---

## What It Does

**StreamDB** is a lightweight Chrome/Arc extension that overlays IMDB ratings on movie and show thumbnails while you browse Prime Video and JioHotstar. No more opening a new tab to check ratings before watching.

- **Prime Video** — hover any card → rating badge appears top-right of the thumbnail
- **JioHotstar** — move cursor over any card → rating badge tracks the card, even as it expands
- **Click the badge** → opens the full IMDB page for that title
- **7-day cache** — ratings are cached locally so repeat visits are instant and don't burn API quota

---

## Screenshots

| Prime Video | JioHotstar |
|---|---|
| ![Prime](docs/prime-screenshot.png) | ![Hotstar](docs/hotstar-screenshot.png) |

---

## Installation (Manual / Developer Mode)

Chrome Web Store listing coming soon. Until then, install manually:

1. Download the latest release ZIP from [Releases](../../releases)
2. Unzip it to a folder on your computer
3. Open Chrome or Arc and go to `chrome://extensions`
4. Toggle **Developer mode** ON (top right)
5. Click **Load unpacked** → select the unzipped folder
6. Done — visit Prime Video or JioHotstar and start hovering

---

## How It Works

```
User hovers a thumbnail
        ↓
Content script extracts title from DOM
        ↓
Sends message to background service worker
        ↓
Service worker checks local cache
  → Cache hit: returns immediately
  → Cache miss: fetches from OMDb API
        ↓
Rating returned → badge injected/updated on page
```

**Tech stack:**
- Manifest V3 Chrome Extension
- Vanilla JS — no frameworks, no build step
- [OMDb API](https://www.omdbapi.com/) for rating data
- Shadow DOM for Hotstar badge isolation
- `chrome.storage.local` for 7-day rating cache

---

## Files

```
imdb-extension/
├── manifest.json      # Extension config (MV3)
├── background.js      # Service worker — handles OMDb API fetches + caching
├── content.js         # Content script — DOM injection, hover detection
├── content.css        # Badge styles for Prime Video
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## API Key

This extension uses the [OMDb API](https://www.omdbapi.com/). The free tier allows 1,000 requests/day, which is plenty for personal use.

To use your own API key:
1. Register free at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx)
2. Open `background.js` and replace the key on line 4:
   ```js
   const OMDB_API_KEY = "your_key_here";
   ```

---

## Limitations

- **Regional Indian films** (e.g. Happy Raj, Matka King) may not appear in OMDb's database — OMDb skews toward mainstream content
- Ratings are sourced from OMDb which pulls from IMDB — they may occasionally lag behind IMDB's live data by a few days
- Works on `primevideo.com`, `amazon.com/gp/video`, and `hotstar.com`

---

## Privacy

StreamDB does **not**:
- Collect any user data
- Track browsing history
- Send any personal information anywhere

The only external request made is to `api.omdbapi.com` with the movie/show title to fetch its rating. See the full [Privacy Policy](https://YOUR_USERNAME.github.io/streamdb-extension/privacy).

---

## Contributing

PRs welcome. Common improvements:
- Add support for Netflix, Apple TV+, Disney+
- Add Rotten Tomatoes score alongside IMDB
- Improve title matching for regional Indian content

---

## License

MIT — do whatever you want with it.

---

*Built with Claude. Powered by OMDb.*
