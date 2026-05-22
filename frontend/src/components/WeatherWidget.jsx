// Weather widget — Open-Meteo current_weather + 3denní předpověď s mrazovým varováním
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

const FROST_THRESHOLD = 2; // °C — pod touto hodnotou varujeme

const DOW = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
function dayLabel(iso, idx) {
  if (idx === 0) return 'Dnes';
  if (idx === 1) return 'Zítra';
  const d = new Date(iso);
  return DOW[d.getDay()];
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
  const [daily, setDaily] = useState(null);
  const [sensitive, setSensitive] = useState({ count: 0, plants: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async (l) => {
    setLoading(true);
    setError(null);
    try {
      const [data, sens] = await Promise.all([
        api.weather(l.lat, l.lon),
        api.sensitivePins().catch(() => ({ count: 0, plants: [] })),
      ]);
      setWeather(data.current_weather);
      setDaily(data.daily || null);
      setSensitive(sens);
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

  // Offline / fetch fail — schovat widget (per Vize: offline fallback)
  if (loading && !weather) {
    return (
      <div className="weather-widget">
        <div className="weather-loading">🌤️ Načítám počasí…</div>
      </div>
    );
  }

  if (error && !weather) {
    // Offline / API down — schovat widget
    return null;
  }

  const { icon, label } = wmoToIcon(weather?.weathercode ?? -1);
  const temp = Math.round(weather?.temperature ?? 0);
  const wind = Math.round(weather?.windspeed ?? 0);

  // Mrazové varování — pokud min teplota v některém z následujících 3 dnů < 2°C
  // a uživatel má citlivé rostliny
  let frostWarning = null;
  if (daily && daily.temperature_2m_min && sensitive.count > 0) {
    const mins = daily.temperature_2m_min;
    let coldestIdx = -1;
    let coldestTemp = Infinity;
    for (let i = 0; i < mins.length; i++) {
      if (mins[i] < FROST_THRESHOLD && mins[i] < coldestTemp) {
        coldestTemp = mins[i];
        coldestIdx = i;
      }
    }
    if (coldestIdx >= 0) {
      const when = dayLabel(daily.time[coldestIdx], coldestIdx).toLowerCase();
      frostWarning = {
        temp: Math.round(coldestTemp),
        when,
        plantsCount: sensitive.count,
      };
    }
  }

  return (
    <>
      {frostWarning && (
        <div className="frost-warning" role="alert">
          <div className="frost-warning-icon">❄️</div>
          <div className="frost-warning-body">
            <div className="frost-warning-title">
              ⚠️ Mráz {frostWarning.when} ({frostWarning.temp}°C)
            </div>
            <div className="frost-warning-text">
              Přikryj citlivé rostliny — máš jich {frostWarning.plantsCount}
              {frostWarning.plantsCount === 1 ? '' : frostWarning.plantsCount < 5 ? ' citlivé' : ' citlivých'}.
            </div>
          </div>
        </div>
      )}
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

        {/* 3denní předpověď */}
        {daily && daily.time && (
          <div className="weather-forecast">
            {daily.time.map((iso, i) => {
              const ic = wmoToIcon(daily.weathercode?.[i] ?? -1);
              const min = Math.round(daily.temperature_2m_min?.[i] ?? 0);
              const max = Math.round(daily.temperature_2m_max?.[i] ?? 0);
              const isCold = (daily.temperature_2m_min?.[i] ?? 99) < FROST_THRESHOLD;
              return (
                <div key={iso} className={`forecast-day${isCold ? ' is-cold' : ''}`}>
                  <div className="forecast-dow">{dayLabel(iso, i)}</div>
                  <div className="forecast-icon">{ic.icon}</div>
                  <div className="forecast-temps">
                    <span className="t-max">{max}°</span>
                    <span className="t-min">{min}°</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
    </>
  );
}
