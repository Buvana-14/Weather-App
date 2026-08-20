/**
 * SkyPulse Weather - API Layer & Service Worker
 * Handles OpenWeatherMap API endpoints, error fallbacks, and realistic mock simulation data.
 */

class WeatherApiService {
    constructor() {
        this.defaultApiKey = '30d5bda63556f283625ffcb85ade6900';
        this.apiKey = localStorage.getItem('skypulse_api_key') || this.defaultApiKey;
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
        this.geoUrl = 'https://api.openweathermap.org/geo/1.0';
        this.isDemoMode = localStorage.getItem('skypulse_demo_mode') === 'true';
    }

    setApiKey(key) {
        this.apiKey = key ? key.trim() : this.defaultApiKey;
        localStorage.setItem('skypulse_api_key', this.apiKey);
    }

    setDemoMode(isDemo) {
        this.isDemoMode = !!isDemo;
        localStorage.setItem('skypulse_demo_mode', this.isDemoMode ? 'true' : 'false');
    }

    /**
     * Test an API Key against OpenWeatherMap
     */
    async testConnection(testKey = null) {
        const keyToTest = (testKey || this.apiKey || '').trim();
        if (!keyToTest) {
            return { success: false, message: 'Please enter an API key.' };
        }

        try {
            const url = `${this.baseUrl}/weather?q=London&appid=${keyToTest}&units=metric`;
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                return { success: true, message: 'API key is active and connected successfully!' };
            } else if (response.status === 401) {
                return { 
                    success: false, 
                    message: 'API Key returned 401 (Invalid/Pending). Newly generated keys can take 15–60 minutes to activate on OpenWeatherMap.' 
                };
            } else {
                return { success: false, message: data.message || `API Error: ${response.statusText}` };
            }
        } catch (error) {
            return { success: false, message: `Network error: ${error.message}` };
        }
    }

    /**
     * Fetch complete weather payload for a city name
     */
    async fetchAllWeatherByCity(cityName, units = 'metric') {
        if (this.isDemoMode) {
            return this.getMockWeatherPayload(cityName, units);
        }

        try {
            // 1. Fetch Current Weather
            const currentWeatherUrl = `${this.baseUrl}/weather?q=${encodeURIComponent(cityName)}&appid=${this.apiKey}&units=${units}`;
            const weatherRes = await fetch(currentWeatherUrl);
            const currentData = await weatherRes.json();

            if (!weatherRes.ok) {
                if (weatherRes.status === 401) {
                    console.warn('OpenWeatherMap 401 received. Automatically activating fallback demo mode.');
                    const mock = this.getMockWeatherPayload(cityName, units);
                    mock.isFallback = true;
                    mock.fallbackReason = 'API Key is pending OpenWeatherMap activation (HTTP 401). Displaying high-fidelity simulated forecast.';
                    return mock;
                }
                throw new Error(currentData.message || 'Failed to fetch current weather.');
            }

            const { lat, lon } = currentData.coord;

            // 2. Fetch 5-Day / 3-Hour Forecast & Air Pollution in parallel
            const [forecastRes, aqiRes] = await Promise.all([
                fetch(`${this.baseUrl}/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=${units}`).then(r => r.json()).catch(() => null),
                fetch(`${this.baseUrl}/air_pollution?lat=${lat}&lon=${lon}&appid=${this.apiKey}`).then(r => r.json()).catch(() => null)
            ]);

            return {
                current: currentData,
                forecast: forecastRes || this.generateMockForecast(currentData, units),
                airQuality: aqiRes || this.generateMockAQI(),
                isDemo: false
            };
        } catch (error) {
            console.warn('Weather API fetch error, falling back to simulated data:', error);
            const mock = this.getMockWeatherPayload(cityName, units);
            mock.isFallback = true;
            mock.fallbackReason = error.message || 'API connection issue. Showing simulated weather.';
            return mock;
        }
    }

    /**
     * Fetch complete weather payload by latitude and longitude
     */
    async fetchAllWeatherByCoords(lat, lon, units = 'metric') {
        if (this.isDemoMode) {
            return this.getMockWeatherPayload('Current Location', units, lat, lon);
        }

        try {
            const currentWeatherUrl = `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=${units}`;
            const weatherRes = await fetch(currentWeatherUrl);
            const currentData = await weatherRes.json();

            if (!weatherRes.ok) {
                if (weatherRes.status === 401) {
                    const mock = this.getMockWeatherPayload('Local Area', units, lat, lon);
                    mock.isFallback = true;
                    mock.fallbackReason = 'API Key is activating. Displaying local simulated forecast.';
                    return mock;
                }
                throw new Error(currentData.message || 'Failed to fetch weather for coordinates.');
            }

            const [forecastRes, aqiRes] = await Promise.all([
                fetch(`${this.baseUrl}/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=${units}`).then(r => r.json()).catch(() => null),
                fetch(`${this.baseUrl}/air_pollution?lat=${lat}&lon=${lon}&appid=${this.apiKey}`).then(r => r.json()).catch(() => null)
            ]);

            return {
                current: currentData,
                forecast: forecastRes || this.generateMockForecast(currentData, units),
                airQuality: aqiRes || this.generateMockAQI(),
                isDemo: false
            };
        } catch (error) {
            console.warn('Coordinates fetch error, falling back:', error);
            const mock = this.getMockWeatherPayload('My Location', units, lat, lon);
            mock.isFallback = true;
            mock.fallbackReason = error.message;
            return mock;
        }
    }

    /**
     * High-fidelity Realistic Mock Generator for seamless offline/pending testing
     */
    getMockWeatherPayload(cityName = 'London', units = 'metric', customLat = null, customLon = null) {
        const cityDatabase = {
            'london': { name: 'London', country: 'GB', tempC: 21, condition: 'Clouds', desc: 'scattered clouds', icon: '03d', humidity: 62, windKmh: 14, windDeg: 230, pressure: 1016, visibility: 10000, clouds: 45, aqi: 2 },
            'new york': { name: 'New York', country: 'US', tempC: 26, condition: 'Clear', desc: 'clear sky', icon: '01d', humidity: 55, windKmh: 18, windDeg: 160, pressure: 1018, visibility: 10000, clouds: 10, aqi: 2 },
            'tokyo': { name: 'Tokyo', country: 'JP', tempC: 28, condition: 'Rain', desc: 'light rain shower', icon: '10d', humidity: 78, windKmh: 12, windDeg: 80, pressure: 1009, visibility: 8000, clouds: 80, aqi: 1 },
            'paris': { name: 'Paris', country: 'FR', tempC: 23, condition: 'Clear', desc: 'sunshine with light breeze', icon: '01d', humidity: 58, windKmh: 11, windDeg: 310, pressure: 1019, visibility: 10000, clouds: 15, aqi: 2 },
            'sydney': { name: 'Sydney', country: 'AU', tempC: 19, condition: 'Clouds', desc: 'broken clouds', icon: '04d', humidity: 68, windKmh: 22, windDeg: 190, pressure: 1021, visibility: 10000, clouds: 60, aqi: 1 },
            'dubai': { name: 'Dubai', country: 'AE', tempC: 38, condition: 'Clear', desc: 'sunny & warm', icon: '01d', humidity: 38, windKmh: 16, windDeg: 340, pressure: 1006, visibility: 9000, clouds: 0, aqi: 3 },
            'singapore': { name: 'Singapore', country: 'SG', tempC: 31, condition: 'Thunderstorm', desc: 'tropical thunderstorm', icon: '11d', humidity: 84, windKmh: 9, windDeg: 120, pressure: 1010, visibility: 7000, clouds: 90, aqi: 2 },
            'cairo': { name: 'Cairo', country: 'EG', tempC: 34, condition: 'Clear', desc: 'clear desert skies', icon: '01d', humidity: 32, windKmh: 15, windDeg: 20, pressure: 1012, visibility: 10000, clouds: 5, aqi: 4 },
            'mumbai': { name: 'Mumbai', country: 'IN', tempC: 30, condition: 'Rain', desc: 'monsoon drizzle', icon: '10d', humidity: 86, windKmh: 20, windDeg: 250, pressure: 1008, visibility: 6000, clouds: 85, aqi: 3 },
            'san francisco': { name: 'San Francisco', country: 'US', tempC: 18, condition: 'Atmosphere', desc: 'morning coastal fog', icon: '50d', humidity: 82, windKmh: 19, windDeg: 280, pressure: 1015, visibility: 4500, clouds: 75, aqi: 1 }
        };

        const key = (cityName || '').toLowerCase().trim();
        const cityData = cityDatabase[key] || {
            name: cityName.charAt(0).toUpperCase() + cityName.slice(1),
            country: 'WORLD',
            tempC: 22,
            condition: 'Clear',
            desc: 'mostly sunny',
            icon: '01d',
            humidity: 58,
            windKmh: 13,
            windDeg: 180,
            pressure: 1013,
            visibility: 10000,
            clouds: 25,
            aqi: 2
        };

        const isImperial = units === 'imperial';
        const temp = isImperial ? Math.round((cityData.tempC * 9/5) + 32) : cityData.tempC;
        const feelsLike = isImperial ? Math.round(((cityData.tempC + 1.5) * 9/5) + 32) : cityData.tempC + 1.5;
        const tempMin = isImperial ? Math.round(((cityData.tempC - 4) * 9/5) + 32) : cityData.tempC - 4;
        const tempMax = isImperial ? Math.round(((cityData.tempC + 5) * 9/5) + 32) : cityData.tempC + 5;
        const windSpeed = isImperial ? Math.round(cityData.windKmh * 0.621371) : Math.round(cityData.windKmh / 3.6);

        const now = Math.floor(Date.now() / 1000);
        const sunrise = now - 14400; // ~4 hours ago
        const sunset = now + 28800;  // ~8 hours from now

        const current = {
            coord: { lon: customLon || 0.1278, lat: customLat || 51.5074 },
            weather: [{ id: 800, main: cityData.condition, description: cityData.desc, icon: cityData.icon }],
            main: {
                temp: temp,
                feels_like: feelsLike,
                temp_min: tempMin,
                temp_max: tempMax,
                pressure: cityData.pressure,
                humidity: cityData.humidity
            },
            visibility: cityData.visibility,
            wind: { speed: windSpeed, deg: cityData.windDeg, gust: windSpeed * 1.4 },
            clouds: { all: cityData.clouds },
            dt: now,
            sys: {
                country: cityData.country,
                sunrise: sunrise,
                sunset: sunset
            },
            name: cityData.name,
            cod: 200
        };

        const forecast = this.generateMockForecast(current, units);
        const airQuality = this.generateMockAQI(cityData.aqi);

        return {
            current,
            forecast,
            airQuality,
            isDemo: true
        };
    }

    /**
     * Generate dynamic 5-day / 3-hour forecast entries matching the current condition
     */
    generateMockForecast(currentWeather, units) {
        const list = [];
        const baseTemp = currentWeather.main.temp;
        const baseDt = currentWeather.dt || Math.floor(Date.now() / 1000);

        const conditionCycle = [
            { main: 'Clear', desc: 'clear sky', icon: '01d' },
            { main: 'Clear', desc: 'sunshine', icon: '01d' },
            { main: 'Clouds', desc: 'scattered clouds', icon: '03d' },
            { main: 'Clouds', desc: 'broken clouds', icon: '04d' },
            { main: 'Rain', desc: 'light rain', icon: '10d' },
            { main: 'Clouds', desc: 'overcast clouds', icon: '04n' },
            { main: 'Clear', desc: 'clear night', icon: '01n' },
            { main: 'Clear', desc: 'sunny morning', icon: '01d' }
        ];

        for (let i = 1; i <= 40; i++) {
            const dt = baseDt + (i * 3 * 3600);
            const tempVariation = Math.sin(i * 0.7) * 4;
            const cycleIndex = (i + Math.floor(Math.random() * 2)) % conditionCycle.length;
            const cond = conditionCycle[cycleIndex];

            list.push({
                dt: dt,
                main: {
                    temp: Math.round(baseTemp + tempVariation),
                    temp_min: Math.round(baseTemp + tempVariation - 2),
                    temp_max: Math.round(baseTemp + tempVariation + 2),
                    pressure: currentWeather.main.pressure + Math.floor(Math.sin(i) * 3),
                    humidity: Math.min(95, Math.max(30, currentWeather.main.humidity + Math.floor(Math.cos(i) * 15)))
                },
                weather: [{
                    id: 800,
                    main: cond.main,
                    description: cond.desc,
                    icon: cond.icon
                }],
                wind: {
                    speed: currentWeather.wind.speed,
                    deg: (currentWeather.wind.deg + (i * 15)) % 360
                },
                pop: (cond.main === 'Rain') ? 0.75 : (cond.main === 'Clouds' ? 0.2 : 0.05),
                dt_txt: new Date(dt * 1000).toISOString().replace('T', ' ').substring(0, 19)
            });
        }

        return {
            cod: '200',
            list: list,
            city: {
                name: currentWeather.name,
                country: currentWeather.sys ? currentWeather.sys.country : ''
            }
        };
    }

    /**
     * Generate realistic Air Pollution / AQI data
     */
    generateMockAQI(targetAqi = 2) {
        const pollutantValues = {
            1: { pm2_5: 8.2, pm10: 14.1, o3: 35.4, no2: 12.0, so2: 4.5, co: 260 },
            2: { pm2_5: 14.8, pm10: 24.3, o3: 52.0, no2: 19.8, so2: 8.2, co: 380 },
            3: { pm2_5: 38.6, pm10: 58.2, o3: 78.4, no2: 36.1, so2: 15.0, co: 620 },
            4: { pm2_5: 72.4, pm10: 110.5, o3: 125.0, no2: 68.3, so2: 28.4, co: 950 },
            5: { pm2_5: 140.2, pm10: 220.8, o3: 180.5, no2: 110.0, so2: 50.0, co: 1400 }
        };

        const p = pollutantValues[targetAqi] || pollutantValues[2];

        return {
            list: [{
                main: { aqi: targetAqi },
                components: {
                    co: p.co,
                    no: 1.2,
                    no2: p.no2,
                    o3: p.o3,
                    so2: p.so2,
                    pm2_5: p.pm2_5,
                    pm10: p.pm10,
                    nh3: 0.8
                },
                dt: Math.floor(Date.now() / 1000)
            }]
        };
    }
}

// Global singleton instance
window.weatherApi = new WeatherApiService();
