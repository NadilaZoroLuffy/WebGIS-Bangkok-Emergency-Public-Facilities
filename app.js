/* ============================================
   Bangkok Emergency & Public Facilities WebGIS
   ============================================ */

(function () {
    'use strict';

    // ===== Category Configuration =====
    const CATEGORIES = {
        emergency: {
            label: 'Emergency',
            icon: '🚨',
            color: '#ff6b6b',
            subcategories: {
                fire_hydrant:       { label: 'Fire Hydrant',       icon: '🔴', color: '#e74c3c' },
                fire_extinguisher:  { label: 'Fire Extinguisher',  icon: '🧯', color: '#e67e22' },
                defibrillator:      { label: 'Defibrillator',      icon: '💚', color: '#2ecc71' },
                fire_service_inlet: { label: 'Fire Service Inlet', icon: '🔶', color: '#f39c12' },
                assembly_point:     { label: 'Assembly Point',     icon: '📍', color: '#9b59b6' },
                fire_alarm_box:     { label: 'Fire Alarm',         icon: '🔔', color: '#e74c3c' },
                first_aid:          { label: 'First Aid',          icon: '🩹', color: '#1abc9c' },
                phone:              { label: 'Emergency Phone',    icon: '📞', color: '#3498db' },
            }
        },
        amenity: {
            label: 'Amenity',
            icon: '🏛️',
            color: '#6c63ff',
            subcategories: {
                hospital:          { label: 'Hospital',          icon: '🏥', color: '#e74c3c' },
                clinic:            { label: 'Clinic',            icon: '⚕️', color: '#e91e63' },
                police:            { label: 'Police',            icon: '👮', color: '#3f51b5' },
                library:           { label: 'Library',           icon: '📚', color: '#00bcd4' },
                place_of_worship:  { label: 'Place of Worship',  icon: '🛕', color: '#ff9800' },
                toilets:           { label: 'Toilets',           icon: '🚻', color: '#607d8b' },
                community_centre:  { label: 'Community Centre',  icon: '🏘️', color: '#8bc34a' },
                school:            { label: 'School',            icon: '🏫', color: '#03a9f4' },
                bus_station:       { label: 'Bus Station',       icon: '🚌', color: '#ff5722' },
            }
        },
        historic: {
            label: 'Historic',
            icon: '🏛️',
            color: '#ffd93d',
            subcategories: {
                wayside_shrine:      { label: 'Wayside Shrine',      icon: '⛩️', color: '#ffd93d' },
                monument:            { label: 'Monument',             icon: '🗿', color: '#a0522d' },
                memorial:            { label: 'Memorial',             icon: '🎖️', color: '#cd853f' },
                archaeological_site: { label: 'Archaeological Site',  icon: '🏺', color: '#daa520' },
                locomotive:          { label: 'Locomotive',           icon: '🚂', color: '#708090' },
                cannon:              { label: 'Cannon',               icon: '💣', color: '#556b2f' },
                tomb:                { label: 'Tomb',                 icon: '⚰️', color: '#696969' },
                yes:                 { label: 'Historic Site',        icon: '📜', color: '#b8860b' },
            }
        }
    };

    const BASEMAPS = {
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OSM &copy; CARTO',
            maxZoom: 19
        }),
        light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OSM &copy; CARTO',
            maxZoom: 19
        })
    };

    let map;
    let currentBasemap = 'dark';
    let allFeatures = [];
    let layerGroups = {};
    let layerVisible = {};

    function initMap() {
        map = L.map('map', {
            center: [13.75, 100.52],
            zoom: 11
        });
        BASEMAPS[currentBasemap].addTo(map);
    }

    function classifyFeature(props) {
        if (props.emergency && props.emergency !== 'no' && props.emergency !== 'yes') {
            const sub = CATEGORIES.emergency.subcategories[props.emergency];
            if (sub) return { category: 'emergency', subcategory: props.emergency, ...sub };
        }
        if (props.amenity) {
            const sub = CATEGORIES.amenity.subcategories[props.amenity];
            if (sub) return { category: 'amenity', subcategory: props.amenity, ...sub };
        }
        if (props.historic) {
            const sub = CATEGORIES.historic.subcategories[props.historic];
            if (sub) return { category: 'historic', subcategory: props.historic, ...sub };
        }
        return null;
    }

    function createIcon(classification) {
        return L.divIcon({
            className: 'custom-marker-wrapper',
            html: `<div class="custom-marker" style="background:${classification.color}; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3); font-size:12px;">${classification.icon}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -14]
        });
    }

    async function loadData() {
        const loadingOverlay = document.getElementById('loading-overlay');
        try {
            // Memanggil file GeoJSON
            const resp = await fetch('Data_EmergencyPublic_Bangkok.geojson');
            
            if (!resp.ok) {
                throw new Error(`File tidak ditemukan (Status: ${resp.status}). Pastikan nama file di folder Web sudah benar.`);
            }

            const geojson = await resp.json();
            allFeatures = geojson.features;
            
            if (allFeatures.length === 0) {
                throw new Error("File GeoJSON terbaca, tapi tidak ada data fitur (features) di dalamnya.");
            }

            processFeatures();
        } catch (err) {
            console.error('Detail Error:', err);
            loadingOverlay.innerHTML = `
                <div class="loader" style="background: rgba(0,0,0,0.8); padding: 20px; border-radius: 8px; text-align:center;">
                    <p style="color:#ff6b6b; font-weight: bold; font-size:1.2rem;">❌ Error Terjadi</p>
                    <p style="color:white; margin: 10px 0;">${err.message}</p>
                    <button onclick="location.reload()" style="padding:8px 16px; cursor:pointer;">Coba Lagi</button>
                </div>`;
        }
    }

    function processFeatures() {
        const subcategoryCounts = {};

        allFeatures.forEach(feature => {
            const props = feature.properties;
            const cls = classifyFeature(props);
            if (!cls) return;

            const key = cls.subcategory;
            if (!subcategoryCounts[key]) {
                subcategoryCounts[key] = { count: 0, classification: cls };
            }
            subcategoryCounts[key].count++;

            if (!layerGroups[key]) {
                layerGroups[key] = L.markerClusterGroup({
                    maxClusterRadius: 40,
                    disableClusteringAtZoom: 16
                });
                layerVisible[key] = true;
            }

            const coords = feature.geometry.coordinates;
            // Handle Point data
            if (feature.geometry.type === "Point") {
                const marker = L.marker([coords[1], coords[0]], { icon: createIcon(cls) });
                marker.bindPopup(`<strong>${props.name || 'Fasilitas Tanpa Nama'}</strong><br>${cls.label}`);
                layerGroups[key].addLayer(marker);
            }
        });

        Object.keys(layerGroups).forEach(key => map.addLayer(layerGroups[key]));

        // Sembunyikan loading overlay setelah selesai
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    function init() {
        initMap();
        loadData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();