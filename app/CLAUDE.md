# CLAUDE.md

## Project Overview
This is a SvelteKit template application using the Liquid Glass design system. It's designed to be highly customizable and provides a robust foundation for modern web apps.

## Core Instructions
- **Project Structure**: To understand the project structure and architecture, refer to the `graphify/` directory.
- **Authentication**: The project includes an authentication skeleton in `src/lib/auth/`. It is currently **disabled** by default. To enable it, you will need to configure the environment variables in `.env` and update the initialization logic in `src/routes/+layout.svelte`.
- **Branding**: To create the mini logo diamond shape, refer to the component patterns in `src/lib/icons/` and use the appropriate SVG or CSS implementations.

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
