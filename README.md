# JSON Formatter

A single-page, dependency-free JSON formatter website.

## Why this stack?

For this project the fastest and lightest option is plain HTML, CSS, and JavaScript. It has no framework runtime, no bundler, no dependency install, and can be deployed as static files.

## Features

- Format JSON as structured, indented output
- Convert JSON to a single-line compact format
- Validate JSON and show parse errors
- Repair common issues before formatting:
  - trailing commas
  - single-quoted strings
  - unquoted object keys
- Search formatted output with match highlighting
- Copy formatted output

## Run locally

Open `index.html` in a browser, or run a static server from this folder:

```sh
python3 -m http.server 3001
```

Then visit `http://localhost:3001`.

## Deploy

Upload these files to any static host:

- `index.html`
- `styles.css`
- `app.js`

Good options include Netlify, Vercel, GitHub Pages, Cloudflare Pages, or any simple web hosting provider.

## Deploy on Coolify

Use the included `Dockerfile`.

1. Push this folder to a Git repository.
2. In Coolify, create a new resource from that repository.
3. Choose Dockerfile build.
4. Set the exposed port to `80`.
5. Deploy.
