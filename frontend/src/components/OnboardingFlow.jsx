// OnboardingFlow — iOS-style fullscreen průvodce pro nové uživatele.
// 4 obrazovky (welcome + 3 kroky), swipe doleva/doprava, dots indikátor.
// Ukládá flag do localStorage pod klíčem `gp_onboarded` aby se neobjevoval znovu.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'gp_onboarded';
const SWIPE_THRESHOLD = 50; // px — minimální vzdálenost pro swipe

const SLIDES = [
  {
    icon: '🌱',
    title: 'Vítej v GardenPinu',
    text: 'Tvůj zahradní deník. Pohlídá ti hlavní zahradnické úkony po celý rok.',
    bullets: [
      'Zahrada = místo, kde pěstuješ (záhon, květináče, sad)',
      'Rostlina = pin v zahradě s vlastní historií péče',
      'Úkon = sezónní akce vázaná na rostlinu (zástřih, hnojení, výsadba)',
    ],
    cta: 'Začít',
  },
  {
    icon: '🗺️',
    title: 'Nejdřív si přidej zahradu',
    text: 'Pojmenuj ji a nahraj fotku z leteckého pohledu — pomůže ti orientovat se mezi rostlinami.',
    bullets: [
      'Jméno — třeba „Záhon za domem“ nebo „Skleník“',
      'Fotka layoutu (volitelná, ale doporučená)',
      'Můžeš použít i šablonu (zeleninová / okrasná / ovocná / bylinková)',
    ],
    cta: 'Dál →',
  },
  {
    icon: '🌿',
    title: 'Přidej první rostlinu',
    text: 'V detailu zahrady klikni na mapu pro přidání pinu. Vyber ze 321 druhů — GardenPin sám navrhne co a kdy dělat.',
    bullets: [
      'Pin = jedna rostlina nebo skupina (např. „Levandule u plotu“)',
      'Po výběru rostliny se automaticky nabídnou hlavní úkony',
      'Úkon má frekvenci (každý rok v srpnu) nebo konkrétní datum',
    ],
    cta: 'Dál →',
  },
  {
    icon: '✅',
    title: 'Vše připraveno!',
    text: 'Každý měsíc tě GardenPin upozorní na hlavní úkony. Nic nezapomeneš.',
    cta: 'Jdeme na to 🌱',
  },
];

export function shouldShowOnboardingFlow() {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export function markOnboardingFlowDone() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {}
}

export function resetOnboardingFlow() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function OnboardingFlow({ onClose }) {
  const [step, setStep] = useState(0);
  const nav = useNavigate();
  const total = SLIDES.length;
  const isLast = step === total - 1;
  const slide = SLIDES[step];

  // Touch swipe — startX uchováváme v ref, ať nezpůsobuje re-render
  const touchStartX = useRef(null);

  const next = () => {
    if (isLast) finish();
    else setStep((s) => s + 1);
  };
  const prev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const finish = () => {
    markOnboardingFlowDone();
    onClose?.();
    nav('/zahrady');
  };

  const skip = () => {
    markOnboardingFlowDone();
    onClose?.();
  };

  // Keyboard: ← →, Escape přeskočí, Enter pokračuje
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') skip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [step]);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > SWIPE_THRESHOLD) prev();
    else if (dx < -SWIPE_THRESHOLD) next();
  };

  return (
    <div
      className="ob-flow"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding průvodce"
    >
      <button
        type="button"
        className="ob-skip"
        onClick={skip}
        aria-label="Přeskočit průvodce"
      >
        Přeskočit
      </button>

      <div className="ob-track" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* key={step} → re-mountne slide a CSS animace se spustí znovu */}
        <div className="ob-slide" key={step}>
          <div className="ob-icon" aria-hidden="true">{slide.icon}</div>
          <h1 className="ob-title">{slide.title}</h1>
          <p className="ob-text">{slide.text}</p>
          {slide.bullets && (
            <ul className="ob-bullets">
              {slide.bullets.map((b, i) => (
                <li key={i}>
                  <span className="ob-bullet-dot" aria-hidden="true">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="ob-bottom">
        <div className="ob-dots" role="tablist" aria-label="Postup">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`ob-dot${i === step ? ' active' : ''}`}
              onClick={() => setStep(i)}
              aria-label={`Krok ${i + 1} z ${total}`}
              aria-current={i === step ? 'step' : undefined}
            />
          ))}
        </div>
        <button type="button" className="ob-cta" onClick={next}>
          {slide.cta}
        </button>
      </div>
    </div>
  );
}
