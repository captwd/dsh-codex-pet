// The Desktop patcher is the riskiest part of this package, so it is exercised
// against throwaway app roots. Nothing here touches a real DSH installation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/install-desktop.mjs');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Minimal stand-in for a packaged DSH Desktop "resources/app" directory. */
function sandbox(version = '2.0.18') {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-desktop-'));
  fs.mkdirSync(path.join(appRoot, 'lib'), {recursive: true});
  fs.writeFileSync(path.join(appRoot, 'package.json'), JSON.stringify({name: 'dsh-desktop', version}));
  fs.writeFileSync(path.join(appRoot, 'lib/main.js'), "import {app} from 'electron';\napp.whenReady();\n");
  fs.writeFileSync(path.join(appRoot, 'lib/preload.cjs'), "const {contextBridge} = require('electron');\n");
  return appRoot;
}

/** Paths the installer derives from an app root; removed again after each case. */
function derived(appRoot) {
  const key = crypto.createHash('sha256').update(appRoot.toLowerCase()).digest('hex').slice(0, 8);
  return {
    backup: path.join(root, 'backups', `desktop-2.0.18-${key}`),
    report: path.join(root, 'artifacts', `desktop-install-${key}.json`)
  };
}

function run(appRoot, ...extra) {
  return execFileSync(process.execPath, [script, '--app-root', appRoot, ...extra], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function runExpectingFailure(appRoot, ...extra) {
  try {
    run(appRoot, ...extra);
  } catch (error) {
    return String(error.stderr ?? '') + String(error.stdout ?? '');
  }
  throw new Error('expected the installer to refuse, but it succeeded');
}

function cleanup(appRoot) {
  const {backup, report} = derived(appRoot);
  fs.rmSync(backup, {recursive: true, force: true});
  fs.rmSync(report, {force: true});
  fs.rmSync(appRoot, {recursive: true, force: true});
}

test('client bundle registers the package id and exported applier', () => {
  const bundle = fs.readFileSync(path.join(root, 'lib/client.js'), 'utf8');
  assert.match(bundle, /id:"dsh-pet-quota-desktop"/);
  assert.match(bundle, /return \{apply:mountEnhancements,inject\}/);
  assert.doesNotMatch(bundle, /dsh-quota-battery"/, 'must not hijack the older plugin id');
});

test('refuses an unverified Desktop version unless explicitly allowed', () => {
  const appRoot = sandbox('9.9.9');
  try {
    const message = runExpectingFailure(appRoot);
    assert.match(message, /--unsafe-version/);
    assert.equal(
      hash(path.join(appRoot, 'lib/main.js')),
      hash(path.join(appRoot, 'lib/main.js')),
      'nothing was written'
    );
    assert.equal(fs.readFileSync(path.join(appRoot, 'lib/main.js'), 'utf8').includes('pet-desktop'), false);
  } finally {
    cleanup(appRoot);
  }
});

test('installs the window, patches entry points, and is idempotent', () => {
  const appRoot = sandbox();
  try {
    run(appRoot);
    const main = fs.readFileSync(path.join(appRoot, 'lib/main.js'), 'utf8');
    const preload = fs.readFileSync(path.join(appRoot, 'lib/preload.cjs'), 'utf8');
    assert.ok(main.startsWith("import './pet-desktop/main.mjs';"));
    assert.ok(preload.includes('dsh-pet-desktop:v1'));

    const target = path.join(appRoot, 'lib/pet-desktop');
    for (const file of ['main.mjs', 'renderer.mjs', 'index.html', 'cursor-runtime.mjs']) {
      assert.ok(fs.existsSync(path.join(target, file)), `${file} shipped`);
    }
    for (const file of ['core', 'mini-core', 'task-core', 'codex-mini']) {
      assert.ok(fs.existsSync(path.join(target, 'src', `${file}.mjs`)), `${file}.mjs shipped`);
    }
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, '.dsh-pet-quota-desktop.json'), 'utf8')).package, 'dsh-pet-quota-desktop');

    run(appRoot);
    const again = fs.readFileSync(path.join(appRoot, 'lib/main.js'), 'utf8');
    assert.equal(again.split("import './pet-desktop/main.mjs';").length - 1, 1, 'import not duplicated');
    assert.equal(fs.readFileSync(path.join(appRoot, 'lib/preload.cjs'), 'utf8').split('dsh-pet-desktop:v1').length - 1, 1);
  } finally {
    cleanup(appRoot);
  }
});

test('restore returns byte-identical files and removes only its own directory', () => {
  const appRoot = sandbox();
  try {
    const mainBefore = hash(path.join(appRoot, 'lib/main.js'));
    const preloadBefore = hash(path.join(appRoot, 'lib/preload.cjs'));
    run(appRoot);
    assert.notEqual(hash(path.join(appRoot, 'lib/main.js')), mainBefore);
    run(appRoot, '--restore');
    assert.equal(hash(path.join(appRoot, 'lib/main.js')), mainBefore);
    assert.equal(hash(path.join(appRoot, 'lib/preload.cjs')), preloadBefore);
    assert.equal(fs.existsSync(path.join(appRoot, 'lib/pet-desktop')), false);
  } finally {
    cleanup(appRoot);
  }
});

test('take-over is required before replacing a foreign pet-desktop build', () => {
  const appRoot = sandbox();
  try {
    const foreign = path.join(appRoot, 'lib/pet-desktop');
    fs.mkdirSync(foreign, {recursive: true});
    fs.writeFileSync(path.join(foreign, 'main.mjs'), '// someone else\n');
    assert.match(runExpectingFailure(appRoot), /--take-over/);
    run(appRoot, '--take-over');
    assert.match(fs.readFileSync(path.join(foreign, 'main.mjs'), 'utf8'), /app\.whenReady|import/);
  } finally {
    cleanup(appRoot);
  }
});
