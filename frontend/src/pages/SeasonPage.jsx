// Sezónní přehled — co dělat tento měsíc
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import TaskItem from '../components/TaskItem.jsx';
import PinDetail from './PinDetail.jsx';
import { toast } from '../App.jsx';

const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

const MONTH_TIPS = [
  'V lednu plánuj — připrav semínka, zkontroluj nářadí a nakresli osevní plán. Venku jen ošetři kmeny ovocných stromů.',
  'Začni předpěstovávat papriky a celer. Stříhej peckoviny po skončení mrazů. Kontroluj uskladněnou zeleninu.',
  'Předpěstuj rajčata a ledový salát. Začni s rytím záhonů, jakmile půda rozmrzne. Vysazuj cibuli a česnek.',
  'Ideální čas pro výsadbu cibulovin a rychlení zeleniny. Začni vysévat hrách, mrkev a ředkvičky přímo do záhonů.',
  'Přesazuj rajčata ven až po 15. května — nebezpečí mrazů. Vysazuj okurky, dýně a sazenice papriky po ledových mužích.',
  'Pravidelně zalévej a okopávej. Zaštipuj zálistky u rajčat. Sklízej první ředkvičky, salát a jahody.',
  'Hlídej zálivku v horku — nejlépe ráno a večer. Sklízej rybíz, maliny, hrách a ranou zeleninu. Mulčuj záhony.',
  'Vrchol sklizně — rajčata, papriky, okurky. Zavařuj a suš. Sij zeleninu na podzimní sklizeň (špenát, polníček).',
  'Sklízej jablka a hrušky. Vysazuj cibulky tulipánů a narcisů. Hnoj záhony kompostem před zimou.',
  'Sklízej dýně a poslední rajčata před prvním mrazem. Vyhrabuj listí, ale nech ho na záhonech jako mulč.',
  'Připrav zahradu na zimu — zazimuj růže, přikryj choulostivé rostliny chvojím. Stříhej ovocné stromy.',
  'Zahrada odpočívá — kontroluj uskladněné brambory a jablka. Plánuj příští sezónu a objednávej semena.',
];

export default function SeasonPage() {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openPin, setOpenPin] = useState(null);

  const now = new Date();
  const monthIdx = now.getMonth();
  const year = now.getFullYear();
  const monthLabel = MONTH_NAMES[monthIdx];
  const tip = MONTH_TIPS[monthIdx];

  const load = async () => {
    try {
      const [t, h] = await Promise.all([api.listTasks(), api.listHistory()]);
      setTasks(t);
      setHistory(h);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const completeTask = async (t) => {
    try {
      await api.completeTask(t.id);
      toast('✅ Hotovo');
      load();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  // Filter tasks with next_due in current month, group by garden
  const { groups, totalThisMonth, doneThisMonth } = useMemo(() => {
    const inMonth = (iso) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d.getFullYear() === year && d.getMonth() === monthIdx;
    };

    const monthTasks = tasks.filter((t) => inMonth(t.next_due));
    const monthHistory = history.filter((h) => inMonth(h.done_at));

    const map = new Map();
    for (const t of monthTasks) {
      const key = t.garden_id;
      if (!map.has(key)) map.set(key, { gardenId: key, gardenName: t.garden_name, tasks: [], doneCount: 0 });
      map.get(key).tasks.push(t);
    }
    for (const h of monthHistory) {
      const key = h.garden_id;
      if (!map.has(key)) map.set(key, { gardenId: key, gardenName: h.garden_name, tasks: [], doneCount: 0 });
      map.get(key).doneCount++;
    }

    const groupsArr = Array.from(map.values()).sort((a, b) => a.gardenName.localeCompare(b.gardenName, 'cs'));
    return {
      groups: groupsArr,
      totalThisMonth: monthTasks.length + monthHistory.length,
      doneThisMonth: monthHistory.length,
    };
  }, [tasks, history, year, monthIdx]);

  if (loading) return <div className="empty">Načítám...</div>;

  const pct = totalThisMonth > 0 ? Math.round((doneThisMonth / totalThisMonth) * 100) : 0;

  return (
    <>
      <div className="season-header">
        <div className="season-month">{monthLabel}</div>
        <div className="season-title">Co dělat v zahradě</div>
        <div className="season-sub">{year}</div>
      </div>

      <div className="card season-tip">
        <div className="season-tip-label">💡 Tip měsíce</div>
        <div className="season-tip-body">{tip}</div>
      </div>

      <div className="card">
        <div className="row spread" style={{ alignItems: 'center', marginBottom: 8 }}>
          <strong>Celkem tento měsíc</strong>
          <span className="small muted">{doneThisMonth} / {totalThisMonth} hotovo</span>
        </div>
        <div className="season-progress">
          <div className="season-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card empty">
          <div className="icon">🌱</div>
          <div>V tomto měsíci nemáte naplánované žádné úkoly.</div>
        </div>
      ) : (
        groups.map((g) => {
          const groupTotal = g.tasks.length + g.doneCount;
          const groupPct = groupTotal > 0 ? Math.round((g.doneCount / groupTotal) * 100) : 0;
          return (
            <div key={g.gardenId} className="card">
              <div className="row spread" style={{ alignItems: 'center', marginBottom: 6 }}>
                <h3 className="section-title" style={{ margin: 0 }}>🗺️ {g.gardenName}</h3>
                <span className="small muted">{g.doneCount} / {groupTotal} hotovo</span>
              </div>
              <div className="season-progress" style={{ marginBottom: 12 }}>
                <div className="season-progress-fill" style={{ width: `${groupPct}%` }} />
              </div>
              {g.tasks.length === 0 ? (
                <div className="small muted">Vše hotovo 🎉</div>
              ) : (
                g.tasks.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    onComplete={completeTask}
                    onClick={() => setOpenPin(t.pin_id)}
                  />
                ))
              )}
            </div>
          );
        })
      )}

      {openPin && (
        <PinDetail
          pinId={openPin}
          onClose={() => {
            setOpenPin(null);
            load();
          }}
        />
      )}
    </>
  );
}
