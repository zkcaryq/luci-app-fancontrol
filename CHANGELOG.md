# Changelog

## 1.0.3

- Add LuCI ACL compatibility for fancontrol service reload / restart.
- Add `/usr/share/ucitrack/luci-app-fancontrol.json`.
- Show fan RPM, estimated fan speed percentage, and RPM range in LuCI.
- Keep fancontrol logging quiet by default.
- Keep procd-managed main daemon and watchdog.

## 1.0.2

- Disable normal fancontrol syslog output by default.
- Remove custom success notifications from the LuCI page.
- Keep standard LuCI apply flow.
- Add per-level minimum RPM fault thresholds.

## 1.0.1

- Add automatic temperature curve with hysteresis.
- Add 1-second full-speed fan kick on startup.
- Add startup grace period to avoid false RPM fault detection.
- Add watchdog and heartbeat.

## 1.0.0

- Initial LuCI fan control page.
- Add CPU temperature, fan RPM, and basic fan mode display.
