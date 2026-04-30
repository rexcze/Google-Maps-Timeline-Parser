import json
from typing import List, Tuple, Any

from models.location import Location


class TimelineParserService:
    """Parses a Google Maps Timeline JSON export into Location objects."""

    def __init__(self, json_path: str) -> None:
        self._json_path = json_path

    def parse(self) -> List[Location]:
        with open(self._json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Handle various Google export formats (List vs Dict)
        if isinstance(data, list):
            segments = data
        elif isinstance(data, dict):
            segments = (
                data.get('semanticSegments') or 
                data.get('timelineObjects') or 
                data.get('locations') or 
                []
            )
        else:
            segments = []

        locations: List[Location] = []
        for segment in segments:
            if not isinstance(segment, dict):
                continue
            
            # 1. Handle "visit" (Current snippet format)
            if 'visit' in segment:
                loc = self._parse_visit_segment(segment)
                if loc:
                    locations.append(loc)
            
            # 2. Handle "activity" (Current snippet format)
            elif 'activity' in segment:
                locations.extend(self._parse_activity_v2(segment))
            
            # 3. Handle "placeVisit" (Takeout format)
            elif 'placeVisit' in segment:
                loc = self._parse_place_visit(segment['placeVisit'])
                if loc:
                    locations.append(loc)
            
            # 4. Handle "activitySegment" (Takeout format)
            elif 'activitySegment' in segment:
                locations.extend(self._parse_activity_segment(segment['activitySegment']))

            # 5. Handle "timelinePath" at top level
            if 'timelinePath' in segment:
                locations.extend(self._parse_path(segment))
                
        return locations

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _extract_timestamp(self, obj: Any) -> str:
        """Attempt to find a timestamp in various formats/keys."""
        if not isinstance(obj, dict):
            return ""
        return str(
            obj.get("startTime") or 
            obj.get("timestamp") or 
            obj.get("startTimestamp") or 
            obj.get("time") or 
            obj.get("timestampMs") or
            ""
        )

    def _extract_coords(self, obj: Any) -> Tuple[float, float] | None:
        """Attempt to extract (lat, lng) from various location object formats."""
        if not obj:
            return None
            
        if isinstance(obj, str):
            try:
                return self._split_latlng(obj)
            except Exception:
                return None

        if not isinstance(obj, dict):
            return None

        # Format: {latitudeE7: ..., longitudeE7: ...}
        if 'latitudeE7' in obj and 'longitudeE7' in obj:
            return obj['latitudeE7'] / 1e7, obj['longitudeE7'] / 1e7

        # Format: {latLng: "lat,lng"} or {point: "lat,lng"}
        for key in ['latLng', 'point', 'placeLocation']:
            if key in obj and isinstance(obj[key], str):
                return self._split_latlng(obj[key])

        return None

    @staticmethod
    def _split_latlng(raw: str, sep: str = ',') -> Tuple[float, float]:
        """Strip prefixes, degree signs, and split a 'lat<sep>lng' string into floats."""
        cleaned = (
            raw.replace('geo:', '')
               .replace('\u00b0', '')
               .replace('\xc2\xb0', '')
               .replace('Â°', '')
               .strip()
        )
        
        if sep not in cleaned and ',' in cleaned:
            sep = ','
            
        parts = cleaned.split(sep)
        if len(parts) < 2:
            raise ValueError(f"Could not split coordinate string: {raw}")
            
        return float(parts[0].strip()), float(parts[1].strip())

    def _parse_visit_segment(self, segment: dict) -> Location | None:
        """Parses the 'visit' format found in your snippet."""
        visit = segment.get('visit', {})
        candidate = visit.get('topCandidate', {})
        coords = self._extract_coords(candidate) # topCandidate often has placeLocation or latLng
        
        return Location(
            timestamp=self._extract_timestamp(segment),
            latitude=coords[0] if coords else 0.0,
            longitude=coords[1] if coords else 0.0,
            semantic_type=candidate.get('semanticType', 'Visit'),
        ) if coords else None

    def _parse_activity_v2(self, segment: dict) -> List[Location]:
        """Parses the 'activity' format found in your snippet."""
        activity = segment.get('activity', {})
        locations = []
        ts = self._extract_timestamp(segment)
        
        # Use 'start' and 'end' keys
        for key in ['start', 'end']:
            coords = self._extract_coords(activity.get(key))
            if coords:
                locations.append(Location(
                    timestamp=ts if key == 'start' else segment.get('endTime', ts),
                    latitude=coords[0],
                    longitude=coords[1],
                    semantic_type=f"Activity {key.capitalize()}",
                ))
        return locations

    def _parse_place_visit(self, visit: dict) -> Location | None:
        location_data = visit.get('location', {})
        coords = self._extract_coords(location_data)
        if not coords:
            return None
        
        timestamp = self._extract_timestamp(visit) or self._extract_timestamp(visit.get('duration', {}))
        
        return Location(
            timestamp=timestamp,
            latitude=coords[0],
            longitude=coords[1],
            semantic_type=location_data.get('name', 'Place Visit'),
        )

    def _parse_activity_segment(self, activity: dict) -> List[Location]:
        locations: List[Location] = []
        duration = activity.get('duration', {})
        
        for key in ['startLocation', 'endLocation']:
            coords = self._extract_coords(activity.get(key))
            if coords:
                ts_key = 'startTimestamp' if key == 'startLocation' else 'endTimestamp'
                locations.append(Location(
                    timestamp=duration.get(ts_key, ''),
                    latitude=coords[0],
                    longitude=coords[1],
                    semantic_type=activity.get('activityType', 'Activity'),
                ))

        path = activity.get('waypointPath', {}).get('waypoints', []) or \
               activity.get('simplifiedRawPath', {}).get('points', [])

        for point in path:
            coords = self._extract_coords(point)
            if coords:
                locations.append(Location(
                    timestamp=self._extract_timestamp(point),
                    latitude=coords[0],
                    longitude=coords[1],
                ))
        return locations

    def _parse_path(self, segment: dict) -> List[Location]:
        locations: List[Location] = []
        for point in segment.get('timelinePath', []):
            coords = self._extract_coords(point)
            if coords:
                locations.append(Location(
                    timestamp=self._extract_timestamp(point),
                    latitude=coords[0],
                    longitude=coords[1],
                ))
        return locations
