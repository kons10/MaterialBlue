***Be static, and be beautiful.***

[English] | [日本語](README-ja.md)

# Static Bluesky Client

A static Bluesky client built with [Hugo](https://gohugo.io/) and [Material Web Components](https://github.com/material-components/material-web).

## Features

- **Login** — Sign in with your Bluesky handle and app password
- **Timeline** — Fetch and display your home timeline
- **Post** — Create text posts
- **Image upload** — Attach up to 4 images per post
- **Session persistence** — Login state is saved via cookies so you stay logged in on reload
- **Responsive UI** — Built with Material Design 3 components

## Tech Stack

| Layer | Technology |
|---|---|
| Static site generator | [Hugo](https://gohugo.io/) v0.140.0+ |
| UI components | [Material Web Components](https://github.com/material-components/material-web) (via esm.sh) |
| Bluesky API | [@atproto/api](https://www.npmjs.com/package/@atproto/api) v0.13.6 (via esm.sh) |
| Fonts | Google Fonts — Roboto, Material Symbols Outlined |

## Getting Started

### Prerequisites

- Hugo extended v0.140.0 or later

### Installation

```bash
git clone https://github.com/kons10/materialblue.git
cd repo-name
```

### Local development

```bash
hugo server
```

Open `http://localhost:1313` in your browser.

### Build

```bash
hugo
```

The output is generated in the `public/` directory.

## Deployment

This project is designed for static hosting (e.g. GitHub Pages, Cloudflare Pages, Netlify).

Before deploying, update `baseURL` in `hugo.yaml` to match your actual URL:

```yaml
baseURL: 'https://example.com/'
```
This application must be placed in the `/` directory directly under the domain. Otherwise, it may not function correctly.

## Usage

1. Open the app in your browser
2. Enter your Bluesky **handle** (e.g. `user.bsky.social`) and an **app password**
   - App passwords can be created at: **Bluesky Settings → Privacy and Security → App Passwords**
3. Click **Login**
4. Your timeline will load automatically

> **Note:** Your credentials are never sent anywhere other than `bsky.social`. Session tokens are stored in browser cookies only.

## Project Structure

```
.
├── content/
│   └── _index.md          # Home page front matter
├── layouts/
│   ├── _default/
│   │   └── baseof.html    # Base HTML template (header, footer, MWC setup)
│   └── index.html         # Home page template (login + timeline UI)
├── static/
│   └── src/
│       └── bsky-client.js # Bluesky API client wrapper
└── hugo.yaml              # Hugo configuration
```

## License

Licensed under the [Apache License 2.0](LICENSE).
