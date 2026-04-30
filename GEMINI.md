# Gemini Project Context: Google Maps Timeline Heatmap (Web)

This project is a privacy-focused, client-side web application designed to parse and visualize Google Maps Timeline data (JSON). It transforms raw location history into an interactive heatmap with advanced filtering and playback capabilities.

## Project Overview

- **Purpose**: Provide a modern, browser-based interface for analyzing Google Maps Timeline exports without data ever leaving the user's machine.
- **Tech Stack**:
  - **Frontend**: HTML5, Vanilla CSS3 (Glassmorphism), Modern JavaScript (ES6+).
  - **Mapping**: [Leaflet.js](https://leafletjs.com/) for interactive maps.
  - **Visualization**: [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) for heatmap rendering.
  - **UI Components**: [noUiSlider](https://refreshless.com/nouislider/) for date range filtering.
  - **Theming**: Dark and Light mode support with [CartoDB](https://carto.com/basemaps/) basemaps.

### Key Features
- **Zero-Backend Parsing**: Full privacy; processing via browser File API.
- **Time Machine**: Chronological date filtering and playback animation.
- **Seasonality Filters**: View travels specifically by season (Summer, Winter, etc.).
- **Advanced Heatmap Controls**: Adjust radius, blur, opacity, and sensitivity (noise clipping).
- **Intensity Scaling**: Support for Additive, Linear, and Logarithmic density scaling.
- **Custom Palettes**: Includes high-contrast and color-blind friendly themes (Magma, Viridis, Plasma).

### Architecture
The application is contained within a single `index.html` file for portability and ease of use.
- **Models/Logic**: 
    - `TimelineParser`: Static utility for extracting coordinates and timestamps from various Google Maps JSON formats.
    - `DistanceCalculator`: Implements the Haversine formula to calculate total travel distance.
- **State Management**: Local state handles filtered data and UI settings (persisted via `localStorage` where applicable).
- **View Layer**: Leaflet-based map with custom floating glassmorphism UI cards.

## Building and Running

### Prerequisites
No build step is required. Any modern web browser is sufficient.

### Usage
1. Open `index.html` in a web browser.
2. Upload a Google Maps Timeline JSON file (Takeout export).
3. Use the **Time Machine** dock at the bottom to filter by date or play an animation of your travel history.
4. Access **Advanced Options** via the gear icon in the top-right to customize visuals and scaling.

## Development Conventions

- **Privacy First**: Never introduce features that send coordinate data to external APIs.
- **Performance**: Use loops and optimized filtering for large datasets (100k+ points); avoid the spread operator on large arrays to prevent stack overflows.
- **Theming**: Adhere to the Glassmorphism aesthetic. Use CSS variables defined in `:root` and `.dark-theme` for all colors.
- **Modularity**: Keep the `TimelineParser` and `DistanceCalculator` logic decoupled from the DOM manipulation.
