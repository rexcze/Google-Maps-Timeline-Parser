# Gemini Project Context: Google Maps Timeline Parser

This project is a Python-based utility designed to parse, analyze, and visualize Google Maps Timeline data (exported as JSON). It provides tools for generating heatmaps, GPX files, and calculating total travel distance while persisting the data in a local SQLite database.

## Project Overview

- **Purpose**: Transform raw Google Maps Timeline JSON exports into actionable formats (GPX, Heatmap) and store them for historical analysis.
- **Tech Stack**:
  - **Language**: Python 3.10+ (utilizes type hints and dataclasses).
  - **Database**: SQLite (via `sqlite3` and custom Repository pattern).
  - **Visualization**: `folium` (for interactive HTML heatmaps).
  - **Core Libraries**: `argparse`, `json`, `math`, `dataclasses`.

### Architecture

The project follows a clean, layered architecture:
- **Models** (`models/`): Simple data structures using `@dataclass` (e.g., `Location`).
- **Infrastructure** (`database/`): Manages the SQLite connection lifecycle.
- **Repositories** (`repositories/`): Handles SQL operations and data persistence for specific models.
- **Services** (`services/`): Contains the business logic:
    - `parser_service.py`: Extracts visit and path data from Google's semantic JSON format.
    - `export_service.py`: Generates GPX and Folium-based HTML heatmaps.
    - `distance_service.py`: Implements the Haversine formula to calculate travel distances.
- **Entry Point** (`main.py`): Orchestrates the CLI interface and service execution.

## Building and Running

### Prerequisites

The project requires `folium` for heatmap generation.
```bash
pip install folium
```

### Usage

The script is executed via `main.py` with the path to your Google Maps JSON export.

```bash
# Basic parsing and database storage
python main.py location_history.json

# Export to GPX and Generate Heatmap
python main.py location_history.json --gpx --heatmap

# Calculate total distance travelled
python main.py location_history.json --distance

# Specify a custom database path
python main.py location_history.json --db my_timeline.db
```

### CLI Arguments
- `json_file`: (Required) Path to the extracted Google Maps Timeline JSON file.
- `--db`: Path to the SQLite database (default: `timeline.db`).
- `--gpx`: Flag to export locations to `timeline.gpx`.
- `--heatmap`: Flag to generate `travel_heatmap.html`.
- `--distance`: Flag to print total distance covered in kilometers.

## Development Conventions

- **Type Safety**: The codebase uses strict Python type hints. Ensure any new code maintains this standard.
- **Layered Design**: Maintain the separation between Repositories (data access) and Services (logic). Do not put SQL queries directly into services.
- **Data Persistence**: Uses `INSERT OR IGNORE` based on the `timestamp` primary key to avoid duplicate entries when re-parsing the same or overlapping data.
- **Parsing Logic**: The `TimelineParserService` handles both `visit` segments (locations with semantic types) and `timelinePath` segments (raw breadcrumbs).
