# CLAUDE.md

## Project Overview

This is the SvelteKit static SPA frontend for Avante Probe Intake. It's built and
adapter-static'd to plain HTML/JS/CSS, then served behind a Vapor backend that
acts as the API proxy for the tool.

## Core Instructions

- **Authentication**: An authentication skeleton lives in `src/lib/auth/`. It is
  currently **disabled** by default. To enable it, configure the environment
  variables in `.env` and update the initialization logic in
  `src/routes/+layout.svelte`.
- **Branding**: The mini logo diamond shape and other icon patterns live in
  `src/lib/icons/`.

## Development Workflow

- **Install**: `npm install`
- **Dev**: `npm run dev`
- **Build**: `npm run build`
- **Test**: `npm run test`
- **Check**: `npm run check`

## Coding Standards

- Follow Svelte 5 patterns (runes like `$state`, `$derived`, etc.).
- Use Tailwind CSS for styling where appropriate.
- Adhere to the Liquid Glass design system tokens defined in `src/routes/layout.css`.
