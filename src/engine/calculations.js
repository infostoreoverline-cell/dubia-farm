/**
 * D.U.B.I.A. — Calculations Layer
 * Feed-Forward, Health Index, Colony Metrics, Process Measurement
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// FEED-FORWARD PREDICTION
// ═══════════════════════════════════════════════════════════════

const calculatePrediction = (lastWeight, foodAmount, adultRatio, delta_g, params, harvestAmount = 0) => {
    const dubiaModule = D();
    if (dubiaModule) {
        return dubiaModule.feedForward(lastWeight, foodAmount, adultRatio, delta_g, params.theta1, params.theta2, harvestAmount);
    }
    const W_neanidi = lastWeight * (1 - adultRatio);
    return Math.max(0, lastWeight + (params.theta1 * foodAmount) + (params.theta2 * W_neanidi * (delta_g / 30)) - harvestAmount);
};

// ═══════════════════════════════════════════════════════════════
// HEALTH INDEX
// ═══════════════════════════════════════════════════════════════

const computeHealthIndex = (theta1) => {
    const dubiaModule = D();
    if (dubiaModule) return dubiaModule.healthIndex(theta1);
    return (theta1 / 0.30) * 100;
};

// ═══════════════════════════════════════════════════════════════
// COLONY METRICS (Pure function — layout-agnostic)
// ═══════════════════════════════════════════════════════════════

const calculateColonyMetrics = (W_t, A_t, params) => {
    const dubiaModule = D();

    let censusData;
    if (dubiaModule) {
        censusData = dubiaModule.census(W_t, A_t);
    } else {
        const W_adulti  = W_t * A_t;
        const W_neanidi = W_t * (1 - A_t);
        censusData = {
            W_adulti, W_neanidi,
            W_femmine: W_adulti * 0.77, W_maschi: W_adulti * 0.23,
            W_neanidi_medie: W_neanidi * 0.70, W_neanidi_baby: W_neanidi * 0.30,
            N_femmine: Math.round(W_adulti * 0.77 / 2.5),
            N_maschi:  Math.round(W_adulti * 0.23 / 1.5),
            N_medie:   Math.round(W_neanidi * 0.70 / 0.8),
            N_baby:    Math.round(W_neanidi * 0.30 / 0.1),
            N_totale_adulti: 0, N_totale_neanidi: 0, N_totale: 0, sex_ratio: 0
        };
        censusData.N_totale_adulti  = censusData.N_femmine + censusData.N_maschi;
        censusData.N_totale_neanidi = censusData.N_medie + censusData.N_baby;
        censusData.N_totale         = censusData.N_totale_adulti + censusData.N_totale_neanidi;
        censusData.sex_ratio        = censusData.N_femmine > 0 ? censusData.N_maschi / censusData.N_femmine : 0;
    }

    const calibs = (params && params.manualCalibrations) || {};
    const fCount   = calibs['FEMALE']   !== undefined ? calibs['FEMALE']   : censusData.N_femmine;
    const mCount   = calibs['MALE']     !== undefined ? calibs['MALE']     : censusData.N_maschi;
    const saCount  = calibs['SUBADULT'] !== undefined ? calibs['SUBADULT'] : 0;
    const medCount = calibs['MEDIUM']   !== undefined ? calibs['MEDIUM']   : censusData.N_medie;
    const smCount  = calibs['SMALL']    !== undefined ? calibs['SMALL']    : 0;
    const bCount   = calibs['BABY']     !== undefined ? calibs['BABY']     : censusData.N_baby;
    const totalCount = fCount + mCount + saCount + medCount + smCount + bCount;

    const prices = appState.customPrices || DEFAULT_PRICES;
    const economicValue = (fCount * prices.FEMALE) + (mCount * prices.MALE)
        + (saCount * prices.SUBADULT) + (medCount * prices.MEDIUM)
        + (smCount * prices.SMALL) + (bCount * prices.BABY);

    const waterNeed = W_t * 0.035;
    const H_live = (params && params.theta1) ? computeHealthIndex(params.theta1) : 100;

    const theta2 = (params && params.theta2) || 1.05;
    const growthSpeed = Math.max(0.5, Math.min(3.0, theta2 / 1.05));

    const maturStages = [
        { name: 'Micro-Neanidi',   count: bCount,   next: 'Neanidi Medie',  baseDays: 30 },
        { name: 'Neanidi Medie',   count: medCount,  next: 'Sub-Adulte',    baseDays: 40 },
        { name: 'Sub-Adulte',      count: saCount,   next: 'Adulte',        baseDays: 30 },
        { name: 'Neanidi Piccole', count: smCount,   next: 'Neanidi Medie', baseDays: 30 }
    ];
    maturStages.sort((a, b) => b.count - a.count);
    const peakStage = maturStages[0];
    const maturDays = Math.round(peakStage.baseDays / growthSpeed);
    const maturMessage = (peakStage.count > totalCount * 0.2)
        ? `${peakStage.name}: ~${maturDays}gg per mutare in ${peakStage.next}. [θ₂=${theta2.toFixed(3)}]`
        : 'Distribuzione stabile.';

    return Object.freeze({
        census: censusData,
        fCount, mCount, saCount, medCount, smCount, bCount, totalCount,
        economicValue, waterNeed, H_live,
        maturMessage, maturDays, growthSpeed
    });
};

// ═══════════════════════════════════════════════════════════════
// PROCESS NEW MEASUREMENT
// ═══════════════════════════════════════════════════════════════

const processNewMeasurement = async (date, realWeight, foodAmount, adultRatio, notes, harvestAmount = 0, isNewBlood = false, isManualSubmit = false, eventType = 'pesata') => {
    const lastMeasurement = appState.measurements.length > 0
        ? appState.measurements[appState.measurements.length - 1]
        : null;

    let predictedWeight = realWeight;
    let healthIndex = 100;
    let delta_g = 30;

    if (lastMeasurement) {
        const dataUltimaPesata = new Date(lastMeasurement.date);
        const dataTargetFutura = new Date(date);
        delta_g = Math.max(0, (dataTargetFutura - dataUltimaPesata) / (1000 * 60 * 60 * 24));
        predictedWeight = calculatePrediction(lastMeasurement.total_weight, foodAmount, adultRatio, delta_g, appState.params, harvestAmount);

        if (eventType === 'pesata' || eventType === 'calibrazione' || eventType === 'nuovo_sangue') {
            if (isManualSubmit) {
                const dubiaModule = D();
                if (dubiaModule) {
                    const bp = dubiaModule.backpropagate(
                        appState.params.theta1, appState.params.theta2,
                        predictedWeight, realWeight, lastMeasurement.total_weight,
                        foodAmount, adultRatio, delta_g, ALPHA
                    );
                    appState.params.theta1 = bp.theta1;
                    appState.params.theta2 = bp.theta2;
                } else {
                    const E = predictedWeight - realWeight;
                    appState.params.theta1 = Math.max(0.001, appState.params.theta1 - (ALPHA * E * foodAmount));
                    const grad2 = lastMeasurement.total_weight * (1 - adultRatio) * (delta_g / 30);
                    appState.params.theta2 = Math.max(0.001, appState.params.theta2 - (ALPHA * E * grad2));
                }
                saveParams(appState.params);
            }
            healthIndex = computeHealthIndex(appState.params.theta1);
        } else {
            if (eventType !== 'prelievo') realWeight = predictedWeight;
            healthIndex = lastMeasurement.health_index;
        }
    }

    const measurement = {
        date, total_weight: realWeight, food_amount: foodAmount,
        harvest_amount: harvestAmount, is_new_blood: isNewBlood,
        adult_ratio: adultRatio, notes, predicted_weight: predictedWeight,
        health_index: healthIndex, event_type: eventType
    };

    await saveMeasurement(measurement);
    return measurement;
};
