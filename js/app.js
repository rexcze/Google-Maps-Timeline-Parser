import { TimelineParser } from './modules/parser.js';
import { DistanceCalculator } from './modules/utils.js';
import { Merger } from './modules/merger.js';
import { SnapshotMode } from './modules/snapshot.js';
import { Exporter } from './modules/exporter.js';
import { FogLayer } from './modules/fog.js';

const map = L.map('map', { zoomControl: false }).setView([0, 0], 2);
L.control.zoom({ position: 'bottomright' }).addTo(map);

let currentTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO'
}).addTo(map);

let currentAppearance = 'light';
function setTheme(mode, update = true) {
    currentAppearance = mode;
    let isDark = false;
    if (mode === 'system') {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
        isDark = (mode === 'dark');
    }

    if (isDark) document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');

    const url = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    map.removeLayer(currentTileLayer);
    currentTileLayer = L.tileLayer(url, { attribution: '&copy; CARTO' }).addTo(map);
    if (update) updateVisualization();
}

let saveIndicatorTimeout = null;
function showSaveIndicator() {
    const indicator = document.getElementById('saveIndicator');
    if (!indicator) return;
    indicator.classList.add('show');
    if (saveIndicatorTimeout) clearTimeout(saveIndicatorTimeout);
    saveIndicatorTimeout = setTimeout(() => {
        indicator.classList.remove('show');
    }, 1500);
}

let heatLayer = null, rawLocations = [], timeSlider = null, isPlaying = false, animationFrame = null, currentSeason = 'all', hasData = false;
let fogLayer = null;
let currentMode = 'heatmap';
let currentMergeStrategy = 'deduplicate';
let currentExportResolution = '2';

const DEFAULT_SETTINGS = {
    appearance: 'light', season: 'all', theme: 'classic', scaling: 'default', threshold: '0',
    radius: '15', blur: '10', opacity: '0.8', invert: false,
    mergeStrategy: 'deduplicate', exportResolution: '2',
    mode: 'heatmap', fogOpacity: '0.9', fogRadius: '30', fogSoftness: '50'
};
const THEMES = {
    classic: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' },
    magma: { 0.0: '#000004', 0.2: '#3b0f70', 0.4: '#8c2981', 0.6: '#de4968', 0.8: '#fe9f6d', 1.0: '#fcfdbf' },
    viridis: { 0.0: '#440154', 0.2: '#414487', 0.4: '#2a788e', 0.6: '#22a884', 0.8: '#7ad151', 1.0: '#fde725' },
    plasma: { 0.0: '#0d0887', 0.2: '#6a00a8', 0.4: '#b12a90', 0.6: '#e16462', 0.8: '#fca636', 1.0: '#f0f921' },
    cold: { 0.4: '#004c6d', 0.6: '#008ba3', 0.7: '#00c691', 0.8: '#a1ff8a', 1.0: '#faff1f' }
};

// ── Snapshot Mode Setup ───────────────────────────────────

const snapshotMode = new SnapshotMode({
    onCapture: handleSnapshotCapture,
    getResolution: () => currentExportResolution,
    setResolution: (val) => {
        currentExportResolution = val;
        savePreferences();
    }
});

async function handleSnapshotCapture({ rect, multiplier }) {
    const radius = parseInt(document.getElementById('radiusSlider').value);
    const blur = parseInt(document.getElementById('blurSlider').value);
    const opacity = parseFloat(document.getElementById('opacitySlider').value);
    const thresholdPercent = parseInt(document.getElementById('thresholdSlider').value) / 100;
    const scaling = document.getElementById('scalingSelect').value;
    const themeName = document.getElementById('themeSelect').value;
    const invert = document.getElementById('invertCheck').checked;

    let gradient = { ...THEMES[themeName] };
    if (invert && scaling === 'default') {
        const keys = Object.keys(gradient).sort();
        const values = keys.map(k => gradient[k]).reverse();
        gradient = {}; keys.forEach((k, i) => gradient[k] = values[i]);
    }

    const timeRange = timeSlider ? timeSlider.get().map(v => +v) : [0, Infinity];

    snapshotMode.deactivate();
    document.body.classList.remove('snapshot-active');

    await Exporter.capture({
        rect, multiplier, map,
        heatmapConfig: { radius, blur, opacity, gradient, maxIntensity: 1 },
        locations: rawLocations,
        timeRange,
        season: currentSeason,
        scaling,
        thresholdPercent,
        invert
    });
}

document.getElementById('snapshotBtn').addEventListener('click', () => {
    if (!hasData) return;
    document.body.classList.add('snapshot-active');
    snapshotMode.activate();
});

