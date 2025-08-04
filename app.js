// KLV Datenerfassung App - Firebase Integration
let klvApp;

// Initialize immediately when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    klvApp = new KLVDataApp();
});

class KLVDataApp {
    constructor() {
        this.userPassword = "klv";
        this.adminPassword = "Admin";
        this.isAdminMode = false;
        this.currentData = {
            riege: '',
            discipline: '',
            athlete: '',
            athleteKey: '',
            currentAthleteIndex: 0
        };
        
        // Firebase
        this.db = null;
        this.firebaseConnected = false;
        this.athletesData = {}; // Will be loaded from Firebase
        this.riegenList = []; // Will be populated from athletesData
        
        // Disciplines mapping
        this.disciplines = {
            "Weitsprung": { unit: "m", code: "LJ", higherBetter: true, fields: ["LJv1", "LJv2", "LJv3"] },
            "Wurf": { unit: "m", code: "BT", higherBetter: true, fields: ["BTv1", "BTv2", "BTv3"] },
            "Sprint": { unit: "s", code: "RUN", higherBetter: false, fields: ["RUN"] }
        };

        // Age categories for point calculation
        this.ageCategories = {
            "Männer": [2005, 2004, 2003, 2002, 2001, 2000],
            "MU20": [2006, 2007],
            "MU18": [2008, 2009],
            "MU16": [2010, 2011],
            "MU14": [2012, 2013],
            "MU12": [2014, 2015],
            "MU10": [2016, 2017],
            "MU8": [2018, 2019],
            "MU6": [2020, 2021],
            "Frauen": [2005, 2004, 2003, 2002, 2001, 2000],
            "WU20": [2006, 2007],
            "WU18": [2008, 2009],
            "WU16": [2010, 2011],
            "WU14": [2012, 2013],
            "WU12": [2014, 2015],
            "WU10": [2016, 2017],
            "WU8": [2018, 2019],
            "WU6": [2020, 2021]
        };
        
        this.isLoading = false;
        this.localHistory = [];
        this.entryToDelete = null;
        this.currentBestenliste = [];
        
        // Initialize Firebase and app
        this.initFirebase();
        this.init();
    }
    
    initFirebase() {
        try {
            const firebaseConfig = {
                apiKey: "AIzaSyCeP__kl0NqkbjKt2JL9n4tz8g0kU7_72c",
                authDomain: "klv-pplx.firebaseapp.com",
                databaseURL: "https://klv-pplx-default-rtdb.europe-west1.firebasedatabase.app",
                projectId: "klv-pplx",
                storageBucket: "klv-pplx.firebasestorage.app",
                messagingSenderId: "722649851787",
                appId: "1:722649851787:web:0bc48100dcd25899a7b18e"
            };

            // Initialize Firebase
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.database();
            this.firebaseConnected = true;
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            this.firebaseConnected = false;
        }
    }
    
    async init() {
        this.bindEvents();
        this.showPasswordOverlay();
        this.loadLocalHistory();
    }
    
