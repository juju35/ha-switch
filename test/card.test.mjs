import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCard } from "./load.mjs";

const { HaSwitchCardEditor, esc } = loadCard("ha-switch-card.js", ["HaSwitchCardEditor", "esc"]);

test("the editor keeps its form while HA states change, rebuilds it on a language change", () => {
  const editor = new HaSwitchCardEditor();
  editor.setConfig({ type: "custom:ha-switch-card" });
  editor.hass = { language: "en", states: {} };
  const form = editor._form;
  const schema = form.schema;
  assert.ok(schema);

  const next = { language: "en", states: { "sensor.x": { state: "1" } } };
  editor.hass = next;
  assert.equal(editor._form, form);
  assert.equal(form.schema, schema, "schema not reassigned on a state change");
  assert.equal(form.hass, next, "the form still gets the new hass");

  editor.hass = { language: "fr", states: {} };
  assert.notEqual(form.schema, schema, "schema rebuilt for the new language");
});

test("esc escapes HTML text and attributes", () => {
  assert.equal(esc(`<"'&>`), "&lt;&quot;&#39;&amp;&gt;");
});

test("isSafeUrl accepts http(s) and relative paths, rejects javascript:/data:", () => {
  const { isSafeUrl } = loadCard("ha-switch-card.js", ["isSafeUrl"]);
  for (const u of ["http://switch.local", "https://switch.local/admin", "/local/admin"]) assert.equal(isSafeUrl(u), true, u);
  for (const u of ["javascript:alert(1)", "data:text/html,x", "vbscript:x", " javascript:alert(1)", "//evil.com", "//evil.com/admin"]) assert.equal(isSafeUrl(u), false, u);
  // The URL parser reads "\\" as "/" and drops tabs and newlines: these would open evil.com.
  for (const u of ["/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\\/evil.com"]) assert.equal(isSafeUrl(u), false, JSON.stringify(u));
});

test("ports drawn and ports watched agree when ports is not a number", () => {
  const { HaSwitchCard } = loadCard("ha-switch-card.js", ["HaSwitchCard"]);
  for (const ports of ["", "abc", 0, 5]) {
    const card = new HaSwitchCard();
    card.setConfig({ ports, port_pattern: "sensor.p{n}" });
    const watched = card._watched().filter((id) => id.startsWith("sensor.p"));
    assert.equal(watched.length, card._portCount());
    assert.equal(card._portCount(), ports === 5 ? 5 : 8);
  }
});

test("configWarnings flags configs the editor would not produce", () => {
  const { configWarnings } = loadCard("ha-switch-card.js", ["configWarnings"]);
  const base = { ports: 8, port_pattern: "sensor.p{n}" };
  assert.deepEqual([...configWarnings(base)], []);
  assert.equal(configWarnings({ ...base, port_pattern: "sensor.p" }).length, 1);
  assert.equal(configWarnings({ ...base, ports: 60 }).length, 1);
  assert.match(configWarnings({ ...base, ports: 10, model: "gs308t" })[0], /ports 9 to 10/);
  assert.deepEqual([...configWarnings({ ...base, ports: 10, model: "gs308t", image: "/local/x.png" })], []);
});

test("a config warning is logged once, not on every setConfig from the editor", () => {
  const warns = [];
  const console = { info() {}, log() {}, error() {}, warn: (msg) => warns.push(msg) };
  const { HaSwitchCard } = loadCard("ha-switch-card.js", ["HaSwitchCard"], { console });
  const card = new HaSwitchCard();
  // Typing "sensor.sw_port_{n}_status" in the editor: HA calls setConfig on the preview at each keystroke.
  const target = "sensor.sw_port_{n}_status";
  for (let i = 1; i <= target.length; i++) card.setConfig({ port_pattern: target.slice(0, i) });
  assert.equal(warns.length, 1);
  assert.match(warns[0], /port_pattern has no \{n\}/);
  // Another card with the same mistake does not repeat it either; a different mistake is reported.
  new HaSwitchCard().setConfig({ port_pattern: "sensor.p" });
  new HaSwitchCard().setConfig({ port_pattern: "sensor.p{n}", ports: 60 });
  assert.equal(warns.length, 2);
  assert.match(warns[1], /ports is 60/);
});