// ── Heatmap & Fog Rendering ─────────────────────────────────────

function updateVisualization() {
    if (currentMode === 'heatmap') {
        document.getElementById('heatmapControls').style.display = 'block';
        document.getElementById('fogControls').style.display = 'none';
        if (fogLayer) { fogLayer.destroy(); fogLayer = null; }
        updateHeatmap();
    } else {
        document.getElementById('heatmapControls').style.display = 'none';
        document.getElementById('fogControls').style.display = 'block';
        if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
        updateFog();
    }
}

function updateFog() {
    const opacity = document.getElementById('fogOpacitySlider').value;
    const radius = document.getElementById('fogRadiusSlider').value;
    const softness = document.getElementById('fogSoftnessSlider').value;
    const season = currentSeason;

    document.getElementById('fogOpacityValue').textContent = opacity;
    document.getElementById('fogRadiusValue').textContent = radius;
    document.getElementById('fogSoftnessValue').textContent = softness;

    const range = timeSlider ? timeSlider.get().map(v => +v) : [0, Infinity];
    const filtered = rawLocations.filter(l => {
        if (l.ts < range[0] || l.ts > range[1]) return false;
        if (season !== 'all') {
            const m = new Date(l.ts).getMonth();
            if (season === 'winter' && ![11, 0, 1].includes(m)) return false;
            if (season === 'spring' && ![2, 3, 4].includes(m)) return false;
            if (season === 'summer' && ![5, 6, 7].includes(m)) return false;
            if (season === 'fall' && ![8, 9, 10].includes(m)) return false;
        }
        return true;
    });

    if (!fogLayer) {
        fogLayer = new FogLayer(map, { opacity, radius, softness, color: currentAppearance === 'dark' ? '#0a0a0a' : '#111' });
    } else {
        fogLayer.setOptions({ opacity, radius, softness, color: currentAppearance === 'dark' ? '#0a0a0a' : '#111' });
    }
    fogLayer.setData(filtered);

    savePreferences();
}

function updateHeatmap() {
    if (!rawLocations.length) return;
    const radius = parseInt(document.getElementById('radiusSlider').value);
    const blur = parseInt(document.getElementById('blurSlider').value);
    const opacity = parseFloat(document.getElementById('opacitySlider').value);
    const thresholdPercent = parseInt(document.getElementById('thresholdSlider').value) / 100;
    const scaling = document.getElementById('scalingSelect').value;
    const season = currentSeason;
    const themeName = document.getElementById('themeSelect').value;
    const invert = document.getElementById('invertCheck').checked;

    document.getElementById('radiusValue').textContent = radius;
    document.getElementById('blurValue').textContent = blur;
    document.getElementById('opacityValue').textContent = opacity;
    document.getElementById('thresholdValue').textContent = Math.round(thresholdPercent * 100);

    const range = timeSlider ? timeSlider.get().map(v => +v) : [0, Infinity];
    const filtered = rawLocations.filter(l => {
        if (l.ts < range[0] || l.ts > range[1]) return false;
        if (season !== 'all') {
            const m = new Date(l.ts).getMonth();
            if (season === 'winter' && ![11, 0, 1].includes(m)) return false;
            if (season === 'spring' && ![2, 3, 4].includes(m)) return false;
            if (season === 'summer' && ![5, 6, 7].includes(m)) return false;
            if (season === 'fall' && ![8, 9, 10].includes(m)) return false;
        }
        return true;
    });

    let finalPoints = [], maxIntensity = 1.0;
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
        finalPoints = grouped.filter(g => g.count >= (peakCount * thresholdPercent)).map(g => {
            let val = scaling === 'log' ? Math.log10(g.count + 1) : g.count;
            return [g.lat, g.lng, scaling === 'default' ? 1 : (invert ? (maxIntensity - val) : val)];
        });
    } else finalPoints = filtered.map(l => [l.lat, l.lng]);

    let gradient = { ...THEMES[themeName] };
    if (invert && scaling === 'default') {
        const keys = Object.keys(gradient).sort();
        const values = keys.map(k => gradient[k]).reverse();
        gradient = {}; keys.forEach((k, i) => gradient[k] = values[i]);
    }
    if (heatLayer) map.removeLayer(heatLayer);
    heatLayer = L.heatLayer(finalPoints, { radius, blur, minOpacity: 0.05, max: maxIntensity || 1, gradient }).addTo(map);
    if (heatLayer._canvas) heatLayer._canvas.style.opacity = opacity;

    // Update Legend
    let legendColors = Object.keys(gradient).sort().map(k => gradient[k]);
    document.getElementById('legendBar').style.background = `linear-gradient(to right, ${legendColors.join(', ')})`;

    savePreferences();
}

