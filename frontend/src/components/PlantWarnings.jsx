// Sekce „Na co si dát pozor" — choroby a škůdci vázané na rostlinu.
// Zobrazí se na kartě rostliny (PinDetail, katalog). Pokud rostlina nemá
// žádné záznamy v databázi, komponenta nevykreslí nic.
import React, { useState } from 'react';
import { getWarningsForPlant, monthRangeLabel, kindLabel } from '../pestDatabase.js';

export default function PlantWarnings({ plantName }) {
  const warnings = getWarningsForPlant(plantName);
  const [openId, setOpenId] = useState(null);

  if (warnings.length === 0) return null;

  return (
    <div className="plant-warnings">
      <div className="plant-warnings-head">
        <span className="plant-warnings-icon">⚠️</span>
        <span className="plant-warnings-title">Na co si dát pozor</span>
        <span className="plant-warnings-count">{warnings.length}</span>
      </div>
      <ul className="plant-warnings-list">
        {warnings.map((w) => {
          const isOpen = openId === w.id;
          return (
            <li key={w.id} className={`pest-card pest-${w.kind}`}>
              <button
                type="button"
                className="pest-card-head"
                onClick={() => setOpenId(isOpen ? null : w.id)}
                aria-expanded={isOpen}
              >
                <span className="pest-card-icon" aria-hidden="true">{w.icon}</span>
                <span className="pest-card-main">
                  <span className="pest-card-name">{w.name}</span>
                  <span className="pest-card-badges">
                    <span className="pest-kind-badge">{kindLabel(w.kind)}</span>
                    <span className="pest-month-badge">🗓️ {monthRangeLabel(w.months)}</span>
                  </span>
                </span>
                <span className="pest-card-chevron">{isOpen ? '▴' : '▾'}</span>
              </button>
              {isOpen && (
                <div className="pest-card-body">
                  <div className="pest-card-row">
                    <strong>Příznaky:</strong> {w.symptom}
                  </div>
                  <div className="pest-card-row">
                    <strong>Prevence:</strong> {w.prevention}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
