# Timeline Heatmap | Modern Edition

An interactive, privacy-focused web application for visualizing Google Maps Timeline history as a beautiful heatmap. Analyze your travel patterns, relive journeys, and explore your location history with advanced filtering and playback capabilities—all directly in your browser.

![Timeline Heatmap Preview](https://via.placeholder.com/800x450?text=Timeline+Heatmap+Preview)

## 🛡️ Privacy-First Local Processing

Your privacy is the core of this project. Unlike other visualization tools, this application operates on a **Zero-Knowledge** model:

- **Local Execution:** Your location data is parsed directly in your browser using the File API. It is never uploaded to a server or stored in the cloud.
- **Zero Tracking:** No analytics, tracking cookies, or external scripts are used to monitor your data or behavior.
- **Session-Only Data:** All parsed location data resides only in the browser's volatile memory and is wiped the moment you close the tab or refresh the page.
- **Non-Sensitive Preferences:** Only your UI settings (like theme and heatmap radius) are persisted via `localStorage` for your convenience.

## ✨ Key UI Features

- **Interactive Heatmap:** Zoom and pan through your history with smooth rendering powered by Leaflet.js.
- **Time Machine:** Use the chronological dock to filter your history by specific dates or play back your travels through an animated time-lapse.
- **Seasonality Filters:** Instantly view your travels by season (Spring, Summer, Fall, Winter) to discover seasonal habits.
- **Advanced Heatmap Controls:** Fine-tune the visualization with adjustable radius, blur, opacity, and sensitivity (noise clipping).
- **Intensity Scaling:** Switch between Additive, Linear, and Logarithmic density scaling to highlight different patterns in your data.
- **Custom Palettes:** Choose from several high-contrast and aesthetic color themes, including Magma, Viridis, Plasma, and Cold.
- **Invert Colors:** Toggle color inversion for any palette to better suit your map's theme or personal preference.
- **Real-Time Statistics:** Automatically calculates total data points parsed and total travel distance (in kilometers) using the Haversine formula.
- **Modern Glassmorphism UI:** A clean, responsive interface with a semi-transparent "glass" aesthetic that supports both Light and Dark modes.

## 🚀 Getting Started

### Prerequisites
No installation is required. You only need a modern web browser (Chrome, Firefox, Safari, or Edge).

### Usage

> **Note:** Because this project uses modern ES6 JavaScript modules, you must serve it through a web server. Browsers block modules when opened via the `file://` protocol (double-clicking the file) for security reasons.

1.  Open your terminal in the project directory.
2.  Start a local web server:
    ```bash
    # Using Python 3
    python3 -m http.server 8000
    ```
3.  Navigate to `http://localhost:8000` in your browser.
4.  Drag and drop your Google Maps Timeline JSON file onto the landing page, or click **Select JSON Export**.
5.  Once the data is processed, use the **Time Machine** at the bottom to explore different dates.
6.  Access **Settings** via the gear icon in the top-right to customize the map's appearance.

## 📂 How to Export Your Data

To use this tool, you need your Google Maps Timeline data in JSON format.

### Using Google Takeout (Recommended)
1. Go to [Google Takeout](https://takeout.google.com/).
2. Deselect all and then select only **Location History (Timeline)**.
3. Click **Next step**, choose your preferred delivery method, and click **Create export**.
4. Once the export is ready, download and unzip it. You are looking for a file named `Records.json` or files within the `Semantic Location History` folder.

### Mobile Devices
- **Android:** Maps > Profile > Your Timeline > Menu > Settings and privacy > Export Timeline data.
- **iOS:** Maps > Profile > Your Timeline > Menu > Settings > Export Timeline data.

## ❓ FAQ

**Q: Is my data sent to any server?**
A: No. All processing happens locally in your browser. You can even run this application offline once it's loaded.

**Q: What file formats are supported?**
A: The application supports the standard `Records.json` format, the older `Location History.json` format, and the newer Semantic JSON files provided by Google.

**Q: The heatmap looks too crowded, how can I fix it?**
A: Use the **Sensitivity** slider in Settings to filter out low-density points, or adjust the **Radius** and **Blur** to fine-tune the visualization.

## 💻 Browser Support

This application relies on modern web technologies (ES6 Modules, CSS Variables, Backdrop Filter). It is compatible with the latest versions of:
- Google Chrome
- Mozilla Firefox
- Microsoft Edge
- Apple Safari

## 🗺️ Roadmap

- [ ] Support for GPX and KML file imports.
- [ ] Ability to export high-resolution map snapshots.
- [ ] Detailed "Visit" markers for specific points of interest.
- [ ] Multi-file support for merging multiple years of history.

## 🛠️ Technical Stack

- **Frontend:** HTML5, Vanilla CSS3 (Glassmorphism), Modern JavaScript (ES6+).
- **Mapping:** [Leaflet.js](https://leafletjs.com/) for interactive map layers.
- **Visualization:** [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) for high-performance heatmap rendering.
- **UI Components:** [noUiSlider](https://refreshless.com/nouislider/) for smooth date range filtering.
- **Basemaps:** [CartoDB](https://carto.com/basemaps/) for clean light and dark map themes.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request if you have ideas for new features or improvements.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
