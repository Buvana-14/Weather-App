/**
 * SkyPulse Weather - Main Application Controller
 */

class WeatherApp {
    constructor() {
        this.currentCity = localStorage.getItem('skypulse_last_city') || 'London';
        this.units = localStorage.getItem('skypulse_units') || 'metric';
        this.searchHistory = JSON.parse(localStorage.getItem('skypulse_history') || '["London", "New York", "Tokyo", "Paris"]');
        this.favorites = JSON.parse(localStorage.getItem('skypulse_favorites') || '[]');
        this.lastWeatherData = null;

        this.initElements();
        this.bindEvents();
    }

    initElements() {
        // Search elements
        this.searchInput = document.getElementById('citySearchInput');
        this.searchBtn = document.getElementById('searchSubmitBtn');
        this.clearSearchBtn = document.getElementById('clearSearchBtn');
        this.searchDropdown = document.getElementById('searchDropdown');
        this.searchHistoryList = document.getElementById('searchHistoryList');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.quickCityChips = document.getElementById('quickCityChips');

        // Action buttons
        this.geoLocateBtn = document.getElementById('geoLocateBtn');
        this.metricBtn = document.getElementById('metricUnitBtn');
        this.imperialBtn = document.getElementById('imperialUnitBtn');
        this.favoriteBtn = document.getElementById('favoriteToggleBtn');

        // Settings modal
        this.openSettingsBtn = document.getElementById('openSettingsBtn');
        this.footerApiKeyBtn = document.getElementById('footerApiKeyBtn');
        this.closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
        this.settingsModal = document.getElementById('settingsModal');
        this.apiKeyInput = document.getElementById('apiKeyInput');
        this.toggleKeyVisibilityBtn = document.getElementById('toggleKeyVisibilityBtn');
        this.testApiConnectionBtn = document.getElementById('testApiConnectionBtn');
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        this.apiKeyStatusBanner = document.getElementById('apiKeyStatusBanner');
        this.apiKeyStatusText = document.getElementById('apiKeyStatusText');
        this.modeLive = document.getElementById('modeLive');
        this.modeDemo = document.getElementById('modeDemo');
        this.toggleDemoBtn = document.getElementById('toggleDemoBtn');
        this.demoBtnLabel = document.getElementById('demoBtnLabel');
    }

