// Renders the card with mock data and saves the README screenshots.
// Usage: npm run build && npm run screenshots
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cardJs = readFileSync(`${root}dist/ha-switch-card.js`, "utf8");

const THEMES = {
  light: {
    "--primary-background-color": "#e8eaed",
    "--secondary-background-color": "#ececec",
    "--card-background-color": "#ffffff",
    "--primary-text-color": "#212121",
    "--secondary-text-color": "#727272",
    "--disabled-text-color": "#bdbdbd",
    "--divider-color": "rgba(0,0,0,.12)",
  },
  dark: {
    "--primary-background-color": "#111111",
    "--secondary-background-color": "#282828",
    "--card-background-color": "#1c1c1c",
    "--primary-text-color": "#e1e1e1",
    "--secondary-text-color": "#9b9b9b",
    "--disabled-text-color": "#6f6f6f",
    "--divider-color": "rgba(225,225,225,.12)",
  },
};
const COMMON = {
  "--primary-color": "#03a9f4",
  "--info-color": "#039be5",
  "--success-color": "#43a047",
  "--warning-color": "#ffa600",
  "--error-color": "#db4437",
  "--text-primary-color": "#ffffff",
};

// Minimal stand-ins for Home Assistant's <ha-card> and <ha-icon> (Material Design Icons paths below).
const haElements = (icons) => `
const ICONS = ${JSON.stringify(icons)};
customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--card-background-color);border-radius:12px;" +
      "border:1px solid var(--divider-color);color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});
customElements.define("ha-icon", class extends HTMLElement {
  static get observedAttributes() { return ["icon"]; }
  connectedCallback() { this._draw(); }
  attributeChangedCallback() { this._draw(); }
  _draw() {
    const path = ICONS[(this.getAttribute("icon") || "").replace("mdi:", "")] || "";
    this.style.display = "inline-flex";
    this.innerHTML = '<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor"><path d="' + path + '"/></svg>';
  }
});`;

const pageHtml = (theme, width) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  :root { ${Object.entries({ ...THEMES[theme], ...COMMON }).map(([k, v]) => `${k}:${v};`).join("")} }
  body { margin: 0; padding: 16px; background: var(--primary-background-color); color: var(--primary-text-color);
         font-family: Roboto, "Segoe UI", Helvetica, Arial, sans-serif; width: ${width}px; }
