# RepulsKB

A Chrome extension for [repuls.io](https://repuls.io) that provides full keybind remapping. All configuration is handled from the extension popup, so the game's own controls menu is left untouched.

## Features

- **Complete remapping.** Every in-game action, including movement, weapons, reload, and chat, can be bound to any key.
- **Scope modes.** Choose Hold (active while the key is pressed) or Toggle (press to open, press again to close).
- **Sprint modes.** Choose Hold for standard sprinting, or Toggle to sprint automatically while you move.
- **Fire key.** Hold a key to fire continuously, equivalent to holding left-click.
- **Master switch.** Extension On/Off (default `Ctrl + K`) pauses every keybind so keys behave exactly as pressed. Disabling it first releases any open scope, sprint, or fire input so nothing remains stuck.
- **Conflict detection.** A warning is displayed when one key is assigned to more than one action.
- **Typing protection.** Keybinds pause automatically while a text field is focused.
- **Built-in guide.** A short walkthrough opens on first launch and remains available from the Guide button.
- **Minimal setup.** The only game-side requirement is a one-time reset of the default controls.

## Installation

RepulsKB is not listed on the Chrome Web Store. To install it manually:

1. Select **Code**, then **Download ZIP**, on this repository's page.
2. Extract the archive.
3. Open `chrome://extensions` (or the equivalent page in Edge or Brave).
4. Enable **Developer mode** using the toggle in the top-right corner.
5. Select **Load unpacked** and choose the extracted folder.
6. On repuls.io, go to **Settings → Controls** and select **Reset To Default**. This is required once. Afterwards, make all changes through the extension.

## Usage

Click the extension icon to open the popup. On first launch, the guide opens automatically; it can be reopened at any time from the Guide button.

- **Rebind an action:** select its key box, then press the desired key. The change saves immediately. Press `Esc` to cancel.
- **Pause the extension:** use the Extension On/Off switch or its shortcut. This is useful when typing in chat.
- **Configure Scope, Sprint, and Fire:** each has its own on/off switch and key assignment. Scope and Sprint offer separate Hold and Toggle bindings.
- **Restore defaults:** select **Reset To Default** at the bottom of the list.

## How It Works

RepulsKB assumes the game's controls are set to their defaults. When a custom key is pressed, `content.js` intercepts it and dispatches a synthetic keyboard event for the action's default key, so the game responds as though its own binding had been used. When an action is remapped, its original default key is disabled to prevent duplicate input. All of this is gated behind the Extension On/Off switch; when it is off, input passes through unmodified.

## Project Structure


.

├── manifest.json   Extension manifest (Manifest V3)

├── common.js       Shared action definitions, defaults, and key utilities

├── content.js      Input interception and event simulation on repuls.io

├── popup.html      Popup markup and in-extension guide

├── popup.js        Popup logic and settings management

├── popup.css       Popup styling

└── logo.png        Extension icon


## Contributing

Issues and pull requests are welcome. To add a remappable action, append an entry to the `ACTIONS` array in `common.js`; both `content.js` and `popup.js` read from this shared list.

## Known Limitations

Browsers flag script-generated keyboard and mouse events as `isTrusted: false`. Most sites treat them the same as real input, but a site that explicitly rejects untrusted events cannot be supported by any browser extension.

## License

Distributed under the terms of the [LICENSE](LICENSE) file included in this repository.

---

Created by **axionified**.
