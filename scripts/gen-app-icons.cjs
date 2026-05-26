/**
 * Vygeneruje zdrojové assety pro @capacitor/assets (App Store icon + splash).
 * Motiv GardenPin: mapový pin s lístkem, sage/cream paleta z design systemu.
 *
 * Výstup → ./assets/{icon-only.png, splash.png, splash-dark.png}
 * Spuštění (sharp žije v backend/node_modules):
 *   NODE_PATH=backend/node_modules node scripts/gen-app-icons.cjs
 * Po změně motivu znovu spusť + `npx cap-assets generate` (viz docs/IOS_BUILD.md).
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const SAGE = '#7BA889';
const SAGE_DEEP = '#5E8A6E';
const CREAM = '#FAF7F2';
const DARK = '#1C1C1E';

// Logo v souřadnicích 1024 prostoru (pin tip dole, hlava s lístkem).
// Pin = teardrop: hrot (512,800) → tečny ke kružnici (střed 512,400, r 210).
const PIN = 'M512 800 L333.3 510.3 A210 210 0 1 1 690.7 510.3 Z';
const LEAF = 'M512 292 C598 342 598 458 512 508 C426 458 426 342 512 292 Z';
const MIDRIB = 'M512 314 L512 486';

function logo({ pin, leaf, rib }) {
  return `
    <path d="${PIN}" fill="${pin}"/>
    <path d="${LEAF}" fill="${leaf}"/>
    <path d="${MIDRIB}" stroke="${rib}" stroke-width="11" stroke-linecap="round" fill="none"/>`;
}

// App icon: full-bleed sage gradient, cream pin, sage lístek (iOS si zaoblí rohy sám).
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8FBB9E"/>
      <stop offset="1" stop-color="#688F73"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g>${logo({ pin: CREAM, leaf: SAGE_DEEP, rib: CREAM })}</g>
</svg>`;

// Splash: vycentrované logo na jednobarevném podkladu, scale 1.7 do 2732 plátna.
function splashSvg(bg, colors) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="${bg}"/>
  <g transform="translate(495.6,524.5) scale(1.7)">${logo(colors)}</g>
</svg>`;
}

const splashLight = splashSvg(CREAM, { pin: SAGE, leaf: CREAM, rib: SAGE_DEEP });
const splashDark = splashSvg(DARK, { pin: SAGE, leaf: DARK, rib: CREAM });

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

async function render(svg, file) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, file));
  console.log('✓', file);
}

(async () => {
  await render(iconSvg, 'icon-only.png');
  await render(splashLight, 'splash.png');
  await render(splashDark, 'splash-dark.png');
  console.log('Hotovo →', outDir);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
