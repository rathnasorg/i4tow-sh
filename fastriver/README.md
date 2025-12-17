# i4tow

**Turn any photo folder into a beautiful, shareable gallery in seconds.**

[![npm version](https://img.shields.io/npm/v/@rathnasorg/i4tow.svg)](https://www.npmjs.com/package/@rathnasorg/i4tow)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Live Demo](https://rathnasorg.github.io/i4tow/a/i4tow-album) | [View Albums](https://rathnasorg.github.io/i4tow/p/rathnasorg)

---

## Why i4tow?

**No servers. No databases. No monthly fees. No ads.**

i4tow creates stunning photo galleries hosted on GitHub Pages - completely free, forever. One command turns your photo folder into a shareable album with a permanent link.

Perfect for:
- **Wedding photographers** sharing albums with clients
- **Event photographers** delivering photos
- **Anyone** who wants a simple way to share photo collections

---

## Install

```bash
npm install -g @rathnasorg/i4tow
```

> Requires [Node.js](https://nodejs.org) 18+

---

## Quick Start

```bash
i4tow /path/to/photos --token YOUR_GITHUB_TOKEN --username YOUR_GITHUB_USERNAME
```

That's it! Your album is live at:
```
https://rathnasorg.github.io/i4tow/a/i4tow-[folder-name]
```

### Example

```bash
i4tow "/Users/john/Photos/Smith Wedding" --token ghp_xxxx --username johnphoto
```

Creates: `https://rathnasorg.github.io/i4tow/a/i4tow-SmithWedding`

---

## Batch Mode

Upload multiple albums at once:

```bash
i4tow /Photos/2024 --batch --token YOUR_TOKEN --username YOUR_USERNAME
```

```
/Photos/2024/
  ├── Johnson Wedding/     → i4tow-JohnsonWedding
  ├── Smith Anniversary/   → i4tow-SmithAnniversary
  └── Corporate Event/     → i4tow-CorporateEvent
```

---

## Options

```
i4tow <folder> [options]

Options:
  -t, --token      GitHub personal access token (required)
  -u, --username   GitHub username (required)
  -d, --dry-run    Preview without creating albums
  -b, --batch      Create album for each subfolder
  -s, --single     Treat entire folder as one album
  -h, --help       Show help
```

---

## Features

### Gallery View
Clean, responsive grid that looks great on any device.

### Slideshow Mode
Auto-playing slideshow with shuffle - perfect for events or big screens.

### Slideshow All
Play through ALL your albums at once - great for portfolios.

### View All Albums
See every album at: `https://rathnasorg.github.io/i4tow/p/YOUR_USERNAME`

### Easy Sharing
Direct links + QR codes for instant sharing with clients.

---

## Supported Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- HEIC (.heic) - iPhone photos
- WebP (.webp)
- GIF (.gif)

---

## Getting a GitHub Token

1. Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Generate new token (classic) with `repo` scope
3. Copy and use with `--token`

[Detailed guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

---

## Need Help?

- Email: **i4tow@rathnas.com**
- Want to self-host? We can help!

---

Made with photographers in mind.
