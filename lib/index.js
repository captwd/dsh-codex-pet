// Installs the bundled pet into the Codex-pet library on first activation.
//
// The pet itself is rendered by @michengai/dsh-codex-pet, which scans
// $DSH_HOME/codex-pet/pets/<folder>/pet.json on boot. This plugin only makes
// that folder appear, so no rendering code is duplicated here.
//
// Guarantees:
// - idempotent: an existing folder is never overwritten or deleted
// - no network, no extra ports, no credentials
// - a failed install only logs a warning; it never blocks DSH startup
import {access, cp, mkdir, readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const name = 'dsh-pet-deepseek-whale';
export const inject = [];
export const PET_ID = 'deepseek-whale-v2';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const dshHome = () => process.env.DSH_HOME ?? join(homedir(), '.dsh');

/** Absolute path of the pet library this plugin writes into. */
export function petDirectory(home = dshHome()) {
  return join(home, 'codex-pet', 'pets', PET_ID);
}

const exists = async path => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Copy the bundled pet into the library unless it is already there.
 * @returns {'already-present' | 'created'} what happened.
 */
export async function installPet(home = dshHome()) {
  const target = petDirectory(home);
  if (await exists(join(target, 'pet.json'))) return 'already-present';
  await mkdir(target, {recursive: true});
  for (const file of ['spritesheet.png', 'pet.json']) {
    await cp(join(packageRoot, 'pets', PET_ID, file), join(target, file));
  }
  return 'created';
}

/** Read the manifest this package ships, for identity checks. */
export async function bundledManifest() {
  return JSON.parse(await readFile(join(packageRoot, 'pets', PET_ID, 'pet.json'), 'utf8'));
}

export function apply(ctx) {
  ctx.effect(() => {
    let cancelled = false;
    installPet()
      .then(outcome => {
        if (cancelled) return;
        ctx.logger.info(
          outcome === 'created'
            ? `[dsh-pet-deepseek-whale] 已安装宠物 DeepSeek 鲸鱼娘；在 DSH 宠物设置中刷新并选择即可。`
            : `[dsh-pet-deepseek-whale] 宠物已存在，未做改动：${petDirectory()}`
        );
      })
      .catch(error => {
        if (cancelled) return;
        ctx.logger.warn(`[dsh-pet-deepseek-whale] 宠物安装失败：${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, 'dsh-pet-deepseek-whale: install bundled pet');
}
