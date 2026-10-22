# Changelog

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