</style></head><body><div id="root"></div></body></html>`;

// Renders each shot { file, type, theme, width, config, hass?, after? } into screenshots/<file>.png.
// extra: more stand-in elements, as script source.
export async function render(shots, { icons = {}, hass = {}, extra = "" } = {}) {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  // A fresh page per shot: re-running the scripts in the same realm would redeclare their globals.
  for (const s of shots) {
    const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1000, height: 2000 } });
    page.on("pageerror", (err) => console.error(`${s.file}: ${err.message}`));
    await page.setContent(pageHtml(s.theme, s.width));
    await page.addScriptTag({ content: haElements(icons) + extra });
    await page.addScriptTag({ content: cardJs });
    await page.evaluate(
      ({ type, config, hass, dark }) => {
        const el = document.createElement(type);
        el.setConfig({ type: `custom:${type}`, ...config });
        el.hass = { states: {}, entities: {}, devices: {}, language: "en", locale: { language: "en" },
                    themes: { darkMode: dark }, callService: async () => {}, callWS: async () => ({}),
                    ...(window.formatEntityState ? { formatEntityState: window.formatEntityState } : {}), ...hass };
        document.getElementById("root").appendChild(el);
      },
      { type: s.type, config: s.config || {}, hass: { ...hass, ...(s.hass || {}) }, dark: s.theme === "dark" }
    );
    if (s.after) await s.after(page);
    await page.waitForTimeout(400);
    // The card plus the 16px page padding around it, on the theme background.
    const box = await page.locator("#root").boundingBox();
    await page.screenshot({
      path: `${root}screenshots/${s.file}.png`,
      clip: { x: 0, y: 0, width: s.width + 32, height: Math.ceil(box.height) + 32 },
      animations: "disabled",
    });
    console.log(`screenshots/${s.file}.png`);
    await page.close();
  }
  await browser.close();
}

const icons = {
  "switch": "M13,18H14A1,1 0 0,1 15,19H22V21H15A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21H2V19H9A1,1 0 0,1 10,18H11V16H8A1,1 0 0,1 7,15V3A1,1 0 0,1 8,2H16A1,1 0 0,1 17,3V15A1,1 0 0,1 16,16H13V18M13,6H14V4H13V6M9,4V6H11V4H9M9,8V10H11V8H9M9,12V14H11V12H9Z",
  "network-outline": "M15,20A1,1 0 0,0 14,19H13V17H17A2,2 0 0,0 19,15V5A2,2 0 0,0 17,3H7A2,2 0 0,0 5,5V15A2,2 0 0,0 7,17H11V19H10A1,1 0 0,0 9,20H2V22H9A1,1 0 0,0 10,23H14A1,1 0 0,0 15,22H22V20H15M7,15V5H17V15H7Z",
  "network-off-outline": "M1.04,5.27L5,9.23V15A2,2 0 0,0 7,17H11V19H10A1,1 0 0,0 9,20H2V22H9A1,1 0 0,0 10,23H14A1,1 0 0,0 15,22H17.77L19.77,24L21.04,22.72L2.32,4L1.04,5.27M7,11.23L10.77,15H7V11.23M15,20A1,1 0 0,0 14,19H13V17.23L15.77,20H15M22,20V21.14L20.86,20H22M7,6.14L5.14,4.28C5.43,3.53 6.16,3 7,3H17A2,2 0 0,1 19,5V15C19,15.85 18.47,16.57 17.72,16.86L15.86,15H17V5H7V6.14Z",
  "check-circle": "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z",
  "minus-circle": "M17,13H7V11H17M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  "alert-circle": "M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  "clock-outline": "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  "arrow-down-bold": "M9,4H15V12H19.84L12,19.84L4.16,12H9V4Z",
  "arrow-up-bold": "M15,20H9V12H4.16L12,4.16L19.84,12H15V20Z"
};

// Home Assistant (2024.8+, the card's minimum) translates states through hass.formatEntityState:
// a connectivity binary_sensor reads "Connected", not the raw "on". Functions do not survive
// page.evaluate's serialization, so the formatter is defined in the page and picked up by render().
const formatter = `
window.formatEntityState = (st) => {
  const common = { unavailable: "Unavailable", unknown: "Unknown" };
  if (common[st.state]) return common[st.state];
  if (st.entity_id.startsWith("binary_sensor.")) {
    const names = { connectivity: { on: "Connected", off: "Disconnected" } }[st.attributes?.device_class] || { on: "On", off: "Off" };
    return names[st.state] ?? st.state;
  }
  const unit = st.attributes?.unit_of_measurement;
  return unit ? st.state + " " + unit : st.state;
};`;

// Stand-in for Home Assistant's <ha-switch> toggle.
const extra = formatter + `
customElements.define("ha-switch", class extends HTMLElement {
  set checked(v) { this._c = v; this._draw(); }
  connectedCallback() { this._draw(); }
  _draw() {
    const on = this._c !== false;
    this.innerHTML = '<span style="display:inline-block;width:36px;height:14px;border-radius:7px;position:relative;background:' +
      (on ? "var(--success-color)" : "var(--error-color)") + '"><span style="position:absolute;top:-3px;' + (on ? "right:-2px" : "left:-2px") +
      ';width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span></span>';
  }
});`;

const state = (entity_id, s, attributes = {}) => [entity_id, { entity_id, state: s, attributes }];
const ports = (up) => Array.from({ length: 8 }, (_, i) => state(`sensor.switch_port_${i + 1}_status`, up.includes(i + 1) ? "1" : "2"));
const states = Object.fromEntries([
  state("switch.office_switch", "on"),
  state("sensor.office_switch_status", "Online"),
  state("binary_sensor.office_switch_connectivity", "on", { device_class: "connectivity" }),
  state("sensor.office_switch_uptime", "109530000"),
  state("sensor.office_switch_in", "184412876800", { unit_of_measurement: "B" }),
  state("sensor.office_switch_out", "39728447488", { unit_of_measurement: "B" }),
  ...ports([1, 2, 3, 5, 6, 8]),
]);
const config = {
  name: "Office switch",
  subtitle: "Netgear GS308T",
  switch_entity: "switch.office_switch",
  status_entity: "sensor.office_switch_status",
  connectivity_entity: "binary_sensor.office_switch_connectivity",
  uptime_entity: "sensor.office_switch_uptime",
  traffic_in_entity: "sensor.office_switch_in",
  traffic_out_entity: "sensor.office_switch_out",
};
const hass = { states };

await render(
  [
    { file: "card", type: "ha-switch-card", theme: "light", width: 460, config: { ...config, subtitle: "Generic" } },
    { file: "card-dark", type: "ha-switch-card", theme: "dark", width: 460, config: { ...config, subtitle: "Generic" } },
    { file: "card-gs308t", type: "ha-switch-card", theme: "light", width: 460, config: { ...config, model: "gs308t" } },
    { file: "card-gs308t-dark", type: "ha-switch-card", theme: "dark", width: 460, config: { ...config, model: "gs308t" } },
  ],
  { icons, hass, extra }
);
