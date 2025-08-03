// Sports Data App - Firebase integration with Riege system and password protection
class SportsDataApp {
    constructor() {
        this.database = null;
        this.resultsRef = null;
        this.results = [];
        this.authenticated = false;
        
        // Riege to athletes mapping
        this.riegeAthletes = {
            'Cali': ['Carla', 'Anton', 'Lena', 'Isabel'],
            'Tampere': ['Tamara', 'Anton', 'Michael', 'Paula', 'Emma', 'Robert', 'Elena'],
            'Bergen': ['Ben', 'Eva', 'Robert', 'Gina', 'Erik', 'Nora'],
            'Espo': ['Emma', 'Stefan', 'Paul', 'Olivia']
        };
        
        // Initialize password protection first
        this.initializePasswordProtection();
        
        // Initialize Firebase
        this.initializeFirebase();
    }

    initializePasswordProtection() {
        console.log('Setting up password protection...');
        
        const passwordForm = document.getElementById('passwordForm');
        const passwordInput = document.getElementById('passwordInput');
        
        if (passwordForm && passwordInput) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordSubmit(e));
            
            // Also add keypress event for Enter key
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handlePasswordSubmit(e);
                }
            });
            
            // Focus the password input
            setTimeout(() => passwordInput.focus(), 100);
            console.log('Password protection initialized');
        } else {
            console.error('Password form elements not found');
        }
    }

    handlePasswordSubmit(e) {
        e.preventDefault();
        console.log('Password submit handler called');
        
        const passwordInput = document.getElementById('passwordInput');
        const passwordError = document.getElementById('passwordError');
        
        if (!passwordInput) {
            console.error('Password input not found');
            return;
        }
        
        const enteredPassword = passwordInput.value.trim();
        console.log('Entered password length:', enteredPassword.length);
        
        if (enteredPassword === 'sport2025') {
            console.log('Correct password entered');
            this.authenticated = true;
            
            // Hide password overlay
            const overlay = document.getElementById('passwordOverlay');
            if (overlay) {
                overlay.style.display = 'none';
                console.log('Password overlay hidden');
            }
            
            // Initialize the main app
            this.initializeApp();
            this.initializeEventListeners();
            
        } else {
            console.log('Incorrect password entered');
            // Show error message
            if (passwordError) {
                passwordError.classList.remove('hidden');
            }
            passwordInput.value = '';
            passwordInput.focus();
            
            // Hide error after 3 seconds
            setTimeout(() => {
                if (passwordError) {
                    passwordError.classList.add('hidden');
                }
            }, 3000);
        }
    }

    initializeFirebase() {
        /* 
         * Firebase Setup Instructions:
         * 1. Go to https://console.firebase.google.com/
         * 2. Create a new project named "sportdaten-app"
         * 3. Go to "Realtime Database" and create a database
         * 4. Choose "Start in test mode" for now
         * 5. Get your config from Project Settings > General > Your apps
         * 6. Replace the placeholder values below with your real config
         * 
         * Security Rules for Realtime Database:
         * {
         *   "rules": {
         *     "results": {
         *       ".read": true,
         *       ".write": true
         *     }
         *   }
         * }
         */
        
        const firebaseConfig = {
            apiKey: "AIzaSyCeP__kl0NqkbjKt2JL9n4tz8g0kU7_72c",
            authDomain: "klv-pplx.firebaseapp.com",
            databaseURL: "https://klv-pplx-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "klv-pplx",
            storageBucket: "klv-pplx.firebasestorage.app",
            messagingSenderId: "722649851787",
            appId: "1:722649851787:web:0bc48100dcd25899a7b18e"
        };

        try {
            if (typeof firebase !== 'undefined') {
                firebase.initializeApp(firebaseConfig);
                this.database = firebase.database();
                this.resultsRef = this.database.ref('results');
                this.updateConnectionStatus('Verbunden - Echtzeit-Synchronisation aktiv');
            } else {
                console.log('Firebase SDK not loaded, using demo mode');
                this.simulateFirebase();
            }
        } catch (error) {
            console.log('Firebase initialization failed, using demo mode:', error);
            this.simulateFirebase();
        }
    }

    simulateFirebase() {
        // Simulate Firebase for demo purposes
        this.updateConnectionStatus('Demo-Modus (lokale Speicherung)');
        
        this.database = {
            ref: (path) => ({
                push: (data) => {
                    const key = Date.now().toString();
                    // Add to local results immediately in demo mode
                    this.results.push({ ...data, id: key });
                    this.updateResultsDisplay();
                    return Promise.resolve({ key });
                },
                on: (event, callback) => {
                    // Simulate real-time updates
                    const mockData = {};
                    this.results.forEach((result, index) => {
                        mockData[result.id || `result_${index}`] = result;
                    });
                    setTimeout(() => callback({ val: () => mockData }), 100);
                },
                off: () => {},
                once: (event) => {
                    const mockData = {};
                    this.results.forEach((result, index) => {
                        mockData[result.id || `result_${index}`] = result;
                    });
                    return Promise.resolve({ val: () => mockData });
                }
            })
        };
        
        this.resultsRef = this.database.ref('results');
    }

    initializeApp() {
        console.log('Initializing main app...');
        
        if (!this.authenticated) {
            console.log('Not authenticated, skipping app initialization');
            return;
        }

        // Setup Firebase listeners for real-time sync
        if (this.resultsRef) {
            this.resultsRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    this.results = Object.keys(data).map(key => ({
                        ...data[key],
                        id: key
                    }));
                } else {
                    this.results = [];
                }
                this.updateResultsDisplay();
            });
        }

        // Initialize the UI
        this.showBestResults();
        this.updateResultsDisplay();
        this.updateSubmitButtonState();
        
        console.log('Main app initialized successfully');
    }

    initializeEventListeners() {
        console.log('Setting up event listeners...');
        
        // Riege selection handler
        const riegeSelect = document.getElementById('riegeSelect');
        if (riegeSelect) {
            riegeSelect.addEventListener('change', (e) => this.handleRiegeChange(e));
        }

        // Form field handlers for submit button state
        const athleteSelect = document.getElementById('athleteSelect');
        const disciplineSelect = document.getElementById('disciplineSelect');
        const valueInput = document.getElementById('valueInput');
        
        [riegeSelect, athleteSelect, disciplineSelect, valueInput].forEach(element => {
            if (element) {
                element.addEventListener('change', () => this.updateSubmitButtonState());
                element.addEventListener('input', () => this.updateSubmitButtonState());
            }
        });

        // Form submission
        const resultForm = document.getElementById('resultForm');
        if (resultForm) {
            resultForm.addEventListener('submit', (e) => this.handleResultSubmission(e));
        }

        // Tab navigation
        const bestListTab = document.getElementById('bestListTab');
        const allResultsTab = document.getElementById('allResultsTab');
        
        if (bestListTab) {
            bestListTab.addEventListener('click', () => this.showBestResults());
        }
        if (allResultsTab) {
            allResultsTab.addEventListener('click', () => this.showAllResults());
        }

        // Export functions
        const exportCsvBtn = document.getElementById('exportCsvBtn');
        const exportJsonBtn = document.getElementById('exportJsonBtn');
        
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => this.exportCsv());
        }
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => this.exportJson());
        }

        // Input validation
        if (valueInput) {
            valueInput.addEventListener('input', (e) => this.validateNumberInput(e));
        }

        console.log('Event listeners initialized');
    }

    handleRiegeChange(e) {
        const selectedRiege = e.target.value;
        const athleteSelect = document.getElementById('athleteSelect');
        
        if (!athleteSelect) return;
        
        // Clear current athletes
        athleteSelect.innerHTML = '<option value="">Athlet wählen</option>';
        
        if (selectedRiege && this.riegeAthletes[selectedRiege]) {
            // Enable athlete dropdown and populate with athletes for selected Riege
            athleteSelect.disabled = false;
            
            this.riegeAthletes[selectedRiege].forEach(athlete => {
                const option = document.createElement('option');
                option.value = athlete;
                option.textContent = athlete;
                athleteSelect.appendChild(option);
            });
        } else {
            // Disable athlete dropdown if no Riege selected
            athleteSelect.disabled = true;
            athleteSelect.innerHTML = '<option value="">Erst Riege wählen</option>';
        }
        
        this.updateSubmitButtonState();
    }

    updateSubmitButtonState() {
        const submitBtn = document.getElementById('submitBtn');
        const riege = document.getElementById('riegeSelect')?.value;
        const athlete = document.getElementById('athleteSelect')?.value;
        const discipline = document.getElementById('disciplineSelect')?.value;
        const value = document.getElementById('valueInput')?.value;
        
        if (submitBtn) {
            const allFieldsFilled = riege && athlete && discipline && value;
            submitBtn.disabled = !allFieldsFilled;
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = status;
            
            if (status.includes('Verbunden')) {
                statusElement.className = 'connection-status connected';
            } else if (status.includes('Demo')) {
                statusElement.className = 'connection-status';
            } else {
                statusElement.className = 'connection-status disconnected';
            }
        }
    }

    handleResultSubmission(e) {
        e.preventDefault();
        
        const riege = document.getElementById('riegeSelect').value;
        const athlete = document.getElementById('athleteSelect').value;
        const discipline = document.getElementById('disciplineSelect').value;
        const valueStr = document.getElementById('valueInput').value;
        
        if (!riege || !athlete || !discipline || !valueStr) {
            this.showError('Bitte füllen Sie alle Felder aus.');
            return;
        }

        const value = parseFloat(valueStr.replace(',', '.'));
        if (isNaN(value) || value <= 0) {
            this.showError('Bitte geben Sie einen gültigen Wert ein.');
            return;
        }

        const result = {
            riege,
            athlete,
            discipline,
            value,
            timestamp: Date.now()
        };

        this.addResult(result);
        
        // Reset form but keep Riege selection
        document.getElementById('athleteSelect').value = '';
        document.getElementById('disciplineSelect').value = '';
        document.getElementById('valueInput').value = '';
        
        this.updateSubmitButtonState();
        this.showSuccessMessage('Ergebnis erfolgreich hinzugefügt!');
    }

    addResult(result) {
        console.log('Adding result:', result);
        
        // Add to Firebase (will trigger real-time update)
        if (this.resultsRef) {
            try {
                this.resultsRef.push(result);
            } catch (error) {
                console.log('Firebase push failed, adding locally:', error);
                // Fallback: add locally if Firebase fails
                this.results.push({ ...result, id: Date.now().toString() });
                this.updateResultsDisplay();
            }
        } else {
            // Fallback: add locally
            this.results.push({ ...result, id: Date.now().toString() });
            this.updateResultsDisplay();
        }
    }

    updateResultsDisplay() {
        this.updateBestResults();
        this.updateAllResults();
    }

    updateBestResults() {
        const bestResults = this.getBestResultsGroupedByRiege();
        const container = document.getElementById('bestResultsList');
        
        if (!container) return;
        
        if (Object.keys(bestResults).length === 0) {
            container.innerHTML = '<p class="no-results">Noch keine Ergebnisse vorhanden</p>';
            return;
        }

        let html = '';
        Object.keys(bestResults).sort().forEach(riege => {
            html += `
                <div class="riege-group">
                    <div class="riege-header">
                        <h4 class="riege-title">Riege: ${riege}</h4>
                    </div>
                    <div class="riege-results">
            `;
            
            bestResults[riege].forEach((result, index) => {
                html += `
                    <div class="result-item rank-${Math.min(index + 1, 3)}">
                        <div class="result-info">
                            <div class="result-athlete">
                                <span class="rank-indicator">#${index + 1}</span>
                                ${result.athlete}
                            </div>
                            <div class="result-discipline">${result.discipline}</div>
                        </div>
                        <div class="result-value">
                            ${this.formatValue(result.value, result.discipline)}
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateAllResults() {
        const sortedResults = [...this.results].sort((a, b) => b.timestamp - a.timestamp);
        const container = document.getElementById('allResultsList');
        
        if (!container) return;
        
        if (sortedResults.length === 0) {
            container.innerHTML = '<p class="no-results">Noch keine Ergebnisse vorhanden</p>';
            return;
        }

        container.innerHTML = sortedResults.map(result => `
            <div class="result-item">
                <div class="result-info">
                    <div class="result-athlete">${result.athlete}</div>
                    <div class="result-discipline">${result.discipline}</div>
                    <div class="result-riege">Riege: ${result.riege}</div>
                    <div class="result-time">${this.formatTimestamp(result.timestamp)}</div>
                </div>
                <div class="result-value">
                    ${this.formatValue(result.value, result.discipline)}
                </div>
            </div>
        `).join('');
    }

    getBestResultsGroupedByRiege() {
        const disciplineConfig = {
            'Weitsprung': { unit: 'm', higherBetter: true },
            'Wurf': { unit: 'm', higherBetter: true },
            'Sprint': { unit: 's', higherBetter: false }
        };

        const groupedResults = {};
        
        // Group results by Riege
        this.results.forEach(result => {
            if (!groupedResults[result.riege]) {
                groupedResults[result.riege] = {};
            }
            
            const key = `${result.athlete}-${result.discipline}`;
            const config = disciplineConfig[result.discipline];
            
            if (!groupedResults[result.riege][key] || 
                (config.higherBetter && result.value > groupedResults[result.riege][key].value) ||
                (!config.higherBetter && result.value < groupedResults[result.riege][key].value)) {
                groupedResults[result.riege][key] = result;
            }
        });

        // Convert to sorted arrays per Riege
        const finalResults = {};
        Object.keys(groupedResults).forEach(riege => {
            finalResults[riege] = Object.values(groupedResults[riege])
                .sort((a, b) => {
                    const configA = disciplineConfig[a.discipline];
                    const configB = disciplineConfig[b.discipline];
                    
                    if (a.discipline !== b.discipline) {
                        return a.discipline.localeCompare(b.discipline);
                    }
                    
                    return configA.higherBetter ? b.value - a.value : a.value - b.value;
                });
        });

        return finalResults;
    }

    formatValue(value, discipline) {
        const unit = discipline === 'Sprint' ? 's' : 'm';
        return `${value.toFixed(2)} ${unit}`;
    }

    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showBestResults() {
        const bestTab = document.getElementById('bestListTab');
        const allTab = document.getElementById('allResultsTab');
        const bestResults = document.getElementById('bestResults');
        const allResults = document.getElementById('allResults');
        
        if (bestTab) bestTab.classList.add('active');
        if (allTab) allTab.classList.remove('active');
        if (bestResults) bestResults.classList.remove('hidden');
        if (allResults) allResults.classList.add('hidden');
    }

    showAllResults() {
        const bestTab = document.getElementById('bestListTab');
        const allTab = document.getElementById('allResultsTab');
        const bestResults = document.getElementById('bestResults');
        const allResults = document.getElementById('allResults');
        
        if (allTab) allTab.classList.add('active');
        if (bestTab) bestTab.classList.remove('active');
        if (allResults) allResults.classList.remove('hidden');
        if (bestResults) bestResults.classList.add('hidden');
    }

    exportCsv() {
        if (this.results.length === 0) {
            this.showError('Keine Daten zum Exportieren vorhanden.');
            return;
        }

        const headers = ['Riege', 'Athlet', 'Disziplin', 'Wert', 'Datum', 'Zeit'];
        const rows = this.results.map(result => [
            result.riege,
            result.athlete,
            result.discipline,
            result.value.toString().replace('.', ','),
            new Date(result.timestamp).toLocaleDateString('de-DE'),
            new Date(result.timestamp).toLocaleTimeString('de-DE')
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(';'))
            .join('\n');

        this.downloadFile(csvContent, 'sportdaten.csv', 'text/csv;charset=utf-8;');
        this.showSuccessMessage('CSV-Datei wurde heruntergeladen!');
    }

    exportJson() {
        if (this.results.length === 0) {
            this.showError('Keine Daten zum Exportieren vorhanden.');
            return;
        }

        const exportData = {
            exported: new Date().toISOString(),
            totalResults: this.results.length,
            riegen: Object.keys(this.riegeAthletes),
            results: this.results.map(result => ({
                ...result,
                timestamp: new Date(result.timestamp).toISOString()
            }))
        };

        const jsonContent = JSON.stringify(exportData, null, 2);
        this.downloadFile(jsonContent, 'sportdaten.json', 'application/json');
        this.showSuccessMessage('JSON-Datei wurde heruntergeladen!');
    }

    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    validateNumberInput(e) {
        let value = e.target.value;
        // Allow numbers, comma, and dot
        value = value.replace(/[^0-9.,]/g, '');
        // Replace comma with dot for decimal
        value = value.replace(',', '.');
        // Prevent multiple dots
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        e.target.value = value;
        this.updateSubmitButtonState();
    }

    showSuccessMessage(message) {
        const messageEl = document.getElementById('successMessage');
        if (messageEl) {
            const textEl = messageEl.querySelector('p');
            if (textEl) {
                textEl.textContent = message;
            }
            messageEl.classList.remove('hidden');
            
            setTimeout(() => {
                messageEl.classList.add('hidden');
            }, 3000);
        }
    }

    showError(message) {
        // Create temporary error message
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = message;
        errorEl.style.position = 'fixed';
        errorEl.style.top = '20px';
        errorEl.style.left = '50%';
        errorEl.style.transform = 'translateX(-50%)';
        errorEl.style.zIndex = '1000';
        errorEl.style.maxWidth = '90%';
        
        document.body.appendChild(errorEl);
        
        setTimeout(() => {
            if (document.body.contains(errorEl)) {
                document.body.removeChild(errorEl);
            }
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    try {
        new SportsDataApp();
        console.log('App initialization completed');
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
});