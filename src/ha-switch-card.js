/**
 * ha-switch — custom Lovelace card for Home Assistant
 * Displays a managed network switch (SNMP): status, uptime, port states, traffic.
 * Pure JavaScript, no dependencies (no mushroom / card-mod / button-card required).
 */
const VERSION = '__VERSION__';

const I18N = {
  fr: {
    card_name: 'Carte switch réseau',
    card_desc: 'Affiche l’état d’un switch réseau : statut, uptime, ports et trafic.',
    in: 'Trafic entrant',
    out: 'Trafic sortant',
    port: 'Port',
    default: 'Défaut',
    sections: {
      general: 'Général',
      entities: 'Entités',
      ports: 'Ports',
      status: 'Statut',
      appearance: 'Apparence',
    },
    fields: {
      name: 'Nom',
      subtitle: 'Sous-titre',
      icon: 'Icône',
      url: 'URL d’administration (clic sur l’image)',
      switch_entity: 'Interrupteur (alimentation)',
      status_entity: 'Statut global',
      connectivity_entity: 'Connectivité',
      uptime_entity: 'Uptime',
      uptime_unit: 'Unité de l’uptime',
      traffic_in_entity: 'Trafic entrant',
      traffic_out_entity: 'Trafic sortant',
      ports: 'Nombre de ports',
      port_pattern: 'Modèle d’entité des ports ({n} = numéro)',
      port_on_state: 'État « port actif »',
      online_state: 'État « en ligne »',
      idle_state: 'État « inactif »',
      model: 'Modèle (façade dessinée)',
      image: 'Image personnalisée (remplace le modèle)',
      port_start: 'Position du 1er port (%)',
      port_step: 'Écart entre ports (%)',
      port_bottom: 'Hauteur des ports (% depuis le bas)',
    },
    units: { timeticks: 'Centièmes de seconde (SNMP)', seconds: 'Secondes' },
    day: 'j',
    generic: 'Générique',
    open_admin: 'Ouvrir la page d’administration',
    online: 'En ligne',
    idle: 'Inactif',
  },
  en: {
    card_name: 'Network switch card',
    card_desc: 'Shows a network switch: status, uptime, ports and traffic.',
    in: 'Incoming traffic',
    out: 'Outgoing traffic',
    port: 'Port',
    default: 'Default',
    sections: {
      general: 'General',
      entities: 'Entities',
      ports: 'Ports',
      status: 'Status',
      appearance: 'Appearance',
    },
    fields: {
      name: 'Name',
      subtitle: 'Subtitle',
      icon: 'Icon',
      url: 'Admin URL (tap on image)',
      switch_entity: 'Power switch',
      status_entity: 'Global status',
      connectivity_entity: 'Connectivity',
      uptime_entity: 'Uptime',
      uptime_unit: 'Uptime unit',
      traffic_in_entity: 'Incoming traffic',
      traffic_out_entity: 'Outgoing traffic',
      ports: 'Number of ports',
      port_pattern: 'Port entity pattern ({n} = number)',
      port_on_state: '"Port up" state',
      online_state: '"Online" state',
      idle_state: '"Idle" state',
      model: 'Model (drawn front panel)',
      image: 'Custom image (overrides model)',
      port_start: 'First port position (%)',
      port_step: 'Spacing between ports (%)',
      port_bottom: 'Port height (% from bottom)',
    },
    units: { timeticks: 'Hundredths of a second (SNMP)', seconds: 'Seconds' },
    day: 'd',
    generic: 'Generic',
    open_admin: 'Open the admin page',
    online: 'Online',
    idle: 'Idle',
  },
};

const DEFAULTS = {
  name: 'Switch',
  icon: 'mdi:switch',
  ports: 8,
  port_pattern: 'sensor.switch_port_{n}_status',
  port_on_state: '1',
  uptime_unit: 'timeticks',
  model: 'generic',
  port_start: 21,
  port_step: 10,
  port_bottom: 39,
};

// Values of `status_entity` meaning online / idle when `online_state` / `idle_state` are not set: the English
// and French ones (1.x defaulted to the French `En ligne` / `Inactif`, which still match). Compared case-insensitively.
const STATUS_DEFAULTS = {
  online_state: ['Online', 'En ligne'],
  idle_state: ['Idle', 'Inactif'],
};

