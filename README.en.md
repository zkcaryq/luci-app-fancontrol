# luci-app-fancontrol

[简体中文](README.md) | **English**

Simple LuCI fan control for GL.iNet GL-MT3600BE / Beryl 7 running
ImmortalWrt or OpenWrt-style firmware with `apk` packaging.

After installation, the package adds **System > Fan Control** to LuCI. The
default mode is `system`, so it does not take over the fan until the user
selects automatic or fixed control.

## Screenshots

Screenshots from GL.iNet GL-MT3600BE / Beryl 7 running ImmortalWrt 25.12 with
Argon theme.

![Desktop fan control page](docs/images/fancontrol-desktop.png)

<img src="docs/images/fancontrol-mobile.png" alt="Narrow fan control page" width="360">

## Features

- LuCI page under **System > Fan Control**.
- Shows CPU, Wi-Fi, Ethernet temperatures, realtime fan RPM, fan power, and
  estimated fan speed percentage.
- Uses the highest valid key sensor temperature as the control temperature, so
  hot Wi-Fi chips are not hidden by a cooler CPU reading.
- Supports a recommended curve and custom temperature points.
- Custom mode only exposes temperature points. PWM, sysfs paths, and fan power
  levels stay protected.
- Fixed fan power mode remains a short-term diagnostic tool.
- Procd-managed daemon plus a lightweight watchdog.
- Quiet logging by default.

## Compatibility

### Tested Device

| Item | Value |
| --- | --- |
| Device | GL.iNet GL-MT3600BE / Beryl 7 |
| Firmware family | ImmortalWrt 25.12 / OpenWrt-style system |
| Target | mediatek / filogic |
| Package manager | `apk` |
| Kernel fan driver | `pwm-fan` |

Expected sysfs nodes:

- CPU temperature: `/sys/class/hwmon/*/name = cpu_thermal` or
  `/sys/class/thermal/thermal_zone0/temp`
- Fan driver: `/sys/class/hwmon/*/name = pwmfan`
- Fan RPM: `fan1_input`
- PWM control: `pwm1`

Other fan-equipped OpenWrt / ImmortalWrt devices may work if they expose a
standard `pwm-fan` sysfs layout. Treat untested devices carefully.

### Quick Compatibility Check

Run the following commands on the router:

```sh
for d in /sys/class/hwmon/hwmon*; do
  echo "$d: $(cat "$d/name" 2>/dev/null)"
  ls "$d"/fan*_input "$d"/pwm* 2>/dev/null
done

for z in /sys/class/thermal/thermal_zone*; do
  echo "$z: $(cat "$z/type" 2>/dev/null) $(cat "$z/temp" 2>/dev/null)"
done
```

If you cannot find `pwmfan`, `fan1_input`, and `pwm1`, treat the device as
unsupported.

## Installation

### One-line Install

Run one of the following commands over SSH on the router:

```sh
wget -O- https://raw.githubusercontent.com/zkcaryq/luci-app-fancontrol/main/install.sh | sh
```

```sh
curl -fsSL https://raw.githubusercontent.com/zkcaryq/luci-app-fancontrol/main/install.sh | sh
```

Safer manual flow:

```sh
wget -O /tmp/install-fancontrol.sh https://raw.githubusercontent.com/zkcaryq/luci-app-fancontrol/main/install.sh
sh /tmp/install-fancontrol.sh
```

`install.sh` is a convenient source install path. It is not tracked by the `apk`
package database, so it may need to be reinstalled after firmware upgrades or
restore operations. For long-term clean installs, prefer a `.apk` package from
Releases when available and install it with `apk add ./package.apk`.

The install script does not change package feeds, does not run `apk upgrade`,
does not reboot the router, and does not overwrite an existing
`/etc/config/fancontrol`. Replaced package files are backed up under `/tmp`.

### Releases APK

This repository includes a GitHub Actions build workflow. Every push to `main`
builds a standard `.apk` package with the ImmortalWrt 25.12 `mediatek/filogic`
SDK and uploads it to the `continuous` prerelease. Future `v*` tags create fixed
versioned releases.

If you prefer an install that is tracked by the `apk` package database, download
the `.apk` from Releases, or install the rolling build directly on the router:

