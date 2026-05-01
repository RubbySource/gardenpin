// Weather widget — Open-Meteo current_weather via backend proxy
import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';

const PRAGUE = { lat: 50.08, lon: 14.44, label: 'Praha' };

// Open-Meteo WMO weather codes → emoji + Czech label
function wmoToIcon(code) {
  if (code === 0) return { icon: '☀️', label: 'Jasno' };
  if ([1, 2].includes(code)) return { icon: '🌤️', label: 'Polojasno' };
  if (code === 3) return { icon: '☁️', label: 'Zataženo' };
  if ([45, 48].includes(code)) return { icon: '🌫️', label: 'Mlha' };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: '🌦️', label: 'Mrholení' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: '🌧️', label: 'Déšť' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: '🌨️', label: 'Sněžení' };
  if ([95, 96, 99].includes(code)) return { icon: '⛈️', label: 'Bouřka' };
  return { icon: '🌡️', label: 'Počasí' };
}

export default function WeatherWidget() {
  const [loc, setLoc] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('weatherLoc'));
      if (saved && typeof saved.lat === 'number' && typeof saved.lon === 'number') return saved;
    } catch {}
    return PRAGUE;
  });
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async (l) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.weather(l.lat, l.lon);
      setWeather(data.current_weather);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(loc);
  }, [loc, load]);

  const useGeolocation = () => {
    if (!navigator.geolocation) {
      setError('Geolokace není podporována');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: +pos.coords.latitude.toFixed(2),
          lon: +pos.coords.longitude.toFixed(2),
          label: 'Vaše poloha',
        };
        localStorage.setItem('weatherLoc', JSON.stringify(next));
        setLoc(next);
        setLocating(false);
      },
      (err) => {
        setError('Geolokace selhala: ' + err.message);
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  const resetToPrague = () => {
    localStorage.removeItem('weatherLoc');
    setLoc(PRAGUE);
  };

  if (loading && !weather) {
    return (
      <div className="weather-widget">
        <div className="weather-loading">🌤️ Načítám počasí…</div>
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div className="weather-widget">
        <div className="weather-error">⚠️ {error}</div>
        <button className="btn secondary weather-btn" onClick={() => load(loc)}>
          Zkusit znovu
        </button>
      </div>
    );
  }

  const { icon, label } = wmoToIcon(weather?.weathercode ?? -1);
  const temp = Math.round(weather?.temperature ?? 0);
  const wind = Math.round(weather?.windspeed ?? 0);

  return (
    <div className="weather-widget">
      <div className="weather-main">
        <div className="weather-icon">{icon}</div>
        <div className="weather-info">
          <div className="weather-temp">{temp}°C</div>
          <div className="weather-label">{label}</div>
          <div className="weather-meta">
            <span>📍 {loc.label}</span>
            <span>💨 {wind} km/h</span>
          </div>
        </div>
      </div>
      <div className="weather-actions">
        <button
          className="btn secondary weather-btn"
          onClick={useGeolocation}
          disabled={locating}
          title="Použít moji polohu"
        >
          {locating ? '…' : '📍 Moje poloha'}
        </button>
        {loc.label !== PRAGUE.label && (
          <button className="btn secondary weather-btn" onClick={resetToPrague} title="Praha">
            Praha
          </button>
        )}
      </div>
    </div>
  );
}
