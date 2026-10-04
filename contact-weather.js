        async function fetchCurrentWeather(lat, lon) {
            const params = new URLSearchParams({ latitude: lat, longitude: lon,
                current: 'temperature_2m,apparent_temperature,weather_code,is_day',
                temperature_unit: 'celsius', timezone: 'Asia/Ulaanbaatar' });
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000);
            try {
                const response = await fetch('https://api.open-meteo.com/v1/forecast?' + params,
                    { signal: controller.signal });
                if (!response.ok) throw new Error('Weather request failed');
                const data = await response.json();
                const current = data.current;
                if (!current || !Number.isFinite(current.temperature_2m) ||
                    !Number.isFinite(current.apparent_temperature) || typeof current.time !== 'string') {
                    throw new Error('Invalid weather data');
                }
                return current;
            } finally { clearTimeout(timeout); }
        }
        function formatTemperature(value) {
            const rounded = Math.round(value);
            return (rounded > 0 ? '+' : '') + rounded + '°';
        }
        function weatherIcon(current) {
            const code = current.weather_code;
            if (code === 0) return current.is_day ? '☀️' : '🌙';
            if (code <= 3) return '☁️';
            if (code === 45 || code === 48) return '🌫️';
            if ([71,73,75,77,85,86].includes(code)) return '❄️';
            if (code >= 95) return '⛈️';
            return '🌧️';
        }
        async function updateTopWeatherChip() {
            const chipText = document.getElementById('chipTempText');
            const chip = document.getElementById('liveWeatherChip');
            try {
                const current = await fetchCurrentWeather(47.923, 106.920);
                chipText.innerText = formatTemperature(current.temperature_2m) + ' мэдрэгдэх ' +
                    formatTemperature(current.apparent_temperature) + ' УБ';
                document.querySelector('.chip-sun').textContent = weatherIcon(current);
                chip.title = 'Улаанбаатар · ' + current.time.replace('T', ' ') +
                    ' · Open-Meteo цаг агаарын загварын мэдээлэл';
            } catch (err) {
                chipText.innerText = 'Цаг агаар авах боломжгүй';
                document.querySelector('.chip-sun').textContent = '🌡️';
                chip.title = 'Интернэт холболтоо шалгана уу. Дарж дахин оролдоно.';
            }
        }
        document.getElementById('liveWeatherChip').addEventListener('click', updateTopWeatherChip);
        updateTopWeatherChip();
        setInterval(updateTopWeatherChip, 10 * 60 * 1000);


