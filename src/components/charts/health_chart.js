/**
 * D.U.B.I.A. — Health Index Chart (ApexCharts)
 * H(t) trend with warning/critical threshold lines
 */

'use strict';

let healthChartInstance = null;

const renderHealthChart = (measurements, params) => {
    const container = document.getElementById('healthChart');
    if (!container) return;
    if (healthChartInstance) healthChartInstance.destroy();
    if (!measurements || measurements.length === 0) return;

    const labels = measurements.map(m => m.date);
    const healthData = measurements.map((m, i) => {
        if (i === measurements.length - 1) {
            return Math.round(computeHealthIndex(params.theta1) * 10) / 10;
        }
        const h = m.health_index;
        return (h >= 0 && h <= 200) ? Math.round(h * 10) / 10 : 100;
    });

    const hMin = Math.max(40, Math.min(...healthData) - 10);
    const hMax = Math.min(140, Math.max(...healthData) + 10);

    const options = {
        series: [
            { name: 'Indice H (%)', data: healthData },
            { name: 'Warning (90%)', data: Array(labels.length).fill(90) },
            { name: 'Critico (75%)', data: Array(labels.length).fill(75) }
        ],
        chart: {
            type: 'line',
            height: 260,
            background: 'transparent',
            fontFamily: "'Inter', sans-serif",
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: { enabled: true, easing: 'easeout', speed: 500 }
        },
        colors: ['#00F0FF', '#F2C94C', '#C0292B'],
        stroke: {
            width: [2, 1, 1],
            curve: 'smooth',
            dashArray: [0, 4, 4]
        },
        fill: {
            type: ['gradient', 'none', 'none'],
            gradient: {
                shade: 'dark', type: 'vertical',
                opacityFrom: 0.2, opacityTo: 0, stops: [0, 100]
            }
        },
        xaxis: {
            categories: labels,
            labels: {
                style: { colors: '#6B7280', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace" },
                rotate: -45, maxHeight: 60
            },
            axisBorder: { show: false }
        },
        yaxis: {
            min: hMin, max: hMax,
            labels: {
                style: { colors: '#6B7280', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" },
                formatter: (v) => v.toFixed(0) + '%'
            }
        },
        grid: {
            borderColor: '#1A1C23',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } }
        },
        tooltip: {
            theme: 'dark',
            style: { fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" },
            y: { formatter: (v) => v !== null ? v.toFixed(1) + '%' : 'N/A' }
        },
        legend: {
            position: 'bottom',
            labels: { colors: '#A0A4B0' },
            fontSize: '11px',
            markers: { radius: 2 }
        },
        markers: {
            size: [4, 0, 0],
            strokeWidth: 0,
            hover: { size: 6 }
        }
    };

    healthChartInstance = new ApexCharts(container, options);
    healthChartInstance.render();
};
