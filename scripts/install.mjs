#!/usr/bin/env node
// Standalone installer for people who do not want to add a DSH plugin.
// Usage:
//   node scripts/install.mjs            # install into $DSH_HOME/codex-pet/pets
//   node scripts/install.mjs --force    # overwrite an existing copy
//   node scripts/install.mjs --dry-run  # print what would happen
import {access, cp, mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const PET_ID = 'deepseek-whale-v2';
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const home = process.env.DSH_HOME ?? join(homedir(), '.dsh');
const target = join(home, 'codex-pet', 'pets', PET_ID);
const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

const exists = async path => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

if (dryRun) {
  console.log(`将安装到：${target}`);
  console.log(force ? '已存在时会覆盖（--force）。' : '已存在时保持不动。');
  process.exit(0);
}

if (await exists(join(target, 'pet.json'))) {
  if (!force) {
    console.log(`已存在，未改动：${target}`);
    console.log('如需覆盖请加 --force。');
    process.exit(0);
  }
  console.log(`覆盖：${target}`);
}

await mkdir(dirname(target), {recursive: true});
await mkdir(target, {recursive: true});
for (const file of ['pet.json', 'spritesheet.png']) {
  await cp(join(packageRoot, 'pets', PET_ID, file), join(target, file));
}
console.log(`已安装 DeepSeek 鲸鱼娘：${target}`);
console.log('打开 DSH 宠物设置，刷新列表并选择「DeepSeek 鲸鱼娘」即可。');