```sh
wget -O /tmp/luci-app-fancontrol.apk https://github.com/zkcaryq/luci-app-fancontrol/releases/download/continuous/luci-app-fancontrol_latest_all.apk
apk add /tmp/luci-app-fancontrol.apk
```

The APK no longer hard-depends on the `kmod-hwmon-pwmfan` package. The router
must already provide the `pwm-fan` driver, either built into the kernel or
installed separately, and expose the expected `pwmfan`, `fan1_input`, and
`pwm1` sysfs nodes. If those nodes do not exist, the package may install but it
will not be able to control the fan.

The rolling build follows the `main` branch and is best for early testing. For
long-term stable use, prefer a versioned Release when available.

### SDK Build

Place this package under an OpenWrt / ImmortalWrt package feed or package tree,
then build it with the normal SDK workflow.

```sh
make package/luci-app-fancontrol/compile V=s
```

The package is marked as `PKGARCH:=all`.

## Usage

1. Open LuCI and go to **System > Fan Control**.
2. The default mode is **System default**. The plugin does not control the fan.
3. Select **Automatic temperature control**, then choose:
   - **Recommended curve**: good default for most GL-MT3600BE routers.
   - **Custom temperature**: adjust temperature points only; fan power levels
     remain protected.
4. Click **Save & Apply**.
5. The page shows control temperature, hottest sensor source, fan state, RPM,
   and the current reason.

Fixed fan power is intended for short-term diagnostics, such as checking whether
the fan spins or how loud a given level sounds. Automatic mode is recommended
for long-term operation.

## Default Fan Strategy

Recommended automatic curve:

| Temperature | Fan state |
| --- | --- |
| `< 60°C` | stopped |
| `>= 65°C` | low, 50% |
| `>= 72°C` | medium, 70% |
| `>= 79°C` | high, 85% |
| `>= 86°C` | full-speed protection, 100% |

Custom mode allows changing only these five temperature points:

- Stop temperature: `45-70°C`
- Low start: `55-78°C`
- Medium start: `60-84°C`
- High start: `68-88°C`
- Full-speed protection: `80-90°C`

Rule: `stop < low < medium < high < full`, with at least `3°C` between adjacent
points.

## Temperature Suggestions

| Preference | Stop | Low | Medium | High | Full protection |
| --- | --- | --- | --- | --- | --- |
| Quiet first | 62°C | 68°C | 75°C | 82°C | 88°C |
| Balanced | 60°C | 65°C | 72°C | 79°C | 86°C |
| Cooling first | 58°C | 63°C | 70°C | 77°C | 84°C |

Downshift thresholds are calculated automatically. For example, the threshold
between low and medium is the integer floor midpoint, so the daemon never uses
ambiguous decimal thresholds such as `74.5°C`.

## Protection Behavior

- Control temperature is the highest valid reading among CPU, Wi-Fi 0, Wi-Fi 1,
  Ethernet, and other known key probes.
- Temperature readings must be valid numbers between `0-150°C`; invalid values
  trigger full-speed protection.
- Temperature is smoothed over the latest 3 samples.
- Fan starts with a 1-second 100% kick, then drops to the target level.
- Startup RPM checks are delayed for 9 seconds.
- Low-speed startup, stopping, and downshifts wait for temperature stability.
- Once started, the fan must run for at least 90 seconds before stopping.

## Useful Commands

```sh
/usr/bin/fancontrol status
/usr/bin/fancontrol apply
/usr/bin/fancontrol system
/etc/init.d/fancontrol restart
logread -e fancontrol
```

Restore system default fan control:

```sh
/usr/bin/fancontrol system
```

Temporarily enable debug logging:

```sh
touch /tmp/fancontrol.debug
rm -f /tmp/fancontrol.debug
```

## Safety Notes

- The default mode is `system`; the package does not take over fan control until
  automatic or fixed mode is selected.
- Fixed mode is intended for short-term testing only.
- Fan control touches hardware sysfs nodes. Verify compatibility before using it
  on devices other than GL-MT3600BE.
- The author and contributors are not responsible for hardware damage caused by
  incorrect firmware, incompatible hardware, or unsafe manual changes.

## License

MIT. See [LICENSE](LICENSE).