test("ports, tiles and chips are keyboard buttons", () => {
  const { HaSwitchCard } = loadCard("ha-switch-card.js", ["HaSwitchCard"]);
  const card = new HaSwitchCard();
  card.setConfig({ ports: 2, port_pattern: "sensor.p{n}", status_entity: "sensor.s", traffic_in_entity: "sensor.in" });
  card.hass = { language: "en", states: { "sensor.p1": { state: "up", attributes: {} }, "sensor.s": { state: "x", attributes: {} }, "sensor.in": { state: "1", attributes: {} } } };
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /<g class="port" data-entity="sensor\.p1" role="button" tabindex="0">/);
  assert.match(html, /class="tile" data-entity="sensor\.in" role="button" tabindex="0"/);
  assert.match(html, /class="chip"[^>]*data-entity="sensor\.s" role="button" tabindex="0"/);
});

test("the header icon and the admin link are reachable from the keyboard", () => {
  const { HaSwitchCard } = loadCard("ha-switch-card.js", ["HaSwitchCard"]);
  const card = new HaSwitchCard();
  card.setConfig({ ports: 2, port_pattern: "sensor.p{n}", status_entity: "sensor.s", url: "http://switch.local" });
  card.hass = { language: "en", states: { "sensor.s": { state: "x", attributes: { friendly_name: "Status" } } } };
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /class="ic big"[^>]*data-entity="sensor\.s" role="button" tabindex="0" aria-label="Status"/);
  assert.match(html, /class="device" data-url="http:\/\/switch\.local" role="link" tabindex="0"/);
});

test("the GS308T front panel lines up its ports and their link LEDs", () => {
  const { gs308tSvg, COLORS } = loadCard("ha-switch-card.js", ["gs308tSvg", "COLORS"]);
  const ports = [1, 2, 3, 4, 5, 6].map((n) => ({ n, id: `switch.p${n}`, colors: [n === 4 ? COLORS.red : COLORS.green, "#000"] }));
  const svg = gs308tSvg(ports, COLORS.green, "Port");
  const num = (re) => [...svg.matchAll(re)].map((m) => Number(m[1]));
  const portX = num(/<rect x="([\d.]+)" y="52" width="62" height="44"/g);
  const ledX = num(/<rect x="([\d.]+)" y="42" width="12" height="6"/g);
  assert.equal(portX.length, 8); // the 8 ports are always drawn, ports 7-8 inactive here
  assert.deepEqual(ledX, portX.map((x) => x + 3)); // one LED at the top-left corner of each port
  const steps = portX.slice(1).map((x, i) => x - portX[i]);
  assert.deepEqual(steps, [70, 70, 70, 86, 70, 70, 70]); // even spacing, wider gap between the two groups
  assert.equal((svg.match(/class="port"/g) || []).length, 6); // only configured ports are clickable
  assert.match(svg, /<rect x="363" y="42" width="12" height="6" rx="1" style="fill:#2a2b2e"\/>/); // port 4 down: LED off
});

test("online / idle states: English and French by default, case-insensitive, shown in the card's language", () => {
  const { HaSwitchCard, COLORS } = loadCard("ha-switch-card.js", ["HaSwitchCard", "COLORS"]);
  const show = (state, config = {}, language = "en") => {
    const card = new HaSwitchCard();
    card.setConfig({ ports: 1, port_pattern: "sensor.p{n}", status_entity: "sensor.s", ...config });
    card.hass = { language, states: { "sensor.s": { state, attributes: {} } } };
    return { color: card._statusColor(), html: card.shadowRoot.innerHTML };
  };
  // Existing configs relying on the former French default keep working.
  for (const s of ["En ligne", "en ligne", "Online", "ONLINE"]) assert.equal(show(s).color, COLORS.green, s);
  for (const s of ["Inactif", "idle"]) assert.equal(show(s).color, COLORS.orange, s);
  assert.equal(show("Offline").color, COLORS.red);
  assert.match(show("En ligne").html, /mdi:check-circle[\s\S]*>Online</);
  assert.match(show("online", {}, "fr").html, />En ligne</);
  assert.match(show("idle", {}, "fr").html, />Inactif</);
  // A configured value replaces the defaults.
  assert.equal(show("up", { online_state: "UP" }).color, COLORS.green);
  assert.equal(show("Online", { online_state: "up" }).color, COLORS.red);
});

