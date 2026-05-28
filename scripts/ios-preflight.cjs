#!/usr/bin/env node
/**
 * GardenPin — iOS pre-flight check
 *
 * Spustit před `npx cap sync ios` (lokálně na Macu i v Codemagic CI), aby
 * build neselhal kvůli chybějícímu Info.plist klíči, neexistujícímu icon
 * assetu nebo špatně nastavenému Bundle ID. Cíl: rychlá detekce chyb dřív,
 * než utratíme buildovací slot v cloudu.
 *
 * Exit code 0 = OK, 1 = blokující chyba. Warningy nezastaví běh.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }
function ok(msg) { console.log(`  ✓ ${msg}`); }

function readFileSafe(rel) {
  const full = path.join(ROOT, rel);
  try { return fs.readFileSync(full, 'utf8'); }
  catch { return null; }
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

console.log('GardenPin iOS pre-flight\n');

console.log('1. Root packages');
const rootPkg = JSON.parse(readFileSafe('package.json') || '{}');
const reqDev = ['@capacitor/cli', '@capacitor/ios'];
const reqRun = [
  '@capacitor/app', '@capacitor/core', '@capacitor/keyboard',
  '@capacitor/splash-screen', '@capacitor/status-bar',
  '@capacitor/camera', '@capacitor/haptics', '@capacitor/share',
  '@capacitor/push-notifications',
];
for (const dep of reqDev) {
  if (!rootPkg.devDependencies?.[dep]) err(`root devDependencies chybí ${dep}`);
  else ok(`devDep ${dep}@${rootPkg.devDependencies[dep]}`);
}
for (const dep of reqRun) {
  if (!rootPkg.dependencies?.[dep]) err(`root dependencies chybí ${dep} (CocoaPods nenajde plugin)`);
  else ok(`dep ${dep}@${rootPkg.dependencies[dep]}`);
}

console.log('\n2. Frontend packages');
const frontPkg = JSON.parse(readFileSafe('frontend/package.json') || '{}');
for (const dep of reqRun) {
  if (!frontPkg.dependencies?.[dep]) err(`frontend dependencies chybí ${dep} (Vite nezabundluje)`);
  else ok(`frontend dep ${dep}@${frontPkg.dependencies[dep]}`);
}

console.log('\n3. Capacitor config');
const cap = readFileSafe('capacitor.config.ts') || '';
const appIdMatch = cap.match(/appId:\s*'([^']+)'/);
if (!appIdMatch) err('capacitor.config.ts: appId není definováno');
else {
  ok(`appId = ${appIdMatch[1]}`);
  if (appIdMatch[1] === 'cz.gardenpin.app') {
    warn(`appId je placeholder cz.gardenpin.app — před App Store submission zaregistruj vlastní Bundle ID`);
  }
}
const webDirMatch = cap.match(/webDir:\s*'([^']+)'/);
if (!webDirMatch) err('capacitor.config.ts: webDir není definováno');
else ok(`webDir = ${webDirMatch[1]}`);

console.log('\n4. iOS projekt');
const iosDirs = ['ios', 'ios/App', 'ios/App/App', 'ios/App/App.xcodeproj', 'ios/App/App.xcworkspace'];
for (const d of iosDirs) {
  if (!fileExists(d)) err(`Chybí ${d}/ (spusť \`npx cap add ios\` znovu)`);
  else ok(`${d}/ existuje`);
}

console.log('\n5. Info.plist usage strings');
const plist = readFileSafe('ios/App/App/Info.plist') || '';
const usageKeys = [
  ['NSCameraUsageDescription', 'kamera (PinDetail/GardenDetail upload)'],
  ['NSPhotoLibraryUsageDescription', 'galerie (výběr fotky rostliny/mapy)'],
  ['NSPhotoLibraryAddUsageDescription', 'uložení fotky do galerie'],
];
for (const [key, why] of usageKeys) {
  if (!plist.includes(`<key>${key}</key>`)) {
    err(`Info.plist chybí <key>${key}</key> → ${why} (App Store reject jinak)`);
  } else {
    ok(`${key} přítomný`);
  }
}

console.log('\n6. App icon + splash assety');
const assetCatalog = 'ios/App/App/Assets.xcassets';
const iconSet = `${assetCatalog}/AppIcon.appiconset`;
const splashSet = `${assetCatalog}/Splash.imageset`;
if (!fileExists(iconSet)) {
  err(`Chybí ${iconSet}/ (spusť \`npx capacitor-assets generate --ios\`)`);
} else {
  ok(`AppIcon.appiconset existuje`);
  const contents = readFileSafe(`${iconSet}/Contents.json`);
  if (!contents || !contents.includes('1024x1024')) {
    warn(`AppIcon.appiconset nemá 1024×1024 marketing ikonu (App Store ji vyžaduje)`);
  } else ok('1024×1024 marketing icon registrovaná');
}
if (!fileExists(splashSet)) {
  warn(`Chybí ${splashSet}/ (splash bude bílý — spusť \`npx capacitor-assets generate --ios\`)`);
} else ok(`Splash.imageset existuje`);

console.log('\n7. Frontend build artefakt');
if (!fileExists('backend/public/index.html')) {
  warn(`backend/public/index.html chybí — spusť \`cd frontend && npm run build\` před \`npx cap sync ios\``);
} else ok('backend/public/index.html existuje');

console.log('\n8. Native bootstrap');
if (!fileExists('frontend/src/native.js')) {
  err('frontend/src/native.js chybí (nativní status-bar/splash bootstrap)');
} else ok('frontend/src/native.js existuje');
const nativeDir = 'frontend/src/native';
for (const f of ['camera.js', 'haptics.js', 'share.js', 'push.js']) {
  if (!fileExists(`${nativeDir}/${f}`)) {
    err(`${nativeDir}/${f} chybí (nativní API helper)`);
  } else ok(`${nativeDir}/${f} existuje`);
}

console.log('\n──────────────────────────────────────────');
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log(`  ⚠  ${w}`));
}
if (errors.length) {
  console.log(`\n${errors.length} BLOKUJÍCÍ chyba(y):`);
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  console.log('\nOprav výše uvedené chyby před iOS buildem.');
  process.exit(1);
}
console.log('\n✓ Pre-flight OK — iOS build může pokračovat.');
process.exit(0);
