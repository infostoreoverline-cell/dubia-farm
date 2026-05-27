/**
 * D.U.B.I.A. — Demographic Bars (Pure HTML/CSS)
 * Horizontal progress bars with blue→cyan gradient
 */

'use strict';

const DEMO_BAR_CONFIG = [
    { key: 'FEMALE',   label: 'Femmine Adulte',   massKey: 'fCount', color: '#E53E3E' },
    { key: 'MALE',     label: 'Maschi Adulti',     massKey: 'mCount', color: '#3B82F6' },
    { key: 'SUBADULT', label: 'Sub-Adulte',        massKey: 'saCount', color: '#F2C94C' },
    { key: 'MEDIUM',   label: 'Neanidi Medie',     massKey: 'medCount', color: '#00FF66' },
    { key: 'SMALL',    label: 'Neanidi Piccole',   massKey: 'smCount', color: '#A0A4B0' },
    { key: 'BABY',     label: 'Micro-Neanidi',     massKey: 'bCount', color: '#FF5500' }
];

const renderDemographicBars = (containerId, metrics) => {
    const container = document.getElementById(containerId);
    if (!container || !metrics) return;

    const totalN = metrics.totalCount || 1;
    const maxCount = Math.max(...DEMO_BAR_CONFIG.map(b => metrics[b.massKey] || 0), 1);

    let html = '';
    DEMO_BAR_CONFIG.forEach(bar => {
        const count = metrics[bar.massKey] || 0;
        const percent = (count / maxCount * 100).toFixed(1);
        const biomass = (count * MASS[bar.key]).toFixed(1);
        const populationPercent = ((count / totalN) * 100).toFixed(0);

        html += `
            <div class="demo-bar-row">
                <span class="demo-bar-label">${bar.label}</span>
                <div class="demo-bar-track">
                    <div class="demo-bar-fill bar-animate"
                         style="width:${percent}%;background:linear-gradient(90deg,${bar.color}88,${bar.color});">
                    </div>
                </div>
                <span class="demo-bar-value">${populationPercent}% (${count} · ${biomass}g)</span>
            </div>
        `;
    });

    container.innerHTML = html;
};
