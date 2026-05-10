/**
 * High-Resolution Export Engine
 * Renders the area inside the snapshot viewfinder onto a canvas,
 * compositing map tiles and a scaled heatmap, then triggers a PNG download.
 */
export class Exporter {
    /**
     * Maximum canvas dimension to prevent browser memory issues.
     * @type {number}
     */
    static MAX_CANVAS_DIM = 8192;

    /**
     * Capture a snapshot of the viewfinder area and download as PNG.
     *
     * @param {object} params
     * @param {DOMRect} params.rect — The viewfinder's bounding rect (viewport-relative)
     * @param {number} params.multiplier — Resolution multiplier (1, 2, or 4)
     * @param {L.Map} params.map — Leaflet map instance
     * @param {object} params.heatmapConfig — { radius, blur, opacity, gradient, maxIntensity }
     * @param {Array<{lat: number, lng: number, ts: number}>} params.locations — Filtered location data
     * @param {number[]} params.timeRange — [min, max] timestamp filter
     * @param {string} params.season — Current season filter
     * @param {string} params.scaling — Scaling mode
     * @param {number} params.thresholdPercent — Threshold value 0-1
     * @param {boolean} params.invert — Whether colors are inverted
     */
    static async capture(params) {
        const {
            rect, multiplier, map, heatmapConfig,
            locations, timeRange, season, scaling,
            thresholdPercent, invert
        } = params;

        // Calculate canvas size with safety cap
        let canvasW = Math.round(rect.width * multiplier);
        let canvasH = Math.round(rect.height * multiplier);
        if (canvasW > this.MAX_CANVAS_DIM || canvasH > this.MAX_CANVAS_DIM) {
            const scale = this.MAX_CANVAS_DIM / Math.max(canvasW, canvasH);
            canvasW = Math.round(canvasW * scale);
            canvasH = Math.round(canvasH * scale);
        }

        // Geographic bounds of the viewfinder
        const mapContainer = map.getContainer().getBoundingClientRect();
        const topLeft = map.containerPointToLatLng([
            rect.left - mapContainer.left,
            rect.top - mapContainer.top
        ]);
        const bottomRight = map.containerPointToLatLng([
            rect.right - mapContainer.left,
            rect.bottom - mapContainer.top
        ]);

        // Show progress
        const loading = document.getElementById('loading');
        if (loading) {
            loading.textContent = 'Rendering snapshot...';
            loading.style.display = 'grid';
        }

        try {
            // Step 1: Render map tiles
            const tileCanvas = await this._renderTiles(map, topLeft, bottomRight, canvasW, canvasH, rect);

            // Step 2: Render heatmap
            const heatCanvas = this._renderHeatmap(
                locations, topLeft, bottomRight,
                canvasW, canvasH, multiplier,
                heatmapConfig, timeRange, season,
                scaling, thresholdPercent, invert
            );

            // Step 3: Composite
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = canvasW;
            finalCanvas.height = canvasH;
            const ctx = finalCanvas.getContext('2d');

            ctx.drawImage(tileCanvas, 0, 0);
            ctx.globalAlpha = heatmapConfig.opacity;
            ctx.drawImage(heatCanvas, 0, 0);
            ctx.globalAlpha = 1.0;

            // Step 4: Download
            this._downloadCanvas(finalCanvas);
        } catch (err) {
            console.error('Snapshot export failed:', err);
            alert('Failed to export snapshot. See console for details.');
        } finally {
            if (loading) {
                loading.textContent = 'Processing timeline data...';
                loading.style.display = 'none';
            }
        }
    }

    /**
     * Render map tiles onto a canvas for the specified geographic bounds.
     */
    static async _renderTiles(map, topLeft, bottomRight, canvasW, canvasH, viewfinderRect) {
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');

        // Fill with map background
        const isDark = document.body.classList.contains('dark-theme');
        ctx.fillStyle = isDark ? '#1a1a2e' : '#f2efe9';
        ctx.fillRect(0, 0, canvasW, canvasH);

        const zoom = map.getZoom();
        const tileSize = 256;

        // Convert geographic bounds to tile coordinates
        const nw = this._latLngToTileCoords(topLeft.lat, topLeft.lng, zoom);
        const se = this._latLngToTileCoords(bottomRight.lat, bottomRight.lng, zoom);

        const minTileX = Math.floor(nw.x);
        const maxTileX = Math.floor(se.x);
        const minTileY = Math.floor(nw.y);
        const maxTileY = Math.floor(se.y);

        // Determine tile URL pattern
        const subdomains = ['a', 'b', 'c', 'd'];
        const tileUrl = isDark
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png';

        // Calculate the pixel offset of the top-left corner of our viewfinder in "world pixels"
        const worldPixelTopLeft = this._latLngToWorldPixel(topLeft.lat, topLeft.lng, zoom, tileSize);
        const worldPixelBottomRight = this._latLngToWorldPixel(bottomRight.lat, bottomRight.lng, zoom, tileSize);

        const worldW = worldPixelBottomRight.x - worldPixelTopLeft.x;
        const worldH = worldPixelBottomRight.y - worldPixelTopLeft.y;

        const scaleX = canvasW / worldW;
        const scaleY = canvasH / worldH;

        // Fetch and draw all tiles
        const tilePromises = [];
        for (let tx = minTileX; tx <= maxTileX; tx++) {
            for (let ty = minTileY; ty <= maxTileY; ty++) {
                const s = subdomains[(tx + ty) % subdomains.length];
                const url = tileUrl
                    .replace('{s}', s)
                    .replace('{z}', zoom)
                    .replace('{x}', tx)
                    .replace('{y}', ty);

                const tileWorldX = tx * tileSize;
                const tileWorldY = ty * tileSize;

                tilePromises.push(
                    this._loadImage(url).then(img => {
                        const dx = (tileWorldX - worldPixelTopLeft.x) * scaleX;
                        const dy = (tileWorldY - worldPixelTopLeft.y) * scaleY;
                        const dw = tileSize * scaleX;
                        const dh = tileSize * scaleY;
                        ctx.drawImage(img, dx, dy, dw, dh);
                    }).catch(() => {
                        // Silently skip failed tiles
                    })
                );
            }
        }

        await Promise.all(tilePromises);
        return canvas;
    }

