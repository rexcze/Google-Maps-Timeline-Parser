export class FogLayer {
    constructor(map, options = {}) {
        this.map = map;
        this.options = Object.assign({
            opacity: 0.9,
            radius: 30,
            softness: 50,
            color: '#000000'
        }, options);

        this._locations = [];
        this._canvas = L.DomUtil.create('canvas', 'leaflet-fog-layer leaflet-layer');
        this._canvas.style.pointerEvents = 'none';

        const size = this.map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;

        this.map.getPanes().overlayPane.appendChild(this._canvas);
        
        this._ctx = this._canvas.getContext('2d');

        this._onMoveEnd = this._onMoveEnd.bind(this);
        this._onResize = this._onResize.bind(this);
        this._onZoomAnim = this._onZoomAnim.bind(this);
        
        this.map.on('moveend', this._onMoveEnd);
        this.map.on('resize', this._onResize);
        this.map.on('zoomanim', this._onZoomAnim);
        
        this._updateCanvasPosition();
    }

    setData(locations) {
        this._locations = locations || [];
        this.redraw();
    }

    setOptions(options) {
        Object.assign(this.options, options);
        this.redraw();
    }

    destroy() {
        this.map.off('moveend', this._onMoveEnd);
        this.map.off('resize', this._onResize);
        this.map.off('zoomanim', this._onZoomAnim);
        if (this._canvas && this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }
    }

    _onMoveEnd() {
        this._updateCanvasPosition();
        this.redraw();
    }

    _onResize() {
        const size = this.map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
        this._updateCanvasPosition();
        this.redraw();
    }
    
    _onZoomAnim(e) {
        // scale the canvas during zoom animation
        const scale = this.map.getZoomScale(e.zoom);
        const offset = this.map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this.map._getMapPanePos());
        L.DomUtil.setTransform(this._canvas, offset, scale);
    }

    _updateCanvasPosition() {
        const topLeft = this.map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this._canvas, topLeft);
    }

    redraw() {
        if (!this._ctx) return;
        const width = this._canvas.width;
        const height = this._canvas.height;

        this._ctx.clearRect(0, 0, width, height);

        // Fill with fog
        this._ctx.globalCompositeOperation = 'source-over';
        this._ctx.fillStyle = this.options.color;
        this._ctx.globalAlpha = parseFloat(this.options.opacity);
        this._ctx.fillRect(0, 0, width, height);

        if (!this._locations.length) return;

        // Reveal logic
        this._ctx.globalCompositeOperation = 'destination-out';
        this._ctx.globalAlpha = 1.0;

        const r = parseInt(this.options.radius);
        let innerStop = 1 - (parseInt(this.options.softness) / 100);
        if (innerStop < 0) innerStop = 0;
        if (innerStop > 0.99) innerStop = 0.99;

        const isLargeDataset = this._locations.length > 50000;
        const processedPoints = isLargeDataset ? new Set() : null;

        for (let i = 0; i < this._locations.length; i++) {
            const loc = this._locations[i];
            const pt = this.map.latLngToContainerPoint([loc.lat, loc.lng]);
            
            // Only draw if roughly within bounds
            if (pt.x < -r || pt.x > width + r || pt.y < -r || pt.y > height + r) continue;

            if (isLargeDataset) {
                // Cell size roughly based on radius so we don't draw heavily overlapping gradients
                const cellSize = r / 3;
                const gridX = Math.floor(pt.x / cellSize);
                const gridY = Math.floor(pt.y / cellSize);
                const key = `${gridX},${gridY}`;
                if (processedPoints.has(key)) continue;
                processedPoints.add(key);
            }

            const grad = this._ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
            grad.addColorStop(0, 'rgba(0,0,0,1)');
            grad.addColorStop(innerStop, 'rgba(0,0,0,1)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');

            this._ctx.fillStyle = grad;
            this._ctx.beginPath();
            this._ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
            this._ctx.fill();
        }
    }
}
