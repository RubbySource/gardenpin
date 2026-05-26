// Home / Přehled — iOS large-title dashboard:
// large title + greeting · „Dnes" grouped-list widget · „Tento týden" stat grid ·
// modulární karty (streak / počasí / fotky) · velké karty zahrad · FAB.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import NewGardenModal from '../components/NewGardenModal.jsx';
import WeatherWidget from '../components/WeatherWidget.jsx';
import StreakWidget from '../components/StreakWidget.jsx';
import SeasonStats from '../components/SeasonStats.jsx';
import YearOverYear from '../components/YearOverYear.jsx';
import Icon from '../components/Icon.jsx';
import { toast } from '../App.jsx';
import { daysFromToday, dueBadge, taskIconName } from '../utils.js';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';
import { fireConfetti } from '../utils/confetti.js';

const MONTH_TIPS = [
  'Plánujte výsadbu na další sezónu',
  'Připravte sazenice na jaro',
  'Začíná předpěstování — papriky a rajčata',
  'Vysazujte mrazuvzdorné druhy',
  'Hlavní výsadbová sezóna',
  'Sledujte zálivku a škůdce',
  'Sklízejte a hnojte',
  'Začátek sklizňových prací',
  'Sklizeň ovoce a zeleniny',
  'Připravte zahradu na zimu',
  'Mulčování a ochrana',
  'Plánujte sezónu ve své kuchyni',
];

const USER_NAME_KEY = 'gardenpin.userName';
const DEFAULT_NAME = 'Patriku';

const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Dobrou noc';
  if (h < 11) return 'Dobré ráno';
  if (h < 18) return 'Dobré odpoledne';
  return 'Dobrý večer';
}

