// Concatenates the client modules into the single browser bundle DSH serves.
//
// The sources share one closure on purpose: they are small, mutually recursive
// (companion <-> mini-core <-> task-core) and only ever ship together. Stripping
// the relative imports keeps the output a single file with no loader of its own.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const strip = code =>
  code
    .replace(/^import .*from '\.\/[^']+\.mjs';\r?\n/gm, '')
    .replace(/^export /gm, '');

/** Modules in dependency order: later files may use earlier declarations. */
const MODULES = ['core', 'mini-core', 'task-core', 'codex-mini', 'desktop-host', 'client'];
export const PLUGIN_ID = 'dsh-pet-quota-desktop';

const code = MODULES.map(name => strip(read(`src/${name}.mjs`))).join('\n');
fs.mkdirSync(path.join(root, 'lib'), {recursive: true});
fs.writeFileSync(
  path.join(root, 'lib/client.js'),
  `window.__ModuleLoader__.load({id:"${PLUGIN_ID}",factory:()=>{\n"use strict";\n${code}\nreturn {apply:mountEnhancements,inject};\n}});\n`
);

// The desktop window imports these by relative path at runtime.
const desktopSrc = path.join(root, 'desktop/src');
fs.mkdirSync(desktopSrc, {recursive: true});
for (const name of ['core', 'mini-core', 'task-core', 'codex-mini']) {
  fs.copyFileSync(path.join(root, 'src', `${name}.mjs`), path.join(desktopSrc, `${name}.mjs`));
}

console.log(`built lib/client.js (${MODULES.length} modules) and desktop/src`);
