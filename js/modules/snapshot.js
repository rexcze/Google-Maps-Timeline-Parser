/**
 * Snapshot Mode module — provides a full-screen overlay with a draggable,
 * resizable viewfinder for selecting a region of the map to export.
 */
export class SnapshotMode {
    /**
     * @param {object} opts
     * @param {Function} opts.onCapture - Called with { rect, multiplier } when download is clicked
     * @param {Function} opts.getResolution - Returns the current resolution multiplier string
     * @param {Function} opts.setResolution - Called when the user changes resolution in the toolbar
     */
    constructor(opts = {}) {
        this.onCapture = opts.onCapture || (() => {});
        this.getResolution = opts.getResolution || (() => '2');
        this.setResolution = opts.setResolution || (() => {});
        this.active = false;
        this.aspectRatio = null; // null = free, or a number like 1, 16/9, 4/5
        this.overlay = null;
        this.viewfinder = null;
        this.toolbar = null;

        // Drag state
        this._drag = null;
        // Resize state
        this._resize = null;

        // Bound handlers for cleanup
        this._onPointerMove = this._handlePointerMove.bind(this);
        this._onPointerUp = this._handlePointerUp.bind(this);
        this._onKeyDown = this._handleKeyDown.bind(this);
    }

    /** Activate snapshot mode */
    activate() {
        if (this.active) return;
        this.active = true;
        this._buildOverlay();
        document.addEventListener('keydown', this._onKeyDown);
    }

