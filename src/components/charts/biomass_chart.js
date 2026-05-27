/**
 * D.U.B.I.A. — Biomass Chart (ApexCharts)
 * Storico Reale vs Predizione — Dark/Industrial Theme
 */

'use strict';

let biomassChartInstance = null;

const renderBiomassChart = (measurements, deltaG = 30) => {
    const container = document.getElementById('biomassChart');
    if (!container) return;
    if (biomassChartInstance) biomassChartInstance.destroy();
    if (!measurements || measurements.length === 0) return;

    const labels = measurements.map(m => m.date);
    const realData = measurements.map(m => Math.round(m.total_weight * 100) / 100);
    const predData = measurements.map(m => Math.round((m.predicted_weight || m.total_weight) * 100) / 100);

    // Future prediction point
    const lastM = measurements[measurements.length - 1];
    const futureDate = new Date(lastM.date);
    futureDate.setDate(futureDate.getDate() + deltaG);
    const futureLabel = futureDate.toISOString().split('T')[0];

    const futurePred = calculatePrediction(
        lastM.total_weight, lastM.food_amount || 0,
        lastM.adult_ratio || 0.35, deltaG, appState.params, 0
    );

    const allLabels = [...labels, futureLabel];
    const realSeries = [...realData, null];
    const predSeries = [...predData, Math.round(futurePred * 100) / 100];

    const options = {
        series: [
            {
                name: 'Peso Reale (g)',
                data: realSeries,
                type: 'area'
            },
            {
                name: 'Peso Teorico (g)',
                data: predSeries,
                type: 'line'
            }
        ],
        chart: {
            type: 'line',
            height: 280,
            background: 'transparent',
            fontFamily: "'Inter', sans-serif",
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: {
                enabled: true,
                easing: 'easeout',
                speed: 600
            }
        },
        colors: ['#00F0FF', '#6B7280'],
        stroke: {
            width: [2, 2],
            curve: 'smooth',
            dashArray: [0, 5]
        },
        fill: {
            type: ['gradient', 'none'],
            gradient: {
                shade: 'dark',
                type: 'vertical',
                opacityFrom: 0.3,
                opacityTo: 0.02,
                stops: [0, 100]
            }
        },
        xaxis: {
            categories: allLabels,
            labels: {
                style: {
                    colors: '#6B7280',
                    fontSize: '10px',
                    fontFamily: "'JetBrains Mono', monospace"
                },
                rotate: -45,
                maxHeight: 60
            },
            axisBorder: { show: false },
            axisTicks: { color: '#2D313A' }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#6B7280',
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace"
                },
                formatter: (v) => v ? v.toFixed(0) + 'g' : ''
            }
        },
        grid: {
            borderColor: '#1A1C23',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { left: 10, right: 10 }
        },
        tooltip: {
            theme: 'dark',
            style: { fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" },
            x: { show: true },
            y: { formatter: (v) => v !== null ? v.toFixed(1) + ' g' : 'N/A' },
            marker: { show: true },
            custom: undefined
        },
        legend: {
            position: 'top',
            horizontalAlign: 'left',
            labels: { colors: '#A0A4B0' },
            fontSize: '11px',
            fontFamily: "'Inter', sans-serif",
            markers: { radius: 2 }
        },
        markers: {
            size: [4, 3],
            strokeWidth: 0,
            hover: { size: 6 }
        }
    };

    biomassChartInstance = new ApexCharts(container, options);
    biomassChartInstance.render();
};
