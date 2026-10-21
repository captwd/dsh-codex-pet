# DSH Small DS Companion with Balance and Quota Batteries

A small DeepSeek companion that lives in DSH and shows your balance and subscription
quota next to it. Optionally it becomes a real always-on-top desktop window.

![Quota panel](assets/battery-panel.jpg)

## Two layers

| Layer | Contents | How it installs |
| --- | --- | --- |
| **Web layer** | The companion, `DS ¥` / `5h` / `week` batteries, task cards, settings | An ordinary DSH plugin |
| **Desktop layer** (optional) | Separate transparent always-on-top window, click-through, native dragging | Edits files inside DSH Desktop |

The web layer works on its own; the companion then lives inside the DSH page.
Only the desktop layer lets it leave the window and sit on your desktop.

## Dependencies

| Dependency | Required | Role |
| --- | --- | --- |
| `@linxin666/dsh-pet` | **Yes** | Main pet rendering, `/api/pet/state`, `/api/pet/pets`; the companion anchors to it |
| Pet `deepseek-whale-v2` | **Yes** | Source of the companion atlas — the “DeepSeek Whale Girl” pet pack |
| `@linxin666/dsh-usage` | Suggested | `DS ¥` balance; that row shows an error without it |
| `@eddyskywalker/dsh-chatgpt-subscription` | Suggested | `5h` / `week` batteries |
| `@michengai/dsh-codex-ui` | **No** | A UI skin; unrelated to this plugin |
| DSH Desktop `2.0.18` | Desktop layer only | Other versions are refused by the installer |

The atlas is **not** redistributed here: the companion reads the `deepseek-whale-v2`
pet already installed on your machine. If that pet is absent the companion shows an
empty recallable state instead of crashing.

## Install: web layer

```sh
dsh plugin add <repo URL or local path>
```

Refresh the interface afterwards. If the older `dsh-quota-battery` is still enabled,
disable it first — this plugin removes its legacy widget, but running both renders twice.

## Install: desktop layer (optional)

Quit DSH Desktop completely, then:

```sh
node scripts/install-desktop.mjs
```

What it does:

1. Verifies the DSH Desktop version (only `2.0.18`; anything else needs `--unsafe-version`)
2. Backs up `lib/main.js` and `lib/preload.cjs` into `backups/desktop-<version>-<hash>/`
3. Copies the window implementation into `lib/pet-desktop/` with an ownership marker
4. Prepends one import to `main.js` and appends a narrow IPC bridge to `preload.cjs`

Start DSH Desktop again and the companion is its own window. Transparent areas pass the
mouse through; the character, batteries and buttons stay interactive.

### Undo

```sh
node scripts/install-desktop.mjs --restore
```

Restores both entry files **byte for byte** (covered by a test) and deletes only the
`lib/pet-desktop/` directory it created. If either file was changed after installation,
the installer refuses to overwrite it and points at the backup.

### Taking over an older manual install

If `lib/pet-desktop` already exists without this package's marker, the installer refuses
to proceed. After confirming you want to replace it:

```sh
node scripts/install-desktop.mjs --take-over
```

Disable the previous copy first, or you may end up with two companions.

## Settings

`⚙` beneath the companion or right-click: 80–896 px scaling, look-at and idle actions,
wave, hop, focus, hide. The “main pet idle settings” in the same menu control the DSH
main pet instead. Hidden companions can be recalled from “显示小 DS”.

## Data sources

- `DS ¥` — `/api/dsh-usage/overview` from `@linxin666/dsh-usage`
- `5h` / `week` — `/api/dsh-chatgpt-subscription/quota/refresh` from the subscription plugin
- Task cards — the current DSH conversation's thinking / tool / waiting / done / error state

All three come from DSH's own same-origin, already-authenticated page APIs. No new ports,
no copied credentials, no model calls. Missing or stale data is greyed out or shown as
`--`, never faked as 100%.

## Known limits

- The desktop layer targets `2.0.18`; a DSH Desktop upgrade needs re-validation. The
  installer refuses unknown versions instead of writing blindly.
- The desktop window needs the Electron main process, so it cannot be a zero-patch plugin.
- Native menus, window borders and system-level file-drop cursors are out of scope.
- The page version and the desktop version do not both show; installing the desktop layer
  makes the in-page copy step aside.

## License

Code in this repository is MIT, see [LICENSE](LICENSE).

**No third-party character art is bundled.** The companion reads the pet atlas already
installed on your machine. If that pet belongs to someone else, their license applies —
for example `deepseek-whale-v2` is by YunYueSama under the Big Fat Fish Attribution
License 1.0.
