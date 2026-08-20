/**
 * SkyPulse Weather - UI Rendering Engine & Animation Controller
 */

class WeatherUI {
    constructor() {
        this.particleContainer = document.getElementById('weatherParticles');
        this.toastContainer = document.getElementById('toastContainer');
        this.currentThemeMode = localStorage.getItem('skypulse_theme_mode') || 'auto';
    }

    /**
     * Renders all weather dashboard sections
     */
    renderDashboard(payload, units = 'metric') {
        const { current, forecast, airQuality, isDemo, isFallback, fallbackReason } = payload;

        this.renderStatusBadge(isDemo, isFallback, fallbackReason);
        this.renderCurrentWeather(current, units);
        this.renderHourlyForecast(forecast, units);
        this.renderDailyForecast(forecast, units);
        this.renderAirQuality(airQuality);
        this.renderSunArc(current.sys?.sunrise, current.sys?.sunset, current.dt);
        this.renderWind(current.wind, units);
        this.renderAtmosphericMetrics(current, units);
        
        // Update atmospheric theme background
        this.applyAtmosphericTheme(current);

        // Re-initialize any newly rendered Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * Render status badge indicating Live API vs Demo/Fallback mode
     */
    renderStatusBadge(isDemo, isFallback, fallbackReason) {
        const badge = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');
        if (!badge || !statusText) return;

        if (isDemo || isFallback) {
            badge.className = 'status-badge demo-mode';
            statusText.textContent = isFallback ? 'Simulated Data (Key Pending)' : 'Demo Mode';
            badge.title = fallbackReason || 'Running in simulated demonstration mode';
        } else {
            badge.className = 'status-badge';
            statusText.textContent = 'Live API Data';
            badge.title = 'Real-time feed connected from OpenWeatherMap';
        }
    }

    /**
     * Render the Hero Weather Section
     */
    renderCurrentWeather(data, units) {
        const isImperial = units === 'imperial';
        const unitSymbol = isImperial ? '°F' : '°C';
        const speedUnit = isImperial ? 'mph' : 'km/h';

        // City & Country
        document.getElementById('cityName').textContent = data.name || 'Unknown Location';
        document.getElementById('countryBadge').textContent = (data.sys && data.sys.country) ? data.sys.country : '—';

        // Local Date & Time
        const localDate = this.formatLocalDateTime(data.dt, data.timezone);
        document.getElementById('dateTimeString').textContent = localDate;

        // Temperatures
        const temp = Math.round(data.main.temp);
        const feelsLike = Math.round(data.main.feels_like);
        const tempMin = Math.round(data.main.temp_min);
        const tempMax = Math.round(data.main.temp_max);

        document.getElementById('currentTemp').textContent = temp;
        document.getElementById('displayUnit').textContent = unitSymbol;
        document.getElementById('feelsLikeTemp').textContent = `${feelsLike}${unitSymbol}`;
        document.getElementById('tempMax').textContent = `${tempMax}${unitSymbol}`;
        document.getElementById('tempMin').textContent = `${tempMin}${unitSymbol}`;

        // Description
        const weatherInfo = data.weather && data.weather[0] ? data.weather[0] : { main: 'Clear', description: 'Clear sky', icon: '01d' };
        document.getElementById('weatherDescription').textContent = weatherInfo.description;

        // Humidity & Wind Quick Pills
        document.getElementById('heroHumidity').textContent = `${data.main.humidity}%`;
        const windVal = isImperial ? Math.round(data.wind.speed) : Math.round(data.wind.speed * 3.6);
        document.getElementById('heroWind').textContent = `${windVal} ${speedUnit}`;

        // Dynamic Animated SVG Weather Icon
        const heroIconContainer = document.getElementById('animatedHeroIcon');
        if (heroIconContainer) {
            const isNight = weatherInfo.icon ? weatherInfo.icon.endsWith('n') : false;
            heroIconContainer.innerHTML = this.getAnimatedWeatherSvg(weatherInfo.main, isNight);
        }
    }

    /**
     * Render the 24-Hour Forecast Timeline (8 x 3-hour steps)
     */
    renderHourlyForecast(forecast, units) {
        const timeline = document.getElementById('hourlyTimeline');
        if (!timeline || !forecast || !forecast.list) return;

        const isImperial = units === 'imperial';
        const unitSymbol = isImperial ? '°F' : '°C';

        const next8Hours = forecast.list.slice(0, 8);
        let html = '';

        next8Hours.forEach((item, index) => {
            const date = new Date(item.dt * 1000);
            let timeStr = date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
            if (index === 0) timeStr = 'Now';

            const temp = Math.round(item.main.temp);
            const cond = item.weather && item.weather[0] ? item.weather[0] : { main: 'Clear', icon: '01d' };
            const isNight = cond.icon ? cond.icon.endsWith('n') : false;
            const popPercent = Math.round((item.pop || 0) * 100);

            html += `
                <div class="hourly-item ${index === 0 ? 'active-now' : ''}">
                    <span class="hourly-time">${timeStr}</span>
                    <div class="hourly-icon-wrap">
                        ${this.getMiniWeatherSvg(cond.main, isNight)}
                    </div>
                    <span class="hourly-temp">${temp}${unitSymbol}</span>
                    ${popPercent > 10 ? `
                        <span class="hourly-pop" title="Precipitation Probability">
                            <i data-lucide="droplets" class="icon-xs"></i> ${popPercent}%
                        </span>
                    ` : `
                        <span class="hourly-pop" style="opacity:0.35;">
                            <i data-lucide="droplet" class="icon-xs"></i> 0%
                        </span>
                    `}
                </div>
            `;
        });

        timeline.innerHTML = html;
    }

    /**
     * Render the 5-Day Outlook with Daily Min/Max spectrum bars
     */
    renderDailyForecast(forecast, units) {
        const listContainer = document.getElementById('dailyForecastList');
        if (!listContainer || !forecast || !forecast.list) return;

        const isImperial = units === 'imperial';
        const unitSymbol = isImperial ? '°F' : '°C';

        // Group forecast items by calendar day
        const dailyGroups = {};
        forecast.list.forEach(item => {
            const dateStr = new Date(item.dt * 1000).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            if (!dailyGroups[dateStr]) {
                dailyGroups[dateStr] = [];
            }
            dailyGroups[dateStr].push(item);
        });

        // Compute daily summary
        const days = Object.keys(dailyGroups).slice(0, 5);
        let globalMin = 999;
        let globalMax = -999;

        const dailyStats = days.map((dayKey, idx) => {
            const items = dailyGroups[dayKey];
            let min = 999;
            let max = -999;
            let midItem = items[Math.floor(items.length / 2)] || items[0];

            items.forEach(i => {
                if (i.main.temp_min < min) min = i.main.temp_min;
                if (i.main.temp_max > max) max = i.main.temp_max;
            });

            min = Math.round(min);
            max = Math.round(max);

            if (min < globalMin) globalMin = min;
            if (max > globalMax) globalMax = max;

            const dateObj = new Date(midItem.dt * 1000);
            const weekday = idx === 0 ? 'Today' : dateObj.toLocaleDateString([], { weekday: 'short' });
            const cond = midItem.weather && midItem.weather[0] ? midItem.weather[0] : { main: 'Clear', description: 'Clear sky' };

            return { weekday, min, max, cond };
        });

        const tempRange = Math.max(1, globalMax - globalMin);

        let html = '';
        dailyStats.forEach(day => {
            const leftPercent = Math.max(0, ((day.min - globalMin) / tempRange) * 100);
            const widthPercent = Math.max(15, (((day.max - day.min) / tempRange) * 100));

            html += `
                <div class="daily-row">
                    <span class="daily-day-label">${day.weekday}</span>
                    <div class="daily-condition-block">
                        <div class="daily-icon-mini">
                            ${this.getMiniWeatherSvg(day.cond.main, false, 24)}
                        </div>
                        <span class="daily-desc-text" title="${day.cond.description}">${day.cond.description}</span>
                    </div>
                    <div class="temp-bar-container">
                        <div class="temp-bar-fill" style="left: ${leftPercent}%; width: ${widthPercent}%;"></div>
                    </div>
                    <div class="daily-temps">
                        <span class="min-temp-label">${day.min}°</span>
                        <span class="max-temp-label">${day.max}${unitSymbol}</span>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
    }

    /**
     * Render the Air Quality Index (AQI) and pollutant breakdown
     */
    renderAirQuality(aqiData) {
        const aqiValElem = document.getElementById('aqiValue');
        const aqiTitleElem = document.getElementById('aqiStatusTitle');
        const aqiAdviceElem = document.getElementById('aqiAdvice');
        const aqiCircle = document.getElementById('aqiBadgeCircle');
        if (!aqiValElem) return;

        const aqiItem = (aqiData && aqiData.list && aqiData.list[0]) ? aqiData.list[0] : { main: { aqi: 2 }, components: { pm2_5: 12, pm10: 20, o3: 45, no2: 18 } };
        const aqi = aqiItem.main.aqi || 2;
        const comps = aqiItem.components || {};

        const aqiConfig = {
            1: { title: 'Good Air Quality', advice: 'Air quality is ideal for outdoor activities and exercise.', color: '#10b981', border: '#059669' },
            2: { title: 'Fair Air Quality', advice: 'Air quality is acceptable for the majority of people.', color: '#3b82f6', border: '#2563eb' },
            3: { title: 'Moderate Air Quality', advice: 'Sensitive individuals should limit prolonged outdoor exertion.', color: '#f59e0b', border: '#d97706' },
            4: { title: 'Poor Air Quality', advice: 'Health effects may be experienced by members of sensitive groups.', color: '#f97316', border: '#ea580c' },
            5: { title: 'Very Poor Air Quality', advice: 'Health warning of emergency conditions. Keep windows closed.', color: '#ef4444', border: '#dc2626' }
        };

        const config = aqiConfig[aqi] || aqiConfig[2];

        aqiValElem.textContent = aqi;
        aqiTitleElem.textContent = config.title;
        aqiAdviceElem.textContent = config.advice;

        if (aqiCircle) {
            aqiCircle.style.borderColor = config.color;
            aqiCircle.style.boxShadow = `0 0 16px ${config.color}55`;
            aqiCircle.style.background = `${config.color}22`;
        }

        // Pollutants
        document.getElementById('pPm25').textContent = `${(comps.pm2_5 || 12.4).toFixed(1)} µg/m³`;
        document.getElementById('pPm10').textContent = `${(comps.pm10 || 21.8).toFixed(1)} µg/m³`;
        document.getElementById('pO3').textContent = `${(comps.o3 || 48.2).toFixed(1)} µg/m³`;
        document.getElementById('pNo2').textContent = `${(comps.no2 || 18.5).toFixed(1)} µg/m³`;
    }

    /**
     * Render Sunrise & Sunset daylight progress arc
     */
    renderSunArc(sunrise, sunset, currentDt) {
        const sunriseElem = document.getElementById('sunriseTime');
        const sunsetElem = document.getElementById('sunsetTime');
        const arcProgress = document.getElementById('sunArcProgress');

        const now = currentDt || Math.floor(Date.now() / 1000);
        const rise = sunrise || (now - 14400);
        const set = sunset || (now + 28800);

        if (sunriseElem) sunriseElem.textContent = this.formatUnixTime(rise);
        if (sunsetElem) sunsetElem.textContent = this.formatUnixTime(set);

        if (arcProgress) {
            const totalDaylight = Math.max(1, set - rise);
            const elapsed = Math.min(totalDaylight, Math.max(0, now - rise));
            const progressRatio = elapsed / totalDaylight; // 0 to 1

            // Total stroke-dasharray is ~251
            const maxOffset = 251;
            const targetOffset = maxOffset - (progressRatio * maxOffset);
            arcProgress.style.strokeDashoffset = `${targetOffset}`;
        }
    }

    /**
     * Render Wind velocity, direction compass, and gusts
     */
    renderWind(wind, units) {
        if (!wind) return;

        const isImperial = units === 'imperial';
        const speed = isImperial ? Math.round(wind.speed) : Math.round(wind.speed * 3.6);
        const speedUnit = isImperial ? 'mph' : 'km/h';
        const deg = wind.deg || 0;

        document.getElementById('windSpeedVal').textContent = speed;
        document.getElementById('windSpeedUnit').textContent = speedUnit;

        // Pointer rotation
        const pointer = document.getElementById('compassPointer');
        if (pointer) {
            pointer.style.transform = `rotate(${deg}deg)`;
        }

        // Direction text
        const cardinal = this.degToCardinal(deg);
        document.getElementById('windDirectionText').textContent = `${cardinal} (${deg}°)`;

        const gust = wind.gust ? (isImperial ? Math.round(wind.gust) : Math.round(wind.gust * 3.6)) : Math.round(speed * 1.3);
        document.getElementById('windGustText').textContent = `Gusts up to ${gust} ${speedUnit}`;
    }

    /**
     * Render Atmospheric Metrics: Humidity, Visibility, Pressure, Clouds
     */
    renderAtmosphericMetrics(data, units) {
        const isImperial = units === 'imperial';

        // 1. Humidity & Dew Point
        const humidity = data.main.humidity || 50;
        document.getElementById('humidityVal').textContent = humidity;
        const humBar = document.getElementById('humidityProgress');
        if (humBar) humBar.style.width = `${humidity}%`;

        // Calculate approximate dew point: T - ((100 - RH) / 5)
        const tempC = isImperial ? (data.main.temp - 32) * 5/9 : data.main.temp;
        const dewPointC = Math.round(tempC - ((100 - humidity) / 5));
        const dewPointDisplay = isImperial ? Math.round((dewPointC * 9/5) + 32) + '°F' : `${dewPointC}°C`;
        document.getElementById('humidityCaption').textContent = `The dew point is ${dewPointDisplay} right now.`;

        // 2. Visibility
        const rawVisMeters = data.visibility || 10000;
        const visKm = (rawVisMeters / 1000).toFixed(1);
        const visMiles = (rawVisMeters * 0.000621371).toFixed(1);

        document.getElementById('visibilityVal').textContent = isImperial ? visMiles : visKm;
        document.getElementById('visibilityUnit').textContent = isImperial ? 'miles' : 'km';

        const visRating = document.getElementById('visibilityRating');
        const visCaption = document.getElementById('visibilityCaption');
        if (rawVisMeters >= 9000) {
            visRating.textContent = 'Excellent Visibility';
            visRating.style.background = 'rgba(16, 185, 129, 0.15)';
            visRating.style.color = '#6ee7b7';
            visCaption.textContent = 'Perfect visual clarity across the horizon.';
        } else if (rawVisMeters >= 4000) {
            visRating.textContent = 'Moderate Visibility';
            visRating.style.background = 'rgba(245, 158, 11, 0.15)';
            visRating.style.color = '#fcd34d';
            visCaption.textContent = 'Mild haze or mist present in the air.';
        } else {
            visRating.textContent = 'Low Visibility';
            visRating.style.background = 'rgba(239, 68, 68, 0.15)';
            visRating.style.color = '#fca5a5';
            visCaption.textContent = 'Fog, dense precipitation, or heavy smog.';
        }

        // 3. Pressure
        const pressureHpa = data.main.pressure || 1013;
        document.getElementById('pressureVal').textContent = pressureHpa;
        const presRating = document.getElementById('pressureRating');
        const presCaption = document.getElementById('pressureCaption');

        if (pressureHpa > 1020) {
            presRating.textContent = 'High Pressure';
            presCaption.textContent = 'Typically brings clear, calm, and sunny skies.';
        } else if (pressureHpa < 1005) {
            presRating.textContent = 'Low Pressure';
            presCaption.textContent = 'May indicate approaching clouds or precipitation.';
        } else {
            presRating.textContent = 'Normal Pressure';
            presCaption.textContent = 'Stable meteorological conditions.';
        }

        // 4. Cloud Cover
        const clouds = data.clouds ? data.clouds.all : 20;
        document.getElementById('cloudCoverVal').textContent = clouds;
        const cloudBar = document.getElementById('cloudProgress');
        if (cloudBar) cloudBar.style.width = `${clouds}%`;

        const cloudCaption = document.getElementById('cloudCaption');
        if (clouds < 20) cloudCaption.textContent = 'Clear to mostly clear skies.';
        else if (clouds < 60) cloudCaption.textContent = 'Partly cloudy with sunny intervals.';
        else cloudCaption.textContent = 'Overcast and dense cloud layers.';
    }

    /**
     * Dynamically apply atmospheric theme styling and particles
     */
    applyAtmosphericTheme(weatherData) {
        if (this.currentThemeMode !== 'auto') {
            document.body.className = `theme-${this.currentThemeMode}`;
            this.generateParticles(this.currentThemeMode);
            return;
        }

        const condition = (weatherData.weather && weatherData.weather[0]) ? weatherData.weather[0].main.toLowerCase() : 'clear';
        const isNight = weatherData.weather && weatherData.weather[0] && weatherData.weather[0].icon ? weatherData.weather[0].icon.endsWith('n') : false;

        let themeClass = 'theme-clouds';

        if (condition.includes('thunder')) {
            themeClass = 'theme-thunderstorm';
        } else if (condition.includes('rain') || condition.includes('drizzle')) {
            themeClass = 'theme-rain';
        } else if (condition.includes('snow')) {
            themeClass = 'theme-snow';
        } else if (condition.includes('fog') || condition.includes('mist') || condition.includes('haze')) {
            themeClass = 'theme-mist';
        } else if (condition.includes('clear')) {
            themeClass = isNight ? 'theme-clear-night' : 'theme-clear-day';
        } else {
            themeClass = 'theme-clouds';
        }

        document.body.className = themeClass;
        this.generateParticles(themeClass);
    }

    /**
     * Generate dynamic floating particles (Rain streaks, snowflakes, starfield)
     */
    generateParticles(theme) {
        if (!this.particleContainer) return;
        this.particleContainer.innerHTML = '';

        if (theme === 'theme-rain' || theme === 'theme-thunderstorm') {
            const count = 45;
            for (let i = 0; i < count; i++) {
                const drop = document.createElement('div');
                drop.className = 'particle-rain';
                drop.style.left = `${Math.random() * 100}vw`;
                drop.style.animationDuration = `${0.6 + Math.random() * 0.4}s`;
                drop.style.animationDelay = `${Math.random() * 2}s`;
                this.particleContainer.appendChild(drop);
            }
        } else if (theme === 'theme-snow') {
            const count = 35;
            for (let i = 0; i < count; i++) {
                const flake = document.createElement('div');
                flake.className = 'particle-snow';
                const size = 3 + Math.random() * 5;
                flake.style.width = `${size}px`;
                flake.style.height = `${size}px`;
                flake.style.left = `${Math.random() * 100}vw`;
                flake.style.animationDuration = `${4 + Math.random() * 6}s`;
                flake.style.animationDelay = `${Math.random() * 5}s`;
                this.particleContainer.appendChild(flake);
            }
        } else if (theme === 'theme-clear-night' || theme === 'theme-dark') {
            const count = 30;
            for (let i = 0; i < count; i++) {
                const star = document.createElement('div');
                star.className = 'particle-star';
                const size = 1.5 + Math.random() * 2.5;
                star.style.width = `${size}px`;
                star.style.height = `${size}px`;
                star.style.left = `${Math.random() * 100}vw`;
                star.style.top = `${Math.random() * 80}vh`;
                star.style.animationDuration = `${1.5 + Math.random() * 3}s`;
                star.style.animationDelay = `${Math.random() * 3}s`;
                this.particleContainer.appendChild(star);
            }
        }
    }

    /**
     * Show interactive Toast Notification
     */
    showToast(message, type = 'info', duration = 4000) {
        if (!this.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const iconNames = {
            success: 'check-circle',
            error: 'alert-triangle',
            warning: 'alert-circle',
            info: 'info'
        };

        const iconName = iconNames[type] || 'info';

        toast.innerHTML = `
            <i data-lucide="${iconName}" class="toast-icon"></i>
            <div class="toast-content">${message}</div>
            <button class="toast-close" aria-label="Close notification">&times;</button>
        `;

        this.toastContainer.appendChild(toast);

        if (window.lucide) {
            window.lucide.createIcons();
        }

        const removeToast = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            setTimeout(() => toast.remove(), 300);
        };

        toast.querySelector('.toast-close').addEventListener('click', removeToast);
        setTimeout(removeToast, duration);
    }

    /**
     * Toggle skeleton loading state
     */
    setLoadingState(isLoading) {
        const elementsToShimmer = [
            document.getElementById('cityName'),
            document.getElementById('currentTemp'),
            document.getElementById('weatherDescription'),
            document.getElementById('feelsLikeTemp'),
            document.getElementById('hourlyTimeline'),
            document.getElementById('dailyForecastList')
        ];

        elementsToShimmer.forEach(el => {
            if (el) {
                if (isLoading) el.classList.add('skeleton');
                else el.classList.remove('skeleton');
            }
        });
    }

    /* --- Helper Formatting & SVG Generators --- */

    formatLocalDateTime(dt, timezoneOffset = 0) {
        const date = dt ? new Date((dt + timezoneOffset) * 1000) : new Date();
        const options = {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'UTC'
        };
        return date.toLocaleDateString('en-US', options);
    }

    formatUnixTime(unixTimestamp) {
        if (!unixTimestamp) return '--:--';
        return new Date(unixTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    degToCardinal(deg) {
        const val = Math.floor((deg / 22.5) + 0.5);
        const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
        return arr[(val % 16)];
    }

    /**
     * Generates rich animated SVG illustrations for the Hero Section
     */
    getAnimatedWeatherSvg(mainCondition = 'Clear', isNight = false) {
        const cond = mainCondition.toLowerCase();

        if (cond.includes('clear')) {
            if (isNight) {
                return `
                    <svg viewBox="0 0 100 100" class="hero-svg">
                        <defs>
                            <linearGradient id="moonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#f8fafc"/>
                                <stop offset="100%" stop-color="#cbd5e1"/>
                            </linearGradient>
                            <filter id="moonGlow">
                                <feGaussianBlur stdDeviation="3" result="glow"/>
                                <feComposite in="SourceGraphic" in2="glow" operator="over"/>
                            </filter>
                        </defs>
                        <path d="M 55 20 A 30 30 0 1 0 78 72 A 32 32 0 1 1 55 20" fill="url(#moonGrad)" filter="url(#moonGlow)"/>
                        <circle cx="28" cy="25" r="1.5" fill="#ffffff" opacity="0.8"/>
                        <circle cx="75" cy="30" r="2" fill="#ffffff" opacity="0.9"/>
                        <circle cx="35" cy="65" r="1" fill="#ffffff" opacity="0.7"/>
                    </svg>
                `;
            } else {
                return `
                    <svg viewBox="0 0 100 100" class="hero-svg">
                        <defs>
                            <linearGradient id="sunGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#fde047"/>
                                <stop offset="50%" stop-color="#f59e0b"/>
                                <stop offset="100%" stop-color="#ea580c"/>
                            </linearGradient>
                            <filter id="sunGlow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="5" result="glow"/>
                                <feComposite in="SourceGraphic" in2="glow" operator="over"/>
                            </filter>
                        </defs>
                        <circle cx="50" cy="50" r="24" fill="url(#sunGrad)" filter="url(#sunGlow)"/>
                        <g stroke="url(#sunGrad)" stroke-width="3.5" stroke-linecap="round">
                            <line x1="50" y1="12" x2="50" y2="18"/>
                            <line x1="50" y1="82" x2="50" y2="88"/>
                            <line x1="12" y1="50" x2="18" y2="50"/>
                            <line x1="82" y1="50" x2="88" y2="50"/>
                            <line x1="23" y1="23" x2="28" y2="28"/>
                            <line x1="72" y1="72" x2="77" y2="77"/>
                            <line x1="23" y1="77" x2="28" y2="72"/>
                            <line x1="72" y1="28" x2="77" y2="23"/>
                        </g>
                    </svg>
                `;
            }
        }

        if (cond.includes('rain') || cond.includes('drizzle')) {
            return `
                <svg viewBox="0 0 100 100" class="hero-svg">
                    <defs>
                        <linearGradient id="rainCloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#94a3b8"/>
                            <stop offset="100%" stop-color="#475569"/>
                        </linearGradient>
                    </defs>
                    <!-- Cloud -->
                    <path d="M 30 55 A 16 16 0 0 1 54 32 A 20 20 0 0 1 80 46 A 14 14 0 0 1 76 65 L 30 65 Z" fill="url(#rainCloudGrad)" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.3))"/>
                    <!-- Raindrops -->
                    <g stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round">
                        <line x1="38" y1="70" x2="33" y2="82"/>
                        <line x1="52" y1="70" x2="47" y2="82"/>
                        <line x1="66" y1="70" x2="61" y2="82"/>
                    </g>
                </svg>
            `;
        }

        if (cond.includes('thunder')) {
            return `
                <svg viewBox="0 0 100 100" class="hero-svg">
                    <defs>
                        <linearGradient id="stormCloud" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#64748b"/>
                            <stop offset="100%" stop-color="#334155"/>
                        </linearGradient>
                    </defs>
                    <path d="M 28 50 A 16 16 0 0 1 52 28 A 20 20 0 0 1 78 42 A 14 14 0 0 1 74 60 L 28 60 Z" fill="url(#stormCloud)"/>
                    <!-- Lightning Bolt -->
                    <polygon points="50,56 42,70 50,70 44,88 60,66 51,66" fill="#fbbf24" filter="drop-shadow(0 0 6px #f59e0b)"/>
                </svg>
            `;
        }

        if (cond.includes('snow')) {
            return `
                <svg viewBox="0 0 100 100" class="hero-svg">
                    <defs>
                        <linearGradient id="snowCloud" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#cbd5e1"/>
                            <stop offset="100%" stop-color="#94a3b8"/>
                        </linearGradient>
                    </defs>
                    <path d="M 30 50 A 16 16 0 0 1 54 28 A 20 20 0 0 1 80 42 A 14 14 0 0 1 76 60 L 30 60 Z" fill="url(#snowCloud)"/>
                    <circle cx="40" cy="74" r="2.5" fill="#e0f2fe"/>
                    <circle cx="54" cy="80" r="3" fill="#e0f2fe"/>
                    <circle cx="68" cy="74" r="2.5" fill="#e0f2fe"/>
                </svg>
            `;
        }

        // Default Clouds / Atmosphere
        return `
            <svg viewBox="0 0 100 100" class="hero-svg">
                <defs>
                    <linearGradient id="sunBehind" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#fde047"/>
                        <stop offset="100%" stop-color="#f97316"/>
                    </linearGradient>
                    <linearGradient id="cloudFront" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff"/>
                        <stop offset="100%" stop-color="#cbd5e1"/>
                    </linearGradient>
                </defs>
                <circle cx="64" cy="38" r="16" fill="url(#sunBehind)" filter="drop-shadow(0 0 8px #f59e0b)"/>
                <path d="M 26 62 A 15 15 0 0 1 48 40 A 18 18 0 0 1 74 52 A 13 13 0 0 1 70 70 L 26 70 Z" fill="url(#cloudFront)" filter="drop-shadow(0 6px 14px rgba(0,0,0,0.3))"/>
            </svg>
        `;
    }

    /**
     * Mini SVG icons for timeline and daily forecast lists
     */
    getMiniWeatherSvg(condition = 'Clear', isNight = false, size = 32) {
        const cond = condition.toLowerCase();

        if (cond.includes('clear')) {
            if (isNight) {
                return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
            }
            return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line></svg>`;
        }
        if (cond.includes('rain') || cond.includes('drizzle')) {
            return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M16 13v6"></path><path d="M8 13v6"></path><path d="M12 15v6"></path><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>`;
        }
        if (cond.includes('thunder')) {
            return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"></path><polyline points="13 11 9 17 15 17 11 23"></polyline></svg>`;
        }
        if (cond.includes('snow')) {
            return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#e0f2fe" stroke-width="2"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="12" y1="18" x2="12.01" y2="18"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>`;
        }
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`;
    }
}

// Global UI instance
window.weatherUI = new WeatherUI();