// Whether a status state is the configured `online_state` / `idle_state` (or one of its defaults).
const statusIs = (state, config, key) => {
  if (state == null) return false;
  const norm = (v) => String(v).trim().toLowerCase();
  const wanted = config[key] != null && config[key] !== '' ? [config[key]] : STATUS_DEFAULTS[key];
  return wanted.some((v) => norm(v) === norm(state));
};

// Theme colors with the Home Assistant defaults as fallbacks, like the other juju35 cards.
const COLORS = {
  green: 'var(--success-color, #43a047)',
  orange: 'var(--warning-color, #ffa600)',
  red: 'var(--error-color, #db4437)',
  blue: 'var(--info-color, #039be5)',
  grey: 'var(--disabled-text-color, #9e9e9e)',
  neutral: 'var(--secondary-text-color, #727272)',
};

// Darker shade of a port color, for its contacts and LEDs.
const shade = (color) => `color-mix(in srgb, ${color} 45%, #000)`;

const getLang = (hass) => {
  const l = (hass?.locale?.language || hass?.language || navigator.language || 'en').slice(0, 2);
  return I18N[l] ? l : 'en';
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Admin URLs opened on a tap: only http(s) and same-origin relative paths, never javascript:/data: from a YAML config.
const isSafeUrl = (url) => /^https?:\/\//i.test(url) || String(url).startsWith('/');

const formatBytes = (v) => {
  if (!Number.isFinite(v)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

const formatUptime = (raw, unit, day = 'd') => {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return '—';
  const t = unit === 'seconds' ? n : Math.floor(n / 100);
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${d > 0 ? `${d}${day} ` : ''}${h}h ${m}min`;
};

const portSvg = (color, dark) => `
  <svg viewBox="0 0 27 25" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="4" width="25" height="20" rx="2" style="fill:${color}"/>
    <rect x="10" y="1" width="6" height="5" rx="1" style="fill:${color}"/>
    ${[4, 8, 12, 16].map((x) => `<rect x="${x}" y="8" width="2" height="10" rx="0.5" style="fill:${dark}" opacity="0.6"/>`).join('')}
  </svg>`;

/**
 * Netgear GS308T (S350) front panel, drawn as SVG: black chassis, power LED and reset on the left,
 * two groups of four ports in a silver bezel, each port with its link LED at the top-left corner.
 * The ports and LEDs are laid out on one grid, so they always line up whatever the card width.
 */
const GS308T = { H: 150, CELL: 62, GAP: 8, GROUP_GAP: 16, X0: 150, BEZEL_Y: 38, PORT_Y: 52, PORT_H: 44 };
const gs308tSvg = (ports, powerColor, portLabel) => {
  const g = GS308T;
  const portX = (i) => g.X0 + i * (g.CELL + g.GAP) + (i >= 4 ? g.GROUP_GAP : 0);
  const groupW = 4 * g.CELL + 3 * g.GAP;
  const right = portX(7) + g.CELL + 8; // right edge of the second bezel
  const W = right + 18;
  const bezel = [0, 4]
    .map((i) => `<rect x="${portX(i) - 8}" y="${g.BEZEL_Y}" width="${groupW + 16}" height="${g.PORT_Y + g.PORT_H + 8 - g.BEZEL_Y}" rx="3" fill="url(#ng-bezel)"/>`)
    .join('');
  const slots = Array.from({ length: 8 }, (_, i) => {
    const p = ports[i];
    const [col, dark] = p ? p.colors : [COLORS.grey, '#555'];
    const led = !p || col === COLORS.grey ? '#5f6368' : col === COLORS.green ? COLORS.green : '#2a2b2e';
    const x = portX(i);
    const y = g.PORT_Y;
    const cx = x + g.CELL / 2;
    const contacts = Array.from({ length: 8 }, (_, k) => `<rect x="${cx - 15 + k * 4}" y="${y + 16}" width="2" height="12" style="fill:${dark}" opacity="0.8"/>`).join('');
    const body = `
          <rect x="${x}" y="${y}" width="${g.CELL}" height="${g.PORT_H}" rx="2" fill="#0d0e10"/>
          <path d="M${x + 6} ${y + 6} h${g.CELL - 12} v${g.PORT_H - 16} h-16 v6 h-${g.CELL - 44} v-6 h-16 z" style="fill:${col}"/>
          ${contacts}
          <rect x="${x + 3}" y="${g.BEZEL_Y + 4}" width="12" height="6" rx="1" style="fill:${led}"/>
          ${led === COLORS.green ? `<rect x="${x + 1}" y="${g.BEZEL_Y + 2}" width="16" height="10" rx="2" style="fill:${led}" opacity="0.3"/>` : ''}
          <text x="${cx}" y="${g.PORT_Y + g.PORT_H + 30}" text-anchor="middle" font-size="13" fill="#d6d6d6">${i + 1}</text>`;
    return p
      ? `<g class="port" data-entity="${esc(p.id)}" role="button" tabindex="0"><title>${esc(portLabel)} ${p.n}</title>${body}</g>`
      : `<g>${body}</g>`;
  }).join('');
  return `
    <svg viewBox="0 0 ${W} ${g.H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Netgear GS308T">
      <defs>
        <linearGradient id="ng-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2b2c2f"/><stop offset=".12" stop-color="#1b1c1e"/><stop offset="1" stop-color="#141517"/>
        </linearGradient>
        <linearGradient id="ng-bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e4e6e8"/><stop offset="1" stop-color="#a7abb0"/>
        </linearGradient>
      </defs>
      <rect x="18" y="136" width="44" height="10" rx="2" fill="#0b0b0c"/>
      <rect x="${W - 62}" y="136" width="44" height="10" rx="2" fill="#0b0b0c"/>
      <rect x="2" y="4" width="${W - 4}" height="134" rx="6" fill="url(#ng-body)"/>
      <rect x="2" y="4" width="${W - 4}" height="6" rx="3" fill="#ffffff" opacity="0.07"/>
      <text x="26" y="34" font-size="17" font-weight="700" letter-spacing="1.5" fill="#f2f2f2" font-family="Arial, Helvetica, sans-serif">NETGEAR</text>
      <text x="44" y="48" font-size="9" fill="#d0d0d0" font-family="Arial, Helvetica, sans-serif">S350 Series</text>
      <text x="${(g.X0 + right) / 2}" y="28" text-anchor="middle" font-size="10" fill="#e6e6e6" font-family="Arial, Helvetica, sans-serif">Green=1000M, Yellow=100M/10M, Blink=ACT</text>
      <text x="${right}" y="30" text-anchor="end" font-size="17" font-weight="700" fill="#f2f2f2" font-family="Arial, Helvetica, sans-serif">GS308T</text>
      <text x="44" y="80" text-anchor="middle" font-size="9" fill="#d0d0d0" font-family="Arial, Helvetica, sans-serif">Power</text>
      <rect x="35" y="88" width="18" height="8" rx="2" fill="#3a3b3e"/>
      <rect x="37" y="90" width="14" height="4" rx="1" style="fill:${powerColor}"/>
      <rect x="31" y="84" width="26" height="16" rx="4" style="fill:${powerColor}" opacity="0.18"/>
      <text x="100" y="80" text-anchor="middle" font-size="9" fill="#d0d0d0" font-family="Arial, Helvetica, sans-serif">Reset</text>
      <circle cx="100" cy="92" r="4.5" fill="#0b0b0c" stroke="#3a3b3e" stroke-width="1.5"/>
      ${bezel}
      ${slots}
    </svg>`;
};

/**
 * Embedded device models: drawn front panel with a fixed number of ports.
 */
const MODELS = {
  gs308t: { label: 'Netgear GS308T (S350)', ports: 8, svg: gs308tSvg },
};

/**
 * Built-in front panel of a desktop switch, drawn as SVG.
 * Up to 12 ports on one row; beyond, odd ports on top and even ports below (like real switches).
 */
const chassisSvg = (ports, powerColor, portLabel) => {
  const rows = ports.length > 12 ? 2 : 1;
  const perRow = Math.ceil(ports.length / rows);
  const PW = 50; // port slot width
  const X0 = 176; // first port slot
  const W = X0 + perRow * PW + 18;
  const H = rows === 1 ? 112 : 172;
  const rowY = rows === 1 ? [30] : [26, 86];

  const vents = Array.from({ length: 6 }, (_, i) =>
    `<rect x="${22 + i * 14}" y="${H / 2 - 22}" width="6" height="44" rx="3" class="hs-vent"/>`
  ).join('');

  const slots = ports
    .map(({ n, id, colors: [col, dark] }, i) => {
      const row = rows === 2 ? i % 2 : 0;
      const colIdx = rows === 2 ? Math.floor(i / 2) : i;
      const x = X0 + colIdx * PW;
      const y = rowY[row];
      const contacts = [0, 1, 2, 3, 4, 5, 6, 7]
        .map((k) => `<rect x="${x + 8 + k * 3.6}" y="${y + 9}" width="1.8" height="7" style="fill:${dark}" opacity="0.75"/>`)
        .join('');
      const labelY = rows === 2 && row === 0 ? y - 6 : y + 52;
      return `
        <g class="port" data-entity="${esc(id)}" role="button" tabindex="0">
          <title>${esc(portLabel)} ${n}</title>
          <rect x="${x - 2}" y="${y - 2}" width="44" height="40" rx="4" class="hs-slot"/>
          <path d="M${x} ${y + 6} h10 v-6 h20 v6 h10 v28 h-40 z" style="fill:${col}"/>
          ${contacts}
          <rect x="${x + 4}" y="${y + 26}" width="8" height="4" rx="1" style="fill:${dark}" opacity="0.8"/>
          <rect x="${x + 28}" y="${y + 26}" width="8" height="4" rx="1" style="fill:${dark}" opacity="0.8"/>
          <text x="${x + 20}" y="${labelY}" text-anchor="middle" font-size="11" class="hs-label">${n}</text>
        </g>`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
      <defs>
        <linearGradient id="hs-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:var(--hs-body-top)"/>
          <stop offset="1" style="stop-color:var(--hs-body-bottom)"/>
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10" fill="url(#hs-body)" class="hs-edge" stroke-width="2"/>
      <rect x="6" y="5" width="${W - 12}" height="2" rx="1" fill="#ffffff" opacity="0.08"/>
      ${vents}
      <circle cx="132" cy="${H / 2 - 6}" r="5" style="fill:${powerColor}"/>
      <circle cx="132" cy="${H / 2 - 6}" r="9" style="fill:${powerColor}" opacity="0.25"/>
      <text x="132" y="${H / 2 + 18}" text-anchor="middle" font-size="10" class="hs-label">PWR</text>
      <rect x="156" y="14" width="1.5" height="${H - 28}" class="hs-divider"/>
      ${slots}
    </svg>`;
};

// Port count shared by the drawing and the watched entities: 8 when `ports` is not a number.
function portCount(c) {
  return Math.max(1, Number(c.ports) || 8);
}

// Config mistakes the editor prevents but YAML allows.
// Each message is logged once per page: HA calls setConfig on the preview at every keystroke in the editor.
const warned = new Set();
function configWarnings(c) {
  const out = [];
  const count = portCount(c);
  if (count > 1 && !String(c.port_pattern || '').includes('{n}')) out.push('port_pattern has no {n}: every port shows the same entity');
  if (count > 52) out.push(`ports is ${count}, above the 52 the editor allows`);
  const m = !c.image && MODELS[c.model];
  if (m && count > m.ports) out.push(`model ${c.model} draws ${m.ports} ports; ports ${m.ports + 1} to ${count} are not shown`);
  return out;
}

// Identifies a focusable element across renders (the header icon and a chip can share an entity).
const focusKey = (el) =>
  el?.getAttribute?.('tabindex') != null
    ? [el.getAttribute('class'), el.getAttribute('data-entity'), el.getAttribute('data-url')].join('|')
    : '';

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */
class HaSwitchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._key = '';
    this.shadowRoot.addEventListener('click', (ev) => this._onClick(ev));
    // Ports, tiles, chips, the header icon and the admin link are focusable: Enter or Space opens them like a click.
    this.shadowRoot.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      if (!ev.composedPath().some((el) => ['button', 'link'].includes(el.getAttribute?.('role')))) return;
      ev.preventDefault();
      this._onClick(ev);
    });
  }

  static getConfigElement() {
    return document.createElement('ha-switch-card-editor');
  }

  static getStubConfig(hass) {
    const sw = Object.keys(hass?.states || {}).find((e) => e.startsWith('switch.'));
    return { name: 'Switch', ...(sw ? { switch_entity: sw } : {}) };
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    this._config = { ...DEFAULTS, ...config };
    // Configs the editor would not produce: warn, but still draw the card as before.
    for (const msg of configWarnings(this._config)) {
      if (warned.has(msg)) continue;
      warned.add(msg);
      console.warn(`ha-switch-card: ${msg}`);
    }
    this._key = '';
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 5;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  /* --- helpers --- */
  _state(id) {
    return id ? this._hass?.states?.[id] : undefined;
  }

  _portEntity(n) {
    return this._config.port_pattern.replace('{n}', n);
  }

  // Ports drawn and watched: the same count, 8 when `ports` is not a number.
  _portCount() {
    return portCount(this._config);
  }

  _watched() {
    const c = this._config;
    const ids = [c.switch_entity, c.status_entity, c.connectivity_entity, c.uptime_entity, c.traffic_in_entity, c.traffic_out_entity];
    for (let n = 1; n <= this._portCount(); n++) ids.push(this._portEntity(n));
    return ids.filter(Boolean);
  }

  _statusColor() {
    const c = this._config;
    const st = this._state(c.status_entity);
    if (st) {
      if (statusIs(st.state, c, 'online_state')) return COLORS.green;
      if (statusIs(st.state, c, 'idle_state')) return COLORS.orange;
      return COLORS.red;
    }
    const con = this._state(c.connectivity_entity);
    if (con) return con.state === 'on' ? COLORS.green : COLORS.red;
    return COLORS.grey;
  }

  _formatState(st) {
    if (!st) return '—';
    return this._hass.formatEntityState ? this._hass.formatEntityState(st) : st.state;
  }

  _formatTraffic(st) {
    if (!st) return '—';
    const unit = st.attributes?.unit_of_measurement;
    if (unit && !['B', 'bytes', 'octets', 'o'].includes(unit)) return `${st.state} ${unit}`;
    return formatBytes(parseFloat(st.state));
  }

  _moreInfo(entityId) {
    const ev = new Event('hass-more-info', { bubbles: true, composed: true });
    ev.detail = { entityId };
    this.dispatchEvent(ev);
  }

  _onClick(ev) {
    const path = ev.composedPath();
    if (path.some((el) => el.tagName === 'HA-SWITCH')) return;
    const target = path.find((el) => el.dataset && (el.dataset.entity || el.dataset.url));
    if (!target) return;
    if (target.dataset.entity) this._moreInfo(target.dataset.entity);
    else if (target.dataset.url && isSafeUrl(target.dataset.url)) window.open(target.dataset.url, '_blank', 'noopener');
  }

  /* --- render --- */
  _render() {
    if (!this._config || !this._hass) return;
    const key =
      getLang(this._hass) +
      JSON.stringify(this._config) +
      this._watched().map((id) => this._state(id)?.state ?? '').join('|');
    if (key === this._key) return;
    this._key = key;

    const c = this._config;
    const t = I18N[getLang(this._hass)];
    const statusColor = this._statusColor();
    const sw = this._state(c.switch_entity);
    const headerEntity = c.status_entity || c.connectivity_entity || c.switch_entity;

    /* chips */
    const chips = [];
    const con = this._state(c.connectivity_entity);
    if (c.connectivity_entity) {
      const on = con?.state === 'on';
      chips.push(this._chip(c.connectivity_entity, on ? 'mdi:network-outline' : 'mdi:network-off-outline', on ? COLORS.green : COLORS.red, this._formatState(con)));
    }
    const st = this._state(c.status_entity);
    if (c.status_entity) {
      // Online / idle read in the card's language, whatever the sensor reports; any other state as Home Assistant shows it.
      const online = statusIs(st?.state, c, 'online_state');
      const idle = !online && statusIs(st?.state, c, 'idle_state');
      const icon = online ? 'mdi:check-circle' : idle ? 'mdi:minus-circle' : 'mdi:alert-circle';
      chips.push(this._chip(c.status_entity, icon, statusColor, online ? t.online : idle ? t.idle : this._formatState(st)));
    }
    if (c.uptime_entity) {
      chips.push(this._chip(c.uptime_entity, 'mdi:clock-outline', COLORS.neutral, formatUptime(this._state(c.uptime_entity)?.state, c.uptime_unit, t.day)));
    }

    /* ports */
    const count = this._portCount();
    const portInfo = [];
    for (let n = 1; n <= count; n++) {
      const id = this._portEntity(n);
      const ps = this._state(id);
      const up = ps?.state === String(c.port_on_state);
      const color = !ps ? COLORS.grey : up ? COLORS.green : COLORS.red;
      portInfo.push({ n, id, colors: [color, shade(color)] });
    }
    const urlAttr = c.url ? `data-url="${esc(c.url)}" role="link" tabindex="0" aria-label="${esc(t.open_admin)}"` : '';
    let device;
    if (c.image) {
      const ports = portInfo.map(
        ({ n, id, colors }) =>
          `<div class="port" style="left:${Number(c.port_start) + (n - 1) * Number(c.port_step)}%" data-entity="${esc(id)}" role="button" tabindex="0" title="${t.port} ${n}">${portSvg(...colors)}</div>`
      );
      device = `<div class="device img" ${urlAttr}>
           <img src="${esc(c.image)}" alt="">
           <div class="ports abs" style="bottom:${Number(c.port_bottom)}%">${ports.join('')}</div>
         </div>`;
    } else if (MODELS[c.model]) {
      const m = MODELS[c.model];
      device = `<div class="device" ${urlAttr}>${m.svg(portInfo, statusColor, t.port)}</div>`;
    } else {
      device = `<div class="device" ${urlAttr}>${chassisSvg(portInfo, statusColor, t.port)}</div>`;
    }

    /* traffic */
    const tile = (id, icon, color, label) =>
      id
        ? `<div class="tile" data-entity="${esc(id)}" role="button" tabindex="0">
             <div class="ic" style="--c:${color}"><ha-icon icon="${icon}"></ha-icon></div>
             <div class="txt"><div class="k">${label}</div><div class="v">${esc(this._formatTraffic(this._state(id)))}</div></div>
           </div>`
        : '';
    const traffic = tile(c.traffic_in_entity, 'mdi:arrow-down-bold', COLORS.green, t.in) + tile(c.traffic_out_entity, 'mdi:arrow-up-bold', COLORS.blue, t.out);

    const focused = focusKey(this.shadowRoot.activeElement);
    this.shadowRoot.innerHTML = `
      <style>${HaSwitchCard.styles}</style>
      <ha-card>
        <div class="header">
          <div class="ic big" style="--c:${statusColor}" ${headerEntity ? `data-entity="${esc(headerEntity)}" role="button" tabindex="0" aria-label="${esc(this._state(headerEntity)?.attributes?.friendly_name || headerEntity)}"` : ''}>
            <ha-icon icon="${esc(c.icon)}"></ha-icon>
          </div>
          <div class="titles">
            <div class="name">${esc(c.name)}</div>
            ${c.subtitle ? `<div class="sub">${esc(c.subtitle)}</div>` : ''}
          </div>
          ${sw ? `<ha-switch></ha-switch>` : ''}
        </div>
        ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
        ${device}
        ${traffic ? `<div class="traffic">${traffic}</div>` : ''}
      </ha-card>`;

    // innerHTML replaced the focused element: focus its counterpart so keyboard navigation keeps its place.
    if (focused) {
      const again = [...this.shadowRoot.querySelectorAll('[tabindex]')].find((el) => focusKey(el) === focused);
      again?.focus({ preventScroll: true });
    }

    const toggle = this.shadowRoot.querySelector('ha-switch');
    if (toggle && sw) {
      toggle.checked = sw.state === 'on';
      toggle.disabled = sw.state === 'unavailable';
      toggle.addEventListener('change', (ev) => {
        const [domain] = c.switch_entity.split('.');
        this._hass.callService(domain, ev.target.checked ? 'turn_on' : 'turn_off', { entity_id: c.switch_entity });
      });
    }
  }

  _chip(entity, icon, color, content) {
    return `<div class="chip" style="--c:${color}" data-entity="${esc(entity)}" role="button" tabindex="0">
      <ha-icon icon="${icon}"></ha-icon><span>${esc(content)}</span>
    </div>`;
  }

  static get styles() {
    return `
      :host {
        --hs-body-top: color-mix(in srgb, var(--primary-text-color, #212121) 24%, var(--card-background-color, #fff));
        --hs-body-bottom: color-mix(in srgb, var(--primary-text-color, #212121) 14%, var(--card-background-color, #fff));
        --hs-dark: color-mix(in srgb, var(--primary-text-color, #212121) 45%, var(--card-background-color, #fff));
      }
      ha-card { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
      [data-entity], [data-url] { cursor: pointer; }
      /* The body starts 8px under the header (the card gap is 10px between body blocks). */
      .header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; margin-bottom: -2px; }
      .ic {
        --size: 32px;
        width: var(--size); height: var(--size); border-radius: 50%;
        display: flex; align-items: center; justify-content: center; flex: none;
        color: var(--c); background: color-mix(in srgb, var(--c) 15%, transparent);
      }
      .ic.big { --size: 40px; --mdc-icon-size: 24px; background: color-mix(in srgb, var(--c) 16%, transparent); }
      .titles { min-width: 0; }
      .name { font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      ha-switch {
        --switch-checked-color: var(--success-color, #43a047);
        --switch-checked-button-color: #fff;
        --switch-checked-track-color: var(--success-color, #43a047);
        --switch-unchecked-button-color: #fff;
        --switch-unchecked-track-color: var(--error-color, #db4437);
        --ha-switch-checked-background-color: var(--success-color, #43a047);
        --ha-switch-checked-thumb-background-color: #fff;
        --ha-switch-checked-border-color: var(--success-color, #43a047);
        --ha-switch-background-color: var(--error-color, #db4437);
        --ha-switch-thumb-background-color: #fff;
        --ha-switch-border-color: var(--error-color, #db4437);
      }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .chip {
        display: inline-flex; align-items: center; gap: 6px; padding: 1px 8px 1px 5px;
        border-radius: 12px; font-size: 11px; font-weight: 500;
        background: color-mix(in srgb, var(--c) 15%, transparent); color: var(--c);
        --mdc-icon-size: 14px;
      }
      .chip ha-icon { --mdc-icon-size: 13px; }
      .device { position: relative; width: 100%; border-radius: 10px; overflow: hidden; }
      .device img { width: 100%; display: block; }
      .device svg { width: 100%; height: auto; display: block; }
      .device svg .port:hover { filter: brightness(1.15); }
      .hs-edge { stroke: var(--hs-dark); }
      .hs-vent, .hs-slot, .hs-divider { fill: var(--hs-dark); }
      .hs-label { fill: var(--secondary-text-color, #727272); font-family: inherit; }
      .ports.abs { position: absolute; left: 0; width: 100%; height: 27px; }
      .ports.abs .port { position: absolute; top: 50%; transform: translate(-50%, -50%); }
      .port { width: 27px; line-height: 0; }
      .port svg { width: 100%; height: auto; }
      .traffic { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px; }
      .tile { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px; min-width: 0;
              background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .tile .ic { --mdc-icon-size: 20px; }
      .tile .txt { min-width: 0; }
      .tile .k { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tile .v { font-size: 14px; font-weight: 500; color: var(--primary-text-color); }
    `;
  }
}

