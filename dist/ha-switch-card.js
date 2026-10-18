/**
 * ha-switch — custom Lovelace card for Home Assistant
 * Displays a managed network switch (SNMP): status, uptime, port states, traffic.
 * Pure JavaScript, no dependencies (no mushroom / card-mod / button-card required).
 */
const VERSION = '1.0.0';

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
      image: 'Image du switch',
      port_start: 'Position du 1er port (%)',
      port_step: 'Écart entre ports (%)',
      port_bottom: 'Hauteur des ports (% depuis le bas)',
    },
    units: { timeticks: 'Centièmes de seconde (SNMP)', seconds: 'Secondes' },
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
      image: 'Switch image',
      port_start: 'First port position (%)',
      port_step: 'Spacing between ports (%)',
      port_bottom: 'Port height (% from bottom)',
    },
    units: { timeticks: 'Hundredths of a second (SNMP)', seconds: 'Seconds' },
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
  port_start: 21,
  port_step: 10,
  port_bottom: 39,
};

const COLORS = {
  green: '#4caf50',
  orange: '#ff9800',
  red: '#f44336',
  blue: '#2196f3',
  grey: '#9e9e9e',
};

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

const formatUptime = (raw, unit) => {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return '—';
  const t = unit === 'seconds' ? n : Math.floor(n / 100);
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${d > 0 ? `${d}j ` : ''}${h}h ${m}min`;
};

const portSvg = (color, dark) => `
  <svg viewBox="0 0 27 25" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="4" width="25" height="20" rx="2" fill="${color}"/>
    <rect x="10" y="1" width="6" height="5" rx="1" fill="${color}"/>
    ${[4, 8, 12, 16].map((x) => `<rect x="${x}" y="8" width="2" height="10" rx="0.5" fill="${dark}" opacity="0.6"/>`).join('')}
  </svg>`;

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */
class HaSwitchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._key = '';
    this.shadowRoot.addEventListener('click', (ev) => this._onClick(ev));
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

  _watched() {
    const c = this._config;
    const ids = [c.switch_entity, c.status_entity, c.connectivity_entity, c.uptime_entity, c.traffic_in_entity, c.traffic_out_entity];
    for (let n = 1; n <= Number(c.ports); n++) ids.push(this._portEntity(n));
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
      chips.push(this._chip(c.uptime_entity, 'mdi:clock-outline', COLORS.grey, formatUptime(this._state(c.uptime_entity)?.state, c.uptime_unit)));
    }

    /* ports */
    const count = Math.max(1, Number(c.ports) || 8);
    const ports = [];
    for (let n = 1; n <= count; n++) {
      const id = this._portEntity(n);
      const ps = this._state(id);
      const up = ps?.state === String(c.port_on_state);
      const [col, dark] = !ps ? [COLORS.grey, '#424242'] : up ? ['#22c55e', '#006400'] : ['#ef4444', '#8b0000'];
      const pos = c.image ? `style="left:${Number(c.port_start) + (n - 1) * Number(c.port_step)}%"` : '';
      ports.push(`<div class="port" ${pos} data-entity="${esc(id)}" title="${t.port} ${n}">${portSvg(col, dark)}</div>`);
    }
    const device = c.image
      ? `<div class="device img" ${c.url ? `data-url="${esc(c.url)}"` : ''}>
           <img src="${esc(c.image)}" alt="">
           <div class="ports abs" style="bottom:${Number(c.port_bottom)}%">${ports.join('')}</div>
         </div>`
      : `<div class="device body" ${c.url ? `data-url="${esc(c.url)}"` : ''}>
           <div class="ports flex">${ports.join('')}</div>
         </div>`;

    /* traffic */
    const tile = (id, icon, color, label) =>
      id
        ? `<div class="tile" data-entity="${esc(id)}">
             <div class="ic" style="--c:${color}"><ha-icon icon="${icon}"></ha-icon></div>
             <div><div class="primary">${label}</div><div class="secondary">${esc(this._formatTraffic(this._state(id)))}</div></div>
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
            <div class="primary">${esc(c.name)}</div>
            ${c.subtitle ? `<div class="secondary">${esc(c.subtitle)}</div>` : ''}
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
    return `<div class="chip" data-entity="${esc(entity)}">
      <ha-icon icon="${icon}" style="color:${color}"></ha-icon><span>${esc(content)}</span>
    </div>`;
  }

  static get styles() {
    return `
      ha-card { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
      [data-entity], [data-url] { cursor: pointer; }
      .primary { font-weight: 600; font-size: 14px; color: var(--primary-text-color); }
      .secondary { font-size: 12px; color: var(--secondary-text-color); }
      .header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; }
      .ic {
        --size: 36px;
        width: var(--size); height: var(--size); border-radius: 50%;
        display: flex; align-items: center; justify-content: center; flex: none;
        color: var(--c); background: color-mix(in srgb, var(--c) 20%, transparent);
      }
      .ic.big { --size: 56px; --mdc-icon-size: 36px; }
      .titles { min-width: 0; }
      .titles > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      ha-switch {
        --switch-checked-color: #43a047;
        --switch-checked-button-color: #fff;
        --switch-checked-track-color: #43a047;
        --switch-unchecked-button-color: #fff;
        --switch-unchecked-track-color: #e53935;
        --ha-switch-checked-background-color: #43a047;
        --ha-switch-checked-thumb-background-color: #fff;
        --ha-switch-checked-border-color: #43a047;
        --ha-switch-background-color: #e53935;
        --ha-switch-thumb-background-color: #fff;
        --ha-switch-border-color: #e53935;
      }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .chip {
        display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
        border-radius: 16px; font-size: 12px; font-weight: 500;
        border: 1px solid var(--divider-color); color: var(--primary-text-color);
        --mdc-icon-size: 16px;
      }
      .device { position: relative; width: 100%; border-radius: 8px; overflow: hidden; }
      .device img { width: 100%; display: block; }
      .device.body { background: #2b2d31; padding: 14px 10px; box-sizing: border-box; }
      .ports.abs { position: absolute; left: 0; width: 100%; height: 27px; }
      .ports.abs .port { position: absolute; top: 50%; transform: translate(-50%, -50%); }
      .ports.flex { display: flex; justify-content: space-evenly; flex-wrap: wrap; gap: 6px; }
      .port { width: 27px; line-height: 0; }
      .port svg { width: 100%; height: auto; }
      .traffic { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
      .tile { display: flex; align-items: center; gap: 10px; }
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
    this._hass = hass;
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
        Object.keys(config).forEach((k) => (config[k] === '' || config[k] === undefined) && delete config[k]);
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