/** Persist settings to localStorage (called from updateHeatmap and other state changes) */
function savePreferences() {
    const isModified = currentAppearance !== DEFAULT_SETTINGS.appearance ||
        currentSeason !== DEFAULT_SETTINGS.season ||
        document.getElementById('themeSelect').value !== DEFAULT_SETTINGS.theme ||
        document.getElementById('scalingSelect').value !== DEFAULT_SETTINGS.scaling ||
        document.getElementById('thresholdSlider').value !== DEFAULT_SETTINGS.threshold ||
        document.getElementById('radiusSlider').value !== DEFAULT_SETTINGS.radius ||
        document.getElementById('blurSlider').value !== DEFAULT_SETTINGS.blur ||
        document.getElementById('opacitySlider').value !== DEFAULT_SETTINGS.opacity ||
        document.getElementById('invertCheck').checked !== DEFAULT_SETTINGS.invert ||
        currentMergeStrategy !== DEFAULT_SETTINGS.mergeStrategy ||
        currentExportResolution !== DEFAULT_SETTINGS.exportResolution ||
        currentMode !== DEFAULT_SETTINGS.mode ||
        document.getElementById('fogOpacitySlider').value !== DEFAULT_SETTINGS.fogOpacity ||
        document.getElementById('fogRadiusSlider').value !== DEFAULT_SETTINGS.fogRadius ||
        document.getElementById('fogSoftnessSlider').value !== DEFAULT_SETTINGS.fogSoftness;

    if (isModified) {
        const currentSettings = {
            appearance: currentAppearance,
            season: currentSeason,
            theme: document.getElementById('themeSelect').value,
            scaling: document.getElementById('scalingSelect').value,
            threshold: document.getElementById('thresholdSlider').value,
            radius: document.getElementById('radiusSlider').value,
            blur: document.getElementById('blurSlider').value,
            opacity: document.getElementById('opacitySlider').value,
            invert: document.getElementById('invertCheck').checked,
            mergeStrategy: currentMergeStrategy,
            exportResolution: currentExportResolution,
            mode: currentMode,
            fogOpacity: document.getElementById('fogOpacitySlider').value,
            fogRadius: document.getElementById('fogRadiusSlider').value,
            fogSoftness: document.getElementById('fogSoftnessSlider').value
        };
        localStorage.setItem('timelineHeatmapSettings', JSON.stringify(currentSettings));
        showSaveIndicator();
    } else {
        localStorage.removeItem('timelineHeatmapSettings');
    }

    const resetBtn = document.getElementById('resetDefaultsBtn');
    if (resetBtn) {
        if (isModified) resetBtn.classList.add('show');
        else resetBtn.classList.remove('show');
    }
}

// ── Playback ──────────────────────────────────────────────

function togglePlayback() {
    isPlaying = !isPlaying;
    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');

    if (isPlaying) {
        playBtn.classList.add('playing');
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        animate();
    } else {
        playBtn.classList.remove('playing');
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        cancelAnimationFrame(animationFrame);
    }
}
function animate() {
    const range = timeSlider.get().map(v => +v), bounds = timeSlider.options.range, step = (bounds.max - bounds.min) / 300;
    let newEnd = range[1] + step;
    if (newEnd > bounds.max) { newEnd = bounds.max; togglePlayback(); }
    timeSlider.set([range[0], newEnd]);
    if (isPlaying) animationFrame = requestAnimationFrame(animate);
}

// ── Event Listeners ───────────────────────────────────────

['radiusSlider', 'blurSlider', 'opacitySlider', 'thresholdSlider'].forEach(id => document.getElementById(id).addEventListener('input', updateVisualization));
['fogOpacitySlider', 'fogRadiusSlider', 'fogSoftnessSlider'].forEach(id => document.getElementById(id).addEventListener('input', updateVisualization));
['scalingSelect', 'themeSelect', 'invertCheck'].forEach(id => document.getElementById(id).addEventListener('change', updateVisualization));
document.getElementById('playBtn').addEventListener('click', togglePlayback);

document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const group = e.target.closest('.segmented-control');
        group.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        if (group.id === 'seasonGroup') {
            currentSeason = e.target.getAttribute('data-val');
            updateVisualization();
        } else if (group.id === 'modeGroup') {
            currentMode = e.target.getAttribute('data-val');
            updateVisualization();
        } else if (group.id === 'appearanceGroup') {
            setTheme(e.target.getAttribute('data-val'));
        } else if (group.id === 'mergeStrategyGroup') {
            currentMergeStrategy = e.target.getAttribute('data-val');
            savePreferences();
        }
    });
});

