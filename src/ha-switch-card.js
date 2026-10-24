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
      model: 'Modèle (image embarquée)',
      image: 'Image personnalisée (remplace le modèle)',
      port_start: 'Position du 1er port (%)',
      port_step: 'Écart entre ports (%)',
      port_bottom: 'Hauteur des ports (% depuis le bas)',
    },
    units: { timeticks: 'Centièmes de seconde (SNMP)', seconds: 'Secondes' },
    day: 'j',
    generic: 'Générique',
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
      model: 'Model (embedded image)',
      image: 'Custom image (overrides model)',
      port_start: 'First port position (%)',
      port_step: 'Spacing between ports (%)',
      port_bottom: 'Port height (% from bottom)',
    },
    units: { timeticks: 'Hundredths of a second (SNMP)', seconds: 'Seconds' },
    day: 'd',
    generic: 'Generic',
  },
};

const DEFAULTS = {
  name: 'Switch',
  icon: 'mdi:switch',
  ports: 8,
  port_pattern: 'sensor.switch_port_{n}_status',
  port_on_state: '1',
  online_state: 'En ligne',
  idle_state: 'Inactif',
  uptime_unit: 'timeticks',
  model: 'generic',
  port_start: 21,
  port_step: 10,
  port_bottom: 39,
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
 * Embedded device models: photo + calibrated port positions (% of image width / height).
 */
const MODELS = {
  gs308t: {
    label: 'Netgear GS308T (S350)',
    ports: 8,
    positions: [21.0, 30.9, 40.9, 50.8, 61.4, 71.3, 81.2, 91.1],
    top: 45,
    size: 4.6,
    image:
      'data:image/webp;base64,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',
  },
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
function configWarnings(c) {
  const out = [];
  const count = portCount(c);
  if (count > 1 && !String(c.port_pattern || '').includes('{n}')) out.push('port_pattern has no {n}: every port shows the same entity');
  if (count > 52) out.push(`ports is ${count}, above the 52 the editor allows`);
  const m = !c.image && MODELS[c.model];
  if (m && count > m.positions.length) out.push(`model ${c.model} draws ${m.positions.length} ports; ports ${m.positions.length + 1} to ${count} are not shown`);
  return out;
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */
class HaSwitchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._key = '';
    this.shadowRoot.addEventListener('click', (ev) => this._onClick(ev));
    // Ports, tiles and chips are focusable: Enter or Space opens them like a click.
    this.shadowRoot.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      if (!ev.composedPath().some((el) => el.getAttribute?.('role') === 'button')) return;
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
    for (const msg of configWarnings(this._config)) console.warn(`ha-switch-card: ${msg}`);
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
      if (st.state === c.online_state) return COLORS.green;
      if (st.state === c.idle_state) return COLORS.orange;
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
    else if (target.dataset.url) window.open(target.dataset.url, '_blank', 'noopener');
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
      const icon = st?.state === c.online_state ? 'mdi:check-circle' : st?.state === c.idle_state ? 'mdi:minus-circle' : 'mdi:alert-circle';
      chips.push(this._chip(c.status_entity, icon, statusColor, st?.state ?? '—'));
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
    const urlAttr = c.url ? `data-url="${esc(c.url)}"` : '';
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
      const ports = portInfo.map(({ n, id, colors }) => {
        const left = m.positions[n - 1];
        if (left === undefined) return '';
        return `<div class="port" style="left:${left}%;top:${m.top}%;width:${m.size}%" data-entity="${esc(id)}" role="button" tabindex="0" title="${t.port} ${n}">${portSvg(...colors)}</div>`;
      });
      device = `<div class="device img" ${urlAttr}>
           <img src="${m.image}" alt="${esc(m.label)}">
           <div class="ports model">${ports.join('')}</div>
         </div>`;
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

    this.shadowRoot.innerHTML = `
      <style>${HaSwitchCard.styles}</style>
      <ha-card>
        <div class="header">
          <div class="ic big" style="--c:${statusColor}" ${headerEntity ? `data-entity="${esc(headerEntity)}"` : ''}>
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
      .header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; }
      .ic {
        --size: 32px;
        width: var(--size); height: var(--size); border-radius: 50%;
        display: flex; align-items: center; justify-content: center; flex: none;
        color: var(--c); background: color-mix(in srgb, var(--c) 15%, transparent);
      }
      .ic.big { --size: 36px; --mdc-icon-size: 22px; }
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
      .ports.model { position: absolute; inset: 0; }
      .ports.model .port { position: absolute; transform: translate(-50%, -50%); }
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
    this._form.computeHelper = (s) => (DEFAULTS[s.name] !== undefined ? `${t.default} : ${DEFAULTS[s.name]}` : undefined);
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
    documentationURL: 'https://github.com/juju35/ha-switch',
  });
}

console.info(`%c HA-SWITCH-CARD %c v${VERSION} `, 'color:#fff;background:#43a047;font-weight:700', 'color:#43a047;background:#fff');
