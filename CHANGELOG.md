# Changelog

## 1.8.3 - 2026-10-29

### Maintenance
- Translations: removed an unused editor label ("General" section) from all four languages. No visible change.

## 1.8.2 - 2026-10-29

### Fixes
- An empty YAML key (`port_pattern:` with no value) or a numeric `port_pattern` no longer replaces the card with a "Cannot read properties of null" error: an empty key keeps its default value, and a number is used as text.

## 1.8.1 - 2026-10-29

### Fixes
- The power toggle no longer bounces back to its old position after a click on switches that report their new state a moment after the command (MQTT, cloud or polled SNMP switches). It is redrawn from the real state at once when the command fails, and after 2 seconds when the switch kept its state.
- A `status_entity` that no longer exists in Home Assistant (renamed or deleted) shows a grey header and a question-mark status pill, instead of taking the connectivity colour (green when connected) with an alert icon.

### Maintenance
- README: the status colours mention the grey `unavailable` / `unknown` / missing states, and the Online / Idle label follows the `language` option.

## 1.8.0 - 2026-10-29

### Fixes
- The admin `url` no longer opens an external site through a relative path containing `\`, a tab or a newline (`/\evil.com`, `/<tab>/evil.com`), which browsers read as `//evil.com`.
- Traffic tiles: an `unavailable` / `unknown` sensor reads as Home Assistant shows it instead of "unavailable MB", and values in other units (`kB/s`, `Mbit/s`…) are rounded and localized by Home Assistant.
- Ports, the header icon, the power LED and the status / connectivity chips are grey when their entity is `unavailable` or `unknown`, instead of red as if the switch or the port were down. The connectivity chip shows a question-mark icon in that case.
- The power toggle no longer stays visually flipped when the service call succeeds but the switch keeps its state.
- Editor helpers read "Default: 8" in English, German and Spanish (the French spacing "Default : 8" is kept for French only).
- Non-numeric `port_start` / `port_step` / `port_bottom` in YAML fall back to their defaults (with a console warning) instead of misplacing the ports.

### Changes
- Header status pill on the right of the header, on the title's line (left of the power toggle), like the other juju35 cards: it shows `status_entity`, or `connectivity_entity` when no status is set; the remaining chips stay under the header.
- New `language` option (and editor field) to force the card language: `en`, `fr`, `de` or `es`; unset, the Home Assistant language is used as before.

### Maintenance
- README: language support, editor sections, grey unavailable states and the header layout documented. CI: the Screenshots job fails clearly when apt fails three times and time-boxes the Chromium download; Biome no longer runs twice in the Lint workflow; when the Screenshots job pushes refreshed captures (with `GITHUB_TOKEN`, which triggers no `pull_request` run), it re-runs Lint, Validate and HACS on the branch through `workflow_dispatch`, so the PR's last commit has its checks.

## 1.7.0 - 2026-10-28

### Changes
- German and Spanish translations: the card and its visual editor follow a German (`de`) or Spanish (`es`) dashboard language, including the Online / Idle status chip.

## 1.6.1 - 2026-10-28

### Fixes
- The admin `url` no longer accepts protocol-relative links (`//host`): relative paths must start with a single `/`, so the card can't be made to open an external site.
- The card redraws when only a traffic sensor's unit or the header entity's friendly name changes.
- A failed power toggle service call now redraws the card, so the toggle no longer stays visually flipped.
- The power toggle is disabled when the switch entity is `unknown`, as it already was when `unavailable`.
- Less work on each Home Assistant update: the watched entities and the config part of the render key are computed once per configuration.

### Maintenance
- Repository renamed to `ha-switch-card`: README, badges, "Add to HACS" buttons, HACS install URL and the card's documentation URL updated.
- CI: releases gated on the tests, Screenshots workflow, `hacs/action` pinned to a release tag, npm Dependabot updates, unused ruff tooling removed. README no longer repeats the top screenshots. Nothing changes for users.

## 1.6.0 - 2026-10-26

### Fixes
- The admin `url` opened when tapping the device is now restricted to `http(s)` links and relative paths; a `javascript:` or `data:` URL set in the YAML config is no longer opened.

## 1.5.0
### Changes
- Header icon badge sized like the other cards: 40 px round badge, 24 px icon, 16 % tint of the status color.
- `online_state` / `idle_state` no longer default to the French `En ligne` / `Inactif` only: unset, a status of `Online` or `En ligne` (`Idle` or `Inactif`) matches, case-insensitively, so existing configs keep working and English sensors need no setting. A set value is also compared case-insensitively. The status chip shows Online / Idle in the dashboard language (English or French) instead of the raw sensor value; other states are shown as Home Assistant formats them.
- Header geometry: the chips start 8 px under the header (was 10 px); icon badge 12 px from the top and left edges, power toggle at the right edge as before.