    /** Deactivate snapshot mode */
    deactivate() {
        if (!this.active) return;
        this.active = false;
        document.body.classList.remove('snapshot-active');
        document.removeEventListener('keydown', this._onKeyDown);
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.classList.add('snapshot-fade-out');
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.parentNode.removeChild(this.overlay);
                }
                this.overlay = null;
                this.viewfinder = null;
                this.toolbar = null;
            }, 250);
        }
    }

    /** Returns the viewfinder's bounding rect relative to the viewport */
    getViewfinderRect() {
        if (!this.viewfinder) return null;
        return this.viewfinder.getBoundingClientRect();
    }

    /** Build the overlay DOM */
    _buildOverlay() {
        // Overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'snapshotOverlay';
        this.overlay.className = 'snapshot-overlay';

        // Dimming regions (4 divs around the viewfinder)
        // We'll use a simpler approach: overlay with a "hole" via box-shadow
        const vfW = Math.min(window.innerWidth * 0.5, 800);
        const vfH = this.aspectRatio ? vfW / this.aspectRatio : Math.min(window.innerHeight * 0.5, 600);
        const vfX = (window.innerWidth - vfW) / 2;
        const vfY = (window.innerHeight - vfH) / 2;

        // Viewfinder
        this.viewfinder = document.createElement('div');
        this.viewfinder.className = 'snapshot-viewfinder';
        this.viewfinder.style.left = vfX + 'px';
        this.viewfinder.style.top = vfY + 'px';
        this.viewfinder.style.width = vfW + 'px';
        this.viewfinder.style.height = vfH + 'px';

        // Resize handles
        const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
        handles.forEach(dir => {
            const h = document.createElement('div');
            h.className = `snapshot-handle snapshot-handle-${dir}`;
            h.dataset.dir = dir;
            h.addEventListener('pointerdown', (e) => this._startResize(e, dir));
            this.viewfinder.appendChild(h);
        });

        // Crosshair guides
        const crossH = document.createElement('div');
        crossH.className = 'snapshot-crosshair snapshot-crosshair-h';
        this.viewfinder.appendChild(crossH);
        const crossV = document.createElement('div');
        crossV.className = 'snapshot-crosshair snapshot-crosshair-v';
        this.viewfinder.appendChild(crossV);

        // Size indicator
        this._sizeLabel = document.createElement('div');
        this._sizeLabel.className = 'snapshot-size-label';
        this.viewfinder.appendChild(this._sizeLabel);

        // Drag on viewfinder body
        this.viewfinder.addEventListener('pointerdown', (e) => {
            if (e.target === this.viewfinder || e.target.classList.contains('snapshot-crosshair')) {
                this._startDrag(e);
            }
        });

        this.overlay.appendChild(this.viewfinder);

        // Toolbar
        this._buildToolbar();
        this.overlay.appendChild(this.toolbar);

        // Update dim mask
        this._updateDimMask();

        document.body.appendChild(this.overlay);
        // Force reflow then add active class for animation
        void this.overlay.offsetHeight;
        this.overlay.classList.add('snapshot-active');

        // Defer size label update until after layout
        requestAnimationFrame(() => {
            this._updateSizeLabel();
        });
    }

    /** Build the snapshot toolbar */
    _buildToolbar() {
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'snapshot-toolbar glass-card';

        // Aspect ratio group
        const arGroup = this._createSegmentedGroup('Ratio', [
            { label: 'Free', value: 'free' },
            { label: '1:1', value: '1' },
            { label: '16:9', value: '16/9' },
            { label: '4:5', value: '4/5' },
        ], 'free', (val) => {
            if (val === 'free') {
                this.aspectRatio = null;
            } else if (val.includes('/')) {
                const [w, h] = val.split('/').map(Number);
                this.aspectRatio = w / h;
            } else {
                this.aspectRatio = parseFloat(val);
            }
            // If a ratio is selected, enforce it on the current viewfinder
            if (this.aspectRatio) {
                this._enforceAspectRatio();
            }
        });

        // Resolution group
        const currentRes = this.getResolution();
        const resGroup = this._createSegmentedGroup('Scale', [
            { label: '1×', value: '1' },
            { label: '2×', value: '2' },
            { label: '4×', value: '4' },
        ], currentRes, (val) => {
            this.setResolution(val);
            this._updateSizeLabel();
        });

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'snapshot-btn snapshot-btn-cancel';
        cancelBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel`;
        cancelBtn.addEventListener('click', () => this.deactivate());

        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'snapshot-btn snapshot-btn-download';
        downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download`;
        downloadBtn.addEventListener('click', () => {
            const rect = this.getViewfinderRect();
            const multiplier = parseInt(this.getResolution()) || 2;
            this.onCapture({ rect, multiplier });
        });

        this.toolbar.appendChild(arGroup);
        this.toolbar.appendChild(resGroup);
        this.toolbar.appendChild(cancelBtn);
        this.toolbar.appendChild(downloadBtn);
    }

    /** Create a labeled segmented control group */
    _createSegmentedGroup(labelText, options, activeValue, onChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'snapshot-control-group';

        const label = document.createElement('span');
        label.className = 'snapshot-control-label';
        label.textContent = labelText;
        wrapper.appendChild(label);

        const seg = document.createElement('div');
        seg.className = 'segmented-control snapshot-seg';

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'seg-btn' + (opt.value === activeValue ? ' active' : '');
            btn.textContent = opt.label;
            btn.dataset.val = opt.value;
            btn.addEventListener('click', () => {
                seg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                onChange(opt.value);
            });
            seg.appendChild(btn);
        });

        wrapper.appendChild(seg);
        return wrapper;
    }

    // ── Drag Logic ────────────────────────────────────────────

    _startDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        const rect = this.viewfinder.getBoundingClientRect();
        this._drag = {
            startX: e.clientX,
            startY: e.clientY,
            origLeft: rect.left,
            origTop: rect.top,
        };
        document.addEventListener('pointermove', this._onPointerMove);
        document.addEventListener('pointerup', this._onPointerUp);
        this.viewfinder.style.cursor = 'grabbing';
    }

    // ── Resize Logic ──────────────────────────────────────────

    _startResize(e, dir) {
        e.preventDefault();
        e.stopPropagation();
        const rect = this.viewfinder.getBoundingClientRect();
        this._resize = {
            dir,
            startX: e.clientX,
            startY: e.clientY,
            origLeft: rect.left,
            origTop: rect.top,
            origWidth: rect.width,
            origHeight: rect.height,
        };
        document.addEventListener('pointermove', this._onPointerMove);
        document.addEventListener('pointerup', this._onPointerUp);
    }

    _handlePointerMove(e) {
        if (this._drag) {
            const dx = e.clientX - this._drag.startX;
            const dy = e.clientY - this._drag.startY;
            let newLeft = this._drag.origLeft + dx;
            let newTop = this._drag.origTop + dy;

            // Clamp to viewport
            const w = this.viewfinder.offsetWidth;
            const h = this.viewfinder.offsetHeight;
            newLeft = Math.max(0, Math.min(window.innerWidth - w, newLeft));
            newTop = Math.max(0, Math.min(window.innerHeight - h, newTop));

            this.viewfinder.style.left = newLeft + 'px';
            this.viewfinder.style.top = newTop + 'px';
            this._updateDimMask();
        }

        if (this._resize) {
            this._performResize(e);
            this._updateDimMask();
            this._updateSizeLabel();
        }
    }

    _handlePointerUp() {
        this._drag = null;
        this._resize = null;
        document.removeEventListener('pointermove', this._onPointerMove);
        document.removeEventListener('pointerup', this._onPointerUp);
        if (this.viewfinder) this.viewfinder.style.cursor = 'move';
    }

    _performResize(e) {
        const r = this._resize;
        const dx = e.clientX - r.startX;
        const dy = e.clientY - r.startY;
        const MIN = 100;

        let newLeft = r.origLeft;
        let newTop = r.origTop;
        let newWidth = r.origWidth;
        let newHeight = r.origHeight;

        // Calculate new dimensions based on direction
        if (r.dir.includes('e')) newWidth = Math.max(MIN, r.origWidth + dx);
        if (r.dir.includes('w')) {
            newWidth = Math.max(MIN, r.origWidth - dx);
            newLeft = r.origLeft + r.origWidth - newWidth;
        }
        if (r.dir.includes('s')) newHeight = Math.max(MIN, r.origHeight + dy);
        if (r.dir.includes('n')) {
            newHeight = Math.max(MIN, r.origHeight - dy);
            newTop = r.origTop + r.origHeight - newHeight;
        }

        // Enforce aspect ratio
        if (this.aspectRatio) {
            const arWidth = newHeight * this.aspectRatio;
            const arHeight = newWidth / this.aspectRatio;

            if (r.dir === 'n' || r.dir === 's') {
                // Vertical-only edges: adjust width from center
                newWidth = arWidth;
                newLeft = r.origLeft + (r.origWidth - newWidth) / 2;
            } else if (r.dir === 'e' || r.dir === 'w') {
                // Horizontal-only edges: adjust height from center
                newHeight = arHeight;
                newTop = r.origTop + (r.origHeight - newHeight) / 2;
            } else {
                // Corners: use the larger dimension change
                if (Math.abs(dx) > Math.abs(dy)) {
                    newHeight = newWidth / this.aspectRatio;
                    if (r.dir.includes('n')) {
                        newTop = r.origTop + r.origHeight - newHeight;
                    }
                } else {
                    newWidth = newHeight * this.aspectRatio;
                    if (r.dir.includes('w')) {
                        newLeft = r.origLeft + r.origWidth - newWidth;
                    }
                }
            }

            // Enforce minimum with ratio
            if (newWidth < MIN) {
                newWidth = MIN;
                newHeight = MIN / this.aspectRatio;
            }
            if (newHeight < MIN) {
                newHeight = MIN;
                newWidth = MIN * this.aspectRatio;
            }
        }

        // Clamp to viewport
        newLeft = Math.max(0, newLeft);
        newTop = Math.max(0, newTop);
        if (newLeft + newWidth > window.innerWidth) newWidth = window.innerWidth - newLeft;
        if (newTop + newHeight > window.innerHeight) newHeight = window.innerHeight - newTop;

        this.viewfinder.style.left = newLeft + 'px';
        this.viewfinder.style.top = newTop + 'px';
        this.viewfinder.style.width = newWidth + 'px';
        this.viewfinder.style.height = newHeight + 'px';
    }

    _enforceAspectRatio() {
        if (!this.viewfinder || !this.aspectRatio) return;
        const rect = this.viewfinder.getBoundingClientRect();
        let newWidth = rect.width;
        let newHeight = newWidth / this.aspectRatio;

        // If it exceeds viewport height, constrain by height instead
        if (newHeight > window.innerHeight * 0.8) {
            newHeight = window.innerHeight * 0.8;
            newWidth = newHeight * this.aspectRatio;
        }

        const newLeft = (window.innerWidth - newWidth) / 2;
        const newTop = (window.innerHeight - newHeight) / 2;

        this.viewfinder.style.left = newLeft + 'px';
        this.viewfinder.style.top = newTop + 'px';
        this.viewfinder.style.width = newWidth + 'px';
        this.viewfinder.style.height = newHeight + 'px';

        this._updateDimMask();
        this._updateSizeLabel();
    }

    _updateSizeLabel() {
        if (!this._sizeLabel || !this.viewfinder) return;
        const rect = this.viewfinder.getBoundingClientRect();
        const mult = parseInt(this.getResolution()) || 2;
        const expW = Math.round(rect.width * mult);
        const expH = Math.round(rect.height * mult);
        this._sizeLabel.textContent = `${expW} × ${expH} px`;
    }

    _updateDimMask() {
        if (!this.overlay || !this.viewfinder) return;
        const r = this.viewfinder.getBoundingClientRect();
        // Use a massive box-shadow to dim everything outside the viewfinder
        this.overlay.style.setProperty('--vf-top', r.top + 'px');
        this.overlay.style.setProperty('--vf-left', r.left + 'px');
        this.overlay.style.setProperty('--vf-width', r.width + 'px');
        this.overlay.style.setProperty('--vf-height', r.height + 'px');
    }

    _handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.deactivate();
        }
    }
}