    async loadAthletesData() {
        if (!this.firebaseConnected || !this.db) {
            console.error('Firebase not connected');
            this.showStatusMessage('Firebase-Verbindung nicht verfügbar. Bitte versuchen Sie es später erneut.', 'error');
            return false;
        }

        this.showLoadingOverlay();
        
        try {
            // Add timeout for Firebase call
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), 10000); // 10 second timeout
            });
            
            const dataPromise = this.db.ref('/athleten').once('value');
            const snapshot = await Promise.race([dataPromise, timeoutPromise]);
            const data = snapshot.val();
            
            if (data && typeof data === 'object') {
                this.athletesData = data;
                
                // Extract unique riegen
                this.riegenList = [...new Set(Object.values(data)
                    .filter(athlete => athlete && athlete.riege)
                    .map(athlete => athlete.riege))];
                
                console.log('Athletes loaded:', Object.keys(data).length);
                console.log('Riegen found:', this.riegenList);
                
                this.populateRiegenDropdown();
                this.hideLoadingOverlay();
                return true;
            } else {
                console.log('No athletes data found in Firebase or data is invalid');
                this.hideLoadingOverlay();
                this.showStatusMessage('Keine gültigen Athleten-Daten in Firebase gefunden', 'warning');
                return false;
            }
        } catch (error) {
            console.error('Error loading athletes:', error);
            this.hideLoadingOverlay();
            
            if (error.message === 'Timeout') {
                this.showStatusMessage('Zeitüberschreitung beim Laden der Daten. Bitte prüfen Sie Ihre Internetverbindung.', 'error');
            } else {
                this.showStatusMessage('Fehler beim Laden der Athleten-Daten: ' + error.message, 'error');
            }
            return false;
        }
    }
    
    showLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }
    
    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
    
    populateRiegenDropdown() {
        const riegeSelect = document.getElementById('riegeSelect');
        if (!riegeSelect) return;
        
        // Clear existing options except first
        riegeSelect.innerHTML = '<option value="">Riege wählen...</option>';
        
        // Add riegen from Firebase data
        this.riegenList.forEach(riege => {
            const option = document.createElement('option');
            option.value = riege;
            option.textContent = riege;
            riegeSelect.appendChild(option);
        });
        
        console.log('Riegen dropdown populated with:', this.riegenList);
    }
    
    loadLocalHistory() {
        const localHistoryIds = localStorage.getItem('local-history');
        if (localHistoryIds) {
            try {
                const ids = JSON.parse(localHistoryIds);
                this.localHistory = ids;
                this.updateFilteredHistory();
            } catch (e) {
                console.error('Error loading local history:', e);
                this.localHistory = [];
            }
        }
    }
    
    saveToLocalHistory(entryId) {
        if (!this.localHistory.includes(entryId)) {
            this.localHistory.unshift(entryId);
            // Keep only last 50 entries
            if (this.localHistory.length > 50) {
                this.localHistory = this.localHistory.slice(0, 50);
            }
            localStorage.setItem('local-history', JSON.stringify(this.localHistory));
        }
    }
    
    bindEvents() {
        // Password form
        const passwordSubmit = document.getElementById('passwordSubmit');
        const passwordInput = document.getElementById('passwordInput');
        
        if (passwordSubmit) {
            passwordSubmit.addEventListener('click', (e) => {
                e.preventDefault();
                this.handlePasswordSubmit();
            });
        }
        
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handlePasswordSubmit();
                }
            });
        }

        // Navigation
        const backToLogin = document.getElementById('backToLogin');
        const backToLoginFromMain = document.getElementById('backToLoginFromMain');
        
        if (backToLogin) {
            backToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.backToLogin();
            });
        }
        
        if (backToLoginFromMain) {
            backToLoginFromMain.addEventListener('click', (e) => {
                e.preventDefault();
                this.backToLogin();
            });
        }

        // Admin controls
        const showAllEntries = document.getElementById('showAllEntries');
        const calculatePoints = document.getElementById('calculatePoints');
        const exportCsv = document.getElementById('exportCsv');
        const addAthlete = document.getElementById('addAthlete');
        const showBestenliste = document.getElementById('showBestenliste');
        const exportBestenliste = document.getElementById('exportBestenliste');

        if (showAllEntries) {
            showAllEntries.addEventListener('click', () => this.showAllEntries());
        }
        
        if (calculatePoints) {
            calculatePoints.addEventListener('click', () => this.calculatePoints());
        }
        
        if (exportCsv) {
            exportCsv.addEventListener('click', () => this.exportToCsv());
        }

        if (addAthlete) {
            addAthlete.addEventListener('click', () => this.addAthlete());
        }
        
        if (showBestenliste) {
            showBestenliste.addEventListener('click', () => this.showBestenliste());
        }
        
        if (exportBestenliste) {
            exportBestenliste.addEventListener('click', () => this.exportBestenliste());
        }
        
        // Bestenliste controls
        const bestenlisteGender = document.getElementById('bestenlisteGender');
        const bestenlisteAge = document.getElementById('bestenlisteAge');
        
        if (bestenlisteGender) {
            bestenlisteGender.addEventListener('change', (e) => this.handleBestenlisteGenderChange(e));
        }
        
        // Form events
        const riegeSelect = document.getElementById('riegeSelect');
        const disciplineSelect = document.getElementById('disciplineSelect');
        const athleteSelect = document.getElementById('athleteSelect');
        const submitButton = document.getElementById('submitButton');
        const xButton = document.getElementById('xButton');
        const performanceInput = document.getElementById('performanceInput');
        
        if (riegeSelect) {
            riegeSelect.addEventListener('change', (e) => this.handleRiegeChange(e));
        }
        
        if (disciplineSelect) {
            disciplineSelect.addEventListener('change', (e) => this.handleDisciplineChange(e));
        }
        
        if (athleteSelect) {
            athleteSelect.addEventListener('change', (e) => this.handleAthleteChange(e));
        }
        
        if (submitButton) {
            submitButton.addEventListener('click', () => this.handleSubmit());
        }
        
        if (xButton) {
            xButton.addEventListener('click', () => this.handleXButton());
        }
        
        if (performanceInput) {
            performanceInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !document.getElementById('submitButton').disabled) {
                    this.handleSubmit();
                }
            });
            
            performanceInput.addEventListener('input', () => {
                setTimeout(() => this.updateSubmitButton(), 50);
            });
        }
        
        // Modal events
        this.bindModalEvents();
    }
    
    bindModalEvents() {
        // Confirmation overlay
        const confirmationClose = document.getElementById('confirmationClose');
        const confirmationOverlay = document.getElementById('confirmationOverlay');
        
        if (confirmationClose) {
            confirmationClose.addEventListener('click', () => this.hideConfirmationOverlay());
        }
        
        if (confirmationOverlay) {
            confirmationOverlay.addEventListener('click', (e) => {
                if (e.target === confirmationOverlay) {
                    this.hideConfirmationOverlay();
                }
            });
        }
        
        // Delete modal
        const confirmDelete = document.getElementById('confirmDelete');
        const cancelDelete = document.getElementById('cancelDelete');
        const deleteModal = document.getElementById('deleteModal');
        
        if (confirmDelete) {
            confirmDelete.addEventListener('click', () => this.confirmDeleteEntry());
        }
        
        if (cancelDelete) {
            cancelDelete.addEventListener('click', () => this.hideDeleteModal());
        }
        
        if (deleteModal) {
            deleteModal.addEventListener('click', (e) => {
                if (e.target === deleteModal) {
                    this.hideDeleteModal();
                }
            });
        }
        
        // X Button modal
        const confirmXButton = document.getElementById('confirmXButton');
        const cancelXButton = document.getElementById('cancelXButton');
        const xButtonModal = document.getElementById('xButtonModal');
        
        if (confirmXButton) {
            confirmXButton.addEventListener('click', () => this.confirmXButton());
        }
        
        if (cancelXButton) {
            cancelXButton.addEventListener('click', () => this.hideXButtonModal());
        }
        
        if (xButtonModal) {
            xButtonModal.addEventListener('click', (e) => {
                if (e.target === xButtonModal) {
                    this.hideXButtonModal();
                }
            });
        }
        
        // Athlete Details Modal
        const closeAthleteDetails = document.getElementById('closeAthleteDetails');
        const athleteDetailsModal = document.getElementById('athleteDetailsModal');
        
        if (closeAthleteDetails) {
            closeAthleteDetails.addEventListener('click', () => this.hideAthleteDetailsModal());
        }
        
        if (athleteDetailsModal) {
            athleteDetailsModal.addEventListener('click', (e) => {
                if (e.target === athleteDetailsModal) {
                    this.hideAthleteDetailsModal();
                }
            });
        }
    }
    
    showPasswordOverlay() {
        const overlay = document.getElementById('passwordOverlay');
        const mainApp = document.getElementById('mainApp');
        const adminApp = document.getElementById('adminApp');
        
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        if (mainApp) {
            mainApp.classList.add('hidden');
        }
        if (adminApp) {
            adminApp.classList.add('hidden');
        }
        
        setTimeout(() => {
            const passwordInput = document.getElementById('passwordInput');
            if (passwordInput) {
                passwordInput.focus();
                passwordInput.value = '';
            }
        }, 100);
    }

    backToLogin() {
        this.isAdminMode = false;
        this.showPasswordOverlay();
    }
    
    async handlePasswordSubmit() {
        const input = document.getElementById('passwordInput');
        const error = document.getElementById('passwordError');
        
        if (!input) return;
        
        const inputValue = input.value.trim();
        
        if (error) error.classList.add('hidden');
        
        if (inputValue === this.userPassword) {
            console.log('User login successful');
            this.isAdminMode = false;
            await this.showMainApp();
        } else if (inputValue === this.adminPassword) {
            console.log('Admin login successful');
            this.isAdminMode = true;
            await this.showAdminApp();
        } else {
            console.log('Invalid password');
            if (error) error.classList.remove('hidden');
            input.value = '';
            setTimeout(() => input.focus(), 100);
        }
    }

    async showMainApp() {
        console.log('Attempting to show main app...');
        
        // Show main app immediately, then try to load data
        const overlay = document.getElementById('passwordOverlay');
        const mainApp = document.getElementById('mainApp');
        const adminApp = document.getElementById('adminApp');
        const error = document.getElementById('passwordError');
        
        if (overlay) overlay.classList.add('hidden');
        if (mainApp) mainApp.classList.remove('hidden');
        if (adminApp) adminApp.classList.add('hidden');
        if (error) error.classList.add('hidden');
        
        console.log('Main app UI shown');
        
        // Try to load athletes data in background
        try {
            const loaded = await this.loadAthletesData();
            if (!loaded) {
                // Show a message but keep the app functional
                this.showStatusMessage('Daten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.', 'warning');
            }
        } catch (error) {
            console.error('Error in showMainApp:', error);
            this.showStatusMessage('Fehler beim Laden der App. Bitte versuchen Sie es später erneut.', 'error');
        }
        
        setTimeout(() => {
            const riegeSelect = document.getElementById('riegeSelect');
            if (riegeSelect) riegeSelect.focus();
        }, 100);
    }

    async showAdminApp() {
        console.log('Attempting to show admin app...');
        
        // Show admin app immediately, then try to load data
        const overlay = document.getElementById('passwordOverlay');
        const mainApp = document.getElementById('mainApp');
        const adminApp = document.getElementById('adminApp');
        const error = document.getElementById('passwordError');
        
        if (overlay) overlay.classList.add('hidden');
        if (mainApp) mainApp.classList.add('hidden');
        if (adminApp) adminApp.classList.remove('hidden');
        if (error) error.classList.add('hidden');
        
        console.log('Admin app UI shown');
        
        // Try to load athletes data in background
        try {
            const loaded = await this.loadAthletesData();
            if (loaded) {
                this.updateAthletesList();
            } else {
                this.showAdminMessage('Daten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.', 'warning');
            }
        } catch (error) {
            console.error('Error in showAdminApp:', error);
            this.showAdminMessage('Fehler beim Laden der App. Bitte versuchen Sie es später erneut.', 'error');
        }
    }
    
    handleRiegeChange(e) {
        const riege = e.target.value;
        this.currentData.riege = riege;
        this.currentData.currentAthleteIndex = 0;
        
        const athleteSelect = document.getElementById('athleteSelect');
        if (!athleteSelect) return;
        
        athleteSelect.innerHTML = '<option value="">Athlet wählen...</option>';
        
        if (riege) {
            athleteSelect.disabled = false;
            
            // Filter athletes by riege
            const athletesInRiege = Object.entries(this.athletesData)
                .filter(([key, athlete]) => athlete && athlete.riege === riege)
                .map(([key, athlete]) => ({ key, name: athlete.name }));
            
            console.log('Athletes in riege', riege, ':', athletesInRiege);
            
            athletesInRiege.forEach((athlete, index) => {
                const option = document.createElement('option');
                option.value = athlete.key;
                option.textContent = athlete.name;
                athleteSelect.appendChild(option);
            });
            
            // Auto-select first athlete
            if (athletesInRiege.length > 0) {
                athleteSelect.value = athletesInRiege[0].key;
                this.currentData.athlete = athletesInRiege[0].name;
                this.currentData.athleteKey = athletesInRiege[0].key;
                this.updateAttemptDisplay();
                this.updateFormState();
            }
        } else {
            athleteSelect.disabled = true;
            athleteSelect.innerHTML = '<option value="">Zuerst Riege wählen...</option>';
            this.currentData.athlete = '';
            this.currentData.athleteKey = '';
            this.updateFormState();
        }
        
        // Update filtered history when riege changes
        this.updateFilteredHistory();
    }
    
    handleDisciplineChange(e) {
        const discipline = e.target.value;
        this.currentData.discipline = discipline;
        
        // Update unit display
        const unitDisplay = document.getElementById('unitDisplay');
        if (unitDisplay) {
            if (this.disciplines[discipline]) {
                unitDisplay.textContent = `(${this.disciplines[discipline].unit})`;
            } else {
                unitDisplay.textContent = '';
            }
        }
        
        this.updateAttemptDisplay();
        this.updateFormState();
        
        // Update filtered history when discipline changes
        this.updateFilteredHistory();
    }
    
    handleAthleteChange(e) {
        const athleteKey = e.target.value;
        this.currentData.athleteKey = athleteKey;
        
        if (athleteKey && this.athletesData[athleteKey]) {
            this.currentData.athlete = this.athletesData[athleteKey].name;
            
            // Update current athlete index
            if (this.currentData.riege) {
                const athletesInRiege = Object.entries(this.athletesData)
                    .filter(([key, athlete]) => athlete && athlete.riege === this.currentData.riege)
                    .map(([key, athlete]) => key);
                this.currentData.currentAthleteIndex = athletesInRiege.indexOf(athleteKey);
            }
        } else {
            this.currentData.athlete = '';
        }
        
        this.updateAttemptDisplay();
        this.updateFormState();
    }
    
    handleBestenlisteGenderChange(e) {
        const gender = e.target.value;
        const ageSelect = document.getElementById('bestenlisteAge');
        
        if (!ageSelect) return;
        
        // Clear current selection
        ageSelect.value = '';
        
        // Store all options for reference
        if (!this.allAgeOptions) {
            this.allAgeOptions = Array.from(ageSelect.options).map(option => ({
                value: option.value,
                text: option.textContent
            }));
        }
        
        // Clear all options except placeholder
        ageSelect.innerHTML = '<option value="">Altersklasse wählen...</option>';
        
        // Add filtered options based on gender
        this.allAgeOptions.forEach(option => {
            if (option.value === '') return; // Skip placeholder
            
            let shouldAdd = false;
            
            if (gender === 'm') {
                // Show individual years and M-categories and "Männer"
                shouldAdd = option.value.match(/^\d{4}$/) || 
                           option.value.startsWith('MU') || 
                           option.value === 'Männer';
            } else if (gender === 'w') {
                // Show individual years and W-categories and "Frauen"
                shouldAdd = option.value.match(/^\d{4}$/) || 
                           option.value.startsWith('WU') || 
                           option.value === 'Frauen';
            } else {
                // Show all options when no gender is selected
                shouldAdd = true;
            }
            
            if (shouldAdd) {
                const newOption = document.createElement('option');
                newOption.value = option.value;
                newOption.textContent = option.text;
                ageSelect.appendChild(newOption);
            }
        });
    }
    
    async updateAttemptDisplay() {
        const attemptDisplay = document.getElementById('attemptDisplay');
        const attemptText = document.getElementById('attemptText');
        
        if (!attemptDisplay || !attemptText) return;
        
        if (!this.currentData.athleteKey || !this.currentData.discipline) {
            attemptDisplay.classList.add('hidden');
            return;
        }
        
        const discipline = this.disciplines[this.currentData.discipline];
        if (!discipline) return;
        
        if (!this.firebaseConnected) {
            // Fallback display when Firebase is not connected
            attemptText.textContent = `1. Versuch von ${this.currentData.athlete}`;
            attemptDisplay.classList.remove('completed');
            attemptDisplay.classList.remove('hidden');
            return;
        }
        
        try {
            // Get current athlete data from Firebase
            const snapshot = await this.db.ref(`/athleten/${this.currentData.athleteKey}`).once('value');
            const athleteData = snapshot.val();
            
            if (!athleteData) {
                attemptDisplay.classList.add('hidden');
                return;
            }
            
            // Check if all attempts are completed
            let allCompleted = false;
            let attemptCount = 0;
            
            if (discipline.code === 'RUN') {
                // For sprint, check if there's a value
                if (athleteData.RUN && athleteData.RUN !== '' && athleteData.RUN !== 'X') {
                    allCompleted = true;
                    attemptCount = 1;
                }
            } else {
                // For LJ/BT, count non-empty attempts
                discipline.fields.forEach(field => {
                    if (athleteData[field] && athleteData[field] !== '' && athleteData[field] !== 'X') {
                        attemptCount++;
                    }
                });
                allCompleted = attemptCount >= 3;
            }
            
            // Update display based on completion status
            if (allCompleted) {
                attemptText.textContent = `Alle Versuche für ${this.currentData.athlete} erfasst`;
                attemptDisplay.classList.add('completed');
            } else {
                const nextAttempt = attemptCount + 1;
                attemptText.textContent = `${nextAttempt}. Versuch von ${this.currentData.athlete}`;
                attemptDisplay.classList.remove('completed');
            }
            
            attemptDisplay.classList.remove('hidden');
            
            // Update button states
            this.updateSubmitButton();
            
        } catch (error) {
            console.error('Error updating attempt display:', error);
            // Fallback display
            attemptText.textContent = `1. Versuch von ${this.currentData.athlete}`;
            attemptDisplay.classList.remove('completed');
            attemptDisplay.classList.remove('hidden');
        }
    }
    
    updateFormState() {
        const riegeSelected = !!this.currentData.riege;
        const disciplineSelected = !!this.currentData.discipline;
        const athleteSelected = !!this.currentData.athleteKey;
        
        // Enable/disable performance input
        const performanceInput = document.getElementById('performanceInput');
        if (performanceInput) {
            performanceInput.disabled = !(riegeSelected && disciplineSelected && athleteSelected);
            
            if (performanceInput.disabled) {
                performanceInput.value = '';
            }
        }
        
        // Enable/disable X button
        const xButton = document.getElementById('xButton');
        if (xButton) {
            xButton.disabled = !(riegeSelected && disciplineSelected && athleteSelected);
        }
        
        this.updateSubmitButton();
    }
    
    updateSubmitButton() {
        const submitButton = document.getElementById('submitButton');
        const xButton = document.getElementById('xButton');
        const performanceInput = document.getElementById('performanceInput');
        const attemptDisplay = document.getElementById('attemptDisplay');
        
        if (!submitButton || !performanceInput) return;
        
        // Check if all attempts are completed (red box)
        const allCompleted = attemptDisplay && attemptDisplay.classList.contains('completed');
        
        let canSubmit = false;
        
        if (this.currentData.riege && this.currentData.discipline && this.currentData.athleteKey && !this.isLoading && !allCompleted) {
            const hasValue = performanceInput.value.trim() !== '';
            const validValue = !isNaN(parseFloat(performanceInput.value)) && parseFloat(performanceInput.value) > 0;
            canSubmit = hasValue && validValue;
        }
        
        submitButton.disabled = !canSubmit || allCompleted;
        if (xButton) {
            xButton.disabled = !(this.currentData.riege && this.currentData.discipline && this.currentData.athleteKey) || allCompleted;
        }
    }
    
    // FEATURE 1: Enhanced filtered history
    async updateFilteredHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        // If no riege or discipline selected, show empty message
        if (!this.currentData.riege || !this.currentData.discipline) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <p>Wählen Sie eine Riege und Disziplin um verfügbare Einträge zu sehen.</p>
                </div>
            `;
            return;
        }
        
        if (!this.firebaseConnected || !this.db) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <p>Firebase nicht verfügbar.</p>
                </div>
            `;
            return;
        }
        
        try {
            // Get all athletes data
            const snapshot = await this.db.ref('/athleten').once('value');
            const data = snapshot.val();
            
            if (!data) {
                historyList.innerHTML = `
                    <div class="history-empty">
                        <p>Keine Daten verfügbar.</p>
                    </div>
                `;
                return;
            }
            
            const discipline = this.disciplines[this.currentData.discipline];
            if (!discipline) return;
            
            // Filter athletes by riege and collect all their attempts for this discipline
            const entries = [];
            
            Object.entries(data).forEach(([athleteKey, athlete]) => {
                if (!athlete || athlete.riege !== this.currentData.riege) return;
                
                // Collect all attempts for this discipline
                discipline.fields.forEach((field, index) => {
                    const value = athlete[field];
                    if (value && value !== '' && value !== 'X') {
                        const attemptNumber = discipline.code === 'RUN' ? 1 : index + 1;
                        // Use timestamp from field if available, otherwise use current time
                        const timestamp = athlete[`${field}_timestamp`] || Date.now();
                        entries.push({
                            athleteKey,
                            athleteName: athlete.name,
                            field,
                            value,
                            attemptNumber,
                            timestamp,
                            discipline: this.currentData.discipline
                        });
                    }
                });
            });
            
            // Sort entries by timestamp (newest first), then by athlete name
            entries.sort((a, b) => {
                // First sort by timestamp (newest first)
                if (a.timestamp !== b.timestamp) {
                    return b.timestamp - a.timestamp;
                }
                // If same timestamp, sort by athlete name
                return a.athleteName.localeCompare(b.athleteName);
            });
            
            if (entries.length === 0) {
                historyList.innerHTML = `
                    <div class="history-empty">
                        <p>Keine Einträge für ${this.currentData.riege} - ${this.currentData.discipline} vorhanden.</p>
                    </div>
                `;
                return;
            }
            
            // Build history HTML
            historyList.innerHTML = '';
            
            entries.forEach(entry => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                const unit = discipline.unit;
                const displayValue = entry.value === 0 ? 'ungültig' : `${entry.value}${unit}`;
                
                historyItem.innerHTML = `
                    <div class="history-item-content">
                        <div class="history-item-main">
                            ${entry.athleteName} - ${entry.attemptNumber}. Versuch: ${displayValue}
                        </div>
                        <div class="history-item-details">
                            ${this.currentData.discipline}
                        </div>
                    </div>
                    <div class="history-item-actions">
                        <button class="delete-btn" onclick="klvApp.showDeleteConfirmation('${entry.athleteKey}', '${entry.field}', '${entry.athleteName}', ${entry.attemptNumber}, '${entry.value}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `;
                
                historyList.appendChild(historyItem);
            });
            
        } catch (error) {
            console.error('Error updating filtered history:', error);
            historyList.innerHTML = `
                <div class="history-empty">
                    <p>Fehler beim Laden der Historie.</p>
                </div>
            `;
        }
    }
    
    async handleSubmit() {
        if (this.isLoading) return;
        
        const performanceInput = document.getElementById('performanceInput');
        if (!performanceInput) return;
        
        const value = parseFloat(performanceInput.value);
        
        if (isNaN(value) || value <= 0) {
            this.showStatusMessage('Bitte geben Sie einen gültigen Wert ein (größer als 0).', 'error');
            return;
        }
        
        await this.saveAttempt(value);
    }
    
    handleXButton() {
        const xButtonModal = document.getElementById('xButtonModal');
        const xButtonMessage = document.getElementById('xButtonMessage');
        
        if (xButtonMessage) {
            xButtonMessage.textContent = `Versuch ungültig oder nicht angetreten - ${this.currentData.athlete}`;
        }
        
        if (xButtonModal) {
            xButtonModal.classList.remove('hidden');
        }
    }
    
    async confirmXButton() {
        if (this.isLoading) return;
        
        this.hideXButtonModal();
        await this.saveAttempt('X');
    }
    
    async saveAttempt(value) {
        this.setLoading(true);
        
        if (!this.firebaseConnected) {
            this.showStatusMessage('Firebase nicht verbunden. Daten können nicht gespeichert werden.', 'error');
            this.setLoading(false);
            return;
        }
        
        try {
            const discipline = this.disciplines[this.currentData.discipline];
            if (!discipline) {
                throw new Error('Invalid discipline');
            }
            
            // Get current athlete data
            const snapshot = await this.db.ref(`/athleten/${this.currentData.athleteKey}`).once('value');
            const athleteData = snapshot.val();
            
            if (!athleteData) {
                throw new Error('Athlete not found');
            }
            
            // Determine which field to update
            let fieldToUpdate = null;
            let attemptNumber = 1;
            
            if (discipline.code === 'RUN') {
                // For sprint, always update RUN field with best (fastest) time
                if (value === 'X' || value === 0) {
                    fieldToUpdate = 'RUN';
                } else {
                    const currentTime = parseFloat(athleteData.RUN);
                    if (!currentTime || value < currentTime) {
                        fieldToUpdate = 'RUN';
                    }
                }
                attemptNumber = athleteData.RUN && athleteData.RUN !== '' ? 2 : 1;
            } else {
                // For long jump and throw, find next empty field
                for (let i = 0; i < discipline.fields.length; i++) {
                    const field = discipline.fields[i];
                    if (!athleteData[field] || athleteData[field] === '') {
                        fieldToUpdate = field;
                        attemptNumber = i + 1;
                        break;
                    }
                }
            }
            
            if (!fieldToUpdate) {
                this.showStatusMessage('Alle Versuche bereits erfasst.', 'warning');
                this.setLoading(false);
                return;
            }
            
            // Create entry for confirmation and history
            const entry = {
                id: Date.now() + Math.random(),
                riege: this.currentData.riege,
                athlete: this.currentData.athlete,
                discipline: this.currentData.discipline,
                attempt: attemptNumber,
                value: value,
                timestamp: Date.now()
            };
            
            // Update Firebase with value and timestamp
            const timestamp = Date.now();
            await this.db.ref(`/athleten/${this.currentData.athleteKey}/${fieldToUpdate}`).set(value);
            await this.db.ref(`/athleten/${this.currentData.athleteKey}/${fieldToUpdate}_timestamp`).set(timestamp);
            
            console.log(`Updated ${this.currentData.athleteKey}.${fieldToUpdate} = ${value}`);
            
            // Save to local history
            this.saveToLocalHistory(entry.id);
            
            // Clear input
            const performanceInput = document.getElementById('performanceInput');
            if (performanceInput) {
                performanceInput.value = '';
            }
            
            // Update filtered history to show new entry
            await this.updateFilteredHistory();
            
            // Move to next athlete BEFORE showing confirmation
            await this.moveToNextAthlete();
            
            // Show confirmation overlay AFTER moving to next athlete
            this.showConfirmationOverlay(entry);
            
            this.setLoading(false);
        } catch (error) {
            console.error('Error saving attempt:', error);
            this.showStatusMessage('Fehler beim Speichern des Versuchs: ' + error.message, 'error');
            this.setLoading(false);
        }
    }
    
    async moveToNextAthlete() {
        if (!this.currentData.riege) return;
        
        const athletesInRiege = Object.entries(this.athletesData)
            .filter(([key, athlete]) => athlete && athlete.riege === this.currentData.riege)
            .map(([key, athlete]) => ({ key, name: athlete.name }));
        
        if (athletesInRiege.length === 0) return;
        
        const nextIndex = (this.currentData.currentAthleteIndex + 1) % athletesInRiege.length;
        const nextAthlete = athletesInRiege[nextIndex];
        
        this.currentData.currentAthleteIndex = nextIndex;
        this.currentData.athlete = nextAthlete.name;
        this.currentData.athleteKey = nextAthlete.key;
        
        // Update athlete dropdown
        const athleteSelect = document.getElementById('athleteSelect');
        if (athleteSelect) {
            athleteSelect.value = this.currentData.athleteKey;
        }
        
        // Update attempt display
        await this.updateAttemptDisplay();
        this.updateFormState();
        
        // Focus on performance input
        setTimeout(() => {
            const performanceInput = document.getElementById('performanceInput');
            if (performanceInput && !performanceInput.disabled) {
                performanceInput.focus();
            }
        }, 500);
    }
    
    showConfirmationOverlay(entry) {
        const overlay = document.getElementById('confirmationOverlay');
        const confirmAthlete = document.getElementById('confirmAthlete');
        const confirmAttempt = document.getElementById('confirmAttempt');
        const confirmPerformance = document.getElementById('confirmPerformance');
        const nextAthlete = document.getElementById('nextAthlete');
        const confirmationClose = document.getElementById('confirmationClose');
        
        if (!overlay) return;
        
        // Fill in details
        if (confirmAthlete) confirmAthlete.textContent = entry.athlete;
        if (confirmAttempt) confirmAttempt.textContent = `${entry.attempt}. Versuch`;
        
        if (confirmPerformance) {
            if (entry.value === 'X') {
                confirmPerformance.textContent = 'X';
            } else {
                const discipline = this.disciplines[entry.discipline];
                const unit = discipline ? discipline.unit : '';
                const displayValue = entry.value === 0 ? 'ungültig' : `${entry.value}${unit}`;
                confirmPerformance.textContent = displayValue;
            }
        }
        
        // Show next athlete
        if (nextAthlete && this.currentData.athlete) {
            nextAthlete.textContent = this.currentData.athlete;
        }
        
        // Update button text
        if (confirmationClose && this.currentData.athlete) {
            confirmationClose.textContent = `Weiter mit ${this.currentData.athlete}`;
        }
        
        // Show overlay
        overlay.classList.remove('hidden');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.hideConfirmationOverlay();
        }, 3000);
    }
    
    hideConfirmationOverlay() {
        const overlay = document.getElementById('confirmationOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
    
    hideXButtonModal() {
        const xButtonModal = document.getElementById('xButtonModal');
        if (xButtonModal) {
            xButtonModal.classList.add('hidden');
        }
    }
    
    showDeleteConfirmation(athleteKey, field, athleteName, attemptNumber, value) {
        this.entryToDelete = { athleteKey, field, athleteName, attemptNumber, value };
        
        const deleteModal = document.getElementById('deleteModal');
        const deleteDetails = document.getElementById('deleteEntryDetails');
        
        if (deleteDetails) {
            const discipline = this.disciplines[this.currentData.discipline];
            const unit = discipline ? discipline.unit : '';
            const displayValue = value === 'X' ? 'X' : value === '0' ? 'ungültig' : `${value}${unit}`;
            
            deleteDetails.innerHTML = `
                <strong>${athleteName}</strong><br>
                ${attemptNumber}. Versuch: ${displayValue}<br>
                <small>Disziplin: ${this.currentData.discipline}</small>
            `;
        }
        
        if (deleteModal) {
            deleteModal.classList.remove('hidden');
        }
    }
    
    hideDeleteModal() {
        const deleteModal = document.getElementById('deleteModal');
        if (deleteModal) {
            deleteModal.classList.add('hidden');
        }
        this.entryToDelete = null;
    }
    
    async confirmDeleteEntry() {
        if (!this.entryToDelete || !this.firebaseConnected) return;
        
        try {
            // Set field to empty string in Firebase
            await this.db.ref(`/athleten/${this.entryToDelete.athleteKey}/${this.entryToDelete.field}`).set('');
            
            console.log(`Deleted ${this.entryToDelete.athleteKey}.${this.entryToDelete.field}`);
            
            // Update filtered history
            await this.updateFilteredHistory();
            
            // Update attempt display if it's for the current athlete
            if (this.entryToDelete.athleteKey === this.currentData.athleteKey) {
                await this.updateAttemptDisplay();
            }
            
            // Hide modal
            this.hideDeleteModal();
            
            this.showStatusMessage(`Eintrag von ${this.entryToDelete.athleteName} wurde gelöscht.`, 'success');
            
        } catch (error) {
            console.error('Error deleting entry:', error);
            this.showStatusMessage('Fehler beim Löschen: ' + error.message, 'error');
        }
    }
    
    setLoading(loading) {
        this.isLoading = loading;
        const submitButton = document.getElementById('submitButton');
        const submitText = document.getElementById('submitText');
        const loadingSpinner = document.getElementById('loadingSpinner');
        
        if (submitButton && submitText && loadingSpinner) {
            if (loading) {
                submitButton.classList.add('loading');
                submitText.textContent = 'Speichern...';
                loadingSpinner.classList.remove('hidden');
                submitButton.disabled = true;
            } else {
                submitButton.classList.remove('loading');
                submitText.textContent = 'Ergebnis hinzufügen';
                loadingSpinner.classList.add('hidden');
            }
        }
        
        setTimeout(() => this.updateSubmitButton(), 100);
    }
    
    showStatusMessage(message, type = 'info') {
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = `status-message ${type}`;
            statusMessage.classList.remove('hidden');
            
            setTimeout(() => {
                statusMessage.classList.add('hidden');
            }, 5000);
        }
    }
    
    showAdminMessage(message, type = 'info') {
        const statusMessage = document.getElementById('adminStatusMessage');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = `status-message ${type}`;
            statusMessage.classList.remove('hidden');
            
            setTimeout(() => {
                statusMessage.classList.add('hidden');
            }, 5000);
        }
    }
    
    // FEATURE 3: Bestenliste functionality
    async showBestenliste() {
        const ageSelect = document.getElementById('bestenlisteAge');
        const genderSelect = document.getElementById('bestenlisteGender');
        const tableDiv = document.getElementById('bestenlisteTable');
        const exportButton = document.getElementById('exportBestenliste');
        
        if (!ageSelect || !genderSelect || !tableDiv) return;
        
        const selectedAge = ageSelect.value;
        const selectedGender = genderSelect.value;
        
        if (!selectedAge || !selectedGender || !this.firebaseConnected) {
            this.showAdminMessage('Bitte wählen Sie Altersklasse und Geschlecht aus.', 'warning');
            return;
        }
        
        try {
            const snapshot = await this.db.ref('/athleten').once('value');
            const data = snapshot.val();
            
            if (!data) {
                this.showAdminMessage('Keine Daten verfügbar', 'warning');
                return;
            }
            
            // Filter athletes
            const filteredAthletes = [];
            
            Object.entries(data).forEach(([key, athlete]) => {
                if (!athlete || athlete.geschlecht !== selectedGender) return;
                
                // Check age category match
                let matches = false;
                
                if (selectedAge.match(/^\d{4}$/)) {
                    // Direct year match
                    matches = athlete.jahrgang == selectedAge;
                } else {
                    // Category match
                    const category = this.getAgeCategoryForYear(athlete.jahrgang, athlete.geschlecht);
                    matches = category === selectedAge;
                }
                
                if (matches && athlete['final-points']) {
                    filteredAthletes.push({
                        key,
                        name: athlete.name,
                        riege: athlete.riege,
                        points: parseInt(athlete['final-points']) || 0,
                        ljPoints: parseInt(athlete.LJp) || 0,
                        btPoints: parseInt(athlete.BTp) || 0,
                        runPoints: parseInt(athlete.RUNp) || 0,
                        ljBest: this.getBestValue(athlete, ['LJv1', 'LJv2', 'LJv3'], true),
                        btBest: this.getBestValue(athlete, ['BTv1', 'BTv2', 'BTv3'], true),
                        runBest: this.getBestValue(athlete, ['RUN'], false),
                        fullData: athlete
                    });
                }
            });
            
            // Sort by points descending
            filteredAthletes.sort((a, b) => b.points - a.points);
            
            this.currentBestenliste = filteredAthletes;
            
            if (filteredAthletes.length === 0) {
                tableDiv.innerHTML = '<p>Keine Athleten in dieser Kategorie gefunden.</p>';
                tableDiv.classList.remove('hidden');
                exportButton.disabled = true;
                return;
            }
            
            // Build table
            let tableHtml = `
                <table>
                    <thead>
                        <tr>
                            <th>Platz</th>
                            <th>Name</th>
                            <th>Riege</th>
                            <th>Gesamt-Pkte</th>
                            <th>LJ Pkte</th>
                            <th>BT Pkte</th>
                            <th>Sprint Pkte</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            filteredAthletes.forEach((athlete, index) => {
                const rank = index + 1;
                let medalClass = '';
                let medal = '';
                
                if (rank === 1) {
                    medalClass = 'rank-1';
                    medal = '🥇';
                } else if (rank === 2) {
                    medalClass = 'rank-2';
                    medal = '🥈';
                } else if (rank === 3) {
                    medalClass = 'rank-3';
                    medal = '🥉';
                }
                
                tableHtml += `
                    <tr class="${medalClass}" onclick="klvApp.showAthleteDetails('${athlete.key}')" style="cursor: pointer;">
                        <td><span class="rank-medal">${medal}</span>${rank}</td>
                        <td>${athlete.name}</td>
                        <td>${athlete.riege}</td>
                        <td><strong>${athlete.points}</strong></td>
                        <td>${athlete.ljPoints}</td>
                        <td>${athlete.btPoints}</td>
                        <td>${athlete.runPoints}</td>
                    </tr>
                `;
            });
            
            tableHtml += '</tbody></table>';
            tableDiv.innerHTML = tableHtml;
            tableDiv.classList.remove('hidden');
            exportButton.disabled = false;
            
            this.showAdminMessage(`Bestenliste mit ${filteredAthletes.length} Athleten geladen.`, 'success');
            
        } catch (error) {
            console.error('Error showing bestenliste:', error);
            this.showAdminMessage('Fehler beim Laden der Bestenliste: ' + error.message, 'error');
        }
    }
    
    getBestValue(athlete, fields, higherBetter) {
        const values = fields
            .map(field => athlete[field])
            .filter(val => val && val !== '' && val !== 'X')
            .map(val => parseFloat(val))
            .filter(val => !isNaN(val));
        
        if (values.length === 0) return '-';
        
        const best = higherBetter ? Math.max(...values) : Math.min(...values);
        return best.toString();
    }
    
    showAthleteDetails(athleteKey) {
        if (!this.athletesData[athleteKey]) return;
        
        const athlete = this.athletesData[athleteKey];
        const modal = document.getElementById('athleteDetailsModal');
        const title = document.getElementById('athleteDetailsTitle');
        const content = document.getElementById('athleteDetailsContent');
        
        if (!modal || !title || !content) return;
        
        title.textContent = `Athletendetails - ${athlete.name}`;
        
        const category = this.getAgeCategoryForYear(athlete.jahrgang, athlete.geschlecht);
        
        content.innerHTML = `
            <div class="athlete-details-grid">
                <div class="athlete-detail-section">
                    <h5>Allgemeine Daten</h5>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">Name:</span>
                        <span class="athlete-detail-value">${athlete.name}</span>
                    </div>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">Jahrgang:</span>
                        <span class="athlete-detail-value">${athlete.jahrgang}</span>
                    </div>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">Geschlecht:</span>
                        <span class="athlete-detail-value">${athlete.geschlecht === 'm' ? 'Männlich' : 'Weiblich'}</span>
                    </div>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">Riege:</span>
                        <span class="athlete-detail-value">${athlete.riege}</span>
                    </div>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">Kategorie:</span>
                        <span class="athlete-detail-value">${category || 'Unbekannt'}</span>
                    </div>
                </div>
                
                <div class="athlete-detail-section">
                    <h5>Weitsprung</h5>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">1. Versuch:</span>
                        <span class="athlete-detail-value">${athlete.LJv1 || '-'}</span>
                    </div>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">2. Versuch:</span>
                        <span class="athlete-detail-value">${athlete.LJv2 || '-'}</span>
                    </div>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">3. Versuch:</span>
                        <span class="athlete-detail-value">${athlete.LJv3 || '-'}</span>
                    </div>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">Punkte:</span>
                        <span class="athlete-detail-value"><strong>${athlete.LJp || '-'}</strong></span>
                    </div>
                </div>
                
                <div class="athlete-detail-section">
                    <h5>Wurf</h5>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">1. Versuch:</span>
                        <span class="athlete-detail-value">${athlete.BTv1 || '-'}</span>
                    </div>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">2. Versuch:</span>
                        <span class="athlete-detail-value">${athlete.BTv2 || '-'}</span>
                    </div>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">3. Versuch:</span>
                        <span class="athlete-detail-value">${athlete.BTv3 || '-'}</span>
                    </div>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">Punkte:</span>
                        <span class="athlete-detail-value"><strong>${athlete.BTp || '-'}</strong></span>
                    </div>
                </div>
                
                <div class="athlete-detail-section">
                    <h5>Sprint</h5>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">Zeit:</span>
                        <span class="athlete-detail-value">${athlete.RUN || '-'}</span>
                    </div>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">Punkte:</span>
                        <span class="athlete-detail-value"><strong>${athlete.RUNp || '-'}</strong></span>
                    </div>
                </div>
                
                <div class="athlete-detail-section">
                    <h5>Gesamtergebnis</h5>
                    <div class="athlete-detail-item">
                        <span class="athlete-detail-label">Gesamtpunkte:</span>
                        <span class="athlete-detail-value"><strong style="color: var(--color-primary); font-size: var(--font-size-lg);">${athlete['final-points'] || '-'}</strong></span>
                    </div>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    }
    
    hideAthleteDetailsModal() {
        const modal = document.getElementById('athleteDetailsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    exportBestenliste() {
        if (!this.currentBestenliste || this.currentBestenliste.length === 0) {
            this.showAdminMessage('Keine Bestenliste zum Exportieren vorhanden.', 'warning');
            return;
        }
        
        const ageSelect = document.getElementById('bestenlisteAge');
        const genderSelect = document.getElementById('bestenlisteGender');
        
        const headers = ['Platz', 'Name', 'Riege', 'Gesamt_Punkte', 'LJ_Punkte', 'BT_Punkte', 'Sprint_Punkte', 'LJ_Beste', 'BT_Beste', 'Sprint_Beste'];
        const rows = [headers];
        
        this.currentBestenliste.forEach((athlete, index) => {
            rows.push([
                (index + 1).toString(),
                athlete.name,
                athlete.riege,
                athlete.points.toString(),
                athlete.ljPoints.toString(),
                athlete.btPoints.toString(),
                athlete.runPoints.toString(),
                athlete.ljBest,
                athlete.btBest,
                athlete.runBest
            ]);
        });
        
        const csvContent = rows.map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        
        const ageLabel = ageSelect.options[ageSelect.selectedIndex].text;
        const genderLabel = genderSelect.options[genderSelect.selectedIndex].text;
        link.download = `bestenliste-${ageLabel}-${genderLabel}-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        this.showAdminMessage('Bestenliste CSV wurde heruntergeladen.', 'success');
    }
    
    // Admin Functions
    async showAllEntries() {
        if (!this.firebaseConnected || !this.db) {
            this.showAdminMessage('Firebase nicht verfügbar', 'error');
            return;
        }
        
        try {
            const snapshot = await this.db.ref('/athleten').once('value');
            const data = snapshot.val();
            
            if (!data) {
                this.showAdminMessage('Keine Daten in Firebase gefunden', 'warning');
                return;
            }
            
            const section = document.getElementById('allEntriesSection');
            const table = document.getElementById('entriesTable');
            
            if (!section || !table) return;
            
            let tableHtml = `
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Jahrgang</th>
                            <th>Geschlecht</th>
                            <th>Riege</th>
                            <th>LJ V1</th>
                            <th>LJ V2</th>
                            <th>LJ V3</th>
                            <th>BT V1</th>
                            <th>BT V2</th>
                            <th>BT V3</th>
                            <th>Sprint</th>
                            <th>LJ Pkte</th>
                            <th>BT Pkte</th>
                            <th>Sprint Pkte</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            Object.entries(data).forEach(([key, athlete]) => {
                tableHtml += `
                    <tr>
                        <td>${athlete.name || ''}</td>
                        <td>${athlete.jahrgang || ''}</td>
                        <td>${athlete.geschlecht || ''}</td>
                        <td>${athlete.riege || ''}</td>
                        <td>${athlete.LJv1 || ''}</td>
                        <td>${athlete.LJv2 || ''}</td>
                        <td>${athlete.LJv3 || ''}</td>
                        <td>${athlete.BTv1 || ''}</td>
                        <td>${athlete.BTv2 || ''}</td>
                        <td>${athlete.BTv3 || ''}</td>
                        <td>${athlete.RUN || ''}</td>
                        <td>${athlete.LJp || ''}</td>
                        <td>${athlete.BTp || ''}</td>
                        <td>${athlete.RUNp || ''}</td>
                        <td>${athlete['final-points'] || ''}</td>
                    </tr>
                `;
            });
            
            tableHtml += '</tbody></table>';
            table.innerHTML = tableHtml;
            section.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error loading entries:', error);
            this.showAdminMessage('Fehler beim Laden der Einträge: ' + error.message, 'error');
        }
    }
    
    async calculatePoints() {
        if (!this.firebaseConnected || !this.db) {
            this.showAdminMessage('Firebase nicht verfügbar', 'error');
            return;
        }
        
        try {
            const snapshot = await this.db.ref('/athleten').once('value');
            const data = snapshot.val();
            
            if (!data) {
                this.showAdminMessage('Keine Daten zum Berechnen vorhanden', 'warning');
                return;
            }
            
            // Group athletes by category and gender
            const groups = {};
            
            Object.entries(data).forEach(([key, athlete]) => {
                if (!athlete.jahrgang || !athlete.geschlecht) return;
                
                const category = this.getAgeCategoryForYear(athlete.jahrgang, athlete.geschlecht);
                if (!category) return;
                
                const groupKey = `${category}`;
                if (!groups[groupKey]) {
                    groups[groupKey] = { LJ: [], BT: [], RUN: [] };
                }
                
                // Collect ALL values for each discipline (not just the best ones)
                const ljValues = [athlete.LJv1, athlete.LJv2, athlete.LJv3].filter(v => v && v !== 'X' && v !== '').map(Number);
                const btValues = [athlete.BTv1, athlete.BTv2, athlete.BTv3].filter(v => v && v !== 'X' && v !== '').map(Number);
                const runValue = athlete.RUN && athlete.RUN !== 'X' && athlete.RUN !== '' ? Number(athlete.RUN) : null;
                
                // Add ALL valid values to the groups (not just the best ones)
                ljValues.forEach(value => groups[groupKey].LJ.push(value));
                btValues.forEach(value => groups[groupKey].BT.push(value));
                if (runValue) groups[groupKey].RUN.push(runValue);
            });
            
            // Calculate reference values (average)
            const referenceValues = {};
            for (const groupKey in groups) {
                referenceValues[groupKey] = {};
                for (const discipline in groups[groupKey]) {
                    const values = groups[groupKey][discipline];
                    if (values.length > 0) {
                        referenceValues[groupKey][discipline] = values.reduce((a, b) => a + b, 0) / values.length;
                    }
                }
            }
            
            // Store reference values in Firebase for each athlete
            const referenceUpdates = {};
            Object.entries(data).forEach(([key, athlete]) => {
                if (!athlete.jahrgang || !athlete.geschlecht) return;
                
                const category = this.getAgeCategoryForYear(athlete.jahrgang, athlete.geschlecht);
                if (!category) return;
                
                const groupKey = `${category}`;
                const refValues = referenceValues[groupKey];
                if (!refValues) return;
                
                // Store reference values for this athlete's category
                referenceUpdates[`/athleten/${key}/R_LJ`] = refValues.LJ ? Math.round(refValues.LJ * 100) / 100 : '';
                referenceUpdates[`/athleten/${key}/R_BT`] = refValues.BT ? Math.round(refValues.BT * 100) / 100 : '';
                referenceUpdates[`/athleten/${key}/R_RUN`] = refValues.RUN ? Math.round(refValues.RUN * 100) / 100 : '';
            });
            
            // Calculate points for each athlete
            const updates = {};
            Object.entries(data).forEach(([key, athlete]) => {
                if (!athlete.jahrgang || !athlete.geschlecht) return;
                
                const category = this.getAgeCategoryForYear(athlete.jahrgang, athlete.geschlecht);
                if (!category) return;
                
                const groupKey = `${category}`;
                const refValues = referenceValues[groupKey];
                if (!refValues) return;
                
                // Calculate points for each discipline
                let ljPoints = 0, btPoints = 0, runPoints = 0;
                
                // Long Jump
                const ljValues = [athlete.LJv1, athlete.LJv2, athlete.LJv3].filter(v => v && v !== 'X' && v !== '').map(Number);
                if (ljValues.length > 0 && refValues.LJ) {
                    const bestLJ = Math.max(...ljValues);
                    ljPoints = Math.round(500 * (bestLJ / refValues.LJ));
                }
                
                // Ball Throw
                const btValues = [athlete.BTv1, athlete.BTv2, athlete.BTv3].filter(v => v && v !== 'X' && v !== '').map(Number);
                if (btValues.length > 0 && refValues.BT) {
                    const bestBT = Math.max(...btValues);
                    btPoints = Math.round(500 * (bestBT / refValues.BT));
                }
                
                // Sprint (lower is better)
                const runValue = athlete.RUN && athlete.RUN !== 'X' && athlete.RUN !== '' ? Number(athlete.RUN) : null;
                if (runValue && refValues.RUN) {
                    runPoints = Math.round(500 * (refValues.RUN / runValue));
                }
                
                const totalPoints = ljPoints + btPoints + runPoints;
                
                // Prepare updates
                updates[`/athleten/${key}/LJp`] = ljPoints;
                updates[`/athleten/${key}/BTp`] = btPoints;
                updates[`/athleten/${key}/RUNp`] = runPoints;
                updates[`/athleten/${key}/final-points`] = totalPoints;
            });
            
            // Merge reference updates with point updates
            const allUpdates = { ...updates, ...referenceUpdates };
            
            // Apply all updates to Firebase
            await this.db.ref().update(allUpdates);
            
            this.showAdminMessage('Punkte erfolgreich berechnet und in Firebase gespeichert!', 'success');
            
        } catch (error) {
            console.error('Error calculating points:', error);
            this.showAdminMessage('Fehler beim Berechnen der Punkte: ' + error.message, 'error');
        }
    }
    
    getAgeCategoryForYear(year, gender) {
        const currentYear = new Date().getFullYear();
        const prefix = gender === 'm' ? 'M' : 'W';
        
        for (const [category, years] of Object.entries(this.ageCategories)) {
            if (category.startsWith(prefix) || (category === 'Männer' && gender === 'm') || (category === 'Frauen' && gender === 'w')) {
                if (years.includes(year)) {
                    return category;
                }
                // Special case for Männer/Frauen (2005 and older)
                if ((category === 'Männer' || category === 'Frauen') && year <= 2005) {
                    return category;
                }
            }
        }
        return null;
    }
    
    async exportToCsv() {
        if (!this.firebaseConnected || !this.db) {
            this.showAdminMessage('Firebase nicht verfügbar', 'error');
            return;
        }
        
        try {
            const snapshot = await this.db.ref('/athleten').once('value');
            const data = snapshot.val();
            
            if (!data) {
                this.showAdminMessage('Keine Daten zum Exportieren vorhanden', 'warning');
                return;
            }
            
            const headers = ['Name', 'Jahrgang', 'Geschlecht', 'Riege', 'LJ_V1', 'LJ_V2', 'LJ_V3', 'BT_V1', 'BT_V2', 'BT_V3', 'Sprint', 'LJ_Punkte', 'BT_Punkte', 'Sprint_Punkte', 'Gesamt_Punkte'];
            const rows = [headers];
            
            Object.entries(data).forEach(([key, athlete]) => {
                rows.push([
                    athlete.name || '',
                    athlete.jahrgang || '',
                    athlete.geschlecht || '',
                    athlete.riege || '',
                    athlete.LJv1 || '',
                    athlete.LJv2 || '',
                    athlete.LJv3 || '',
                    athlete.BTv1 || '',
                    athlete.BTv2 || '',
                    athlete.BTv3 || '',
                    athlete.RUN || '',
                    athlete.LJp || '',
                    athlete.BTp || '',
                    athlete.RUNp || '',
                    athlete['final-points'] || ''
                ]);
            });
            
            const csvContent = rows.map(row => 
                row.map(field => `"${field}"`).join(',')
            ).join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `klv-daten-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            
            this.showAdminMessage('CSV-Datei wurde heruntergeladen', 'success');
            
        } catch (error) {
            console.error('Error exporting CSV:', error);
            this.showAdminMessage('Fehler beim CSV-Export: ' + error.message, 'error');
        }
    }
    
    async addAthlete() {
        const nameInput = document.getElementById('athleteName');
        const yearInput = document.getElementById('athleteYear');
        const genderSelect = document.getElementById('athleteGender');
        const riegeInput = document.getElementById('athleteRiege');
        
        if (!nameInput || !yearInput || !genderSelect || !riegeInput) return;
        
        const name = nameInput.value.trim();
        const year = parseInt(yearInput.value);
        const gender = genderSelect.value;
        const riege = riegeInput.value.trim();
        
        if (!name || !year || !gender || !riege) {
            this.showAdminMessage('Bitte füllen Sie alle Felder aus', 'error');
            return;
        }
        
        if (year < 1990 || year > new Date().getFullYear()) {
            this.showAdminMessage('Bitte geben Sie einen gültigen Jahrgang ein', 'error');
            return;
        }
        
        if (!this.firebaseConnected || !this.db) {
            this.showAdminMessage('Firebase nicht verfügbar', 'error');
            return;
        }
        
        try {
            // Create new athlete key
            const athleteKey = `athlet_${Date.now()}`;
            
            // Add to Firebase
            await this.db.ref(`/athleten/${athleteKey}`).set({
                name: name,
                jahrgang: year,
                geschlecht: gender,
                riege: riege,
                LJv1: '',
                LJv2: '',
                LJv3: '',
                BTv1: '',
                BTv2: '',
                BTv3: '',
                RUN: '',
                LJp: '',
                BTp: '',
                RUNp: '',
                'final-points': ''
            });
            
            // Reload athletes data
            await this.loadAthletesData();
            
            // Clear form
            nameInput.value = '';
            yearInput.value = '';
            genderSelect.value = '';
            riegeInput.value = '';
            
            this.updateAthletesList();
            this.showAdminMessage('Athlet wurde zu Firebase hinzugefügt', 'success');
            
        } catch (error) {
            console.error('Error adding athlete:', error);
            this.showAdminMessage('Fehler beim Hinzufügen des Athleten: ' + error.message, 'error');
        }
    }
    
    updateAthletesList() {
        const list = document.getElementById('athletesList');
        if (!list) return;
        
        const athletes = Object.entries(this.athletesData);
        
        if (athletes.length === 0) {
            list.innerHTML = '<p>Keine Athleten in Firebase vorhanden.</p>';
            return;
        }
        
        let html = '';
        athletes.forEach(([key, athlete]) => {
            const category = this.getAgeCategoryForYear(athlete.jahrgang, athlete.geschlecht);
            html += `
                <div class="athlete-item">
                    <div class="athlete-info">
                        <div class="athlete-name">${athlete.name}</div>
                        <div class="athlete-details">
                            ${athlete.jahrgang} • ${athlete.geschlecht === 'm' ? 'Männlich' : 'Weiblich'} • ${athlete.riege} • ${category || 'Unbekannt'}
                        </div>
                    </div>
                    <div class="athlete-actions">
                        <button class="btn btn--outline btn--sm" onclick="klvApp.deleteAthlete('${key}')">Aus Firebase löschen</button>
                    </div>
                </div>
            `;
        });
        
        list.innerHTML = html;
    }
    
    async deleteAthlete(key) {
        if (!this.firebaseConnected || !this.db || !confirm('Athlet wirklich aus Firebase löschen?')) return;
        
        try {
            await this.db.ref(`/athleten/${key}`).remove();
            await this.loadAthletesData();
            this.updateAthletesList();
            this.showAdminMessage('Athlet wurde aus Firebase gelöscht', 'success');
        } catch (error) {
            console.error('Error deleting athlete:', error);
            this.showAdminMessage('Fehler beim Löschen des Athleten: ' + error.message, 'error');
        }
    }
}