// Public marketing landing page for GardenPin
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const FEATURES = [
  {
    icon: '📍',
    title: 'Plánuj piny na mapě',
    body:
      'Nahraj fotku své zahrady a připni rostliny přesně tam, kde rostou. Nikdy už nezapomeneš, kde co máš.',
  },
  {
    icon: '🔔',
    title: 'Sezónní připomínky',
    body:
      'Automatické úkoly podle ročního období — řez, hnojení, zazimování. Přijdou ti přímo do Apple nebo Google Kalendáře přes iCal.',
  },
  {
    icon: '🌿',
    title: '85+ rostlin v databázi',
    body:
      'Zelenina, ovoce, byliny, trvalky i cibuloviny — každá s českým návodem na péči, hnojení a typickými problémy.',
  },
  {
    icon: '✨',
    title: 'Premium pro náročné',
    body:
      'Neomezený počet zahrad, pokročilý plánovač sezóny a prémiové rostliny. Bezpečná platba přes Stripe, kdykoli zrušíš.',
  },
];

const QUOTES = [
  {
    stars: '★★★★★',
    text:
      'Konečně něco, co mi připomene zazimovat růže. Pošle mi to do kalendáře a já jen kliknu „hotovo“.',
    name: 'Petra K.',
    role: 'Beta testerka — Hradec Králové',
    initial: 'P',
  },
  {
    stars: '★★★★★',
    text:
      'Mám tři zahrady na chatě a doma. Konečně to mám všechno na jednom místě, ne v notesu.',
    name: 'Martin H.',
    role: 'Beta tester — Brno',
    initial: 'M',
  },
  {
    stars: '★★★★★',
    text:
      'Databáze rostlin mi šetří hodiny googlení. Vyberu rajče a hned vím, kdy hnojit a jak často zalévat.',
    name: 'Jana S.',
    role: 'Beta testerka — Plzeň',
    initial: 'J',
  },
];

const FAQ = [
  {
    q: 'Je GardenPin opravdu zdarma?',
    a: 'Ano. Free verze obsahuje jednu zahradu, neomezené piny, kompletní databázi 85+ rostlin a všechny sezónní připomínky. Premium odemyká více zahrad a pokročilé funkce, ale není povinné.',
  },
  {
    q: 'Jak dostávám připomínky do iPhone kalendáře?',
    a: 'V nastavení najdeš svou unikátní iCal adresu. Zkopíruješ ji do Nastavení → Kalendář → Účty → Přidat účet → Jiný → Přidat odebíraný kalendář. Apple Kalendář se pak automaticky synchronizuje a úkoly přicházejí ve správný čas.',
  },
  {
    q: 'Můžu používat GardenPin offline?',
    a: 'Aplikace je PWA — po prvním načtení funguje i bez internetu. Změny se synchronizují, jakmile se připojíš.',
  },
  {
    q: 'Jak funguje databáze rostlin?',
    a: 'Po vytvoření pinu vybereš rostlinu z databáze (rajče, růže, jabloň…) a aplikace automaticky vygeneruje úkoly podle skutečné péče — kdy zalévat, hnojit, řezat. Můžeš vše ručně upravit.',
  },
  {
    q: 'Co když chci zrušit Premium?',
    a: 'Premium si můžeš kdykoli zrušit jedním kliknutím v nastavení Stripe portálu. Žádné dlouhodobé závazky, žádné skryté poplatky. Po zrušení ti Free verze zůstane funkční.',
  },
];

