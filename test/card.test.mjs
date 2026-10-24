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
