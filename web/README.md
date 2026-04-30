# Timeline Heatmap Web Interface

This is a fully client-side migration of the Google Maps Timeline Parser. It allows you to visualize your location history as a heatmap directly in your browser.

## Features
- **Privacy First**: All processing is done locally in your browser. Your location data is never uploaded to any server.
- **Interactive Heatmap**: Zoom and pan through your history using Leaflet.js.
- **Statistics**: Automatically calculates total points parsed and total travel distance (km).
- **Format Support**: Supports standard Google Maps Semantic JSON exports and Takeout formats.

## How to Use
1. Open `index.html` in any modern web browser (Chrome, Firefox, Safari, Edge).
2. Click the **Upload JSON** button.
3. Select your Google Maps Timeline JSON file (e.g., `Records.json` or `Location History.json`).
4. The map will automatically populate with a heatmap of your locations.

## Technical Details
- **Mapping Library**: [Leaflet.js](https://leafletjs.com/)
- **Heatmap Plugin**: [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat)
- **Icons/Styles**: Minimal Vanilla CSS for a clean, responsive interface.