document.getElementById('settingsToggle').addEventListener('click', () => {
    document.getElementById('settingsSidebar').classList.add('open');
    document.getElementById('settingsToggle').classList.add('active');
});
document.getElementById('closeSidebar').addEventListener('click', () => {
    document.getElementById('settingsSidebar').classList.remove('open');
    document.getElementById('settingsToggle').classList.remove('active');
});

document.getElementById('resetDefaultsBtn').addEventListener('click', () => {
    localStorage.removeItem('timelineHeatmapSettings');

    const appMode = DEFAULT_SETTINGS.appearance;
    document.querySelectorAll('#appearanceGroup .seg-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-val') === appMode);
    });
    setTheme(appMode, false);

    currentSeason = DEFAULT_SETTINGS.season;
    document.querySelectorAll('#seasonGroup .seg-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-val') === currentSeason);
    });

    currentMergeStrategy = DEFAULT_SETTINGS.mergeStrategy;
    document.querySelectorAll('#mergeStrategyGroup .seg-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-val') === currentMergeStrategy);
    });

    currentExportResolution = DEFAULT_SETTINGS.exportResolution;

    document.getElementById('themeSelect').value = DEFAULT_SETTINGS.theme;
    document.getElementById('scalingSelect').value = DEFAULT_SETTINGS.scaling;
    document.getElementById('thresholdSlider').value = DEFAULT_SETTINGS.threshold;
    document.getElementById('radiusSlider').value = DEFAULT_SETTINGS.radius;
    document.getElementById('blurSlider').value = DEFAULT_SETTINGS.blur;
    document.getElementById('opacitySlider').value = DEFAULT_SETTINGS.opacity;
    document.getElementById('invertCheck').checked = DEFAULT_SETTINGS.invert;

    currentMode = DEFAULT_SETTINGS.mode;
    document.querySelectorAll('#modeGroup .seg-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-val') === currentMode);
    });
    document.getElementById('fogOpacitySlider').value = DEFAULT_SETTINGS.fogOpacity;
    document.getElementById('fogRadiusSlider').value = DEFAULT_SETTINGS.fogRadius;
    document.getElementById('fogSoftnessSlider').value = DEFAULT_SETTINGS.fogSoftness;
    
    updateVisualization();
});

document.getElementById('homeBtn').addEventListener('click', () => {
    if (hasData && confirm('Clear current data and return to the welcome screen?')) {
        rawLocations = [];
        setHasData(false);
        if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
        if (fogLayer) { fogLayer.destroy(); fogLayer = null; }
        if (timeSlider) { timeSlider.destroy(); timeSlider = null; }
        document.getElementById('fileInput').value = '';
    }
});

function setHasData(state) {
    hasData = state;
    if (hasData) {
        document.getElementById('map').classList.remove('blurred');
        document.getElementById('onboardingModal').classList.add('hidden');
        document.getElementById('statsDisplay').style.display = 'flex';
        document.getElementById('playback-dock').style.display = 'flex';
    } else {
        document.getElementById('map').classList.add('blurred');
        document.getElementById('onboardingModal').classList.remove('hidden');
        document.getElementById('statsDisplay').style.display = 'none';
        document.getElementById('playback-dock').style.display = 'none';
    }
}

// ── File Upload / Drop ────────────────────────────────────

const dropZone = document.getElementById('dropZone');
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});
['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});
dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length) handleFiles(dt.files);
});

document.getElementById('fileInput').addEventListener('change', function (e) {
    if (e.target.files && e.target.files.length) handleFiles(e.target.files);
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById('tab-' + e.target.getAttribute('data-tab')).classList.add('active');
    });
});

// ── Multi-File Processing ─────────────────────────────────

/**
 * Read a single File object and return its parsed contents as a Promise.
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

/**
 * Handle one or more uploaded JSON files:
 * 1. Read all files concurrently with Promise.all
 * 2. Parse each file with TimelineParser
 * 3. Merge all parsed arrays using the selected merge strategy
 * 4. Recalculate stats and update the UI
 *
 * @param {FileList} files
 */