function dateLine() {
  const s = new Date().toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function HomePage({ onTaskComplete }) {
  const [today, setToday] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [stats, setStats] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [gardenWeek, setGardenWeek] = useState({}); // { [gardenId]: count 7-denních úkolů }
  const [recentPhotos, setRecentPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [streakRefresh, setStreakRefresh] = useState(0);
  const nav = useNavigate();

  const userName = localStorage.getItem(USER_NAME_KEY) || DEFAULT_NAME;

  const load = async () => {
    try {
      // Jediná dávka requestů — žádný N+1 (zahrady už nesou pin_count / urgent_count,
      // týdenní počet per zahradu odvodíme z jednoho /tasks/week výpisu).
      const [t, w, s, gs, photos] = await Promise.all([
        api.todayTasks(),
        api.weekTasks(),
        api.stats(),
        api.listGardens(),
        api.recentPhotos(8).catch(() => []),
      ]);
      setToday(t);
      const weekTasks = w.tasks || [];
      setUpcoming(weekTasks.filter((x) => !t.some((y) => y.id === x.id)).slice(0, 4));
      setStats(s);
      setGardens(gs);
      setRecentPhotos(photos || []);

      const weekMap = {};
      for (const task of weekTasks) {
        weekMap[task.garden_id] = (weekMap[task.garden_id] || 0) + 1;
      }
      setGardenWeek(weekMap);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ptr = usePullToRefresh(load);

  const completeTask = async (t) => {
    try {
      const res = await api.completeTask(t.id);
      toast('✅ Úkol označen jako hotový');
      // Konfety jen když přibyl den ve streaku (ne pro každý další task v ten samý den)
      if (res?.streak?.increased) {
        fireConfetti({
          count: res.streak.current_streak >= 7 ? 120 : 80,
          duration: res.streak.current_streak >= 7 ? 1800 : 1400,
        });
      }
      setStreakRefresh((k) => k + 1);
      load();
      onTaskComplete?.();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  if (loading) return <div className="empty">Načítám...</div>;

  const monthTip = MONTH_TIPS[new Date().getMonth()];
  const urgentCount = stats ? stats.overdue + stats.dueToday : 0;
  const hasOverdue = stats && stats.overdue > 0;

  return (
    <div {...ptr.handlers} className="ptr-host hm-page">
      {/* Pull-to-refresh indicator */}
      <div
        className={`ptr-indicator ${ptr.refreshing ? 'refreshing' : ''} ${ptr.triggered ? 'triggered' : ''}`}
        style={{ height: `${ptr.pull}px`, opacity: ptr.pull > 6 ? 1 : 0 }}
        aria-hidden="true"
      >
        <Icon
          name="refresh"
          size={22}
          className={`ptr-icon ${ptr.refreshing ? 'spin' : ''}`}
          style={{ transform: `rotate(${Math.min(ptr.pull * 4, 360)}deg)` }}
        />
        <span className="ptr-label">
          {ptr.refreshing ? 'Aktualizuji…' : ptr.triggered ? 'Pustit pro obnovu' : 'Stáhněte ↓'}
        </span>
      </div>

      {/* Large title + greeting */}
      <header className="hm-header">
        <div className="hm-greeting">{getGreeting()} 🌿</div>
        <h1 className="ios-large-title hm-title">{userName}</h1>
        <p className="hm-subtitle">
          {dateLine()}
          {monthTip && ` · ${monthTip}`}
        </p>
      </header>

      {/* DNES — grouped list widget */}
      <section className="hm-section">
        <div className="hm-section-head">
          <h2 className="hm-section-title">Dnes</h2>
          {today.length > 0 && (
            <span className={`hm-section-count ${hasOverdue ? 'danger' : 'warn'}`}>
              {today.length} {plural(today.length, 'úkol', 'úkoly', 'úkolů')}
            </span>
          )}
        </div>
        {today.length === 0 ? (
          <div className="hm-empty-card">
            <span className="hm-empty-icon">🌼</span>
            <div>
              <div className="hm-empty-title">Vše je vyřízené</div>
              <div className="hm-empty-text">Užijte si den v zahradě.</div>
            </div>
          </div>
        ) : (
          <div className="hm-card">
            {today.map((t) => (
              <HomeTaskRow key={t.id} task={t} onComplete={completeTask} />
            ))}
          </div>
        )}
      </section>

      {/* TENTO TÝDEN — stat grid */}
      {stats && (
        <section className="hm-section">
          <h2 className="hm-section-title hm-section-title-solo">Tento týden</h2>
          <div className="hm-stats-grid">
            <button className="hm-stat" onClick={() => nav('/zahrady')}>
              <div className="hm-stat-val">{stats.gardens}</div>
              <div className="hm-stat-lbl">Zahrady</div>
            </button>
            <div className="hm-stat">
              <div className="hm-stat-val brand">{stats.pins}</div>
              <div className="hm-stat-lbl">Rostliny</div>
            </div>
            <button className="hm-stat" onClick={() => nav('/ukoly')}>
              <div className={`hm-stat-val ${urgentCount > 0 ? (hasOverdue ? 'red' : 'orange') : ''}`}>
                {urgentCount}
              </div>
              <div className="hm-stat-lbl">{hasOverdue ? 'Po termínu' : 'Dnes'}</div>
            </button>
            <div className="hm-stat">
              <div className={`hm-stat-val ${stats.weeklyDone > 0 ? 'green' : ''}`}>
                {stats.weeklyDone ?? 0}
              </div>
              <div className="hm-stat-lbl">Hotovo</div>
            </div>
          </div>
        </section>
      )}

      {/* Modulární karty — streak + počasí */}
      <StreakWidget refreshKey={streakRefresh} />
      <WeatherWidget />

      {/* NADCHÁZEJÍCÍ — grouped list */}
      {upcoming.length > 0 && (
        <section className="hm-section">
          <div className="hm-section-head">
            <h2 className="hm-section-title">Nadcházející</h2>
            <Link to="/tyden" className="hm-section-link">
              Týden ›
            </Link>
          </div>
          <div className="hm-card">
            {upcoming.map((t) => (
              <HomeTaskRow key={t.id} task={t} onComplete={completeTask} />
            ))}
          </div>
        </section>
      )}

      {/* NEDÁVNÉ FOTKY — horizontální pás */}
      {recentPhotos.length > 0 && (
        <section className="hm-section">
          <div className="hm-section-head">
            <h2 className="hm-section-title">Nedávné fotky</h2>
          </div>
          <div className="hm-photo-strip">
            {recentPhotos.map((p) => (
              <button
                key={p.id}
                className="hm-photo"
                onClick={() => nav(`/zahrada/${p.garden_id}`)}
                aria-label={`Otevřít zahradu ${p.garden_name || ''}`}
              >
                <img src={p.url} alt={p.pin_name || ''} loading="lazy" />
                <div className="hm-photo-overlay">
                  <div className="hm-photo-title">{p.pin_name}</div>
                  {p.garden_name && <div className="hm-photo-meta">{p.garden_name}</div>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* MOJE ZAHRADY — velké hero karty */}
      {gardens.length > 0 ? (
        <section className="hm-section">
          <div className="hm-section-head">
            <h2 className="hm-section-title">Moje zahrady</h2>
            <Link to="/zahrady" className="hm-section-link">
              Vše ›
            </Link>
          </div>
          <div className="hm-garden-list">
            {gardens.map((g) => (
              <HomeGardenCard
                key={g.id}
                garden={g}
                weekCount={gardenWeek[g.id] || 0}
                onOpen={() => nav(`/zahrada/${g.id}`)}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="gp-empty" style={{ padding: '24px 16px' }}>
          <span className="gp-empty-icon" style={{ fontSize: '2.4rem' }}>
            🌻
          </span>
          <div className="gp-empty-title">Začněte svou první zahradu</div>
          <div className="gp-empty-text">
            Přidejte fotografii zahrady, přidejte rostliny a sledujte péči o ně.
          </div>
          <button className="btn-cta" onClick={() => setShowNew(true)}>
            + Vytvořit zahradu
          </button>
        </div>
      )}

      {/* Sezónní statistiky + meziroční srovnání */}
      <SeasonStats />
      <YearOverYear />

      <Link to="/nastaveni" className="ios-premium-link">
        <span className="ios-premium-icon" aria-hidden="true">
          <Icon name="sparkles" size={18} />
        </span>
        <span>Premium</span>
        <Icon name="chevronRight" size={16} className="ios-premium-chev" />
      </Link>

      {/* FAB — new garden */}
      <button
        className="floating-fab"
        onClick={() => setShowNew(true)}
        aria-label="Nová zahrada"
        title="Nová zahrada"
      >
        +
      </button>

      {showNew && (
        <NewGardenModal
          onClose={() => setShowNew(false)}
          onCreated={(g) => {
            setShowNew(false);
            toast('✅ Zahrada vytvořena');
            nav(`/zahrada/${g.id}`);
          }}
        />
      )}
    </div>
  );
}

// iOS grouped-list řádek úkolu — kruhový check (splnit) + ikona z taxonomie + termín badge.
function HomeTaskRow({ task, onComplete }) {
  const badge = dueBadge(task.next_due);
  const days = daysFromToday(task.next_due);
  const stateClass = days !== null && days < 0 ? 'is-overdue' : days === 0 ? 'is-today' : '';

  return (
    <div className={`hm-task-row ${stateClass}`}>
      <button
        type="button"
        className="hm-task-check"
        onClick={() => onComplete?.(task)}
        aria-label="Označit jako hotové"
        title="Označit jako hotové"
      >
        <Icon name="check" size={15} stroke={2.5} />
      </button>
      <span className="hm-task-ic" aria-hidden="true">
        <Icon name={taskIconName(task.task_type)} size={16} />
      </span>
      <div className="hm-task-main">
        <div className="hm-task-name">{task.title}</div>
        <div className="hm-task-sub">
          🌿 {task.pin_name}
          {task.plant_name ? ` · ${task.plant_name}` : ''}
          {task.garden_name ? ` · ${task.garden_name}` : ''}
        </div>
      </div>
      {badge && <span className={`hm-task-badge ${badge.cls}`}>{badge.text}</span>}
    </div>
  );
}

// Velká hero karta zahrady — fotka/placeholder + urgent badge + počet rostlin/úkolů.
function HomeGardenCard({ garden, weekCount, onOpen }) {
  const pinCount = garden.pin_count || 0;
  const urgent = garden.urgent_count || 0;

  const sub =
    pinCount === 0
      ? 'Zatím žádné rostliny'
      : `${pinCount} ${plural(pinCount, 'rostlina', 'rostliny', 'rostlin')}` +
        (weekCount > 0
          ? ` · ${weekCount} ${plural(weekCount, 'úkol', 'úkoly', 'úkolů')} tento týden`
          : ' · vše pod kontrolou');

  return (
    <button className="hm-garden-card" onClick={onOpen}>
      <div className="gl-card-hero hm-garden-hero">
        {garden.image_path ? (
          <img src={garden.image_path} alt={garden.name} />
        ) : (
          <div className="gl-card-hero-ph">
            <span>🌱</span>
          </div>
        )}
        {urgent > 0 && <span className="gl-urgent-badge">{urgent} po termínu</span>}
      </div>
      <div className="hm-garden-body">
        <div className="hm-garden-text">
          <div className="gl-card-name">{garden.name}</div>
          <div className="gl-card-meta">{sub}</div>
        </div>
        <span className="hm-garden-chev" aria-hidden="true">
          ›
        </span>
      </div>
    </button>
  );
}
