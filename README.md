# Palia AI

Palia AI is a React + Vite + Express AI assistant by ShanPalia.

## Production deployment

This project includes a server-side API, so **do not deploy it as GitHub Pages**. Use a Node-compatible host such as Render.

### Render

- Build command: `npm install --no-audit --no-fund && npm run build`
- Start command: `npm start`
- Health check: `/api/health`

Required environment variables:

- `GEMINI_API_KEY` — server-side AI API key
- `SUPABASE_URL` — optional until Supabase auth/database is connected
- `SUPABASE_ANON_KEY` — optional until Supabase auth/database is connected

The server listens on the host-provided `PORT` environment variable.

## Daily AI usage

The default server-side allowance is **120 minutes (2 hours) per user per day**, using Asia/Kolkata as the default timezone. Usage is shown in the profile drawer, not the main chat header.

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm start
```


## GitHub Pages (PC/mobile website)
This project can also publish the frontend as a static site like a normal GitHub-hosted website. Enable GitHub Pages using **GitHub Actions**.

If you want the AI API to work on GitHub Pages, set a GitHub repository variable named `VITE_API_BASE_URL` to the public URL of the deployed Palia AI backend (for example, a Render service URL). Never put `GEMINI_API_KEY` in the frontend or GitHub Pages.

The same repository can still be deployed as a full Node/Express app on Render using the included `render.yaml`.
