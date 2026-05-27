/**
 * D.U.B.I.A. — App State & Data Layer
 * IndexedDB + Google Sheets Cloud Sync
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const GAS_URL = "https://script.google.com/macros/s/AKfycbzW12kzUhqKywlxLkXbV22ef9MwP9jp3t77yCg3t5YxBVRqIy3iYwX1UjgaCX0VLAJ8jA/exec";
const ALPHA = 1e-6;

const DEFAULT_PARAMS = {
    theta1: 0.30,
    theta2: 1.05,
    mortalityRate: 1.5
};

const HEALTH_THRESHOLD_WARNING = 90;
const HEALTH_THRESHOLD_ALERT   = 75;

const MASS = {
    FEMALE: 2.5, MALE: 1.5, SUBADULT: 1.6,
    MEDIUM: 0.8, SMALL: 0.3, BABY: 0.1
};

const DEFAULT_PRICES = {
    FEMALE: 0.50, MALE: 0.40, SUBADULT: 0.30,
    MEDIUM: 0.20, SMALL: 0.10, BABY: 0.05
};

const BLATTA_TYPES = [
    { value: 'FEMALE',   label: '🔴 Femmine Adulte (2.5g)',  mass: 2.5 },
    { value: 'MALE',     label: '🔵 Maschi Adulti (1.5g)',   mass: 1.5 },
    { value: 'SUBADULT', label: '🟡 Sub-Adulte (1.6g)',      mass: 1.6 },
    { value: 'MEDIUM',   label: '🟢 Neanidi Medie (0.8g)',   mass: 0.8 },
    { value: 'SMALL',    label: '⚪ Neanidi Piccole (0.3g)', mass: 0.3 },
    { value: 'BABY',     label: '🟡 Micro-Neanidi (0.1g)',   mass: 0.1 }
];

const ANIMAL_BADGES = {
    rettile:   { label: '🦎 Rettile',   color: '#27AE60' },
    anfibio:   { label: '🐸 Anfibio',   color: '#3498db' },
    uccello:   { label: '🦜 Uccello',   color: '#F2C94C' },
    mammifero: { label: '🐾 Mammifero', color: '#e67e22' },
    pesce:     { label: '🐟 Pesce',     color: '#1abc9c' },
    altro:     { label: '🐾 Altro',     color: '#95a5a6' }
};

// ═══════════════════════════════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════════════════════════════

let appState = {
    measurements: [],
    params: { ...DEFAULT_PARAMS },
    charts: {},
    clients: [],
    cessioni: [],
    customPrices: { ...DEFAULT_PRICES },
    isOnline: navigator.onLine,
    currentPage: 'dashboard'
};

// Proxy to D.U.B.I.A. math module
const D = () => (typeof DUBIA !== 'undefined' ? DUBIA : null);

// ═══════════════════════════════════════════════════════════════
// INDEXEDDB
// ═══════════════════════════════════════════════════════════════

const dbName = "DubiaDB";
const dbVersion = 3;
let db;

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains("measurements")) {
                db.createObjectStore("measurements", { keyPath: "id", autoIncrement: true });
            }
            if (!db.objectStoreNames.contains("parameters")) {
                db.createObjectStore("parameters", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("clients")) {
                db.createObjectStore("clients", { keyPath: "id", autoIncrement: true });
            }
            if (!db.objectStoreNames.contains("cessioni")) {
                db.createObjectStore("cessioni", { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            loadInitialData().then(resolve);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(event.target.error);
        };
    });
};

// ═══════════════════════════════════════════════════════════════
// PARAM VALIDATION & MIGRATION
// ═══════════════════════════════════════════════════════════════

const validateAndMigrateParams = (stored) => {
    if (!stored || typeof stored !== 'object') return { ...DEFAULT_PARAMS };
    const theta1 = parseFloat(stored.theta1);
    const theta2 = parseFloat(stored.theta2);
    const theta1Valid = isFinite(theta1) && theta1 >= 0.01 && theta1 <= 2.0;
    const theta2Valid = isFinite(theta2) && theta2 >= 0.01 && theta2 <= 5.0;
    if (!theta1Valid || !theta2Valid) return { ...DEFAULT_PARAMS };
    return { ...DEFAULT_PARAMS, ...stored, theta1, theta2 };
};

const rebuildParamsFromMeasurements = (measurements) => {
    const dubiaModule = D();
    let theta1 = DEFAULT_PARAMS.theta1;
    let theta2 = DEFAULT_PARAMS.theta2;

    for (let i = 1; i < measurements.length; i++) {
        const prev = measurements[i - 1];
        const curr = measurements[i];
        const d1 = new Date(prev.date);
        const d2 = new Date(curr.date);
        const delta_g = Math.max(1, (d2 - d1) / (1000 * 60 * 60 * 24));
        const adultRatio = curr.adult_ratio || 0.35;
        const foodAmount = curr.food_amount || 0;

        const W_pred = dubiaModule
            ? dubiaModule.feedForward(prev.total_weight, foodAmount, adultRatio, delta_g, theta1, theta2)
            : prev.total_weight + (theta1 * foodAmount) + (theta2 * prev.total_weight * (1 - adultRatio) * (delta_g / 30));

        const bp = dubiaModule
            ? dubiaModule.backpropagate(theta1, theta2, W_pred, curr.total_weight, prev.total_weight, foodAmount, adultRatio, delta_g, ALPHA)
            : { theta1: theta1 - ALPHA * (W_pred - curr.total_weight) * foodAmount,
                theta2: theta2 - ALPHA * (W_pred - curr.total_weight) * prev.total_weight * (1 - adultRatio) * (delta_g / 30) };

        theta1 = Math.max(0.001, Math.min(2.0, bp.theta1));
        theta2 = Math.max(0.001, Math.min(5.0, bp.theta2));
    }

    return { theta1, theta2 };
};

// ═══════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════

const loadInitialData = async () => {
    // Load params from IndexedDB
    const storedParams = await new Promise((resolve) => {
        const tx = db.transaction("parameters", "readonly");
        const store = tx.objectStore("parameters");
        const req = store.get(1);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror  = () => resolve(null);
    });

    appState.params = validateAndMigrateParams(storedParams);
    if (!storedParams) saveParams(appState.params);

    // Load prices
    const storedPrices = await new Promise((resolve) => {
        const tx = db.transaction("parameters", "readonly");
        const store = tx.objectStore("parameters");
        const req = store.get(2);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror  = () => resolve(null);
    });
    if (storedPrices && storedPrices.prices) {
        appState.customPrices = { ...DEFAULT_PRICES, ...storedPrices.prices };
    }

    await loadClientsAndCessioni();

    // Try cloud
    try {
        showNotification("Sincronizzazione", "Download dati dal cloud...", "info");
        const response = await fetch(GAS_URL, { redirect: "follow" });

        if (response.ok) {
            const jsonResponse = await response.json();
            if (jsonResponse && jsonResponse.status === "error") {
                throw new Error("Cloud error: " + jsonResponse.message);
            }
            const data = jsonResponse.data || jsonResponse;
            if (Array.isArray(data) && data.length > 0) {
                appState.measurements = data.map(m => ({
                    ...m,
                    total_weight:     parseFloat(m.total_weight)     || parseFloat(m.Biomassa) || 0,
                    food_amount:      parseFloat(m.food_amount)      || 0,
                    harvest_amount:   parseFloat(m.harvest_amount)   || 0,
                    adult_ratio:      parseFloat(m.adult_ratio)      || 0,
                    predicted_weight: parseFloat(m.predicted_weight) || 0,
                    health_index:     parseFloat(m.health_index)     || 0,
                    is_new_blood:     m.is_new_blood === 'true' || m.is_new_blood === true
                })).sort((a, b) => new Date(a.date || a['Data Reale']) - new Date(b.date || b['Data Reale']));

                appState.measurements.forEach(m => {
                    if (!m.date && m['Data Reale']) m.date = m['Data Reale'];
                });

                if (appState.measurements.length > 1) {
                    const rebuilt = rebuildParamsFromMeasurements(appState.measurements);
                    appState.params.theta1 = rebuilt.theta1;
                    appState.params.theta2 = rebuilt.theta2;
                    saveParams(appState.params);
                }

                updateSystemStatus(true);
                showNotification("Sincronizzazione", "Dati cloud caricati con successo.", "success");
                return;
            }
        }
    } catch (e) {
        console.warn("Cloud fetch failed, using local DB.", e);
        updateSystemStatus(false);
        if (!navigator.onLine) {
            showNotification("Offline", "Caricamento dati locali.", "warning");
        }
    }

    // Fallback: local DB
    return new Promise((resolve) => {
        const measTx = db.transaction("measurements", "readonly");
        const measStore = measTx.objectStore("measurements");
        const measReq = measStore.getAll();
        measReq.onsuccess = () => {
            if (appState.measurements.length === 0) {
                appState.measurements = measReq.result.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
            resolve();
        };
    });
};

// ═══════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════

const saveParams = (params) => {
    const tx = db.transaction("parameters", "readwrite");
    const store = tx.objectStore("parameters");
    store.put({ id: 1, ...params });
};

const savePrices = (prices) => {
    appState.customPrices = { ...prices };
    const tx = db.transaction("parameters", "readwrite");
    const store = tx.objectStore("parameters");
    store.put({ id: 2, prices });
};

const saveMeasurement = async (measurement) => {
    try {
        const response = await fetch(GAS_URL, {
            method: 'POST', redirect: 'follow',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(measurement)
        });
        if (response.ok) {
            const result = await response.json();
            if (result && result.id) measurement.id = result.id;
        }
    } catch (e) {
        console.error("Cloud save failed:", e);
    }

    return new Promise((resolve) => {
        const tx = db.transaction("measurements", "readwrite");
        const store = tx.objectStore("measurements");
        if (!measurement.id) measurement.id = new Date().getTime();
        const req = store.put(measurement);
        req.onsuccess = () => {
            appState.measurements.push(measurement);
            resolve(measurement);
        };
    });
};

// ═══════════════════════════════════════════════════════════════
// CLIENTS & CESSIONI CRUD
// ═══════════════════════════════════════════════════════════════

const loadClientsAndCessioni = () => {
    return new Promise((resolve) => {
        const tx = db.transaction(["clients", "cessioni"], "readonly");
        const clientsReq = tx.objectStore("clients").getAll();
        const cessioniReq = tx.objectStore("cessioni").getAll();
        let done = 0;
        const check = () => { if (++done === 2) resolve(); };

        clientsReq.onsuccess = () => { appState.clients = clientsReq.result || []; check(); };
        cessioniReq.onsuccess = () => {
            appState.cessioni = (cessioniReq.result || []).sort((a, b) => new Date(b.data) - new Date(a.data));
            check();
        };
        clientsReq.onerror = check;
        cessioniReq.onerror = check;
    });
};

const saveClient = (client) => {
    return new Promise((resolve) => {
        const tx = db.transaction("clients", "readwrite");
        const req = tx.objectStore("clients").put(client);
        req.onsuccess = (e) => {
            if (!client.id) client.id = e.target.result;
            const idx = appState.clients.findIndex(c => c.id === client.id);
            if (idx >= 0) appState.clients[idx] = client;
            else appState.clients.push(client);
            resolve(client);
        };
        req.onerror = () => resolve(null);
    });
};

const deleteClient = (id) => {
    return new Promise((resolve) => {
        const tx = db.transaction(["clients", "cessioni"], "readwrite");
        tx.objectStore("clients").delete(Number(id));
        appState.clients = appState.clients.filter(c => c.id !== Number(id));
        const cessioniReq = tx.objectStore("cessioni").getAll();
        cessioniReq.onsuccess = () => {
            (cessioniReq.result || []).filter(c => c.cliente_id === Number(id)).forEach(c => tx.objectStore("cessioni").delete(c.id));
            appState.cessioni = appState.cessioni.filter(c => c.cliente_id !== Number(id));
            resolve();
        };
    });
};

const saveCessione = (cessione) => {
    return new Promise((resolve) => {
        const tx = db.transaction("cessioni", "readwrite");
        const req = tx.objectStore("cessioni").add(cessione);
        req.onsuccess = (e) => {
            cessione.id = e.target.result;
            appState.cessioni.unshift(cessione);
            resolve(cessione);
        };
        req.onerror = () => resolve(null);
    });
};

const deleteCessione = (id) => {
    return new Promise((resolve) => {
        const tx = db.transaction("cessioni", "readwrite");
        tx.objectStore("cessioni").delete(Number(id));
        appState.cessioni = appState.cessioni.filter(c => c.id !== Number(id));
        resolve();
    });
};

// ═══════════════════════════════════════════════════════════════
// SYSTEM STATUS
// ═══════════════════════════════════════════════════════════════

const updateSystemStatus = (online) => {
    appState.isOnline = online;
    const dot = document.getElementById('statusDot');
    const text = document.querySelector('.status-text');
    if (dot) {
        dot.classList.toggle('offline', !online);
    }
    if (text) {
        text.textContent = online ? 'System Online' : 'Offline';
    }
};

// Listen for online/offline
window.addEventListener('online', () => updateSystemStatus(true));
window.addEventListener('offline', () => updateSystemStatus(false));
