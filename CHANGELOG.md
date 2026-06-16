# Changelog

## 1.1.0

- Release `1.1.0-r2`: remove the hard `kmod-hwmon-pwmfan` package dependency.
- Keep runtime hardware detection and require the router to already expose the
  expected `pwm-fan` sysfs nodes.
- Add recommended/custom automatic temperature profiles.
- Allow custom automatic temperature points without exposing fan power levels.
- Use the highest valid CPU / Wi-Fi / Ethernet temperature as the control temperature.
- Add stricter sensor validation and full-speed protection for invalid readings.
- Add longer startup, stop, and downshift guards to reduce fan wear.
- Add `install.sh` for convenient source installation on compatible routers.
- Expand Chinese and English README usage and installation documentation.

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
