export class DistanceCalculator {
    static haversine(p1, p2) {
        const R = 6371;
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lng - p1.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    static calculateTotal(locs) {
        let t = 0;
        for (let i = 1; i < locs.length; i++) t += this.haversine(locs[i - 1], locs[i]);
        return t;
    }
}
