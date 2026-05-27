/**
 * D.U.B.I.A. — Main Application Entrypoint & UI Logic
 * Integrates IndexedDB app state, calculations, ApexCharts, and custom UI components
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// GLOBAL DOM STUFF
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Database
    try {
        await initDB();
        // Set initial tab and run UI update
        updateUI();
        updateClientiUI();
    } catch (e) {
        console.error("[D.U.B.I.A.] Failed to initialize app data", e);
        showNotification("Errore Inizializzazione", "Impossibile caricare il database locale.", "error");
    }

    // Initialize real-time industrial clock
    const updateClock = () => {
        const clockEl = document.getElementById('headerClock');
        if (clockEl) {
            const now = new Date();
            clockEl.textContent = now.toTimeString().split(' ')[0];
        }
    };
    setInterval(updateClock, 1000);
    updateClock();

    // ═══════════════════════════════════════════════════════════
    // TAB ROUTING & NAVIGATION
    // ═══════════════════════════════════════════════════════════

    const navItems = document.querySelectorAll('.nav-item');
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    const pages = document.querySelectorAll('.page');

    const switchPage = (pageId) => {
        if (!pageId) return;
        appState.currentPage = pageId;

        // Toggle page visibility
        pages.forEach(p => {
            if (p.id === `page${pageId.charAt(0).toUpperCase() + pageId.slice(1)}`) {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });

        // Toggle active states on sidebar nav
        navItems.forEach(item => {
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Toggle active states on bottom mobile nav
        bottomNavItems.forEach(item => {
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Re-render charts on page load if needed (ApexCharts needs container visibility)
        if (pageId === 'dashboard') {
            setTimeout(() => {
                if (appState.measurements.length > 0) {
                    const deltaG = parseInt(document.getElementById('deltaGSlider').value) || 30;
                    renderBiomassChart(appState.measurements, deltaG);
                }
            }, 100);
        } else if (pageId === 'diagnostics') {
            setTimeout(() => {
                if (appState.measurements.length > 0) {
                    renderHealthChart(appState.measurements, appState.params);
                }
            }, 100);
        }
    };

    // Bind sidebar clicks
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            switchPage(page);
        });
    });

    // Bind bottom nav clicks
    bottomNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            switchPage(page);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // COLLAPSIBLE SIDEBAR
    // ═══════════════════════════════════════════════════════════

    const sidebarToggle = document.getElementById('sidebarToggle');
    const appShell = document.getElementById('appShell');

    if (sidebarToggle && appShell) {
        // Recover state
        const isExpanded = localStorage.getItem('sidebarExpanded') === 'true';
        if (isExpanded) {
            appShell.classList.add('sidebar-expanded');
            sidebarToggle.title = "Collassa sidebar";
        }

        sidebarToggle.addEventListener('click', () => {
            const expanding = appShell.classList.toggle('sidebar-expanded');
            localStorage.setItem('sidebarExpanded', expanding);
            sidebarToggle.title = expanding ? "Collassa sidebar" : "Espandi sidebar";
        });
    }

    // ═══════════════════════════════════════════════════════════
    // DELTAG HORIZON TIMEFRAME SYNC
    // ═══════════════════════════════════════════════════════════

    const deltaGSlider = document.getElementById('deltaGSlider');
    const deltaGInput = document.getElementById('deltaGInput');
    const presetBtns = document.querySelectorAll('.btn-preset');

    const updateDeltaG = (val) => {
        val = Math.max(1, Math.min(365, parseInt(val) || 30));
        if (deltaGSlider) deltaGSlider.value = val;
        if (deltaGInput) deltaGInput.value = val;

        // Toggle active preset button class
        presetBtns.forEach(btn => {
            if (parseInt(btn.getAttribute('data-val')) === val) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Trigger updates
        updateUI();
    };

    if (deltaGSlider) {
        deltaGSlider.addEventListener('input', (e) => updateDeltaG(e.target.value));
    }
    if (deltaGInput) {
        deltaGInput.addEventListener('input', (e) => updateDeltaG(e.target.value));
    }
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            updateDeltaG(btn.getAttribute('data-val'));
        });
    });

    // ═══════════════════════════════════════════════════════════
    // MAINTENANCE LOGS STATE
    // ═══════════════════════════════════════════════════════════

    const tasks = ['taskCleaning', 'taskCartons', 'taskTreatments'];
    tasks.forEach(taskId => {
        const el = document.getElementById(taskId);
        if (el) {
            el.checked = localStorage.getItem(taskId) === 'true';
            el.addEventListener('change', (e) => {
                localStorage.setItem(taskId, e.target.checked);
                showNotification("Registro Manutenzione", `Stato modificato: ${el.parentElement.textContent.trim()}`, "success");
            });
        }
    });

    // ═══════════════════════════════════════════════════════════
    // QUICK EVENT AND ENTRY MODAL
    // ═══════════════════════════════════════════════════════════

    const entryModal = document.getElementById('entryModal');
    const entryForm = document.getElementById('entryForm');
    const inputType = document.getElementById('inputType');
    const groupWeight = document.getElementById('groupWeight');
    const groupFoodAmount = document.getElementById('groupFoodAmount');
    const groupHarvestAmount = document.getElementById('groupHarvestAmount');
    const inputAdultRatioSlider = document.getElementById('inputAdultRatioSlider');
    const inputAdultRatio = document.getElementById('inputAdultRatio');

    // Quick access buttons
    document.getElementById('btnQuickWeigh')?.addEventListener('click', () => openEntryModal('pesata'));
    document.getElementById('btnQuickFood')?.addEventListener('click', () => openEntryModal('cibo'));
    document.getElementById('btnQuickHarvest')?.addEventListener('click', () => openEntryModal('prelievo'));
    document.getElementById('fabAdd')?.addEventListener('click', () => openEntryModal('pesata'));
    document.getElementById('btnCancelEntry')?.addEventListener('click', () => entryModal.classList.remove('active'));

    const openEntryModal = (type = 'pesata') => {
        if (!entryModal) return;
        entryForm.reset();
        document.getElementById('inputDate').valueAsDate = new Date();

        if (inputType) {
            inputType.value = type;
            updateFormVisibility();
        }

        // Pre-populate ratios and values if possible
        if (appState.measurements.length > 0) {
            const latest = appState.measurements[appState.measurements.length - 1];
            if (inputAdultRatioSlider) inputAdultRatioSlider.value = latest.adult_ratio || 0.35;
            if (inputAdultRatio) inputAdultRatio.value = latest.adult_ratio || 0.35;
            document.getElementById('inputWeight').value = latest.total_weight.toFixed(1);
        } else {
            if (inputAdultRatioSlider) inputAdultRatioSlider.value = 0.35;
            if (inputAdultRatio) inputAdultRatio.value = 0.35;
        }

        entryModal.classList.add('active');
    };

    const updateFormVisibility = () => {
        const type = inputType.value;
        if (type === 'pesata') {
            groupWeight.style.display = 'block';
            groupFoodAmount.style.display = 'block';
            groupHarvestAmount.style.display = 'block';
            document.getElementById('inputWeight').required = true;
            document.getElementById('inputFoodAmount').required = true;
        } else if (type === 'cibo') {
            groupWeight.style.display = 'none';
            groupFoodAmount.style.display = 'block';
            groupHarvestAmount.style.display = 'none';
            document.getElementById('inputWeight').required = false;
            document.getElementById('inputFoodAmount').required = true;
        } else if (type === 'prelievo') {
            groupWeight.style.display = 'none';
            groupFoodAmount.style.display = 'none';
            groupHarvestAmount.style.display = 'block';
            document.getElementById('inputWeight').required = false;
            document.getElementById('inputFoodAmount').required = false;
        }
    };

    if (inputType) {
        inputType.addEventListener('change', updateFormVisibility);
    }

    if (inputAdultRatioSlider && inputAdultRatio) {
        inputAdultRatioSlider.addEventListener('input', (e) => {
            inputAdultRatio.value = e.target.value;
        });
        inputAdultRatio.addEventListener('input', (e) => {
            inputAdultRatioSlider.value = e.target.value;
        });
    }

    if (entryForm) {
        entryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = inputType.value;
            const date = document.getElementById('inputDate').value;
            const adultRatio = parseFloat(inputAdultRatio.value) || 0.35;
            const notes = document.getElementById('inputNotes').value.trim();

            let weight = 0;
            let foodAmount = 0;
            let harvestAmount = 0;

            if (type === 'pesata') {
                weight = parseFloat(document.getElementById('inputWeight').value) || 0;
                foodAmount = parseFloat(document.getElementById('inputFoodAmount').value) || 0;
                harvestAmount = parseFloat(document.getElementById('inputHarvestAmount').value) || 0;
            } else if (type === 'cibo') {
                foodAmount = parseFloat(document.getElementById('inputFoodAmount').value) || 0;
            } else if (type === 'prelievo') {
                harvestAmount = parseFloat(document.getElementById('inputHarvestAmount').value) || 0;
            }

            try {
                showNotification("Elaborazione", "Invio della misura al motore di inferenza D.U.B.I.A...", "info");
                await processNewMeasurement(date, weight, foodAmount, adultRatio, notes, harvestAmount, false, true, type);
                entryModal.classList.remove('active');
                updateUI();
                showNotification("Successo", "Rilevazione salvata ed elaborata correttamente.", "success");
            } catch (err) {
                console.error(err);
                showNotification("Errore", "Impossibile elaborare l'evento di misura.", "error");
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // NEW BLOOD REGISTRATION
    // ═══════════════════════════════════════════════════════════

    const btnNewBlood = document.getElementById('btnNewBlood');
    if (btnNewBlood) {
        btnNewBlood.addEventListener('click', async () => {
            if (appState.measurements.length === 0) {
                showNotification("Errore", "Nessun dato presente. Inserisci prima una pesata.", "error");
                return;
            }

            const latest = appState.measurements[appState.measurements.length - 1];
            const today = new Date().toISOString().split('T')[0];

            const confirmModal = document.createElement('div');
            confirmModal.className = 'modal-overlay active';
            confirmModal.innerHTML = `
                <div class="modal">
                    <h2>Registra Nuovo Ceppo Genico</h2>
                    <p>Questo evento segnerà l'inserimento di riproduttori esterni per ridurre la consanguineità (inbreeding) e purificare l'indice salute H.</p>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-ghost" id="btnCancelNewBlood">Annulla</button>
                        <button type="button" class="btn btn-primary" id="btnConfirmNewBlood">Registra Inserimento</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmModal);

            document.getElementById('btnCancelNewBlood').addEventListener('click', () => {
                confirmModal.remove();
            });

            document.getElementById('btnConfirmNewBlood').addEventListener('click', async () => {
                confirmModal.remove();
                try {
                    await processNewMeasurement(
                        today,
                        latest.total_weight,
                        0,
                        latest.adult_ratio || 0.35,
                        "[Nuovo Sangue] Inseriti nuovi riproduttori non imparentati per abbattere l'inbreeding.",
                        0,
                        true,
                        false,
                        'nuovo_sangue'
                    );
                    updateUI();
                    showNotification("Successo", "Nuovo patrimonio genetico registrato. Indice H stabilizzato.", "success");
                } catch (err) {
                    console.error(err);
                    showNotification("Errore", "Impossibile completare la registrazione.", "error");
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════════════
    // EXPORT TO CSV
    // ═══════════════════════════════════════════════════════════

    const btnExportCSV = document.getElementById('btnExportCSV');
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            if (appState.measurements.length === 0) {
                showNotification("Esportazione Annullata", "Nessuna rilevazione salvata nel sistema.", "warning");
                return;
            }

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Data,Evento,Peso Reale (g),Teorico Predetto (g),Cibo (g),Prelievo (g),Adult Ratio (A_t),Indice Salute H (%),Note\n";

            appState.measurements.forEach(m => {
                const safeNotes = m.notes ? `"${m.notes.replace(/"/g, '""')}"` : "";
                const row = [
                    m.date,
                    m.event_type || 'pesata',
                    m.total_weight.toFixed(1),
                    (m.predicted_weight || m.total_weight).toFixed(1),
                    (m.food_amount || 0).toFixed(1),
                    (m.harvest_amount || 0).toFixed(1),
                    (m.adult_ratio || 0.35).toFixed(2),
                    m.health_index.toFixed(1),
                    safeNotes
                ];
                csvContent += row.join(",") + "\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `dubia_telemetria_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showNotification("Esportazione Completata", "File CSV generato e scaricato correttamente.", "success");
        });
    }

    // ═══════════════════════════════════════════════════════════
    // DELETE SINGLE MEASUREMENT ROW
    // ═══════════════════════════════════════════════════════════

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete-row');
        if (!btn) return;

        const id = Number(btn.getAttribute('data-id'));

        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay active';
        confirmModal.innerHTML = `
            <div class="modal">
                <h2 style="color:var(--accent-critical);">Conferma Eliminazione</h2>
                <p>Vuoi eliminare questa singola rilevazione telemetrica?</p>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" id="btnCancelDelRow">Annulla</button>
                    <button type="button" class="btn btn-primary" style="background:var(--accent-critical);border-color:var(--accent-critical);" id="btnConfirmDelRow">Procedi</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmModal);

        document.getElementById('btnCancelDelRow').addEventListener('click', () => confirmModal.remove());
        document.getElementById('btnConfirmDelRow').addEventListener('click', () => {
            confirmModal.remove();

            // Double warning
            const warningModal = document.createElement('div');
            warningModal.className = 'modal-overlay active';
            warningModal.innerHTML = `
                <div class="modal">
                    <h2 style="color:var(--accent-critical);">⚠️ ATTENZIONE</h2>
                    <p>L'eliminazione influenzerà il calcolo ricorsivo dei parametri di accrescimento. Confermi?</p>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-ghost" id="btnCancelDelDouble">No, mantieni</button>
                        <button type="button" class="btn btn-primary" style="background:var(--accent-critical);border-color:var(--accent-critical);" id="btnConfirmDelDouble">Sì, elimina definitivamente</button>
                    </div>
                </div>
            `;
            document.body.appendChild(warningModal);

            document.getElementById('btnCancelDelDouble').addEventListener('click', () => warningModal.remove());
            document.getElementById('btnConfirmDelDouble').addEventListener('click', async () => {
                warningModal.remove();
                try {
                    const tx = db.transaction("measurements", "readwrite");
                    const store = tx.objectStore("measurements");
                    await new Promise((resolve, reject) => {
                        const req = store.delete(id);
                        req.onsuccess = resolve;
                        req.onerror = reject;
                    });

                    appState.measurements = appState.measurements.filter(m => m.id !== id);
                    if (appState.measurements.length > 1) {
                        const rebuilt = rebuildParamsFromMeasurements(appState.measurements);
                        appState.params.theta1 = rebuilt.theta1;
                        appState.params.theta2 = rebuilt.theta2;
                        saveParams(appState.params);
                    }

                    updateUI();
                    showNotification("Eliminato", "Rilevazione cancellata e parametri ricalibrati.", "success");
                } catch (err) {
                    console.error(err);
                    showNotification("Errore", "Impossibile eliminare l'elemento.", "error");
                }
            });
        });
    });

    // ═══════════════════════════════════════════════════════════
    // CALIBRATION MODAL & ACTIONS
    // ═══════════════════════════════════════════════════════════

    const calibrationModal = document.getElementById('calibrationModal');
    const calibrationForm = document.getElementById('calibrationForm');
    const btnCalibrate = document.getElementById('btnCalibrate');

    if (btnCalibrate) {
        btnCalibrate.addEventListener('click', () => {
            if (appState.measurements.length === 0) {
                showNotification("Calibrazione Impossibile", "Inserisci almeno una rilevazione per poter calibrare.", "warning");
                return;
            }
            calibrationModal.classList.add('active');
        });
    }

    document.getElementById('btnCancelCalib')?.addEventListener('click', () => {
        calibrationModal.classList.remove('active');
    });

    if (calibrationForm) {
        calibrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const category = document.getElementById('calibCategory').value;
            const count = parseInt(document.getElementById('calibCount').value) || 0;

            const latest = appState.measurements[appState.measurements.length - 1];
            const currentWeight = latest.total_weight;
            const catWeight = count * MASS[category];

            let newAdultRatio = latest.adult_ratio || 0.35;
            if (category === 'FEMALE' || category === 'MALE') {
                newAdultRatio = Math.min(0.9, Math.max(0.1, catWeight / currentWeight));
            }

            // Adjust theta2 feedback loop
            appState.params.theta2 = appState.params.theta2 * 1.03;

            if (!appState.params.manualCalibrations) {
                appState.params.manualCalibrations = {};
            }
            appState.params.manualCalibrations[category] = count;
            saveParams(appState.params);

            const catLabels = {
                FEMALE: 'Femmine Adulte', MALE: 'Maschi Adulti', SUBADULT: 'Sub-Adulte',
                MEDIUM: 'Neanidi Medie', SMALL: 'Neanidi Piccole', BABY: 'Micro-Neanidi'
            };

            try {
                await processNewMeasurement(
                    new Date().toISOString().split('T')[0],
                    currentWeight,
                    0,
                    newAdultRatio,
                    `[Calibrazione] Modello forzato: ${count} ${catLabels[category] || category}`,
                    0,
                    false,
                    false,
                    'calibrazione'
                );
                calibrationModal.classList.remove('active');
                calibrationForm.reset();
                updateUI();
                showNotification("Calibrazione Applicata", "I parametri demografici del sistema sono stati riallineati.", "success");
            } catch (err) {
                console.error(err);
                showNotification("Errore", "Impossibile salvare la misura di calibrazione.", "error");
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // PHYSICAL MORTALITY INPUT
    // ═══════════════════════════════════════════════════════════

    const inputMortality = document.getElementById('inputMortality');
    if (inputMortality) {
        inputMortality.addEventListener('change', (e) => {
            appState.params.mortalityRate = parseFloat(e.target.value) || 1.5;
            saveParams(appState.params);
            updateUI();
            showNotification("Parametri Live", "Tasso di mortalità fisiologica aggiornato.", "success");
        });
    }

    // ═══════════════════════════════════════════════════════════
    // VALORE ECONOMICO CLICK TRIGGER FOR PRICES MODAL
    // ═══════════════════════════════════════════════════════════

    const ecoValueCard = document.getElementById('economicValueValue')?.closest('.card');
    const prezziModal = document.getElementById('prezziModal');
    const prezziForm = document.getElementById('prezziForm');
    const priceRowsContainer = document.getElementById('priceRows');

    if (ecoValueCard && prezziModal) {
        ecoValueCard.style.cursor = 'pointer';
        ecoValueCard.addEventListener('click', () => {
            openPrezziModal();
        });
    }

    document.getElementById('btnCancelPrezzi')?.addEventListener('click', () => {
        prezziModal.classList.remove('active');
    });

    const openPrezziModal = () => {
        if (!prezziModal || !priceRowsContainer) return;

        // Render inputs dynamically
        priceRowsContainer.innerHTML = BLATTA_TYPES.map(b => {
            const price = appState.customPrices[b.value] || DEFAULT_PRICES[b.value] || 0;
            return `
                <div class="form-group" style="display:flex; justify-content:space-between; align-items:center; gap:var(--sp-4);">
                    <label style="margin:0; text-transform:none; font-size:var(--fs-sm); flex:1;">${b.label}</label>
                    <div style="display:flex; align-items:center; gap:var(--sp-1);">
                        <input type="number" id="price_${b.value}" step="0.01" min="0" value="${price.toFixed(2)}" style="width:80px; text-align:right;">
                        <span class="text-muted" style="font-size:var(--fs-sm);">€</span>
                    </div>
                </div>
            `;
        }).join('');

        // Attach listeners for live preview update
        priceRowsContainer.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', updatePrezziPreview);
        });

        updatePrezziPreview();
        prezziModal.classList.add('active');
    };

    const updatePrezziPreview = () => {
        if (appState.measurements.length === 0) return;
        const latest = appState.measurements[appState.measurements.length - 1];
        const lastAdultRatio = latest.adult_ratio || 0.35;

        const tempPrices = {};
        BLATTA_TYPES.forEach(b => {
            const input = document.getElementById(`price_${b.value}`);
            tempPrices[b.value] = parseFloat(input?.value) || 0;
        });

        // Use calculations with temp prices overriding
        const metrics = calculateColonyMetrics(latest.total_weight, lastAdultRatio, appState.params);
        const { fCount, mCount, saCount, medCount, smCount, bCount } = metrics;

        const val = (fCount * tempPrices.FEMALE) + (mCount * tempPrices.MALE)
            + (saCount * tempPrices.SUBADULT) + (medCount * tempPrices.MEDIUM)
            + (smCount * tempPrices.SMALL) + (bCount * tempPrices.BABY);

        const previewEl = document.getElementById('prezziValoreColoniaPreview');
        if (previewEl) {
            previewEl.textContent = `Valore Colonia stimato: € ${val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    };

    if (prezziForm) {
        prezziForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newPrices = {};
            BLATTA_TYPES.forEach(b => {
                const input = document.getElementById(`price_${b.value}`);
                newPrices[b.value] = parseFloat(input?.value) || 0;
            });
            savePrices(newPrices);
            prezziModal.classList.remove('active');
            updateUI();
            showNotification('Listino Prezzi', 'Valutazione economica aggiornata con successo.', 'success');
        });
    }

    // ═══════════════════════════════════════════════════════════
    // CLIENTS SECTION EVENT BINDINGS
    // ═══════════════════════════════════════════════════════════

    const clientModal = document.getElementById('clientModal');
    const clientForm = document.getElementById('clientForm');

    // New Client Button
    document.getElementById('btnNuovoCliente')?.addEventListener('click', () => openClientModal(null));
    document.getElementById('btnCancelClient')?.addEventListener('click', () => clientModal.classList.remove('active'));

    const openClientModal = (client = null) => {
        if (!clientModal || !clientForm) return;
        clientForm.reset();
        document.getElementById('clientModalTitle').textContent = client ? 'Modifica Cliente' : 'Nuovo Cliente';
        document.getElementById('clientId').value = client?.id || '';

        if (client) {
            document.getElementById('clientNome').value = client.nome || '';
            document.getElementById('clientCognome').value = client.cognome || '';
            document.getElementById('clientCitta').value = client.citta || '';
            document.getElementById('clientTelefono').value = client.telefono || '';
            document.getElementById('clientEmail').value = client.email || '';
            document.getElementById('clientAnimale').value = client.animale || 'rettile';
            document.getElementById('clientNote').value = client.note || '';
        }

        clientModal.classList.add('active');
    };

    if (clientForm) {
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idVal = document.getElementById('clientId').value;
            const client = {
                nome:     document.getElementById('clientNome').value.trim(),
                cognome:  document.getElementById('clientCognome').value.trim(),
                citta:    document.getElementById('clientCitta').value.trim(),
                telefono: document.getElementById('clientTelefono').value.trim(),
                email:    document.getElementById('clientEmail').value.trim(),
                animale:  document.getElementById('clientAnimale').value,
                note:     document.getElementById('clientNote').value.trim(),
                data_aggiunta: new Date().toISOString().split('T')[0]
            };
            if (idVal) client.id = Number(idVal);

            await saveClient(client);
            clientModal.classList.remove('active');
            updateClientiUI();
            showNotification('Anagrafica Clienti', `${client.nome} ${client.cognome} salvato nel database.`, 'success');
        });
    }

    // Client card and action listeners delegated
    document.addEventListener('click', async (e) => {
        // Edit Client
        const editBtn = e.target.closest('.btn-client-edit');
        if (editBtn) {
            const id = Number(editBtn.dataset.id);
            const client = appState.clients.find(c => c.id === id);
            if (client) openClientModal(client);
            return;
        }

        // Delete Client
        const deleteClientBtn = e.target.closest('.btn-client-delete');
        if (deleteClientBtn) {
            const id = Number(deleteClientBtn.dataset.id);
            const client = appState.clients.find(c => c.id === id);
            const name = client ? `${client.nome} ${client.cognome}` : 'questo cliente';

            const confirmModal = document.createElement('div');
            confirmModal.className = 'modal-overlay active';
            confirmModal.innerHTML = `
                <div class="modal">
                    <h2 style="color:var(--accent-critical);">Elimina Cliente</h2>
                    <p>Sei sicuro di voler eliminare <strong>${name}</strong> e tutte le cessioni associate?</p>
                    <div class="modal-actions">
                        <button class="btn btn-ghost" id="btnCancelDelClient">Annulla</button>
                        <button class="btn btn-primary" style="background:var(--accent-critical); border-color:var(--accent-critical);" id="btnConfirmDelClient">Sì, Elimina</button>
                    </div>
                </div>`;
            document.body.appendChild(confirmModal);

            document.getElementById('btnCancelDelClient').addEventListener('click', () => confirmModal.remove());
            document.getElementById('btnConfirmDelClient').addEventListener('click', async () => {
                confirmModal.remove();
                await deleteClient(id);
                updateClientiUI();
                showNotification('Anagrafica Clienti', `Cliente ${name} rimosso dal database.`, 'success');
            });
            return;
        }

        // Register Cessione from Client card
        const cardCessioneBtn = e.target.closest('.btn-client-cessione');
        if (cardCessioneBtn) {
            openCessioneModal(Number(cardCessioneBtn.dataset.id));
            return;
        }

        // Delete Cessione row
        const deleteCessioneBtn = e.target.closest('.btn-delete-cessione');
        if (deleteCessioneBtn) {
            const id = Number(deleteCessioneBtn.dataset.id);
            const confirmModal = document.createElement('div');
            confirmModal.className = 'modal-overlay active';
            confirmModal.innerHTML = `
                <div class="modal">
                    <h2 style="color:var(--accent-critical);">Elimina Cessione</h2>
                    <p>Sei sicuro di voler rimuovere questa registrazione di cessione dallo storico?</p>
                    <div class="modal-actions">
                        <button class="btn btn-ghost" id="btnCancelDelCessione">Annulla</button>
                        <button class="btn btn-primary" style="background:var(--accent-critical); border-color:var(--accent-critical);" id="btnConfirmDelCessione">Rimuovi</button>
                    </div>
                </div>`;
            document.body.appendChild(confirmModal);

            document.getElementById('btnCancelDelCessione').addEventListener('click', () => confirmModal.remove());
            document.getElementById('btnConfirmDelCessione').addEventListener('click', async () => {
                confirmModal.remove();
                await deleteCessione(id);
                updateClientiUI();
                showNotification('Storico Cessioni', 'Registrazione cessione eliminata con successo.', 'success');
            });
            return;
        }
    });

    // ═══════════════════════════════════════════════════════════
    // CESSIONI (SALES) MODAL & REGISTRATION
    // ═══════════════════════════════════════════════════════════

    const cessioneModal = document.getElementById('cessioneModal');
    const cessioneForm = document.getElementById('cessioneForm');
    const selectCliente = document.getElementById('cessioneCliente');
    const selectTipo = document.getElementById('cessioneTipo');
    const inputQuantita = document.getElementById('cessioneQuantita');
    const inputPrezzoUnit = document.getElementById('cessionePrezzoUnit');
    const totalPreview = document.getElementById('cessioneTotalePreview');
    const inputTotaleHidden = document.getElementById('cessioneTotale');

    document.getElementById('btnNuovaCessione')?.addEventListener('click', () => openCessioneModal(null));
    document.getElementById('btnCancelCessione')?.addEventListener('click', () => cessioneModal.classList.remove('active'));

    const openCessioneModal = (clienteId = null) => {
        if (!cessioneModal || !cessioneForm) return;
        cessioneForm.reset();
        document.getElementById('cessioneData').valueAsDate = new Date();

        // Populate Clients dropdown
        selectCliente.innerHTML = '<option value="">— Seleziona cliente —</option>' +
            appState.clients.map(c =>
                `<option value="${c.id}" ${c.id === clienteId ? 'selected' : ''}>${c.nome} ${c.cognome}</option>`
            ).join('');

        // Populate Blatta Categories
        selectTipo.innerHTML = BLATTA_TYPES.map(b =>
            `<option value="${b.value}">${b.label}</option>`
        ).join('');

        const updateUnitAndTotal = () => {
            const type = selectTipo.value;
            const price = appState.customPrices[type] || DEFAULT_PRICES[type] || 0;
            inputPrezzoUnit.value = price.toFixed(2);
            calculateTotal();
        };

        const calculateTotal = () => {
            const q = parseFloat(inputQuantita.value) || 0;
            const p = parseFloat(inputPrezzoUnit.value) || 0;
            const type = selectTipo.value;
            const category = BLATTA_TYPES.find(b => b.value === type);
            const count = category ? Math.round(q / category.mass) : 0;
            const total = q * p;

            totalPreview.textContent = `Totale: € ${total.toFixed(2)} · ≈ ${count} individui`;
            inputTotaleHidden.value = total.toFixed(2);
        };

        selectTipo.onchange = updateUnitAndTotal;
        inputQuantita.oninput = calculateTotal;
        inputPrezzoUnit.oninput = calculateTotal;

        updateUnitAndTotal();
        cessioneModal.classList.add('active');
    };

    if (cessioneForm) {
        cessioneForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clienteId = Number(selectCliente.value);
            if (!clienteId) {
                showNotification('Errore Registrazione', 'Seleziona un cliente valido.', 'error');
                return;
            }

            const cessione = {
                cliente_id:  clienteId,
                data:        document.getElementById('cessioneData').value,
                tipo_blatta: selectTipo.value,
                quantita_g:  parseFloat(inputQuantita.value) || 0,
                prezzo_unit: parseFloat(inputPrezzoUnit.value) || 0,
                totale_euro: parseFloat(inputTotaleHidden.value) || 0,
                note:        document.getElementById('cessioneNote').value.trim()
            };

            try {
                await saveCessione(cessione);
                cessioneModal.classList.remove('active');
                updateClientiUI();
                const client = appState.clients.find(c => c.id === clienteId);
                const clientName = client ? `${client.nome} ${client.cognome}` : 'Cliente';
                showNotification('Successo', `Cessione di ${cessione.quantita_g}g registrata per ${clientName}.`, 'success');
            } catch (err) {
                console.error(err);
                showNotification('Errore', 'Impossibile salvare la cessione.', 'error');
            }
        });
    }

    // Bind dropdown filter
    const cessioniFilterCliente = document.getElementById('cessioniFilterCliente');
    if (cessioniFilterCliente) {
        cessioniFilterCliente.addEventListener('change', (e) => {
            updateClientiUI(e.target.value || null);
        });
    }

    // Bind search bar client input with simple debounce
    const clientiSearch = document.getElementById('clientiSearch');
    if (clientiSearch) {
        let timeout;
        clientiSearch.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                updateClientiUI();
            }, 250);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // HARVEST DEVIATION SIMULATOR (MSY CONTROLS)
    // ═══════════════════════════════════════════════════════════

    const harvestSlider = document.getElementById('harvestSlider');
    const harvestAmount = document.getElementById('harvestAmount');
    const harvestCategory = document.getElementById('harvestCategory');
    const harvestCyclic = document.getElementById('harvestCyclic');
    const btnConfirmHarvestSim = document.getElementById('btnConfirmHarvestSim');

    if (harvestSlider && harvestAmount) {
        const syncHarvest = (val) => {
            val = Math.max(0, parseFloat(val) || 0);
            harvestSlider.value = Math.min(500, val);
            harvestAmount.value = val;

            updateUI(); // Run UI updates to recalculate simulated values
        };

        harvestSlider.addEventListener('input', (e) => syncHarvest(e.target.value));
        harvestAmount.addEventListener('input', (e) => syncHarvest(e.target.value));

        if (harvestCategory) harvestCategory.addEventListener('change', () => syncHarvest(harvestAmount.value));
        if (harvestCyclic) harvestCyclic.addEventListener('change', () => syncHarvest(harvestAmount.value));
    }

    if (btnConfirmHarvestSim) {
        btnConfirmHarvestSim.addEventListener('click', async () => {
            const amount = parseFloat(harvestAmount.value) || 0;
            if (amount <= 0) {
                showNotification("Prelievo Annullato", "La quantità da prelevare deve essere superiore a 0g.", "warning");
                return;
            }

            const isCyclic = harvestCyclic.checked;
            const categorySelect = document.getElementById('harvestCategory');
            const categoryText = categorySelect.options[categorySelect.selectedIndex].text;

            let labelNote = `Prelievo: ${categoryText}`;
            if (isCyclic) labelNote += " (Simulazione Periodica)";

            const confirmHarvestModal = document.createElement('div');
            confirmHarvestModal.className = 'modal-overlay active';
            confirmHarvestModal.innerHTML = `
                <div class="modal">
                    <h2>Registra Prelievo Reale</h2>
                    <p>Stai registrando un prelievo fisico e immediato di <strong>${amount.toFixed(1)} g</strong> di biomassa dalla colonia.</p>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-ghost" id="btnCancelActualHarvest">Annulla</button>
                        <button type="button" class="btn btn-primary" id="btnConfirmActualHarvest">Conferma Prelievo</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmHarvestModal);

            document.getElementById('btnCancelActualHarvest').addEventListener('click', () => {
                confirmHarvestModal.remove();
            });

            document.getElementById('btnConfirmActualHarvest').addEventListener('click', async () => {
                confirmHarvestModal.remove();
                try {
                    const latest = appState.measurements[appState.measurements.length - 1];
                    const nextWeight = Math.max(0, latest.total_weight - amount);
                    const today = new Date().toISOString().split('T')[0];

                    showNotification("Registrazione", "Esecuzione prelievo e ricalcolo biomassa...", "info");
                    await processNewMeasurement(
                        today,
                        nextWeight,
                        0,
                        appState.params.manualCalibrations ? null : 0.35,
                        labelNote,
                        amount,
                        false,
                        true,
                        'prelievo'
                    );

                    harvestAmount.value = 0;
                    if (harvestSlider) harvestSlider.value = 0;

                    updateUI();
                    showNotification("Prelievo Registrato", `Prelevati ${amount.toFixed(1)}g. La biomassa totale è ora ${nextWeight.toFixed(1)}g.`, "success");
                } catch (err) {
                    console.error(err);
                    showNotification("Errore", "Impossibile completare il prelievo reale.", "error");
                }
            });
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// UI ENGINE UPDATE (CENTRAL TRUTH LOOP)
// ═══════════════════════════════════════════════════════════════

const updateUI = () => {
    if (appState.measurements.length === 0) {
        showNotification("Nessun Dato", "Nessun dato presente nel database. Inserisci una prima pesata per attivare il terminale.", "warning");
        return;
    }

    const latest = appState.measurements[appState.measurements.length - 1];
    const deltaGSlider = document.getElementById('deltaGSlider');
    const deltaG = deltaGSlider ? parseInt(deltaGSlider.value) : 30;

    // Projected Future Biomass
    const lastAdultRatio = latest.adult_ratio || 0.35;
    const futurePrediction = calculatePrediction(latest.total_weight, 0, lastAdultRatio, deltaG, appState.params);

    // Live demographics & economic values
    const metrics = calculateColonyMetrics(latest.total_weight, lastAdultRatio, appState.params);

    // Calculate matrix scramble text updates
    const updates = {
        realWeightValue: `${latest.total_weight.toFixed(1)} g`,
        predWeightValue: `${futurePrediction.toFixed(1)} g`,
        economicValueValue: `${metrics.economicValue.toFixed(2)} €`,
        waterNeedValue: `${metrics.waterNeed.toFixed(1)} g/g`,
        pregnantRatioValue: `${(appState.measurements.length > 1 ? computePregnantRatio(latest, metrics.census) : 0).toFixed(1)} %`,
        theta1Value: appState.params.theta1.toFixed(4),
        theta2Value: appState.params.theta2.toFixed(4),
        fcrValue: calculateFCR(),
        healthValue: `${metrics.H_live.toFixed(1)}%`
    };

    // Scramble values to match the biosecurity interface
    scrambleUpdatedValues(updates);

    // Header Health indicator update
    const headerHealthValue = document.getElementById('headerHealthValue');
    if (headerHealthValue) {
        headerHealthValue.textContent = `${metrics.H_live.toFixed(1)}%`;
        headerHealthValue.className = 'header-health-value';
        if (metrics.H_live < HEALTH_THRESHOLD_ALERT) {
            headerHealthValue.classList.add('critical');
        } else if (metrics.H_live < HEALTH_THRESHOLD_WARNING) {
            headerHealthValue.classList.add('warning');
        }
    }

    // Health Status Dot or Alerts
    const healthStatusEl = document.getElementById('healthStatus');
    if (healthStatusEl) {
        healthStatusEl.className = 'card-status';
        if (metrics.H_live < HEALTH_THRESHOLD_ALERT) {
            healthStatusEl.classList.add('error');
        } else if (metrics.H_live < HEALTH_THRESHOLD_WARNING) {
            healthStatusEl.classList.add('warning');
        } else {
            healthStatusEl.classList.add('ok');
        }
    }

    // Demographic alert bottlenecks
    const alarmCard = document.getElementById('demographicAlarmCard');
    const alarmText = document.getElementById('demographicAlarmText');
    if (alarmCard && alarmText) {
        if (metrics.bCount < metrics.smCount * 0.5 && latest.total_weight > 50) {
            alarmCard.classList.remove('hidden');
            alarmText.innerHTML = "<strong>CRITICAL BOTTLENECK</strong>: Carenza drastica di Micro-Neanidi. Previsto vuoto demografico generazionale tra 60-90 giorni (mancato ricambio).";
        } else if (metrics.saCount < metrics.fCount * 0.2 && metrics.fCount > 10) {
            alarmCard.classList.remove('hidden');
            alarmText.innerHTML = "<strong>WARNING PIPELINE</strong>: Carenza di Sub-Adulte. Rischio di imminente arresto riproduttivo dovuto alla mancata sostituzione delle fattrici senescenti.";
        } else {
            alarmCard.classList.add('hidden');
        }
    }

    // Maturation Timer Box
    const maturationTimerText = document.getElementById('maturationTimerText');
    const maturationCard = document.getElementById('maturationTimerCard');
    if (maturationCard && maturationTimerText) {
        maturationCard.classList.remove('hidden');
        maturationTimerText.textContent = metrics.maturMessage;
    }

    // Sex Ratio Check
    const sexRatioValue = document.getElementById('sexRatioValue');
    const sexRatioStatusText = document.getElementById('sexRatioStatusText');
    const sexRatioStatusDot = document.getElementById('sexRatioStatus');

    if (sexRatioValue && sexRatioStatusText && sexRatioStatusDot) {
        const ratio = metrics.census.sex_ratio;
        sexRatioValue.textContent = `1 : ${(1/ratio).toFixed(1)}`;
        sexRatioStatusDot.className = 'card-status';

        if (ratio >= 0.20 && ratio <= 0.35) { // Sane breeding bounds
            sexRatioStatusDot.classList.add('ok');
            sexRatioStatusText.innerHTML = "Breeding target bilanciato (1:3 - 1:5). Struttura ormonale riproduttiva stabile.";
            sexRatioStatusText.style.color = "var(--accent-green)";
        } else if (ratio > 0.35) {
            sexRatioStatusDot.classList.add('warning');
            sexRatioStatusText.innerHTML = "SURPLUS MASCHI. Consigliata rimozione manuale per evitare lotte territoriali e consumi sterili.";
            sexRatioStatusText.style.color = "var(--accent-yellow)";
        } else {
            sexRatioStatusDot.classList.add('error');
            sexRatioStatusText.innerHTML = "DEFICIT DI MASCHI. Rischio uova sterili/abortite. Inserire individui maschi.";
            sexRatioStatusText.style.color = "var(--accent-critical)";
        }
    }

    // Demographic Bars Rendering
    renderDemographicBars('demoBars', metrics);
    renderDemographicBars('censusBars', metrics);

    // Demographic Table update
    updateCensusTable(latest.total_weight, lastAdultRatio, metrics);

    // Harvest / MSY projections in real time
    const harvestAmountInput = document.getElementById('harvestAmount');
    const harvestCategorySelect = document.getElementById('harvestCategory');
    const harvestCyclicCheckbox = document.getElementById('harvestCyclic');
    const msyWarning = document.getElementById('msyWarning');
    const suggesterText = document.getElementById('optimalSuggesterText');
    const msyValueText = document.getElementById('msyValueText');
    const harvestDaysLabel = document.getElementById('harvestDaysLabel');
    const harvestFutureWeight = document.getElementById('harvestFutureWeight');

    if (harvestAmountInput && harvestDaysLabel && harvestFutureWeight) {
        const amount = parseFloat(harvestAmountInput.value) || 0;
        const category = harvestCategorySelect ? harvestCategorySelect.value : 'ALL';
        const isCyclic = harvestCyclicCheckbox ? harvestCyclicCheckbox.checked : false;

        harvestDaysLabel.textContent = deltaG;

        let totalSimulatedHarvest = amount;
        if (isCyclic) {
            totalSimulatedHarvest = amount * (deltaG / 7);
        }

        const remainingWeight = Math.max(0, latest.total_weight - totalSimulatedHarvest);
        let simulatedAdultRatio = lastAdultRatio;

        // Apply selective demographic harvesting predictions
        if (category === 'FEMALE') {
            const count = Math.round(amount / MASS.FEMALE);
            const nextFemales = Math.max(0, metrics.fCount - count);
            simulatedAdultRatio = Math.max(0.01, (nextFemales * MASS.FEMALE + metrics.mCount * MASS.MALE) / remainingWeight);
        } else if (category === 'MALE') {
            const count = Math.round(amount / MASS.MALE);
            const nextMales = Math.max(0, metrics.mCount - count);
            simulatedAdultRatio = Math.max(0.01, (metrics.fCount * MASS.FEMALE + nextMales * MASS.MALE) / remainingWeight);
        }

        const simulatedFuture = calculatePrediction(remainingWeight, 0, simulatedAdultRatio, deltaG, appState.params);
        harvestFutureWeight.textContent = `${simulatedFuture.toFixed(1)} g`;

        // MSY calculations
        const natural30 = calculatePrediction(latest.total_weight, 0, lastAdultRatio, 30, appState.params);
        const msy30 = Math.max(0, natural30 - latest.total_weight);
        if (msyValueText) msyValueText.textContent = `${msy30.toFixed(1)} g`;

        // Warning trigger
        if (simulatedFuture < latest.total_weight && totalSimulatedHarvest > 0) {
            msyWarning.classList.remove('hidden');
        } else {
            msyWarning.classList.add('hidden');
        }

        // Suggester recommendations
        if (suggesterText) {
            const mRatio = metrics.census.sex_ratio;
            if (mRatio > 0.4) {
                suggesterText.innerHTML = `Rapporto maschi elevato (1:${(1/mRatio).toFixed(1)}). Preleva preferenzialmente <strong>Maschi Adulti</strong> per favorire il riproduttivo.`;
            } else if (metrics.medCount + metrics.smCount > (metrics.saCount + metrics.fCount + metrics.mCount) * 1.8) {
                suggesterText.innerHTML = `Eccesso di stadi intermedi. Prelevare <strong>Neanidi Medie</strong> per liberare volume vitale.`;
            } else {
                suggesterText.innerHTML = `Demografia bilanciata. Consigliato prelievo generico proporzionale.`;
            }
        }

        // Dynamic MSY diagonal stripes overlay styling based on threshold
        const msyCard = document.getElementById('msyCard');
        if (msyCard) {
            if (simulatedFuture < latest.total_weight && totalSimulatedHarvest > 0) {
                msyCard.classList.add('msy-danger');
            } else {
                msyCard.classList.remove('msy-danger');
            }
        }
    }

    // Render History table rows
    updateHistoryTable();

    // Render differential diagnostics alerts
    updateDiagnosticsPanel();

    // Update charts
    renderBiomassChart(appState.measurements, deltaG);
    renderHealthChart(appState.measurements, appState.params);

    // Activity Log update
    updateActivityLog();
};

// ═══════════════════════════════════════════════════════════════
// CENSUS TABLE UPDATES
// ═══════════════════════════════════════════════════════════

const updateCensusTable = (W_t, A_t, metrics) => {
    const tbody = document.getElementById('censusTableBody');
    if (!tbody || !metrics) return;

    const rows = [
        {
            stage:       'Femmine Adulte',
            mass_avg:    '2.5g',
            proportion:  `A_t × 77%`,
            N:           metrics.fCount,
            biomassa_g:  (metrics.fCount * MASS.FEMALE).toFixed(1),
            destinazione: 'Riproduttrici — mantenere'
        },
        {
            stage:       'Maschi Adulti',
            mass_avg:    '1.5g',
            proportion:  `A_t × 23%`,
            N:           metrics.mCount,
            biomassa_g:  (metrics.mCount * MASS.MALE).toFixed(1),
            destinazione: 'Riproduttori — verificare sex ratio'
        },
        {
            stage:       'Neanidi Medie',
            mass_avg:    '0.8g',
            proportion:  `(1−A_t) × 70%`,
            N:           metrics.medCount,
            biomassa_g:  (metrics.medCount * MASS.MEDIUM).toFixed(1),
            destinazione: 'Crescita — prelievo futuro'
        },
        {
            stage:       'Micro-Neanidi (Baby)',
            mass_avg:    '0.1g',
            proportion:  `(1−A_t) × 30%`,
            N:           metrics.bCount,
            biomassa_g:  (metrics.bCount * MASS.BABY).toFixed(1),
            destinazione: 'Riserva — non prelevare'
        }
    ];

    tbody.innerHTML = rows.map(r => {
        let colorClass = 'text-muted';
        let icon = '📊';
        if (r.destinazione.includes('mantenere')) { colorClass = 'purple'; icon = '🔴'; }
        else if (r.destinazione.includes('prelievo')) { colorClass = 'green'; icon = '✂️'; }
        else if (r.destinazione.includes('non prelevare')) { colorClass = 'yellow'; icon = '🛡️'; }
        else if (r.destinazione.includes('sex ratio')) { colorClass = 'cyan'; icon = '⚖️'; }

        return `
            <tr>
                <td>
                    <strong>${r.stage}</strong><br>
                    <small class="text-muted">${r.mass_avg} media · ${r.proportion}</small>
                </td>
                <td class="mono font-bold">${r.N.toLocaleString('it-IT')}</td>
                <td class="mono">${r.biomassa_g} g</td>
                <td class="${colorClass}">${icon} ${r.destinazione}</td>
            </tr>
        `;
    }).join('');
};

// ═══════════════════════════════════════════════════════════════
// HISTORY LOG TABLE UPDATES
// ═══════════════════════════════════════════════════════════

const updateHistoryTable = () => {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (appState.measurements.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center;">Nessuna pesata registrata.</td></tr>`;
        return;
    }

    const reversed = [...appState.measurements].reverse();
    tbody.innerHTML = reversed.map((m, idx) => {
        let fcr = '-';
        if (idx + 1 < reversed.length) {
            const prev = reversed[idx + 1];
            const gain = m.total_weight - prev.total_weight;
            if (m.food_amount > 0 && gain > 0) {
                fcr = (m.food_amount / gain).toFixed(2);
            }
        }

        const dateStr = m.date;
        const weightStr = m.total_weight.toFixed(1);
        const foodStr = m.food_amount ? `${m.food_amount.toFixed(1)} g` : '—';
        const harvestStr = m.harvest_amount ? `-${m.harvest_amount.toFixed(1)} g` : '—';
        const healthStr = `${m.health_index.toFixed(1)}%`;

        let healthClass = 'green';
        if (m.health_index < HEALTH_THRESHOLD_ALERT) healthClass = 'critical';
        else if (m.health_index < HEALTH_THRESHOLD_WARNING) healthClass = 'yellow';

        const rowStyle = m.is_new_blood ? 'style="background:rgba(155, 89, 182, 0.08); border-left: 2px solid var(--accent-purple);"' : '';
        const bloodBadge = m.is_new_blood ? '🩸 ' : '';

        return `
            <tr ${rowStyle}>
                <td class="mono">${bloodBadge}${dateStr}</td>
                <td class="mono font-bold">${weightStr} g</td>
                <td class="mono">${foodStr}</td>
                <td class="mono text-warning">${harvestStr}</td>
                <td class="mono">${fcr}</td>
                <td class="mono ${healthClass}">${healthStr}</td>
                <td class="text-secondary" style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${m.notes || ''}">${m.notes || '—'}</td>
                <td style="text-align:right;">
                    <button class="btn btn-ghost btn-sm btn-delete-row" data-id="${m.id}" style="padding:4px 8px; font-size:10px; color:var(--accent-critical);">X</button>
                </td>
            </tr>
        `;
    }).join('');
};

// ═══════════════════════════════════════════════════════════════
// DIFFERENTIAL DIAGNOSTICS SUBSECTION
// ═══════════════════════════════════════════════════════════

const updateDiagnosticsPanel = () => {
    const panel = document.getElementById('differentialDiagnosticsPanel');
    if (!panel) return;

    if (appState.measurements.length === 0) {
        panel.innerHTML = `
            <div class="diag-ok">
                <span>⏳</span>
                <div>
                    <strong>In attesa di telemetria...</strong>
                    <p class="text-muted">Esegui una pesata iniziale per generare l'analisi differenziale dei sensori.</p>
                </div>
            </div>`;
        return;
    }

    const { theta1, theta2 } = appState.params;
    const H = computeHealthIndex(theta1);
    const diagnostics = DUBIA.differentialDiagnostics(theta1, theta2, H);

    if (diagnostics.length === 0) {
        panel.innerHTML = `
            <div class="diag-ok" style="border: 1px solid var(--accent-green); background: var(--accent-green-10); padding: var(--sp-4); border-radius: var(--radius-sm); display: flex; gap: var(--sp-3); align-items: flex-start;">
                <span style="font-size:var(--fs-xl);">🟢</span>
                <div>
                    <strong style="color: var(--accent-green);">ANALISI DIAGNOSTICA NOMINALE</strong>
                    <p style="margin-top:var(--sp-1); font-size:var(--fs-sm); color:var(--text-secondary);">Tutti i parametri rientrano nei range di tolleranza definiti dal Teorema D.U.B.I.A. La biologia della colonia è stabile.</p>
                </div>
            </div>`;
    } else {
        panel.innerHTML = diagnostics.map(d => {
            const borderColor = d.severity === 'critical' ? 'var(--accent-critical)' : 'var(--accent-warning)';
            const bgColor = d.severity === 'critical' ? 'var(--accent-critical-10)' : 'var(--accent-warning-10)';

            return `
                <div class="diag-card" style="border:1px solid ${borderColor}; background:${bgColor}; padding:var(--sp-4); border-radius:var(--radius-sm); margin-bottom:var(--sp-3);">
                    <h4 style="color:${borderColor}; font-size:var(--fs-base); font-weight:700; margin-bottom:var(--sp-1);">${d.title}</h4>
                    <p style="font-size:var(--fs-sm); color:var(--text-primary); margin-bottom:var(--sp-2);">${d.message}</p>
                    <p style="font-size:var(--fs-xs); color:var(--text-secondary); line-height:1.4;">${d.suggestion}</p>
                </div>
            `;
        }).join('');
    }
};

// ═══════════════════════════════════════════════════════════════
// RECENT ACTIVITY LOG RENDERER
// ═══════════════════════════════════════════════════════════

const updateActivityLog = () => {
    const container = document.getElementById('activityLog');
    if (!container) return;

    if (appState.measurements.length === 0) {
        container.innerHTML = `<div class="activity-item"><span class="activity-dot"></span><span class="activity-text">In attesa di telemetria...</span></div>`;
        return;
    }

    const recent = appState.measurements.slice(-5).reverse();
    container.innerHTML = recent.map(m => {
        let typeLabel = "Misura";
        let color = "var(--accent-cyan)";
        if (m.event_type === 'cibo') { typeLabel = "Alimentazione"; color = "var(--accent-green)"; }
        else if (m.event_type === 'prelievo') { typeLabel = "Prelievo"; color = "var(--accent-warning)"; }
        else if (m.event_type === 'calibrazione') { typeLabel = "Calibrazione"; color = "var(--accent-purple)"; }
        else if (m.event_type === 'nuovo_sangue') { typeLabel = "Genetic Refresh"; color = "var(--accent-purple)"; }

        return `
            <div class="activity-item">
                <span class="activity-dot" style="background:${color}; box-shadow: 0 0 6px ${color};"></span>
                <div class="activity-content">
                    <div class="activity-text"><strong>${typeLabel}</strong>: ${m.total_weight.toFixed(1)}g (${m.date})</div>
                    ${m.notes ? `<div class="activity-notes" style="font-size:var(--fs-xs); color:var(--text-muted);">${m.notes}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
};

// ═══════════════════════════════════════════════════════════════
// SCENARIO CALCULATIONS HELPERS
// ═══════════════════════════════════════════════════════════════

const computePregnantRatio = (latest, census) => {
    if (appState.measurements.length <= 1 || !census || census.N_femmine === 0) return 0;
    const delta = latest.total_weight - (latest.predicted_weight || latest.total_weight);
    const maxWeightIncrease = census.N_femmine * 0.4; // 0.4g pregnant weight delta factor
    return Math.min(100, Math.max(0, (delta / maxWeightIncrease) * 100));
};

const calculateFCR = () => {
    if (appState.measurements.length < 2) return "--";
    let totalFood = 0;
    let totalWeightGain = 0;
    for (let i = 1; i < appState.measurements.length; i++) {
        const m = appState.measurements[i];
        const prev = appState.measurements[i-1];
        const gain = m.total_weight - prev.total_weight;
        if (m.food_amount > 0 && gain > 0) {
            totalFood += m.food_amount;
            totalWeightGain += gain;
        }
    }
    return totalWeightGain > 0 ? (totalFood / totalWeightGain).toFixed(2) : "--";
};

const updateDoubleScenarioChart = (harvestAmount, simulatedFuture, days) => {
    // Standard ApexCharts update logic inside biomass_chart.js will override this
    // as it manages its own state, but we will leave a placeholder if needed.
};
