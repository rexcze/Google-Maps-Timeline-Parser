# Google Maps Timeline Data Parser

This is a robust Python utility that parses Google Maps Timeline JSON exports and transforms them into useful formats for analysis and visualization.

- **Interactive Heatmap**: Visualizes your location density over time.
- **GPX Export**: Converts timeline data into standard GPS tracks for use in other mapping software.
- **SQLite Persistence**: Stores all parsed data in a local database with duplicate prevention.
- **Distance Analytics**: Calculates the total travel distance using the Haversine formula.

![Example Heatmap](example.png)

## Installation & Usage

The project is optimized for use with [uv](https://github.com/astral-sh/uv), but can also be run with standard Python/pip.

### Using `uv` (Recommended)

1. **Install dependencies**:
   ```bash
   uv pip install folium
   ```

2. **Run the parser**:
   ```bash
   uv run main.py path/to/Timeline.json --heatmap --distance
   ```

### Using standard Python

1. **Install dependencies**:
   ```bash
   pip install folium
   ```

2. **Run the parser**:
   ```bash
   python main.py path/to/Timeline.json --heatmap --distance
   ```

## Command Line Options

| Argument | Description |
| :--- | :--- |
| `json_file` | **(Required)** Path to your Google Maps JSON export. |
| `--heatmap` | Generates `travel_heatmap.html` (Interactive Leaflet map). |
| `--distance`| Calculates and prints the total distance travelled in kilometers. |
| `--gpx`     | Exports a `timeline.gpx` file. |
| `--db`      | Specify a custom SQLite database path (default: `timeline.db`). |

## How to get your data

Google has transitioned Timeline data to **on-device storage**. To use this script, you must export your data directly from the Google Maps mobile app:

1. Open **Google Maps** on your phone.
2. Tap your **Profile Picture** (top right) → **Your Timeline**.
3. Tap the **three dots (⋮ or ⋯)** in the top right → **Settings and privacy** (Android) or **Settings** (iOS).
4. Scroll down to "Location settings" and tap **Export Timeline data**.
5. Save the generated `Timeline.json` file to your device or computer.
6. Provide the path to this file to the script.

## Technical Details

The parser is designed to be defensive and handles multiple Google Timeline formats, including:
- Top-level lists and dictionary formats (`semanticSegments`, `timelineObjects`).
- Standard coordinate pairs and `geo:lat,lng` URI formats.
- Modern `latitudeE7` integer formats.
- `placeVisit` and `activitySegment` structures.
- On-device mobile exports (`activity` and `visit` keys).
