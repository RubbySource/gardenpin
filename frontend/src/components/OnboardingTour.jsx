// Onboarding průvodce — 3 kroky, zobrazí se při prvním spuštění
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'gardenpin.onboardingDone';

const STEPS = [
  {
    emoji: '🌻',
    title: 'Vítejte v GardenPinu',
    desc: 'Pojďme nastavit první zahradu — zabere to minutku. Tracker vám pak pohlídá hlavní zahradnické úkony po celý rok.',
    bullets: [
      'Zahrada = místo, kde pěstujete (záhon, květináče, ovocný sad)',
      'Rostlina = pin v zahradě s vlastní historií péče',
      'Úkon = sezónní akce vázaná na rostlinu (zástřih, hnojení, výsadba)',
    ],
    cta: 'Začít',
    target: null,
  },
  {
    emoji: '🗺️',
    title: 'Přidejte první zahradu',
    desc: 'Pojmenujte ji a nahrajte fotku z leteckého pohledu — pomůže vám orientovat se mezi rostlinami.',
    bullets: [
      'Jméno (např. "Zahrada u domu", "Skleník")',
      'Fotka layoutu (volitelné, ale doporučené)',
      'Můžete použít i šablonu (zeleninová / okrasná / ovocná / bylinková)',
    ],
    cta: 'Otevřít zahrady',
    target: '/zahrady',
  },
  {
    emoji: '🌱',
    title: 'Přidejte rostlinu a sezónní úkon',
    desc: 'V detailu zahrady kliknete na mapu pro přidání pinu. Vyberete rostlinu z katalogu (85 druhů) a tracker vám rovnou navrhne sezónní úkony.',
    bullets: [
      'Pin = jedna rostlina nebo skupina (např. "Levandule u plotu")',
      'Vyberte rostlinu — automaticky se nabídnou hlavní úkony',
      'Úkon má frekvenci (např. každý rok v srpnu) nebo konkrétní datum',
    ],
    cta: 'Procházet katalog rostlin',
    target: '/katalog',
  },
];

export function shouldShowOnboarding() {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // localStorage nedostupný — ignoruj
  }
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignoruj
  }
}

export default function OnboardingTour({ onClose }) {
  const [step, setStep] = useState(0);
  const nav = useNavigate();
  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') skip();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft' && step > 0) setStep((s) => s - 1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [step]);

  const next = () => {
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const skip = () => {
    markOnboardingDone();
    onClose?.();
  };

  const finish = () => {
    markOnboardingDone();
    onClose?.();
    if (current.target) nav(current.target);
  };

  return (
    <div className="onboarding-backdrop" onClick={skip}>
      <div className="onboarding-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="onboarding-skip"
          onClick={skip}
          aria-label="Přeskočit průvodce"
        >
          Přeskočit
        </button>

        <div className="onboarding-emoji" aria-hidden="true">{current.emoji}</div>
        <div className="onboarding-step-label">
          Krok {step + 1} z {total}
        </div>
        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-desc">{current.desc}</p>

        <ul className="onboarding-bullets">
          {current.bullets.map((b, i) => (
            <li key={i}>
              <span className="onboarding-bullet-dot">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="onboarding-dots" role="tablist" aria-label="Postup">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`onboarding-dot${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
              onClick={() => setStep(i)}
              aria-label={`Krok ${i + 1}`}
              aria-current={i === step ? 'step' : undefined}
            />
          ))}
        </div>

        <div className="onboarding-actions">
          {step > 0 && (
            <button
              type="button"
              className="btn ghost onboarding-back"
              onClick={() => setStep((s) => s - 1)}
            >
              ‹ Zpět
            </button>
          )}
          <button type="button" className="btn-cta onboarding-next" onClick={next}>
            {current.cta} {isLast ? '' : '›'}
          </button>
        </div>
      </div>
    </div>
  );
}
