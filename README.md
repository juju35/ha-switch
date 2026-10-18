# ha-switch

Custom Lovelace card for Home Assistant displaying a managed network switch (SNMP): power toggle, global status, connectivity, uptime, per-port state and traffic. Pure JavaScript, no dependencies (no mushroom, card-mod or button-card required). Fully configurable from the visual editor. FR/EN auto-detected.

## Installation

**HACS**: add `https://github.com/juju35/ha-switch` as a custom repository (type *Dashboard*), install, reload.

**Manual**: copy `dist/ha-switch-card.js` to `/config/www/` and add the resource `/local/ha-switch-card.js` (JavaScript module).

## Configuration

```yaml
type: custom:ha-switch-card
name: Switch Séjour Netgear S350 (GS308T)
subtitle: 8 Ports Supervisés
icon: phu:netgear-switch
switch_entity: switch.switch_sejour
status_entity: sensor.switch_sejour_statut_global
connectivity_entity: binary_sensor.switch_sejour
uptime_entity: sensor.switch_sejour_uptime
traffic_in_entity: sensor.switch_sejour_port_1_in
traffic_out_entity: sensor.switch_sejour_port_1_out
ports: 8
port_pattern: sensor.switch_sejour_port_{n}_status
image: /local/images/netgear-GS308T.png
url: http://192.168.1.117
```

| Option | Default | Description |
|---|---|---|
| `name` | `Switch` | Title |
| `subtitle` | – | Subtitle |
| `icon` | `mdi:switch` | Header icon, colored by status |
| `switch_entity` | – | Power toggle (`switch` / `input_boolean`) |
| `status_entity` | – | Global status sensor |
| `connectivity_entity` | – | Connectivity `binary_sensor` |
| `uptime_entity` | – | Uptime sensor |
| `uptime_unit` | `timeticks` | `timeticks` (SNMP, 1/100 s) or `seconds` |
| `traffic_in_entity` / `traffic_out_entity` | – | Traffic sensors (bytes, auto-scaled) |
| `ports` | `8` | Number of ports |
| `port_pattern` | `sensor.switch_port_{n}_status` | Port entity pattern, `{n}` = port number |
| `port_on_state` | `1` | State meaning "port up" |
| `online_state` / `idle_state` | `En ligne` / `Inactif` | Status values → green / orange (anything else → red) |
| `image` | – | Device image; without it, a generic front panel is drawn |
| `port_start` / `port_step` / `port_bottom` | `21` / `10` / `39` | Port overlay position on the image (%) |
| `url` | – | Opened when tapping the device |

Tapping any chip, tile or port opens its more-info dialog.