    bindEvents() {
        // 1. Search Interactions
        this.searchBtn.addEventListener('click', () => this.handleSearch());
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleSearch();
            }
        });

        this.searchInput.addEventListener('input', () => {
            if (this.searchInput.value.trim().length > 0) {
                this.clearSearchBtn.classList.remove('hidden');
            } else {
                this.clearSearchBtn.classList.add('hidden');
            }
        });

        this.clearSearchBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.clearSearchBtn.classList.add('hidden');
            this.searchInput.focus();
        });

        // Search History Dropdown
        this.searchInput.addEventListener('focus', () => this.showSearchDropdown());
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) && !this.searchDropdown.contains(e.target)) {
                this.searchDropdown.classList.add('hidden');
            }
        });

        this.clearHistoryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clearAllHistory();
        });

        // Quick City Chips
        if (this.quickCityChips) {
            this.quickCityChips.addEventListener('click', (e) => {
                const chip = e.target.closest('.city-chip');
                if (!chip) return;
                const city = chip.dataset.city;
                this.updateActiveChip(city);
                this.loadWeatherForCity(city);
            });
        }

        // 2. Geolocation
        this.geoLocateBtn.addEventListener('click', () => this.handleGeolocation());

        // 3. Unit Toggle
        this.metricBtn.addEventListener('click', () => this.setUnitSystem('metric'));
        this.imperialBtn.addEventListener('click', () => this.setUnitSystem('imperial'));

        // 4. Favorites Toggle
        if (this.favoriteBtn) {
            this.favoriteBtn.addEventListener('click', () => this.toggleFavorite());
        }

        // 5. Settings Modal
        this.openSettingsBtn.addEventListener('click', () => this.openSettingsModal());
        if (this.footerApiKeyBtn) {
            this.footerApiKeyBtn.addEventListener('click', () => this.openSettingsModal());
        }
        this.closeSettingsModalBtn.addEventListener('click', () => this.closeSettingsModal());
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeSettingsModal();
        });

        this.toggleKeyVisibilityBtn.addEventListener('click', () => {
            const isPass = this.apiKeyInput.type === 'password';
            this.apiKeyInput.type = isPass ? 'text' : 'password';
        });

        this.testApiConnectionBtn.addEventListener('click', () => this.handleTestApi());
        this.saveSettingsBtn.addEventListener('click', () => this.handleSaveSettings());

        // Footer Toggle Demo
        if (this.toggleDemoBtn) {
            this.toggleDemoBtn.addEventListener('click', () => {
                const nextMode = !window.weatherApi.isDemoMode;
                window.weatherApi.setDemoMode(nextMode);
                this.updateDemoBtnLabel();
                window.weatherUI.showToast(nextMode ? 'Switched to Demo / Simulated Mode.' : 'Switched to Live API Mode.', 'info');
                this.loadWeatherForCity(this.currentCity);
            });
        }

        // Theme pills in settings
        document.querySelectorAll('.theme-pill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.theme-pill-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const themeMode = btn.dataset.themeMode;
                localStorage.setItem('skypulse_theme_mode', themeMode);
                window.weatherUI.currentThemeMode = themeMode;
                if (this.lastWeatherData) {
                    window.weatherUI.applyAtmosphericTheme(this.lastWeatherData.current);
                }
            });
        });
    }

    async init() {
        this.updateUnitUI();
        this.updateDemoBtnLabel();
        this.apiKeyInput.value = window.weatherApi.apiKey;

        if (window.weatherApi.isDemoMode) {
            this.modeDemo.checked = true;
        } else {
            this.modeLive.checked = true;
        }

        // Initialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }

        await this.loadWeatherForCity(this.currentCity);
    }

    async loadWeatherForCity(cityName) {
        if (!cityName || !cityName.trim()) return;
        const cleanName = cityName.trim();

        window.weatherUI.setLoadingState(true);

        try {
            const data = await window.weatherApi.fetchAllWeatherByCity(cleanName, this.units);
            this.lastWeatherData = data;
            this.currentCity = cleanName;
            localStorage.setItem('skypulse_last_city', cleanName);

            window.weatherUI.renderDashboard(data, this.units);
            this.addToHistory(cleanName);
            this.updateFavoriteButtonState();
            this.updateActiveChip(cleanName);

            if (data.isFallback && !this._shownFallbackToast) {
                window.weatherUI.showToast('Using high-fidelity simulated weather while your API key activates.', 'warning', 6000);
                this._shownFallbackToast = true;
            }
        } catch (error) {
            console.error('Failed to load weather:', error);
            window.weatherUI.showToast(`City not found or network error: "${cleanName}"`, 'error');
        } finally {
            window.weatherUI.setLoadingState(false);
        }
    }

    async loadWeatherByCoords(lat, lon) {
        window.weatherUI.setLoadingState(true);

        try {
            const data = await window.weatherApi.fetchAllWeatherByCoords(lat, lon, this.units);
            this.lastWeatherData = data;
            const fetchedName = data.current.name || 'My Location';
            this.currentCity = fetchedName;
            localStorage.setItem('skypulse_last_city', fetchedName);

            window.weatherUI.renderDashboard(data, this.units);
            this.addToHistory(fetchedName);
            this.updateFavoriteButtonState();
            window.weatherUI.showToast(`Updated weather for ${fetchedName}!`, 'success');
        } catch (error) {
            console.error('Failed to load coordinates weather:', error);
            window.weatherUI.showToast('Could not fetch weather for your location.', 'error');
        } finally {
            window.weatherUI.setLoadingState(false);
        }
    }

    handleSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            window.weatherUI.showToast('Please enter a city name to search.', 'warning');
            this.searchInput.focus();
            return;
        }

        this.searchDropdown.classList.add('hidden');
        this.loadWeatherForCity(query);
    }

    handleGeolocation() {
        if (!navigator.geolocation) {
            window.weatherUI.showToast('Geolocation is not supported by your browser.', 'error');
            return;
        }

        window.weatherUI.showToast('Detecting your location...', 'info', 2500);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.loadWeatherByCoords(latitude, longitude);
            },
            (error) => {
                console.warn('Geolocation denied/failed:', error);
                window.weatherUI.showToast('Location access denied. Please search your city manually.', 'warning');
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    }

    setUnitSystem(unit) {
        if (this.units === unit) return;
        this.units = unit;
        localStorage.setItem('skypulse_units', unit);
        this.updateUnitUI();
        this.loadWeatherForCity(this.currentCity);
    }

    updateUnitUI() {
        if (this.units === 'imperial') {
            this.imperialBtn.classList.add('active');
            this.metricBtn.classList.remove('active');
        } else {
            this.metricBtn.classList.add('active');
            this.imperialBtn.classList.remove('active');
        }
    }

    updateActiveChip(cityName) {
        document.querySelectorAll('.city-chip').forEach(chip => {
            if (chip.dataset.city.toLowerCase() === cityName.toLowerCase()) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    // --- Search History & Favorites ---

    showSearchDropdown() {
        if (this.searchHistory.length === 0) {
            this.searchDropdown.classList.add('hidden');
            return;
        }

        let html = '';
        this.searchHistory.forEach((city) => {
            html += `
                <li class="dropdown-item" data-city="${city}">
                    <span class="item-city-name"><i data-lucide="history" class="icon-xs"></i> ${city}</span>
                    <button class="remove-history-btn" title="Remove" data-remove-city="${city}">&times;</button>
                </li>
            `;
        });

        this.searchHistoryList.innerHTML = html;
        this.searchDropdown.classList.remove('hidden');

        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Attach click events
        this.searchHistoryList.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.remove-history-btn')) return;
                const city = item.dataset.city;
                this.searchInput.value = city;
                this.searchDropdown.classList.add('hidden');
                this.loadWeatherForCity(city);
            });
        });

        this.searchHistoryList.querySelectorAll('.remove-history-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cityToRemove = btn.dataset.removeCity;
                this.removeFromHistory(cityToRemove);
            });
        });
    }

    addToHistory(cityName) {
        const clean = cityName.trim();
        this.searchHistory = this.searchHistory.filter(c => c.toLowerCase() !== clean.toLowerCase());
        this.searchHistory.unshift(clean);
        if (this.searchHistory.length > 8) this.searchHistory.pop();
        localStorage.setItem('skypulse_history', JSON.stringify(this.searchHistory));
    }

    removeFromHistory(cityName) {
        this.searchHistory = this.searchHistory.filter(c => c.toLowerCase() !== cityName.toLowerCase());
        localStorage.setItem('skypulse_history', JSON.stringify(this.searchHistory));
        this.showSearchDropdown();
    }

    clearAllHistory() {
        this.searchHistory = [];
        localStorage.setItem('skypulse_history', JSON.stringify([]));
        this.searchDropdown.classList.add('hidden');
    }

    toggleFavorite() {
        const city = this.currentCity;
        const index = this.favorites.findIndex(f => f.toLowerCase() === city.toLowerCase());

        if (index >= 0) {
            this.favorites.splice(index, 1);
            window.weatherUI.showToast(`Removed ${city} from favorites.`, 'info');
        } else {
            this.favorites.push(city);
            window.weatherUI.showToast(`Added ${city} to favorites! ❤️`, 'success');
        }

        localStorage.setItem('skypulse_favorites', JSON.stringify(this.favorites));
        this.updateFavoriteButtonState();
    }

    updateFavoriteButtonState() {
        if (!this.favoriteBtn) return;
        const isFav = this.favorites.some(f => f.toLowerCase() === this.currentCity.toLowerCase());
        if (isFav) {
            this.favoriteBtn.classList.add('favorited');
        } else {
            this.favoriteBtn.classList.remove('favorited');
        }
    }

    // --- Settings & Modal Logic ---

    openSettingsModal() {
        this.apiKeyInput.value = window.weatherApi.apiKey;
        this.modeLive.checked = !window.weatherApi.isDemoMode;
        this.modeDemo.checked = window.weatherApi.isDemoMode;
        this.settingsModal.classList.remove('hidden');
    }

    closeSettingsModal() {
        this.settingsModal.classList.add('hidden');
    }

    async handleTestApi() {
        const key = this.apiKeyInput.value.trim();
        this.apiKeyStatusBanner.className = 'api-status-banner';
        this.apiKeyStatusText.textContent = 'Testing connection with OpenWeatherMap...';

        const result = await window.weatherApi.testConnection(key);

        if (result.success) {
            this.apiKeyStatusBanner.className = 'api-status-banner success';
            this.apiKeyStatusText.textContent = result.message;
        } else {
            this.apiKeyStatusBanner.className = 'api-status-banner warning';
            this.apiKeyStatusText.textContent = result.message;
        }
    }

    handleSaveSettings() {
        const newKey = this.apiKeyInput.value.trim();
        const isDemo = this.modeDemo.checked;

        window.weatherApi.setApiKey(newKey);
        window.weatherApi.setDemoMode(isDemo);

        this.updateDemoBtnLabel();
        this.closeSettingsModal();
        window.weatherUI.showToast('Settings saved successfully!', 'success');

        this.loadWeatherForCity(this.currentCity);
    }

    updateDemoBtnLabel() {
        if (!this.demoBtnLabel) return;
        if (window.weatherApi.isDemoMode) {
            this.demoBtnLabel.textContent = 'Switch to Live API';
        } else {
            this.demoBtnLabel.textContent = 'Switch to Demo Mode';
        }
    }
}

// Instantiate on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WeatherApp();
    window.app.init();
});