export default function LandingPage() {
  // SEO: set document title and meta description for this route
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'GardenPin — Tvoje zahrada, perfektně naplánovaná';
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content');
    if (meta) {
      meta.setAttribute(
        'content',
        'Připni rostliny na fotku své zahrady a získej sezónní připomínky řezu, hnojení a zazimování přímo v Apple nebo Google Kalendáři. 85+ českých rostlin, zdarma.',
      );
    }
    return () => {
      document.title = prevTitle;
      if (meta && prevDesc != null) meta.setAttribute('content', prevDesc);
    };
  }, []);

  return (
    <div className="lp">
      {/* NAV */}
      <nav className="lp-nav" aria-label="Hlavní navigace">
        <div className="lp-container lp-nav-inner">
          <a href="#hero" className="lp-logo" aria-label="GardenPin domů">
            <span className="lp-logo-icon" aria-hidden="true">📍</span>
            GardenPin
          </a>
          <Link to="/" className="lp-nav-cta">
            Otevřít aplikaci →
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero" id="hero" aria-label="Úvod">
        <div className="lp-container">
          <div className="lp-hero-content">
            <span className="lp-hero-badge">
              <span aria-hidden="true">🌿</span>
              85+ českých rostlin · PWA · Zdarma
            </span>
            <h1>
              Tvoje zahrada,
              <br />
              <span>perfektně naplánovaná</span>
            </h1>
            <p className="lp-hero-sub">
              Připni rostliny na fotku své zahrady a získej sezónní připomínky — řez, hnojení,
              zazimování — přímo v Apple nebo Google Kalendáři. Žádné denní otravování. Jen ty
              správné úkoly ve správný čas.
            </p>
            <div className="lp-hero-actions">
              <Link to="/" className="lp-btn-primary">
                Začít zdarma →
              </Link>
              <a href="#features" className="lp-btn-ghost">
                Co umí GardenPin
              </a>
            </div>
            <div className="lp-hero-trust">
              <span aria-hidden="true">🔒</span>
              <span>Bez registrace · Žádná data ven · Funguje offline</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-features" id="features" aria-label="Funkce">
        <div className="lp-container">
          <header className="lp-section-header">
            <span className="lp-section-label">Funkce</span>
            <h2>Vše, co potřebuješ pro zahradu</h2>
            <p>
              Od plánování přes péči až po sezónní připomínky. Bez zbytečností a bez nutnosti se
              učit nový systém.
            </p>
          </header>
          <div className="lp-features-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon" aria-hidden="true">
                  {f.icon}
                </div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="lp-social" aria-label="Co říkají uživatelé">
        <div className="lp-container">
          <header className="lp-section-header">
            <span className="lp-section-label">Co říkají uživatelé</span>
            <h2>Zahradníci, kteří už nezapomínají</h2>
            <p>První beta testeři používají GardenPin přes celou sezónu — a vrací se k němu každý týden.</p>
          </header>
          <div className="lp-quotes-grid">
            {QUOTES.map((q) => (
              <article key={q.name} className="lp-quote-card">
                <div className="lp-quote-stars" aria-label="5 z 5 hvězdiček">
                  {q.stars}
                </div>
                <p className="lp-quote-text">„{q.text}"</p>
                <div className="lp-quote-author">
                  <div className="lp-quote-avatar" aria-hidden="true">
                    {q.initial}
                  </div>
                  <div>
                    <div className="lp-quote-author-name">{q.name}</div>
                    <div className="lp-quote-author-role">{q.role}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="lp-social-disclaimer">
            * Citace pocházejí z uzavřené beta skupiny. Veřejné recenze přibudou s rostoucí komunitou.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-faq" id="faq" aria-label="Časté otázky">
        <div className="lp-container">
          <header className="lp-section-header">
            <span className="lp-section-label">FAQ</span>
            <h2>Časté otázky</h2>
          </header>
          <div className="lp-faq-list">
            {FAQ.map((item) => (
              <details key={item.q} className="lp-faq-item">
                <summary className="lp-faq-summary">{item.q}</summary>
                <div className="lp-faq-body">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta" aria-label="Začít">
        <div className="lp-container">
          <h2>Začni plánovat svou zahradu dnes</h2>
          <p>Zdarma, bez registrace, na všech zařízeních. Stačí pět minut a máš celou sezónu pod kontrolou.</p>
          <div className="lp-cta-actions">
            <Link to="/" className="lp-btn-primary">
              Otevřít GardenPin →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer" aria-label="Patička">
        <div className="lp-container">
          <div className="lp-footer-inner">
            <a href="#hero" className="lp-footer-logo">
              <span className="lp-footer-logo-icon" aria-hidden="true">📍</span>
              GardenPin
            </a>
            <ul className="lp-footer-links">
              <li>
                <Link to="/">Otevřít aplikaci</Link>
              </li>
              <li>
                <a href="#features">Funkce</a>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
              <li>
                <a href="mailto:hello@gardenpin.cz">Kontakt</a>
              </li>
            </ul>
            <div className="lp-footer-copy">
              © {new Date().getFullYear()} GardenPin · Vyrobeno s 🌿 v České republice
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
