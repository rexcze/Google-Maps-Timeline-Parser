/**
 * Merger module for combining parsed location arrays from multiple files.
 * Supports two strategies: deduplicate (default) and additive.
 */
export class Merger {
    /**
     * Deduplicate merge: uses a composite key of timestamp + lat + lng
     * to ensure only one data point exists per unique location-moment.
     * @param {Array<Array<{lat: number, lng: number, ts: number}>>} arrays
     * @returns {Array<{lat: number, lng: number, ts: number}>}
     */
    static deduplicate(arrays) {
        const seen = new Map();
        for (const arr of arrays) {
            for (const loc of arr) {
                // Composite key: timestamp in ms + coordinates rounded to 7 decimal places
                const key = `${loc.ts}|${loc.lat.toFixed(7)}|${loc.lng.toFixed(7)}`;
                if (!seen.has(key)) {
                    seen.set(key, loc);
                }
            }
        }
        return Array.from(seen.values());
    }

    /**
     * Additive merge: simply concatenates all arrays for an "overlapping" effect.
     * @param {Array<Array<{lat: number, lng: number, ts: number}>>} arrays
     * @returns {Array<{lat: number, lng: number, ts: number}>}
     */
    static additive(arrays) {
        return arrays.flat();
    }

    /**
     * Dispatcher: merges arrays using the specified strategy and sorts chronologically.
     * @param {Array<Array<{lat: number, lng: number, ts: number}>>} arrays
     * @param {'deduplicate' | 'additive'} strategy
     * @returns {Array<{lat: number, lng: number, ts: number}>}
     */
    static merge(arrays, strategy = 'deduplicate') {
        const merged = strategy === 'additive'
            ? this.additive(arrays)
            : this.deduplicate(arrays);

        return merged.sort((a, b) => a.ts - b.ts);
    }
}
