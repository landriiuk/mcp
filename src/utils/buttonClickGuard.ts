const GUARD_ATTR = "data-click-guard";
const LOCK_MS = 800;

function resolveButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest("button");
}

function isGuarded(button: HTMLButtonElement) {
  return button.getAttribute(GUARD_ATTR) === "1";
}

function lockButton(button: HTMLButtonElement) {
  button.setAttribute(GUARD_ATTR, "1");
  button.setAttribute("aria-busy", "true");

  window.setTimeout(() => {
    if (!button.isConnected) {
      return;
    }

    button.removeAttribute(GUARD_ATTR);
    button.removeAttribute("aria-busy");
  }, LOCK_MS);
}

/** Blocks double-clicks on every <button> for a short lock window. */
export function installButtonClickGuard() {
  function onClick(event: MouseEvent) {
    const button = resolveButton(event.target);
    if (!button || button.disabled) {
      return;
    }

    if (isGuarded(button)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    lockButton(button);
  }

  function onDblClick(event: MouseEvent) {
    if (!resolveButton(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("dblclick", onDblClick, true);

  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("dblclick", onDblClick, true);
  };
}
