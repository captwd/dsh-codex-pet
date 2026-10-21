import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {bundledManifest, installPet, petDirectory, PET_ID} from '../lib/index.js';

const pngSize = async path => {
  const buffer = await readFile(path);
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', 'real PNG file');
  return {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
};

test('bundled manifest matches the Codex pet protocol', async () => {
  const manifest = await bundledManifest();
  assert.equal(manifest.id, PET_ID);
  assert.equal(manifest.spriteVersionNumber, 2);
  assert.equal(manifest.spritesheetPath, 'spritesheet.png');
  assert.ok(manifest.displayName.length > 0);
  assert.ok(manifest.description.includes('YunYueSama'), 'keeps the artwork credit in-band');
});

test('bundled spritesheet matches the 8x11 grid the renderer expects', async () => {
  const {width, height} = await pngSize(new URL('../pets/deepseek-whale-v2/spritesheet.png', import.meta.url));
  assert.deepEqual({width, height}, {width: 1536, height: 2288});
  assert.equal(width % 8, 0);
  assert.equal(height % 11, 0);
  assert.deepEqual([width / 8, height / 11], [192, 208]);
});

test('install copies the pet into the library', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-pet-'));
  const outcome = await installPet(home);
  assert.equal(outcome, 'created');
  const directory = petDirectory(home);
  assert.equal(directory, join(home, 'codex-pet', 'pets', PET_ID));
  const manifest = JSON.parse(await readFile(join(directory, 'pet.json'), 'utf8'));
  assert.equal(manifest.id, PET_ID);
  assert.ok((await stat(join(directory, 'spritesheet.png'))).size > 100_000);
});

test('install is idempotent and never overwrites a user copy', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-pet-'));
  await installPet(home);
  const manifestPath = join(petDirectory(home), 'pet.json');
  await writeFile(manifestPath, JSON.stringify({displayName: 'my own edit'}), 'utf8');
  assert.equal(await installPet(home), 'already-present');
  assert.equal(JSON.parse(await readFile(manifestPath, 'utf8')).displayName, 'my own edit');
});

test('install fills in a partially deleted pet instead of failing', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-pet-'));
  await mkdir(join(petDirectory(home)), {recursive: true});
  assert.equal(await installPet(home), 'created');
  const manifest = JSON.parse(await readFile(join(petDirectory(home), 'pet.json'), 'utf8'));
  assert.equal(manifest.id, PET_ID);
});

test('petDirectory honours DSH_HOME', () => {
  const saved = process.env.DSH_HOME;
  try {
    process.env.DSH_HOME = 'C:/custom-home';
    assert.equal(petDirectory(), join('C:/custom-home', 'codex-pet', 'pets', PET_ID));
  } finally {
    if (saved === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = saved;
  }
});
