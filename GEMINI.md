# Gemini Project Context: Google Maps Timeline Heatmap (Modern Edition)

This project is a privacy-focused, browser-based utility for visualizing Google Maps Timeline data. It has transitioned from a Python-based CLI tool to a modern web application that processes data locally in the browser.

## Project Overview

- **Purpose**: Transform Google Maps Timeline JSON exports into interactive heatmaps with advanced filtering and playback features.
- **Tech Stack**:
  - **Frontend**: HTML5, CSS3 (Glassmorphism), Vanilla JavaScript (ES6+ Modules).
  - **Mapping**: [Leaflet.js](https://leafletjs.com/) with [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) for rendering.
  - **UI Components**: [noUiSlider](https://refreshless.com/nouislider/) for chronological filtering.
  - **Privacy**: Zero-knowledge model; data is processed locally via the File API and never leaves the browser.

### Architecture

The application is structured as a modular frontend project:
- **UI Layer** (`index.html`, `css/`): Responsive glassmorphism interface featuring a settings sidebar, a chronological "Time Machine" dock, and real-time statistics.
- **Core Logic** (`js/app.js`): Orchestrates map initialization, heatmap rendering, state management, and user interactions.
- **Modules** (`js/modules/`):
    - `parser.js`: Robust parser for handling various Google Maps semantic JSON formats (visits, activity segments, and raw paths).
    - `utils.js`: Utility functions including `DistanceCalculator` (Haversine formula).

## Building and Running

### Prerequisites

Since the project uses modern ES6 modules, it must be served through a web server to avoid CORS/security restrictions when using the `file://` protocol.

### Execution

```bash
# Using Python 3 (recommended)
python3 -m http.server 8000

# Using Node.js (if installed)
npx serve .
```

Navigate to `http://localhost:8000` to use the application.

## Development Conventions

- **Modular JS**: All new logic should be encapsulated in ES6 modules within `js/modules/`.
- **Stateless Data Processing**: Avoid persisting location data. Keep data in-memory within `rawLocations` and rely on `localStorage` only for non-sensitive UI preferences.
- **CSS Standards**: Maintain the "Glassmorphism" aesthetic using semi-transparent backgrounds, `backdrop-filter: blur()`, and CSS variables for theme management.
- **Heatmap Performance**: Large datasets should be handled efficiently. Use the `scaling` and `threshold` logic in `app.js` to manage point density.
- **Type Safety**: While using Vanilla JS, maintain clear function signatures and use JSDoc where appropriate for complex data structures.

## Key Files

- `index.html`: Main UI structure and onboarding modal.
- `js/app.js`: Main entry point and event orchestration.
- `js/modules/parser.js`: Timeline JSON parsing logic.
- `css/style.css`: The "Modern Edition" visual design.