async function handleFiles(files) {
    if (!files || !files.length) return;
    document.getElementById('loading').style.display = 'grid';

    try {
        // Read all files concurrently
        const fileArray = Array.from(files);
        const textResults = await Promise.all(fileArray.map(f => readFileAsText(f)));

        // Parse each file
        const parsedArrays = textResults.map(text => {
            const data = JSON.parse(text);
            return TimelineParser.parse(data);
        });

        // Merge using the active strategy
        rawLocations = Merger.merge(parsedArrays, currentMergeStrategy);

        if (!rawLocations.length) {
            alert('No location data found in the selected file(s).');
            return;
        }

        // Recalculate stats
        const formatNum = (num) => {
            if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
            return Math.floor(num).toString();
        };

        document.getElementById('pointCount').textContent = formatNum(rawLocations.length);
        document.getElementById('distance').textContent = formatNum(DistanceCalculator.calculateTotal(rawLocations));

        setHasData(true);

        // Recalculate time slider range
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < rawLocations.length; i++) {
            const ts = rawLocations[i].ts;
            if (ts > 0) { if (ts < min) min = ts; if (ts > max) max = ts; }
        }
        if (min === Infinity) { min = 0; max = Date.now(); }
        if (timeSlider) timeSlider.destroy();
        timeSlider = noUiSlider.create(document.getElementById('time-slider'), {
            start: [min, max], connect: true, range: { min, max },
            tooltips: [{ to: v => new Date(+v).toLocaleDateString() }, { to: v => new Date(+v).toLocaleDateString() }]
        });
        timeSlider.on('update', updateVisualization);
        updateVisualization();
        map.fitBounds(L.latLngBounds(rawLocations.map(l => [l.lat, l.lng])));
    } catch (err) {
        console.error(err);
        alert('Error processing data. Check the console for details.');
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

// ── Settings Persistence ──────────────────────────────────

function loadSettingsFromStorage() {
    try {
        const saved = JSON.parse(localStorage.getItem('timelineHeatmapSettings'));
        if (saved) {
            const appMode = saved.appearance || DEFAULT_SETTINGS.appearance;
            document.querySelectorAll('#appearanceGroup .seg-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-val') === appMode);
            });
            setTheme(appMode, false);

            currentSeason = saved.season || DEFAULT_SETTINGS.season;
            document.querySelectorAll('#seasonGroup .seg-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-val') === currentSeason);
            });

            currentMergeStrategy = saved.mergeStrategy || DEFAULT_SETTINGS.mergeStrategy;
            document.querySelectorAll('#mergeStrategyGroup .seg-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-val') === currentMergeStrategy);
            });

            currentExportResolution = saved.exportResolution || DEFAULT_SETTINGS.exportResolution;

            document.getElementById('themeSelect').value = saved.theme || DEFAULT_SETTINGS.theme;
            document.getElementById('scalingSelect').value = saved.scaling || DEFAULT_SETTINGS.scaling;
            document.getElementById('thresholdSlider').value = saved.threshold || DEFAULT_SETTINGS.threshold;
            document.getElementById('radiusSlider').value = saved.radius || DEFAULT_SETTINGS.radius;
            document.getElementById('blurSlider').value = saved.blur || DEFAULT_SETTINGS.blur;
            document.getElementById('opacitySlider').value = saved.opacity || DEFAULT_SETTINGS.opacity;
            document.getElementById('invertCheck').checked = saved.invert !== undefined ? saved.invert : DEFAULT_SETTINGS.invert;

            document.getElementById('radiusValue').textContent = document.getElementById('radiusSlider').value;
            document.getElementById('blurValue').textContent = document.getElementById('blurSlider').value;
            document.getElementById('opacityValue').textContent = document.getElementById('opacitySlider').value;
            document.getElementById('thresholdValue').textContent = document.getElementById('thresholdSlider').value;

            currentMode = saved.mode || DEFAULT_SETTINGS.mode;
            document.querySelectorAll('#modeGroup .seg-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-val') === currentMode);
            });
            document.getElementById('fogOpacitySlider').value = saved.fogOpacity || DEFAULT_SETTINGS.fogOpacity;
            document.getElementById('fogRadiusSlider').value = saved.fogRadius || DEFAULT_SETTINGS.fogRadius;
            document.getElementById('fogSoftnessSlider').value = saved.fogSoftness || DEFAULT_SETTINGS.fogSoftness;
            
            document.getElementById('fogOpacityValue').textContent = document.getElementById('fogOpacitySlider').value;
            document.getElementById('fogRadiusValue').textContent = document.getElementById('fogRadiusSlider').value;
            document.getElementById('fogSoftnessValue').textContent = document.getElementById('fogSoftnessSlider').value;

            updateVisualization();

            const resetBtn = document.getElementById('resetDefaultsBtn');
            if (resetBtn) resetBtn.classList.add('show');
        }
    } catch (e) {
        console.error("Could not load settings", e);
    }
}

document.addEventListener('DOMContentLoaded', loadSettingsFromStorage);
