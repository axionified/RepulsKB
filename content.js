(function () {
  "use strict";

  let settings = buildDefaultSettings();

  function loadSettings() {
    try {
      chrome.storage.sync.get({ repulsSettings: buildDefaultSettings() }, (stored) => {
        settings = mergeSettings(stored.repulsSettings);
      });
    } catch (err) {}
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !changes.repulsSettings) return;
      settings = mergeSettings(changes.repulsSettings.newValue);
      if (!settings.special.toggleSprint.enabled && runModeOn) {
        runModeOn = false;
        updateShiftForMovement();
      }
    });
  } catch (err) {}

  let typingActive = false;

  function isTypingInField() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function refreshTypingState() {
    typingActive = isTypingInField();
    if (typingActive) {
      if (shiftInterval) {
        clearInterval(shiftInterval);
        shiftInterval = null;
      }
    } else if (shiftOn && !shiftInterval) {
      shiftInterval = setInterval(pressShiftOnce, 1000);
    }
  }

  document.addEventListener("focusin", refreshTypingState, true);
  document.addEventListener("focusout", refreshTypingState, true);

  let lastX = window.innerWidth / 2;
  let lastY = window.innerHeight / 2;

  function findTarget() {
    return document.querySelector("canvas") || document.body || document;
  }

  function focusTarget(target) {
    try {
      if (target && target.tabIndex === -1) target.tabIndex = 0;
      if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
    } catch (err) {}
  }

  window.addEventListener(
    "mousemove",
    (e) => {
      lastX = e.clientX;
      lastY = e.clientY;
    },
    true
  );

  function dispatchAll(target, events) {
    for (const evt of events) target.dispatchEvent(evt);
  }

  function makeKeyEvent(type, canonicalKey) {
    const info = KEY_INFO[canonicalKey];
    if (!info) return null;
    return new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key: info.key,
      code: info.code,
      keyCode: info.keyCode,
      which: info.keyCode,
      shiftKey: !!info.shiftKey,
    });
  }

  function dispatchTargetKey(type, canonicalKey) {
    const evt = makeKeyEvent(type, canonicalKey);
    if (!evt) return;
    const target = findTarget();
    dispatchAll(document, [evt]);
    dispatchAll(window, [makeKeyEvent(type, canonicalKey)]);
    if (target !== document.body) dispatchAll(target, [makeKeyEvent(type, canonicalKey)]);
  }

  function simulateMouseDown(button) {
    const target = findTarget();
    focusTarget(target);
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: button,
      buttons: button === 2 ? 2 : 1,
      clientX: lastX,
      clientY: lastY,
      screenX: lastX,
      screenY: lastY,
      pointerType: "mouse",
    };
    const events = [new PointerEvent("pointerdown", opts), new MouseEvent("mousedown", opts)];
    if (button === 2) events.push(new MouseEvent("contextmenu", opts));
    dispatchAll(target, events);
  }

  function simulateMouseUp(button) {
    const target = findTarget();
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: button,
      buttons: 0,
      clientX: lastX,
      clientY: lastY,
      screenX: lastX,
      screenY: lastY,
      pointerType: "mouse",
    };
    dispatchAll(target, [new PointerEvent("pointerup", opts), new MouseEvent("mouseup", opts)]);
  }

  function fireRightClick() {
    simulateMouseDown(2);
    simulateMouseUp(2);
    scopeOpen = !scopeOpen;
  }

  window.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
    },
    true
  );

  let shiftOn = false;
  let shiftInterval = null;
  let scopeOpen = false;
  let holdSprintKeyIsDown = false;
  let fireKeyIsDown = false;
  const heldActionIds = new Set();

  function pressShiftOnce() {
    dispatchTargetKey("keydown", "shift");
  }

  function releaseShiftOnce() {
    dispatchTargetKey("keyup", "shift");
  }

  function turnShiftOn() {
    if (shiftOn) return;
    shiftOn = true;
    focusTarget(findTarget());
    pressShiftOnce();
    if (!typingActive) shiftInterval = setInterval(pressShiftOnce, 1000);
  }

  function turnShiftOff() {
    if (!shiftOn) return;
    shiftOn = false;
    if (shiftInterval) clearInterval(shiftInterval);
    shiftInterval = null;
    releaseShiftOnce();
  }

  let runModeOn = false;
  const movementKeysHeld = new Set();

  const MOVEMENT_ACTION_IDS = ["moveForward", "moveBackward", "moveLeft", "moveRight"];

  function movementCustomKeys() {
    return MOVEMENT_ACTION_IDS.map((id) => settings.actions[id].key);
  }

  function updateShiftForMovement() {
    const shouldBeOn =
      runModeOn && settings.special.toggleSprint.enabled && movementKeysHeld.size > 0;
    if (shouldBeOn && !shiftOn) {
      turnShiftOn();
    } else if (!shouldBeOn && shiftOn) {
      turnShiftOff();
    }
  }

  function activeClaimedKeys() {
    const set = new Set();
    ACTIONS.forEach((a) => set.add(settings.actions[a.id].key));
    if (settings.special.holdScope.enabled) set.add(settings.special.holdScope.key);
    if (settings.special.toggleScope.enabled) set.add(settings.special.toggleScope.key);
    if (settings.special.toggleSprint.enabled) set.add(settings.special.toggleSprint.key);
    if (settings.special.holdSprint.enabled) set.add(settings.special.holdSprint.key);
    if (settings.special.fire.enabled) set.add(settings.special.fire.key);
    return set;
  }

  function orphanedDefaultKeys() {
    const claimed = activeClaimedKeys();
    const orphans = new Set();
    for (const action of ACTIONS) {
      const cfg = settings.actions[action.id];
      if (cfg.key !== action.defaultKey && !claimed.has(action.defaultKey)) {
        orphans.add(action.defaultKey);
      }
    }
    const hsp = settings.special.holdSprint;
    if (hsp.enabled && hsp.key !== "shift" && !claimed.has("shift")) {
      orphans.add("shift");
    }
    return orphans;
  }

  function persistSettings() {
    try {
      chrome.storage.sync.set({ repulsSettings: settings });
    } catch (err) {}
  }

  function deactivateEverything() {
    // Restores exactly the state the game would be in if the player had
    // simply released everything normally, before the extension goes
    // fully inert.
    if (scopeOpen) {
      fireRightClick(); // sends the missing "closing" click; also flips scopeOpen back to false
    }
    if (holdSprintKeyIsDown) {
      dispatchTargetKey("keyup", "shift");
      holdSprintKeyIsDown = false;
    }
    runModeOn = false;
    movementKeysHeld.clear();
    turnShiftOff();
    if (fireKeyIsDown) {
      simulateMouseUp(0);
      fireKeyIsDown = false;
    }
    for (const actionId of heldActionIds) {
      const action = ACTIONS.find((a) => a.id === actionId);
      if (action) dispatchTargetKey("keyup", action.defaultKey);
    }
    heldActionIds.clear();
  }

  document.addEventListener(
    "keyup",
    (e) => {
      if (!e.isTrusted) return;
      if (!settings.conveyor.on) return;
      if (e.key === "Shift" && shiftOn && !typingActive) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (!e.isTrusted) return;

      // The master combo always works — on or off, typing or not — so the
      // extension can always be switched back on. Everything else is fully
      // gated behind conveyor.on: when off, every key passes through
      // exactly as pressed, with nothing intercepted or dispatched.
      const combo = comboFromEvent(e);
      if (combo && combo === settings.conveyor.combo && !e.repeat) {
        settings.conveyor.on = !settings.conveyor.on;
        if (!settings.conveyor.on) {
          deactivateEverything();
        }
        persistSettings();
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (typingActive) return;
      if (!settings.conveyor.on) return;

      const key = normalizeKey(e);

      if (orphanedDefaultKeys().has(key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (movementCustomKeys().includes(key)) {
        if (!e.repeat) {
          movementKeysHeld.add(key);
          updateShiftForMovement();
        }
      }

      const hs = settings.special.holdScope;
      if (hs.enabled && key === hs.key && !e.repeat) {
        fireRightClick();
      }
      const ts = settings.special.toggleScope;
      if (ts.enabled && key === ts.key && !e.repeat) {
        fireRightClick();
      }
      const tr = settings.special.toggleSprint;
      if (tr.enabled && key === tr.key && !e.repeat) {
        runModeOn = !runModeOn;
        updateShiftForMovement();
      }
      const hsp = settings.special.holdSprint;
      if (hsp.enabled && hsp.key !== "shift" && key === hsp.key && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        dispatchTargetKey("keydown", "shift");
        holdSprintKeyIsDown = true;
      }
      const fire = settings.special.fire;
      if (fire.enabled && key === fire.key && !e.repeat) {
        simulateMouseDown(0);
        fireKeyIsDown = true;
      }

      for (const action of ACTIONS) {
        const cfg = settings.actions[action.id];
        if (cfg.key === action.defaultKey) continue;
        if (key === cfg.key) {
          e.preventDefault();
          e.stopPropagation();
          if (!e.repeat) {
            dispatchTargetKey("keydown", action.defaultKey);
            heldActionIds.add(action.id);
          }
        }
      }
    },
    true
  );

  document.addEventListener(
    "keyup",
    (e) => {
      if (!e.isTrusted) return;

      const combo = comboFromEvent(e);
      if (combo && combo === settings.conveyor.combo) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (typingActive) return;
      if (!settings.conveyor.on) return;

      const key = normalizeKey(e);

      if (orphanedDefaultKeys().has(key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (movementCustomKeys().includes(key)) {
        movementKeysHeld.delete(key);
        updateShiftForMovement();
      }

      const hs = settings.special.holdScope;
      if (hs.enabled && key === hs.key) {
        fireRightClick();
      }
      const hsp = settings.special.holdSprint;
      if (hsp.enabled && hsp.key !== "shift" && key === hsp.key) {
        e.preventDefault();
        e.stopPropagation();
        dispatchTargetKey("keyup", "shift");
        holdSprintKeyIsDown = false;
      }
      const fire = settings.special.fire;
      if (fire.enabled && key === fire.key) {
        simulateMouseUp(0);
        fireKeyIsDown = false;
      }

      for (const action of ACTIONS) {
        const cfg = settings.actions[action.id];
        if (cfg.key === action.defaultKey) continue;
        if (key === cfg.key) {
          e.preventDefault();
          e.stopPropagation();
          dispatchTargetKey("keyup", action.defaultKey);
          heldActionIds.delete(action.id);
        }
      }
    },
    true
  );

  loadSettings();
})();