## 1.4.0

### Changes
- The Netgear GS308T (`model: gs308t`) is drawn instead of shown as a photo: black front panel with its two groups of four ports in a silver bezel, the link LED at the top-left corner of each port (lit when the port is up, off when it is down), the power LED (status color) and the reset button. Ports and LEDs come from the same grid, so they stay aligned at any card width; the port numbers sit under each port. The bundle drops from about 54 KB to 31 KB.

### Maintenance
- Test for the alignment of the ports and LEDs (8 in all); GS308T screenshot regenerated.

## 1.3.1

### Fixes
- Configuration warnings are logged once instead of again on every keystroke in the visual editor.
- Keyboard focus stays on the focused port, tile or chip when the card updates.
- The header icon and the device picture (with `url`) can be reached and opened from the keyboard.

### Maintenance
- Screenshot script renders each capture in a fresh page; duplication checks no longer scan the tests. Nothing changes for users.

## 1.3.0

### Changes
- Configuration checks: a `port_pattern` without `{n}`, `ports` above 52 or a `model` drawing fewer ports than `ports` now log a warning in the browser console; the card still renders as before.
- Keyboard access: ports, traffic tiles and chips can be focused and opened with Enter / Space, like a click.
- README example in English, with `mdi:switch` and `http://switch.local`; `online_state` / `idle_state` are explained as values of `status_entity` (their defaults `En ligne` / `Inactif` are unchanged).

### Fixes
- The visual editor no longer redraws its form on every Home Assistant state change while editing.
- An invalid `ports` value no longer stops port updates: the watched ports are the drawn ones (8 by default).

### Maintenance
- CI hardening: actions pinned by commit SHA, read-only workflow token, monthly Dependabot updates, duplication findings annotated in pull requests.
- Unit tests (`npm test`) run in CI; `package-lock.json` version synced. Nothing changes for users.

## 1.2.2

### Maintenance
- Tooling only, no functional change: Biome linting, pre-commit and a Lint CI (duplication checks). Card source modernized (optional chaining, template literals), identical behavior.

## 1.2.1

### Fixes
- The uptime pill is readable in dark mode: it uses the theme's secondary text color instead of the disabled one, which was too dim on a dark card.

## 1.2.0

### Changes
- More compact layout with the same information, like the other ha-* cards: 12 px card padding, 36 px header icon, 16 px name and 12 px subtitle, 11 px pills, tighter tiles and sections.
- Lower traffic tiles; the switch front keeps its size.

## 1.1.3

### Changes
- HACS now asks for Home Assistant 2024.8 or later, the version that brought the sections view the card supports; the README says so under **Prerequisites**.
- README: **Add to HACS** button in the installation steps, as in the other ha-* repositories.

## 1.1.2

### Maintenance
- Merged branches are deleted automatically (new `cleanup-branches` workflow). Nothing changes for users.

## 1.1.1

### Development
- The built card is no longer committed in `dist/`: CI builds it on every push, and the release workflow builds it and attaches it to the release, which is where HACS downloads it from. Nothing changes for users.

## 1.1.0

### Changes
- The generic front panel follows the Home Assistant theme: its body, vents and port slots are derived from the card and text colors, so it no longer stays dark in a light theme.
- Status, port, toggle and traffic colors come from the theme (`--success-color`, `--warning-color`, `--error-color`, `--info-color`) with the Home Assistant defaults as fallbacks.
- Header, chips and traffic tiles aligned with the other ha-* cards: 40px icon, name 18px, tinted status chips, tiles on the secondary background.
- Uptime reads "12d 16h" in English ("12j 16h" in French).

### Development
- The card source moves to `src/ha-switch-card.js`; `npm run build` stamps the version from `package.json` into `dist/ha-switch-card.js`, and CI checks that `dist/` is up to date.
- `npm run screenshots` renders the README screenshots (light, dark and GS308T) into `screenshots/` (was `docs/`).
- Releases are now published from `CHANGELOG.md`, added in this version, when `version` in `package.json` has no tag yet, like the other ha-* repositories (Release Drafter removed).
- Issue templates and stale workflow; HACS name "Network Switch Card", like the other "… Card" repositories.

## 1.0.0

### What's new
- First release: header with status-colored icon and power toggle; connectivity, status and uptime chips; live per-port state on the device; incoming / outgoing traffic.
- Built-in generic front panel (1–52 ports) or Netgear GS308T (S350) photo, or a custom image with an adjustable port overlay.
- Visual editor, French and English.
