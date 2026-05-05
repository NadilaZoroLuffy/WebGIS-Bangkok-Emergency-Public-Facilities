(function () {
'use strict';

// ================= CATEGORIES =================
const CATEGORIES = {
    emergency: {
        subcategories: {
            fire_hydrant:  { label: 'Fire Hydrant',  icon: '🔴', color: '#e74c3c' },
            defibrillator: { label: 'Defibrillator', icon: '💚', color: '#2ecc71' },
            first_aid:     { label: 'First Aid',     icon: '🩹', color: '#1abc9c' }
        }
    },
    amenity: {
        subcategories: {
            hospital: { label: 'Hospital', icon: '🏥', color: '#e74c3c' },
            police:   { label: 'Police',   icon: '👮', color: '#3f51b5' },
            school:   { label: 'School',   icon: '🏫', color: '#03a9f4' }
        }
    }
};

// ================= STATE =================
const activeFilters = new Set();
Object.values(CATEGORIES).forEach(cat =>
    Object.keys(cat.subcategories).forEach(k => activeFilters.add(k))
);
const allMarkers = [];

// ================= MAP =================
let map = L.map('map').setView([13.75, 100.52], 11);

const basemaps = {
    dark:      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',    { maxZoom: 19 }),
    light:     L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',   { maxZoom: 19 }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
    street:    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',               { maxZoom: 19 })
};
basemaps.dark.addTo(map);
let currentBasemap = 'dark';

const cluster = L.markerClusterGroup({ chunkedLoading: true });
map.addLayer(cluster);

// ================= CLASSIFY =================
function classify(props) {
    if (props.emergency && CATEGORIES.emergency.subcategories[props.emergency])
        return { key: props.emergency, cls: CATEGORIES.emergency.subcategories[props.emergency] };
    if (props.amenity && CATEGORIES.amenity.subcategories[props.amenity])
        return { key: props.amenity, cls: CATEGORIES.amenity.subcategories[props.amenity] };
    return null;
}

// ================= ICON =================
function createIcon(cls) {
    return L.divIcon({
        className: '',
        html: `<div style="background:${cls.color};width:30px;height:30px;border-radius:50%;
                   display:flex;align-items:center;justify-content:center;font-size:15px;
                   border:2px solid rgba(255,255,255,0.9);
                   box-shadow:0 2px 8px rgba(0,0,0,0.45);cursor:pointer;">${cls.icon}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

// ================= STATS =================
function updateStats() {
    const total   = allMarkers.length;
    const visible = allMarkers.filter(m => activeFilters.has(m.typeKey)).length;
    const tEl = document.getElementById('total-features');
    const vEl = document.getElementById('visible-features');
    if (tEl) tEl.textContent = total;
    if (vEl) vEl.textContent = visible;
}

// ================= FILTER =================
function applyFilters() {
    cluster.clearLayers();
    allMarkers.forEach(({ marker, typeKey }) => {
        if (activeFilters.has(typeKey)) cluster.addLayer(marker);
    });
    updateStats();
}

// ================= LEGEND =================
function renderLegend() {
    const container = document.getElementById('legend-items');
    if (!container) return;
    container.innerHTML = '';
    Object.values(CATEGORIES).forEach(cat => {
        Object.entries(cat.subcategories).forEach(([key, sub]) => {
            const div = document.createElement('div');
            div.className = 'legend-entry legend-clickable';
            div.setAttribute('data-key', key);
            div.setAttribute('title', 'Klik untuk show/hide ' + sub.label);
            div.innerHTML = `
                <div class="legend-marker" style="background:${sub.color};">${sub.icon}</div>
                <div class="legend-text">${sub.label}</div>
                <div class="legend-eye">👁</div>`;
            div.addEventListener('click', () => toggleFilter(key));
            container.appendChild(div);
        });
    });
}

function toggleFilter(key) {
    activeFilters.has(key) ? activeFilters.delete(key) : activeFilters.add(key);
    updateLegendState();
    syncCheckboxes();
    applyFilters();
}

function updateLegendState() {
    document.querySelectorAll('.legend-clickable').forEach(div => {
        const isActive = activeFilters.has(div.getAttribute('data-key'));
        div.style.opacity          = isActive ? '1' : '0.4';
        div.style.textDecoration   = isActive ? 'none' : 'line-through';
        const eye = div.querySelector('.legend-eye');
        if (eye) eye.textContent   = isActive ? '👁' : '🚫';
    });
}

// ================= LAYER CONTROLS =================
function renderLayerControls() {
    const container = document.getElementById('layer-controls');
    if (!container) return;
    container.innerHTML = '';
    Object.values(CATEGORIES).forEach(cat => {
        Object.entries(cat.subcategories).forEach(([key, sub]) => {
            const item = document.createElement('label');
            item.className = 'layer-item';
            item.style.cursor = 'pointer';
            item.innerHTML = `
                <span class="layer-checkbox">
                    <input type="checkbox" checked data-layer-key="${key}">
                    <span class="checkmark"></span>
                </span>
                <span class="layer-color-dot" style="background:${sub.color};color:${sub.color};"></span>
                <span class="layer-label">${sub.label}</span>
                <span class="layer-count" id="count-${key}">0</span>`;
            item.querySelector('input').addEventListener('change', e => {
                e.target.checked ? activeFilters.add(key) : activeFilters.delete(key);
                updateLegendState();
                syncCheckboxes();
                applyFilters();
            });
            container.appendChild(item);
        });
    });
}

function syncCheckboxes() {
    document.querySelectorAll('[data-layer-key]').forEach(cb => {
        cb.checked = activeFilters.has(cb.getAttribute('data-layer-key'));
    });
}

function updateCounts() {
    const counts = {};
    allMarkers.forEach(({ typeKey }) => { counts[typeKey] = (counts[typeKey] || 0) + 1; });
    Object.entries(counts).forEach(([key, n]) => {
        const el = document.getElementById('count-' + key);
        if (el) el.textContent = n;
    });
}

// ================= BASEMAP =================
function initBasemapControls() {
    document.querySelectorAll('[data-basemap]').forEach(label => {
        label.addEventListener('click', () => {
            const bm = label.getAttribute('data-basemap');
            if (bm === currentBasemap) return;
            map.removeLayer(basemaps[currentBasemap]);
            basemaps[bm].addTo(map);
            basemaps[bm].bringToBack();
            currentBasemap = bm;
            document.querySelectorAll('.basemap-option').forEach(l => l.classList.remove('active'));
            label.classList.add('active');
        });
    });
}

// ================= SIDEBAR TOGGLE =================
function initSidebarToggle() {
    const btn     = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (btn && sidebar) btn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
}

// ================= LOAD DATA =================
async function loadData() {
    const overlay = document.getElementById('loading-overlay');
    try {
        const res = await fetch('Data_EmergencyPublic_Bangkok.geojson');
        if (!res.ok) throw new Error('GeoJSON tidak ditemukan (cek nama file & folder)');
        const data = await res.json();
        if (!data.features) throw new Error('Format GeoJSON salah');

        data.features.forEach(f => {
            if (f.geometry.type !== 'Point') return;
            const props  = f.properties;
            const result = classify(props);
            if (!result) return;

            const { key, cls } = result;
            const [lng, lat]   = f.geometry.coordinates;

            const marker = L.marker([lat, lng], { icon: createIcon(cls) });

            // ── Google Maps URL — pin tepat di koordinat marker ──
            // ?q=lat,lng  meletakkan pin merah di titik tersebut
            const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=18`;

            const addressHtml = props['addr:street']
                ? `<div style="font-size:11px;color:#aaa;margin:4px 0 2px;">
                       📍 ${props['addr:street']}
                   </div>`
                : '';

            const websiteBtn = props.website
                ? `<a href="${props.website}" target="_blank" rel="noopener"
                      style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;
                             background:#333;color:#ccc;padding:8px 10px;border-radius:7px;
                             font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap;">
                       🌐 Website
                   </a>`
                : '';

            // Popup selalu tampil dulu, lalu user klik tombol Google Maps
            marker.bindPopup(`
                <div style="font-family:Inter,sans-serif;min-width:220px;max-width:290px;">
                    <div style="display:flex;align-items:center;gap:10px;
                                border-bottom:1px solid rgba(255,255,255,0.08);
                                padding-bottom:10px;margin-bottom:8px;">
                        <div style="width:38px;height:38px;border-radius:10px;background:${cls.color};
                                    display:flex;align-items:center;justify-content:center;
                                    font-size:20px;flex-shrink:0;">
                            ${cls.icon}
                        </div>
                        <div>
                            <div style="font-weight:700;font-size:14px;color:#e8eaed;line-height:1.3;">
                                ${props.name || 'Fasilitas'}
                            </div>
                            <div style="font-size:11px;color:#888;text-transform:uppercase;
                                        letter-spacing:0.5px;margin-top:2px;">
                                ${cls.label}
                            </div>
                        </div>
                    </div>
                    ${addressHtml}
                    <div style="display:flex;gap:7px;margin-top:10px;">
                        <a href="${mapsUrl}" target="_blank" rel="noopener"
                           style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;
                                  background:${cls.color};color:#fff;padding:8px 10px;border-radius:7px;
                                  font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap;">
                            📍 Google Maps
                        </a>
                        ${websiteBtn}
                    </div>
                </div>
            `, { maxWidth: 300 });

            allMarkers.push({ marker, typeKey: key });
            cluster.addLayer(marker);
        });

        updateCounts();
        updateStats();
        if (overlay) overlay.classList.add('hidden');

    } catch (err) {
        console.error(err);
        if (overlay) overlay.innerHTML = `
            <div style="text-align:center;font-family:Inter,sans-serif;">
                <h3 style="color:#e74c3c;margin-bottom:12px;">⚠️ ERROR</h3>
                <p style="margin-bottom:8px;">${err.message}</p>
                <p style="font-size:13px;color:#888;">
                    Cek:<br>• Nama file GeoJSON<br>
                    • Lokasi file (1 folder dengan index.html)<br>
                    • Jalankan via localhost / live server
                </p>
            </div>`;
    }
}

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
    renderLegend();
    renderLayerControls();
    initBasemapControls();
    initSidebarToggle();
    loadData();
});

})();