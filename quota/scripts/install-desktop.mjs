#!/usr/bin/env node
// Optional: mount the companion as a real Electron window instead of a page overlay.
//
// This is the ONLY part of this package that edits files inside the installed
// DSH Desktop application, so it is deliberately conservative:
//
//   - refuses unknown Desktop versions unless --unsafe-version is given
//   - backs up every touched file before writing
//   - writes an ownership marker; a directory owned by something else needs --take-over
//   - --restore puts the original bytes back and removes only what it created
//
// Usage:
//   node scripts/install-desktop.mjs              # install / refresh
//   node scripts/install-desktop.mjs --take-over  # replace another pet-desktop build
//   node scripts/install-desktop.mjs --restore    # undo, back to page overlay
//   node scripts/install-desktop.mjs --app-root <path>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const PACKAGE_ID = 'dsh-pet-quota-desktop';
/** Desktop versions this integration was actually run against. */
const VERIFIED_VERSIONS = ['2.0.18'];
const TARGET_DIR = 'pet-desktop';
const ENTRY = `./${TARGET_DIR}/main.mjs`;
const MARKER = '.dsh-pet-quota-desktop.json';
const PRELOAD_MARKER = 'dsh-pet-desktop:v1';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const value = name => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
};

const restore = flag('restore');
const takeOver = flag('take-over');
const unsafeVersion = flag('unsafe-version');

function defaultAppRoot() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    if (!local) throw new Error('LOCALAPPDATA is not set; pass --app-root');
    return path.join(local, 'Programs/DSH Desktop/resources/app');
  }
  if (process.platform === 'darwin') return '/Applications/DSH Desktop.app/Contents/Resources/app';
  throw new Error('Unknown platform; pass --app-root <DSH Desktop resources/app>');
}

const appRoot = path.resolve(value('app-root') ?? defaultAppRoot());
if (!fs.existsSync(appRoot)) throw new Error(`DSH Desktop app not found: ${appRoot}`);

const desktopPackage = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const version = desktopPackage.version;
if (!restore && !VERIFIED_VERSIONS.includes(version) && !unsafeVersion) {
  throw new Error(
    `This integration was verified against DSH Desktop ${VERIFIED_VERSIONS.join(', ')}; found ${version}.\n` +
      'Re-run with --unsafe-version only after checking that the desktop entry points still exist.'
  );
}

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// Keyed by app root: several DSH installations must not share one backup, or
// "restore" could put another installation's files back.
const appKey = crypto.createHash('sha256').update(appRoot.toLowerCase()).digest('hex').slice(0, 8);
const targetDir = path.join(appRoot, 'lib', TARGET_DIR);
const backupDir = path.join(root, 'backups', `desktop-${version}-${appKey}`);
const reportPath = path.join(root, 'artifacts', `desktop-install-${appKey}.json`);
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null;
const MARKER_PATH = path.join(targetDir, MARKER);

const touched = ['lib/main.js', 'lib/preload.cjs'].map(name => ({
  name,
  target: path.join(appRoot, name),
  saved: path.join(backupDir, name)
}));

for (const file of touched) {
  if (!fs.existsSync(file.target)) throw new Error(`Missing Desktop entry: ${file.name}`);
}

// ---------------------------------------------------------------- ownership
const marker = fs.existsSync(MARKER_PATH) ? JSON.parse(fs.readFileSync(MARKER_PATH, 'utf8')) : null;
const dirExists = fs.existsSync(targetDir);
if (!restore && dirExists && !marker && !takeOver) {
  throw new Error(
    `lib/${TARGET_DIR} already exists and was not installed by ${PACKAGE_ID}.\n` +
      'That is probably the older local build. Re-run with --take-over to replace it,\n' +
      'after removing it from the other plugin so two companions do not run at once.'
  );
}
if (restore && dirExists && !marker) {
  throw new Error(`lib/${TARGET_DIR} is not owned by ${PACKAGE_ID}; refusing to delete it.`);
}

// ------------------------------------------------------------------ restore
if (restore) {
  for (const file of touched) {
    if (!fs.existsSync(file.saved)) {
      console.warn(`No backup for ${file.name}; leaving it untouched.`);
      continue;
    }
    const current = hash(file.target);
    const expected = report?.files?.find(entry => entry.name === file.name)?.sha256;
    if (expected && current !== expected) {
      throw new Error(`${file.name} changed after installation; refusing to overwrite it. Restore it manually from ${file.saved}`);
    }
    fs.copyFileSync(file.saved, file.target);
  }
  fs.rmSync(targetDir, {recursive: true, force: true});
  fs.mkdirSync(path.dirname(reportPath), {recursive: true});
  fs.writeFileSync(
    reportPath,
    JSON.stringify({restoredAt: new Date().toISOString(), appRoot, version, package: PACKAGE_ID}, null, 2)
  );
  console.log('Restored the Desktop entry points and removed the companion window.');
  console.log('Reload the DSH interface to fall back to the in-page overlay.');
  process.exit(0);
}

// ------------------------------------------------------------------ install
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, {recursive: true});
for (const file of touched) {
  // Keep the pristine copy forever: it is the only way back.
  if (!fs.existsSync(file.saved)) {
    fs.mkdirSync(path.dirname(file.saved), {recursive: true});
    fs.copyFileSync(file.target, file.saved);
  }
}

// Copy the window implementation next to the Desktop entry.
fs.rmSync(targetDir, {recursive: true, force: true});
fs.mkdirSync(path.join(targetDir, 'src'), {recursive: true});
for (const name of ['main.mjs', 'policy.mjs', 'renderer.mjs', 'index.html', 'preload.cjs', 'host-preload.cjs', 'cursor-runtime.mjs']) {
  fs.copyFileSync(path.join(root, 'desktop', name), path.join(targetDir, name));
}
for (const name of ['core', 'mini-core', 'task-core', 'codex-mini']) {
  fs.copyFileSync(path.join(root, 'src', `${name}.mjs`), path.join(targetDir, 'src', `${name}.mjs`));
}
fs.writeFileSync(
  MARKER_PATH,
  JSON.stringify({package: PACKAGE_ID, desktopVersion: version, installedAt: new Date().toISOString()}, null, 2)
);

// Patch the entry points additively and idempotently.
const mainPath = touched[0].target;
const mainSource = fs.readFileSync(mainPath, 'utf8');
if (!mainSource.includes(ENTRY)) {
  const withEntry = `import '${ENTRY}';\n${mainSource}`;
  fs.writeFileSync(mainPath, withEntry);
}

const preloadPath = touched[1].target;
const preloadSource = fs.readFileSync(preloadPath, 'utf8');
if (!preloadSource.includes(PRELOAD_MARKER)) {
  fs.appendFileSync(preloadPath, `\n${fs.readFileSync(path.join(root, 'desktop/host-preload.cjs'), 'utf8')}`);
}

fs.mkdirSync(path.dirname(reportPath), {recursive: true});
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      installedAt: new Date().toISOString(),
      appRoot,
      version,
      package: PACKAGE_ID,
      targetDir,
      backupDir,
      files: touched.map(file => ({name: file.name, sha256: hash(file.target)}))
    },
    null,
    2
  )
);

console.log(`Installed the companion window into ${targetDir}`);
console.log(`Originals backed up in ${backupDir}`);
console.log('Quit DSH Desktop fully and start it again; the small DS then runs as its own window.');