    /**
     * Render heatmap data onto a canvas using simpleheat.
     */
    static _renderHeatmap(
        locations, topLeft, bottomRight,
        canvasW, canvasH, multiplier,
        heatmapConfig, timeRange, season,
        scaling, thresholdPercent, invert
    ) {
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;

        // Filter locations within bounds and time range
        const minLat = Math.min(topLeft.lat, bottomRight.lat);
        const maxLat = Math.max(topLeft.lat, bottomRight.lat);
        const minLng = Math.min(topLeft.lng, bottomRight.lng);
        const maxLng = Math.max(topLeft.lng, bottomRight.lng);

        let filtered = locations.filter(l => {
            if (l.lat < minLat || l.lat > maxLat || l.lng < minLng || l.lng > maxLng) return false;
            if (timeRange && (l.ts < timeRange[0] || l.ts > timeRange[1])) return false;
            if (season && season !== 'all') {
                const m = new Date(l.ts).getMonth();
                if (season === 'winter' && ![11, 0, 1].includes(m)) return false;
                if (season === 'spring' && ![2, 3, 4].includes(m)) return false;
                if (season === 'summer' && ![5, 6, 7].includes(m)) return false;
                if (season === 'fall' && ![8, 9, 10].includes(m)) return false;
            }
            return true;
        });

        // Convert lat/lng to canvas pixel coordinates
        const latRange = topLeft.lat - bottomRight.lat;
        const lngRange = bottomRight.lng - topLeft.lng;

        // Build heatmap points
        let heatPoints = [];
        let maxIntensity = 1.0;

        if (scaling !== 'default' || thresholdPercent > 0) {
            const groups = {};
            filtered.forEach(l => {
                const key = `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`;
                if (!groups[key]) groups[key] = { lat: l.lat, lng: l.lng, count: 0 };
                groups[key].count++;
            });
            const grouped = Object.values(groups);
            let peakCount = 0;
            grouped.forEach(g => { if (g.count > peakCount) peakCount = g.count; });
            if (scaling === 'log') maxIntensity = Math.log10(peakCount + 1);
            else if (scaling === 'linear') maxIntensity = peakCount;

            heatPoints = grouped
                .filter(g => g.count >= (peakCount * thresholdPercent))
                .map(g => {
                    const px = ((g.lng - topLeft.lng) / lngRange) * canvasW;
                    const py = ((topLeft.lat - g.lat) / latRange) * canvasH;
                    let val = scaling === 'log' ? Math.log10(g.count + 1) : g.count;
                    return [px, py, scaling === 'default' ? 1 : (invert ? (maxIntensity - val) : val)];
                });
        } else {
            heatPoints = filtered.map(l => {
                const px = ((l.lng - topLeft.lng) / lngRange) * canvasW;
                const py = ((topLeft.lat - l.lat) / latRange) * canvasH;
                return [px, py, 1];
            });
        }

        // Use simpleheat (bundled with leaflet.heat)
        if (typeof simpleheat === 'undefined') {
            // Fallback: draw simple dots if simpleheat is not available
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            heatPoints.forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(x, y, heatmapConfig.radius * multiplier, 0, Math.PI * 2);
                ctx.fill();
            });
            return canvas;
        }

        // Scale radius and blur by the multiplier for visual consistency
        const heat = simpleheat(canvas);
        heat.radius(
            heatmapConfig.radius * multiplier,
            heatmapConfig.blur * multiplier
        );
        heat.max(maxIntensity || 1);
        heat.gradient(heatmapConfig.gradient);
        heat.data(heatPoints);
        heat.draw(0.05);

        return canvas;
    }

    /** Load an image with CORS enabled, returns a Promise<HTMLImageElement> */
    static _loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    /** Convert lat/lng to tile coordinates at a given zoom level */
    static _latLngToTileCoords(lat, lng, zoom) {
        const n = Math.pow(2, zoom);
        const x = ((lng + 180) / 360) * n;
        const latRad = (lat * Math.PI) / 180;
        const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
        return { x, y };
    }

    /** Convert lat/lng to world pixel coordinates */
    static _latLngToWorldPixel(lat, lng, zoom, tileSize) {
        const n = Math.pow(2, zoom);
        const x = ((lng + 180) / 360) * n * tileSize;
        const latRad = (lat * Math.PI) / 180;
        const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n * tileSize;
        return { x, y };
    }

    /** Trigger a PNG download from a canvas */
    static _downloadCanvas(canvas) {
        canvas.toBlob((blob) => {
            if (!blob) {
                alert('Failed to generate image.');
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            a.download = `timeline-heatmap-${date}.png`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }
}
