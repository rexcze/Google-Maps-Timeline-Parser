export class TimelineParser {
    static extractCoords(obj) {
        if (!obj) return null;
        if (typeof obj === 'string') return this.splitLatLng(obj);
        if (typeof obj !== 'object') return null;
        if (obj.latitudeE7 !== undefined && obj.longitudeE7 !== undefined) return [obj.latitudeE7 / 1e7, obj.longitudeE7 / 1e7];
        for (const key of ['latLng', 'point', 'placeLocation']) if (obj[key] && typeof obj[key] === 'string') return this.splitLatLng(obj[key]);
        return null;
    }
    static splitLatLng(raw) {
        const cleaned = raw.replace('geo:', '').replace(/°/g, '').trim();
        const parts = cleaned.split(cleaned.includes(',') ? ',' : ' ');
        if (parts.length < 2) return null;
        return [parseFloat(parts[0]), parseFloat(parts[1])];
    }
    static extractTimestamp(obj, segment) {
        const ts = obj.startTime || obj.timestamp || obj.timestampMs || segment.startTime || segment.startTimeMs || (obj.duration && (obj.duration.startTime || obj.duration.startTimeMs)) || "";
        if (!ts) return 0;
        const parsed = new Date(isNaN(ts) ? ts : parseInt(ts)).getTime();
        return isNaN(parsed) ? 0 : parsed;
    }
    static parse(data) {
        let raw = Array.isArray(data) ? data : (data.semanticSegments || data.timelineObjects || data.locations || []);
        const locations = [];
        raw.forEach(seg => {
            const process = (obj) => {
                const coords = this.extractCoords(obj);
                if (coords) locations.push({ lat: coords[0], lng: coords[1], ts: this.extractTimestamp(obj, seg) });
            };
            if (seg.visit) process(seg.visit.topCandidate);
            else if (seg.placeVisit) process(seg.placeVisit.location);
            else if (seg.activitySegment) {
                process(seg.activitySegment.startLocation);
                process(seg.activitySegment.endLocation);
                (seg.activitySegment.waypointPath?.waypoints || seg.activitySegment.simplifiedRawPath?.points || []).forEach(process);
            }
            if (seg.timelinePath) seg.timelinePath.forEach(process);
        });
        return locations.sort((a, b) => a.ts - b.ts);
    }
}
