// Home / dashboard — GardenPin design: personal greeting, garden cards, tasks, FAB
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import NewGardenModal from '../components/NewGardenModal.jsx';
import WeatherWidget from '../components/WeatherWidget.jsx';
import Icon from '../components/Icon.jsx';
import { toast } from '../App.jsx';
import { daysFromToday, taskIcon, dueBadge } from '../utils.js';
import { useSwipeToComplete } from '../hooks/useSwipeToComplete.js';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';
import PullIndicator from '../components/PullIndicator.jsx';

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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Dobrou noc';
  if (h < 11) return 'Dobré ráno';
  if (h < 18) return 'Dobré odpoledne';
  return 'Dobrý večer';
}

export default function HomePage({ onTaskComplete }) {
  const [today, setToday] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [harvest, setHarvest] = useState([]);
  const [recentPhotos, setRecentPhotos] = useState([]);
  const [stats, setStats] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [gardenStats, setGardenStats] = useState({}); // { [gardenId]: { plantCount, upcomingCount } }
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const nav = useNavigate();

  const userName = localStorage.getItem(USER_NAME_KEY) || DEFAULT_NAME;

  const load = async () => {
    try {
      const [t, w, s, gs, photos] = await Promise.all([
        api.todayTasks(),
        api.weekTasks(),
        api.stats(),
        api.listGardens(),
        api.recentPhotos(4).catch(() => []),
      ]);
      setToday(t);
      const weekTasks = w.tasks || [];
      const future = weekTasks.filter((x) => !t.some((y) => y.id === x.id)).slice(0, 3);
      setUpcoming(future);
      const harvestThisWeek = weekTasks.filter((x) => x.task_type === 'sklizen').slice(0, 5);
      setHarvest(harvestThisWeek);
      setStats(s);
      setGardens(gs);
      setRecentPhotos(photos || []);

      // Load per-garden plant counts (pins) in parallel
      const pinResults = await Promise.all(
        gs.map((g) =>
          api.listPins(g.id).then((pins) => [g.id, pins.length]).catch(() => [g.id, 0]),
        ),
      );
      const stat = {};
      for (const [gid, plantCount] of pinResults) {
        const upcomingCount = weekTasks.filter((task) => task.garden_id === gid).length;
        stat[gid] = { plantCount, upcomingCount };
      }
      setGardenStats(stat);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const { pull, refreshing, threshold } = usePullToRefresh(load);

  useEffect(() => {
    load();
  }, []);

  const completeTask = async (t) => {
    try {
      await api.completeTask(t.id);
      toast('✅ Úkol označen jako hotový');
      load();
      onTaskComplete?.();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  if (loading) return <div className="empty">Načítám...</div>;

  const monthIdx = new Date().getMonth();
  const monthTip = MONTH_TIPS[monthIdx];
  const urgentCount = stats ? stats.overdue + stats.dueToday : 0;
  const urgentClass = stats && stats.overdue > 0 ? 'danger' : urgentCount > 0 ? 'warning' : '';

  return (
    <>
      <PullIndicator pull={pull} refreshing={refreshing} threshold={threshold} />
      {/* Personal greeting hero */}
      <div className="home-hero greeting-hero">
        <div className="greeting">{getGreeting()}, {userName} 🌿</div>
        <div className="hero-title">
          {today.length === 0
            ? 'Vše je vyřízené'
            : `Máte ${today.length} ${
                today.length === 1 ? 'úkol dnes' : today.length < 5 ? 'úkoly dnes' : 'úkolů dnes'
              }`}
        </div>
        <div className="hero-sub">
          {gardens.length === 0
            ? 'Začněte svou první zahradu'
            : `${gardens.length} ${gardens.length === 1 ? 'zahrada' : gardens.length < 5 ? 'zahrady' : 'zahrad'}`}
          {stats?.pins > 0 && ` · ${stats.pins} rostlin`}
          {monthTip && ` · ${monthTip}`}
        </div>
        {stats && (
          <div className="hero-stats hero-stats-4">
            <div className="hero-stat">
              <div className="val">{stats.gardens}</div>
              <div className="lbl">Zahrady</div>
            </div>
            <div className="hero-stat">
              <div className="val">{stats.pins}</div>
              <div className="lbl">Rostliny</div>
            </div>
            <div className="hero-stat">
              <div className={`val ${urgentClass}`}>{urgentCount}</div>
              <div className="lbl">{stats.overdue > 0 ? 'Po termínu' : 'Dnes'}</div>
            </div>
            <div className="hero-stat">
              <div className={`val ${stats.weeklyDone > 0 ? 'success' : ''}`}>
                {stats.weeklyDone ?? 0}
              </div>
              <div className="lbl">Tento týden</div>
            </div>
          </div>
        )}
      </div>

      {/* Weather */}
      <WeatherWidget />

      {/* Garden cards */}
      {gardens.length > 0 ? (
        <>
          <div className="section-header">
            <div className="title">🗺️ Moje zahrady</div>
            <Link to="/zahrady" className="gp-section-link">Vše →</Link>
          </div>
          <div className="gardens-grid">
            {gardens.map((g) => {
              const gs = gardenStats[g.id] || { plantCount: 0, upcomingCount: 0 };
              return (
                <div
                  key={g.id}
                  className="garden-card-v2 with-stats"
                  onClick={() => nav(`/zahrada/${g.id}`)}
                >
                  <div className="img-wrap">
                    {g.image_path ? <img src={g.image_path} alt={g.name} /> : <span>🌱</span>}
                    <div className="card-stats-overlay">
                      <span className="stat-chip">
                        <span className="ic">🌱</span> {gs.plantCount}
                      </span>
                      <span className={`stat-chip ${gs.upcomingCount > 0 ? 'accent' : ''}`}>
                        <span className="ic">📅</span> {gs.upcomingCount}
                      </span>
                    </div>
                  </div>
                  <div className="card-body">
                    <div>
                      <div className="g-name">{g.name}</div>
                      <div className="g-meta">
                        {gs.plantCount === 0
                          ? 'Žádné rostliny'
                          : `${gs.plantCount} rostlin${gs.plantCount === 1 ? 'a' : gs.plantCount < 5 ? 'y' : ''}`}
                        {gs.upcomingCount > 0 && ` · ${gs.upcomingCount} úkol${gs.upcomingCount === 1 ? '' : gs.upcomingCount < 5 ? 'y' : 'ů'}`}
                      </div>
                    </div>
                    <span style={{ fontSize: '1.3rem', color: 'var(--text-dim)' }}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="gp-empty" style={{ padding: '24px 16px' }}>
          <span className="gp-empty-icon" style={{ fontSize: '2.4rem' }}>🌻</span>
          <div className="gp-empty-title">Začněte svou první zahradu</div>
          <div className="gp-empty-text">
            Přidejte fotografii zahrady, přidejte rostliny a sledujte péči o ně.
          </div>
          <button className="btn-cta" onClick={() => setShowNew(true)}>
            + Vytvořit zahradu
          </button>
        </div>
      )}

      {/* Recent photos grid */}
      {recentPhotos.length > 0 && (
        <>
          <div className="section-header">
            <div className="title">
              <Icon name="camera" size={18} /> Poslední fotky
            </div>
            <span className="count-badge">{recentPhotos.length}</span>
          </div>
          <div className="recent-photos-grid">
            {recentPhotos.map((p) => (
              <Link
                key={p.id}
                to={`/zahrada/${p.garden_id}`}
                className="recent-photo"
                title={`${p.pin_name}${p.plant_name ? ' · ' + p.plant_name : ''}`}
              >
                <img src={p.url} alt={p.pin_name} loading="lazy" />
                <div className="recent-photo-overlay">
                  <div className="recent-photo-pin">{p.pin_name}</div>
                  {p.plant_name && (
                    <div className="recent-photo-plant">{p.plant_name}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Tento týden — sklizeň */}
      {harvest.length > 0 && (
        <>
          <div className="section-header">
            <div className="title">
              <Icon name="basket" size={18} /> Tento týden — sklizeň
            </div>
            <span className="count-badge">{harvest.length}</span>
          </div>
          {harvest.map((t) => (
            <HomeTaskCard key={t.id} task={t} onComplete={completeTask} />
          ))}
        </>
      )}

      {/* Today + overdue */}
      <div className="section-header">
        <div className="title">🌞 Dnes a po termínu</div>
        {today.length > 0 && (
          <span className={`count-badge${stats?.overdue > 0 ? ' danger' : ''}`}>{today.length}</span>
        )}
      </div>
      {today.length === 0 ? (
        <div className="gp-empty" style={{ padding: '24px 16px' }}>
          <span className="gp-empty-icon" style={{ fontSize: '2.4rem' }}>🌼</span>
          <div className="gp-empty-title">Vše je vyřízené</div>
          <div className="gp-empty-text">Užijte si den v zahradě.</div>
        </div>
      ) : (
        today.map((t) => <HomeTaskCard key={t.id} task={t} onComplete={completeTask} />)
      )}

      {/* Upcoming */}
      <div className="section-header">
        <div className="title">📅 Nadcházející</div>
        {upcoming.length > 0 ? (
          <span className="count-badge">{upcoming.length}</span>
        ) : (
          <Link to="/ukoly" className="gp-section-link">Vše →</Link>
        )}
      </div>
      {upcoming.length === 0 ? (
        <div className="gp-empty" style={{ padding: '20px 16px' }}>
          <div className="gp-empty-text" style={{ marginBottom: 0 }}>
            Žádné další úkoly v tomto týdnu
          </div>
        </div>
      ) : (
        upcoming.map((t) => <HomeTaskCard key={t.id} task={t} onComplete={completeTask} />)
      )}

      <Link
        to="/premium"
        className="btn secondary"
        style={{
          display: 'flex',
          padding: '14px 12px',
          borderRadius: 14,
          background: 'var(--sand)',
          color: 'var(--primary)',
          fontWeight: 700,
          border: '1px solid var(--sand-dark)',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 18,
        }}
      >
        🌟 Premium
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
    </>
  );
}

// Lightweight úkolová karta používaná na home — používá .gp-task styl
function HomeTaskCard({ task, onComplete }) {
  const badge = dueBadge(task.next_due);
  const days = daysFromToday(task.next_due);
  const stateClass =
    days !== null && days < 0
      ? 'is-overdue'
      : days === 0
      ? 'is-today'
      : '';
  const cleanTitle = task.title;
  const fallbackEmoji = taskIcon(task.task_type);
  const { handlers, itemStyle, triggered } = useSwipeToComplete(() => onComplete?.(task));

  return (
    <div className="gp-task-wrap">
      <div className={`gp-task-swipe-bg ${triggered ? 'triggered' : ''}`} aria-hidden="true">
        <span className="swipe-icon">{triggered ? '✅' : '✓'}</span>
        <span className="swipe-label">{triggered ? 'Pustit pro hotovo' : 'Posuňte →'}</span>
      </div>
      <div
        className={`gp-task ${stateClass} ${triggered ? 'is-triggered' : ''}`}
        style={itemStyle}
        {...handlers}
      >
        <button
          className="gp-task-check"
          onClick={(e) => {
            e.stopPropagation();
            onComplete?.(task);
          }}
          aria-label="Označit jako hotové"
          title="Označit jako hotové"
        >
          ✓
        </button>
        <div className="gp-task-body">
          <div className="gp-task-title">
            {!/^[^\w\s]/u.test(cleanTitle) && <span>{fallbackEmoji}</span>}
            <span>{cleanTitle}</span>
          </div>
          <div className="gp-task-meta">
            🌿 {task.pin_name}
            {task.plant_name ? ` · ${task.plant_name}` : ''}
            {task.garden_name ? ` · 🗺️ ${task.garden_name}` : ''}
          </div>
          {badge && (
            <div className="gp-task-chips">
              <span className={`gp-chip ${badge.cls}`}>{badge.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