test("I18N parity: every language has exactly the keys of en, placeholders included", () => {
  const { I18N, HaSwitchCard } = loadCard("ha-switch-card.js", ["I18N", "HaSwitchCard"]);
  const flat = (o, p = "") =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const ref = new Map(flat(I18N.en));
  const placeholders = (s) => String(s).match(/\{\w+\}/g) || [];
  for (const lang of ["fr", "de", "es"]) {
    assert.ok(I18N[lang], lang);
    const entries = new Map(flat(I18N[lang]));
    assert.deepEqual([...entries.keys()].sort(), [...ref.keys()].sort(), lang);
    for (const [k, v] of entries) assert.deepEqual(placeholders(v), placeholders(ref.get(k)), `${lang}.${k}`);
  }
  // The card is drawn in German and Spanish when the dashboard uses them.
  for (const [language, label] of [["de", "Inaktiv"], ["es", "Inactivo"]]) {
    const card = new HaSwitchCard();
    card.setConfig({ ports: 1, port_pattern: "sensor.p{n}", status_entity: "sensor.s" });
    card.hass = { language, states: { "sensor.s": { state: "idle", attributes: {} } } };
    assert.match(card.shadowRoot.innerHTML, new RegExp(`>${label}<`));
  }
});

test("traffic tiles: unavailable reads as Home Assistant shows it, other units are formatted by Home Assistant", () => {
  const { HaSwitchCard } = loadCard("ha-switch-card.js", ["HaSwitchCard"]);
  const card = new HaSwitchCard();
  card.setConfig({ ports: 1, port_pattern: "sensor.p{n}", traffic_in_entity: "sensor.in" });
  card.hass = { language: "en", states: {}, formatEntityState: (st) => (st.state === "unavailable" ? "Unavailable" : `fmt:${st.state}`) };
  const fmt = (state, unit) => card._formatTraffic({ state, attributes: unit ? { unit_of_measurement: unit } : {} });
  assert.equal(fmt("unavailable", "MB"), "Unavailable");
  assert.equal(fmt("1234.56789", "kB/s"), "fmt:1234.56789");
  assert.equal(fmt("2048", "B"), "2.00 KB");
  assert.equal(fmt("2048"), "2.00 KB");
});

