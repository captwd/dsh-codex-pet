// dsh-unified-cursor/src/cursor-data.mjs
var CURSOR_VALUE = 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%3E%3Cdefs%3E%3CradialGradient%20id%3D%22g%22%3E%3Cstop%20stop-color%3D%22%23278fd1%22%20stop-opacity%3D%22.40%22%2F%3E%3Cstop%20offset%3D%22.45%22%20stop-color%3D%22%23218bd2%22%20stop-opacity%3D%22.22%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23218bd2%22%20stop-opacity%3D%220%22%2F%3E%3C%2FradialGradient%3E%3C%2Fdefs%3E%3Ccircle%20cx%3D%2229%22%20cy%3D%2229%22%20r%3D%2229%22%20fill%3D%22url%28%23g%29%22%2F%3E%3Cpath%20d%3D%22M20%2017%20Q18%2016%2018.8%2019%20L24.1%2040.2%20Q25.1%2043.3%2027.1%2040.7%20L31.3%2031.5%2040.5%2027.2%20Q43%2026%2040.5%2024.7%20Z%22%20fill%3D%22%23161b20%22%20stroke%3D%22%23e4e7eb%22%20stroke-width%3D%222.4%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E") 19 17,url("data:image/png;base64,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") 19 17,default';

// dsh-unified-cursor/src/runtime.mjs
var CURSOR_ATTRIBUTE = "data-dsh-unified-cursor";
var MARKER = "data-dsh-unified-cursor-style";
function cursorCss(shadow = false) {
  const scope = `html:root:root:root[${CURSOR_ATTRIBUTE}]`;
  const selector = shadow ? ":host,:host *,:host *::before,:host *::after" : `${scope},${scope} *,${scope} *::before,${scope} *::after`;
  return `${selector}{cursor:${CURSOR_VALUE}!important}@media(forced-colors:active){${selector}{cursor:default!important}}`;
}
function mountCursor(document) {
  const window = document.defaultView;
  const roots = /* @__PURE__ */ new Map();
  let enabled = false, disposed = false;
  function prune() {
    for (const [root, entry] of roots) if (root.host && !root.host.isConnected) {
      entry.observer.disconnect();
      entry.style.remove();
      roots.delete(root);
    }
  }
  function scan(node) {
    if (!enabled || !node || node.nodeType !== 1) return;
    if (node.shadowRoot) attach(node.shadowRoot);
    for (const element of node.querySelectorAll("*")) if (element.shadowRoot) attach(element.shadowRoot);
  }
  function attach(root) {
    if (!enabled || !root || root !== document && root.nodeType !== 11 || roots.has(root)) return;
    const style = document.createElement("style");
    style.setAttribute(MARKER, "");
    style.textContent = cursorCss(root !== document);
    const observer = new window.MutationObserver((records) => {
      if (!enabled) return;
      for (const record of records) for (const node of record.addedNodes) if (node !== style) scan(node);
      prune();
    });
    roots.set(root, { style, observer });
    (root === document ? document.head : root).append(style);
    observer.observe(root, { childList: true, subtree: true });
    if (root === document) scan(document.documentElement);
    else for (const element of root.querySelectorAll("*")) if (element.shadowRoot) attach(element.shadowRoot);
  }
  function discover(event) {
    for (const element of event.composedPath()) {
      const root = element?.getRootNode?.();
      if (root && root.host?.shadowRoot === root) attach(root);
    }
  }
  function setEnabled(value) {
    const next = value === true;
    if (disposed || next === enabled) return;
    enabled = next;
    if (enabled) {
      document.documentElement.setAttribute(CURSOR_ATTRIBUTE, "");
      attach(document);
      document.addEventListener("pointerover", discover, { capture: true, passive: true });
    } else {
      document.documentElement.removeAttribute(CURSOR_ATTRIBUTE);
      document.removeEventListener("pointerover", discover, true);
      for (const { style, observer } of roots.values()) {
        observer.disconnect();
        style.remove();
      }
      roots.clear();
    }
  }
  return { setEnabled, get enabled() {
    return enabled;
  }, dispose() {
    setEnabled(false);
    disposed = true;
  } };
}
export {
  CURSOR_ATTRIBUTE,
  cursorCss,
  mountCursor
};
