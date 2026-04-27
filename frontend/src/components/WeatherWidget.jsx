import React, { useEffect, useState } from 'react';

const WMO_ICON = (code) => {
  if (code === 0) return '☀️';
  if (code >= 1 && code <= 3) return '⛅';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code === 95 || code === 96 || code === 99) return '⛈️';
  return '🌡️';
};

const DAY_LABEL = (iso, idx) => {
  if (idx === 0) return 'Dnes';
  if (idx === 1) return 'Zítra';
  const d = new Date(iso);
  return d.toLocaleDateString('cs-CZ', { weekday: 'short' }).replace('.', '');
};

export default function WeatherWidget({ latitude = 50.08, longitude = 14.43 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=Europe%2FPrague`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('API ' + r.status);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setData(json.daily);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  if (error) {
    return (
      <div className="weather-widget weather-widget-error">
        <span>🌥️ Počasí nedostupné</span>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="weather-widget weather-widget-loading">
        <span>Načítám počasí…</span>
      </div>
    );
  }

  return (
    <div className="weather-widget">
      <div className="weather-widget-title">🌤️ Počasí — 7 dní (Praha)</div>
      <div className="weather-strip">
        {data.time.map((iso, i) => (
          <div key={iso} className="weather-day">
            <div className="weather-day-label">{DAY_LABEL(iso, i)}</div>
            <div className="weather-day-icon">{WMO_ICON(data.weathercode[i])}</div>
            <div className="weather-day-temps">
              <span className="weather-max">{Math.round(data.temperature_2m_max[i])}°</span>
              <span className="weather-min">{Math.round(data.temperature_2m_min[i])}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