test("unavailable / unknown ports, status and connectivity are grey, not red", () => {
  const { HaSwitchCard, COLORS } = loadCard("ha-switch-card.js", ["HaSwitchCard", "COLORS"]);
  for (const state of ["unavailable", "unknown"]) {
    const card = new HaSwitchCard();
    card.setConfig({ ports: 2, port_pattern: "sensor.p{n}", connectivity_entity: "binary_sensor.c" });
    card.hass = { language: "en", states: { "sensor.p1": { state, attributes: {} }, "sensor.p2": { state: "2", attributes: {} }, "binary_sensor.c": { state, attributes: {} } } };
    assert.equal(card._statusColor(), COLORS.grey, state);
    const html = card.shadowRoot.innerHTML;
    assert.match(html, /mdi:help-network-outline/);
    assert.doesNotMatch(html, /mdi:network-off-outline/);
    const ports = [...html.matchAll(/data-entity="sensor\.p\d"[\s\S]*?style="fill:([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ports, [COLORS.grey, COLORS.red], state);

    const card2 = new HaSwitchCard();
    card2.setConfig({ ports: 1, port_pattern: "sensor.p{n}", status_entity: "sensor.s", connectivity_entity: "binary_sensor.c" });
    card2.hass = { language: "en", states: { "sensor.s": { state, attributes: {} }, "binary_sensor.c": { state: "on", attributes: {} } } };
    assert.equal(card2._statusColor(), COLORS.grey, state);
  }
});

test("the power toggle is redrawn from the real state once the service call settles", async () => {
  const { HaSwitchCard } = loadCard("ha-switch-card.js", ["HaSwitchCard"]);
  for (const outcome of ["resolve", "reject"]) {
    const card = new HaSwitchCard();
    const toggle = { checked: false, disabled: false, listeners: [], addEventListener(_, fn) { this.listeners.push(fn); } };
    card.shadowRoot.querySelector = (sel) => (sel === "ha-switch" ? toggle : null);
    card.setConfig({ ports: 1, port_pattern: "sensor.p{n}", switch_entity: "switch.sw" });
    card.hass = {
      language: "en",
      states: { "switch.sw": { state: "off", attributes: {} } },
      callService: () => (outcome === "resolve" ? Promise.resolve() : Promise.reject(new Error("x"))),
    };
    // HA would set it, the switch does not answer: the entity stays off.
    toggle.checked = true;
    toggle.listeners.at(-1)({ target: toggle });
    await new Promise((r) => setImmediate(r));
    assert.equal(toggle.checked, false, outcome);
  }
});

test("language option overrides the Home Assistant language; default helper separator per language", () => {
  const { HaSwitchCard, HaSwitchCardEditor } = loadCard("ha-switch-card.js", ["HaSwitchCard", "HaSwitchCardEditor"]);
  const card = new HaSwitchCard();
  card.setConfig({ ports: 1, port_pattern: "sensor.p{n}", status_entity: "sensor.s", language: "fr" });
  card.hass = { language: "en", states: { "sensor.s": { state: "idle", attributes: {} } } };
  assert.match(card.shadowRoot.innerHTML, />Inactif</);

  const helper = (language, config = { type: "custom:ha-switch-card" }) => {
    const editor = new HaSwitchCardEditor();
    editor.setConfig(config);
    editor.hass = { language, states: {} };
    return editor._form.computeHelper({ name: "ports" });
  };
  assert.equal(helper("en"), "Default: 8");
  assert.equal(helper("de"), "Standard: 8");
  assert.equal(helper("es"), "Predeterminado: 8");
  assert.equal(helper("fr"), "Défaut : 8");
  assert.equal(helper("en", { language: "fr" }), "Défaut : 8");
});

test("non-numeric port overlay positions fall back to their defaults and are reported", () => {
  const { HaSwitchCard, configWarnings } = loadCard("ha-switch-card.js", ["HaSwitchCard", "configWarnings"]);
  const config = { ports: 2, port_pattern: "sensor.p{n}", image: "/local/x.png", port_start: "abc", port_step: "x", port_bottom: "y" };
  const card = new HaSwitchCard();
  card.setConfig(config);
  card.hass = { language: "en", states: {} };
  const html = card.shadowRoot.innerHTML;
  assert.doesNotMatch(html, /NaN/);
  assert.match(html, /left:21%/);
  assert.match(html, /left:31%/);
  assert.match(html, /bottom:39%/);
  assert.equal(configWarnings(config).length, 3);
  assert.equal(configWarnings({ ...config, port_start: 5, port_step: "2.5", port_bottom: 0 }).length, 0);
});

test("the status pill sits on the title line, right of the name; other chips stay under the header", () => {
  const { HaSwitchCard } = loadCard("ha-switch-card.js", ["HaSwitchCard"]);
  const states = {
    "sensor.s": { state: "Online", attributes: {} },
    "binary_sensor.c": { state: "on", attributes: {} },
    "sensor.up": { state: "100", attributes: {} },
  };
  const card = new HaSwitchCard();
  card.setConfig({ ports: 1, port_pattern: "sensor.p{n}", status_entity: "sensor.s", connectivity_entity: "binary_sensor.c", uptime_entity: "sensor.up" });
  card.hass = { language: "en", states };
  const html = card.shadowRoot.innerHTML;
  const [header, body] = html.split('<div class="chips">');
  assert.match(header, /<div class="title-row"><div class="name">Switch<\/div><div class="chip"[^>]*data-entity="sensor\.s"/);
  assert.match(body, /data-entity="binary_sensor\.c"/);
  assert.match(body, /data-entity="sensor\.up"/);
  assert.doesNotMatch(body, /data-entity="sensor\.s"/);
  // Without a status sensor, connectivity is the header pill.
  const card2 = new HaSwitchCard();
  card2.setConfig({ ports: 1, port_pattern: "sensor.p{n}", connectivity_entity: "binary_sensor.c" });
  card2.hass = { language: "en", states };
  assert.match(card2.shadowRoot.innerHTML, /<div class="title-row"><div class="name">Switch<\/div><div class="chip"[^>]*data-entity="binary_sensor\.c"/);
  assert.doesNotMatch(card2.shadowRoot.innerHTML, /class="chips"/);
});
