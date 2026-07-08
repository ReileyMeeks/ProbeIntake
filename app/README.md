# SvelteKit Template App

A high-performance, visually stunning SvelteKit template based on the Liquid Glass design system. This template provides a robust foundation for building modern, glassmorphic web applications with built-in support for themes, layouts, and authentication skeletons.

## 🚀 Quickstart

```bash
# 1. Clone the repository
git clone <repo-url>
cd <repo-name>

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev
```

## ✨ Features

- **Liquid Glass Design System**: Beautiful, high-fidelity glassmorphic components (buttons, cards, toolbars).
- **Theme Support**: Built-in dark and light modes with zero-flash early paint.
- **Flexible Layouts**: Support for vertical sidebar and horizontal top-bar layouts.
- **Authentication Skeleton**: Pre-configured Auth0 integration (can be easily enabled/disabled).
- **Responsive Design**: Mobile-first approach with adaptive sidebars and menus.

## 🛠️ Development

### Running Tests
```bash
npm run test      # Vitest
npm run check     # svelte-check + tsc
```

### Building for Production
```bash
npm run build
```

## 📝 Roadmap & TODOs

- [ ] Implement core business logic
- [ ] Configure Authentication provider
- [ ] Add custom routes and pages
- [ ] Integrate backend API
