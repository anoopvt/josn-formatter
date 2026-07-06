# JSON Formatter

A fast, lightweight JSON formatter website built with plain HTML, CSS, and JavaScript.

It runs entirely in the browser, so pasted JSON never leaves the user's device. The app is designed as a single-page developer tool that can be deployed as static files or through Docker.

## Features

- Format JSON with readable indentation
- Minify JSON into a single line
- Validate JSON and show useful error messages
- Highlight likely input errors directly inside the editor
- Repair common JSON mistakes:
  - trailing commas
  - single-quoted strings
  - unquoted object keys
- Search formatted output with highlighted matches
- Syntax-highlight formatted JSON
- View JSON as a collapsible tree
- Upload or drag and drop `.json` files
- Copy formatted output
- Download formatted output as `formatted.json`
- Responsive two-panel layout

## Tech Stack

This project intentionally avoids a frontend framework.

- `index.html` for markup
- `styles.css` for layout and visual design
- `app.js` for formatter, validator, repair, search, tree view, upload, and download logic
- `nginx` Docker image for production serving

This keeps the site small, fast, and simple to deploy.

## Project Structure

```text
.
├── index.html
├── styles.css
├── app.js
├── Dockerfile
├── nginx.conf
├── .dockerignore
├── LICENSE
└── README.md
```

## Run Locally

Start a static server from the project folder:

```sh
python3 -m http.server 3001
```

Open:

```text
http://127.0.0.1:3001
```

You can also open `index.html` directly in a browser, but using a local server is closer to production.

## Docker

Build the image:

```sh
docker build -t json-formatter .
```

Run it locally:

```sh
docker run --rm -p 8080:80 json-formatter
```

Open:

```text
http://127.0.0.1:8080
```

The Docker image includes a health check at `/healthz` so container platforms can wait for nginx before routing traffic.

## Notes

- The app does not send JSON to a server.
- Validation and repair are best-effort helpers. Always review repaired output before using it in production.
- The project has no package manager dependencies and no build step.