/* ------------------------------------------------------------------ */
/* Visual editor                                                       */
/* ------------------------------------------------------------------ */
class HaSwitchCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    const prevLang = this._hass ? getLang(this._hass) : null;
    this._hass = hass;
    // Only a language change needs new labels: otherwise hand the new hass to the form and keep it as is.
    if (this._form && prevLang === getLang(hass)) {
      this._form.hass = hass;
      return;
    }
    this._render();
  }

  _schema(t) {
    return [
      { name: 'name', selector: { text: {} } },
      { name: 'subtitle', selector: { text: {} } },
      { name: 'icon', selector: { icon: {} } },
      {
        type: 'expandable', name: 'entities', flatten: true, title: t.sections.entities, icon: 'mdi:format-list-bulleted',
        schema: [
          { name: 'switch_entity', selector: { entity: { domain: ['switch', 'input_boolean'] } } },
          { name: 'status_entity', selector: { entity: {} } },
          { name: 'connectivity_entity', selector: { entity: { domain: 'binary_sensor' } } },
          { name: 'uptime_entity', selector: { entity: { domain: 'sensor' } } },
          { name: 'traffic_in_entity', selector: { entity: { domain: 'sensor' } } },
          { name: 'traffic_out_entity', selector: { entity: { domain: 'sensor' } } },
        ],
      },
      {
        type: 'expandable', name: 'ports_section', flatten: true, title: t.sections.ports, icon: 'mdi:ethernet',
        schema: [
          { name: 'ports', selector: { number: { min: 1, max: 52, mode: 'box' } } },
          { name: 'port_pattern', selector: { text: {} } },
          { name: 'port_on_state', selector: { text: {} } },
        ],
      },
      {
        type: 'expandable', name: 'status_section', flatten: true, title: t.sections.status, icon: 'mdi:check-circle-outline',
        schema: [
          {
            type: 'grid', name: '', schema: [
              { name: 'online_state', selector: { text: {} } },
              { name: 'idle_state', selector: { text: {} } },
            ],
          },
          {
            name: 'uptime_unit',
            selector: {
              select: {
                mode: 'dropdown',
                options: [
                  { value: 'timeticks', label: t.units.timeticks },
                  { value: 'seconds', label: t.units.seconds },
                ],
              },
            },
          },
        ],
      },
      {
        type: 'expandable', name: 'appearance_section', flatten: true, title: t.sections.appearance, icon: 'mdi:palette',
        schema: [
          {
            name: 'model',
            selector: {
              select: {
                mode: 'dropdown',
                options: [
                  { value: 'generic', label: t.generic },
                  ...Object.entries(MODELS).map(([value, m]) => ({ value, label: m.label })),
                ],
              },
            },
          },
          { name: 'image', selector: { text: {} } },
          {
            type: 'grid', name: '', schema: [
              { name: 'port_start', selector: { number: { min: 0, max: 100, step: 0.5, mode: 'box' } } },
              { name: 'port_step', selector: { number: { min: 0, max: 100, step: 0.5, mode: 'box' } } },
              { name: 'port_bottom', selector: { number: { min: 0, max: 100, step: 0.5, mode: 'box' } } },
            ],
          },
          { name: 'url', selector: { text: { type: 'url' } } },
        ],
      },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    const t = I18N[getLang(this._hass)];
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.addEventListener('value-changed', (ev) => {
        ev.stopPropagation();
        const config = { ...ev.detail.value };
        Object.keys(config).forEach((k) => {
          if (config[k] === '' || config[k] === undefined) delete config[k];
        });
        this._config = config;
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = this._schema(t);
    this._form.computeLabel = (s) => t.fields[s.name] ?? s.name;
    this._form.computeHelper = (s) => {
      const def = DEFAULTS[s.name] ?? STATUS_DEFAULTS[s.name]?.join(' / ');
      return def !== undefined ? `${t.default} : ${def}` : undefined;
    };
  }
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */
if (!customElements.get('ha-switch-card')) customElements.define('ha-switch-card', HaSwitchCard);
if (!customElements.get('ha-switch-card-editor')) customElements.define('ha-switch-card-editor', HaSwitchCardEditor);

const _t = I18N[getLang()];
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'ha-switch-card')) {
  window.customCards.push({
    type: 'ha-switch-card',
    name: _t.card_name,
    description: _t.card_desc,
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-switch-card',
  });
}

console.info(`%c HA-SWITCH-CARD %c v${VERSION} `, 'color:#fff;background:#43a047;font-weight:700', 'color:#43a047;background:#fff');
