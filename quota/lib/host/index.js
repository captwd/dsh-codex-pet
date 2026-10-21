// Host half is intentionally inert.
//
// All UI (companion, balance/quota batteries, task cards) is client-side and is
// discovered from package.json#dsh.client, then served at
// /plugins/dsh-pet-quota-desktop/client.js. No host services, settings, ports or
// credentials are added. The optional desktop window is installed separately by
// scripts/install-desktop.mjs.
export const name = 'dsh-pet-quota-desktop';

export function apply() {}
