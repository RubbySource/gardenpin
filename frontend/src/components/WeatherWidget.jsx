// Weather widget — Open-Meteo přes backend proxy
// Aktuální počasí, 7denní předpověď, varování o dešti / mrazu pro zahradníky
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
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: '🌨️', label: 'Sníh' };
  if ([95, 96, 99].includes(code)) return { icon: '⛈️', label: 'Bouřka' };
  return { icon: '🌡️', label: '—' };
}

const WEEKDAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

function shortWeekday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return WEEKDAYS[d.getDay()];
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
  const [showForecast, setShowForecast] = useState(false);

  const load = useCallback(async (l) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.weather(l.lat, l.lon);
      setWeather(data);
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

  const current = weather?.current_weather || {};
  const daily = weather?.daily || {};
  const hourly = weather?.hourly || {};
  const { icon, label } = wmoToIcon(current.weathercode ?? -1);
  const temp = Math.round(current.temperature ?? 0);
  const wind = Math.round(current.windspeed ?? 0);

  // Varování pro zahradníka — sestavujeme z denní + hodinové předpovědi
  const alerts = [];
  // Déšť do 24 h
  const hourlyTimes = hourly?.time || [];
  const hourlyProb = hourly?.precipitation_probability || [];
  if (hourlyTimes.length && hourlyProb.length) {
    const now = Date.now();
    const next24h = hourlyTimes
      .map((t, i) => ({ t: new Date(t).getTime(), p: hourlyProb[i] }))
      .filter((h) => h.t >= now && h.t <= now + 24 * 3600 * 1000);
    const maxRain = next24h.reduce((m, h) => Math.max(m, h.p ?? 0), 0);
    if (maxRain >= 60) {
      alerts.push({
        icon: '💧',
        text: `Brzy bude pršet (${maxRain} % do 24 h) — zálivka možná nebude potřeba.`,
      });
    }
  }
  // Mráz v dalších 3 dnech
  const minTemps = daily?.temperature_2m_min || [];
  const dailyDates = daily?.time || [];
  const minIn3 = Math.min(...minTemps.slice(0, 3).filter((x) => typeof x === 'number'));
  if (isFinite(minIn3) && minIn3 <= 2) {
    const idx = minTemps.findIndex((t, i) => i < 3 && t === minIn3);
    const when =
      idx === 0 ? 'dnes v noci' : idx === 1 ? 'zítra v noci' : 'do 3 dnů';
    alerts.push({
      icon: '❄️',
      text: `Hrozí mráz ${when} (${Math.round(minIn3)} °C) — chraňte citlivé rostliny.`,
    });
  }

  const forecastDays = (dailyDates || []).map((date, i) => ({
    date,
    code: daily.weather_code?.[i] ?? -1,
    tMax: Math.round(daily.temperature_2m_max?.[i] ?? 0),
    tMin: Math.round(daily.temperature_2m_min?.[i] ?? 0),
    prob: daily.precipitation_probability_max?.[i] ?? 0,
  }));

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

      {alerts.length > 0 && (
        <div className="weather-alerts">
          {alerts.map((a, i) => (
            <div key={i} className="weather-alert">
              <span className="weather-alert-icon">{a.icon}</span>
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {showForecast && forecastDays.length > 0 && (
        <div className="weather-forecast">
          {forecastDays.map((d, i) => {
            const w = wmoToIcon(d.code);
            return (
              <div key={d.date} className={`forecast-day${i === 0 ? ' today' : ''}`}>
                <div className="forecast-day-label">
                  {i === 0 ? 'Dnes' : shortWeekday(d.date)}
                </div>
                <div className="forecast-day-icon" title={w.label}>{w.icon}</div>
                <div className="forecast-day-temp">
                  <span className="t-max">{d.tMax}°</span>
                  <span className="t-min">{d.tMin}°</span>
                </div>
                <div className="forecast-day-rain">
                  💧 {d.prob}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="weather-actions">
        <button
          className="btn secondary weather-btn"
          onClick={() => setShowForecast((v) => !v)}
        >
          {showForecast ? '▲ Skrýt předpověď' : '▼ 7denní předpověď'}
        </button>
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
