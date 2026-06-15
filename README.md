# luci-app-fancontrol

适用于 GL.iNet GL-MT3600BE / Beryl 7 的 LuCI 风扇控制插件，面向
ImmortalWrt / OpenWrt 风格固件，已适配 `apk` 包管理环境。

Simple LuCI fan control for GL.iNet GL-MT3600BE / Beryl 7 running
ImmortalWrt or OpenWrt-style firmware with `apk` packaging.

安装后会在 LuCI 的 **系统 > 风扇控制** 下新增页面。页面会显示 CPU
温度、无线芯片温度、网口温度、风扇转速、估算转速百分比和当前控制模式。
默认安装后为 `system` 模式，不会立即接管风扇；只有用户选择自动温控或固定
风力后才会接管控制。

The package adds **System > Fan Control** to LuCI. It shows CPU temperature,
wireless and Ethernet chip temperatures, fan speed, estimated fan speed
percentage, and the current control mode. The default installed mode is
`system`, so the package does not take over the fan until the user selects
automatic or fixed control.

## 截图 / Screenshots

以下截图来自 GL.iNet GL-MT3600BE / Beryl 7，系统为 ImmortalWrt 25.12，
LuCI 主题为 Argon。

Screenshots from GL.iNet GL-MT3600BE / Beryl 7 running ImmortalWrt 25.12 with
Argon theme.

![Desktop fan control page](docs/images/fancontrol-desktop.png)

<img src="docs/images/fancontrol-mobile.png" alt="Narrow fan control page" width="360">

## 功能 / Features

- 在 LuCI **系统 > 风扇控制** 下提供图形页面。
- 自动识别 `cpu_thermal`、`pwmfan`、`fan1_input`、`pwm1` 和 thermal
  cooling device，不固定写死 `hwmon` 编号。
- 支持三种控制模式：
  - `system`：交给内核 / 固件默认策略控制。
  - `auto`：使用内置静音温控曲线。
  - `fixed`：固定风力，主要用于短时间调试。
- 实时状态显示：
  - CPU 温度
  - 无线芯片温度
  - 网口温度
  - 风力百分比
  - 风扇实时转速
  - 估算转速百分比
  - 当前原因 / 当前状态
- 使用 procd 管理主进程，并带轻量看门狗。
- 风扇从停止进入转动档位时，会先满速踢转 1 秒，降低小风扇低 PWM
  启动失败的概率。
- 分档 RPM 异常检测，连续异常才进入保护。
- 默认静默运行，正常轮询和正常切档不写 fancontrol 系统日志。
- 包含 LuCI ACL 和 ucitrack 元数据，适配较新的 OpenWrt / ImmortalWrt
  LuCI 保存应用流程。

English summary:

- LuCI page under **System > Fan Control**.
- Automatic hardware discovery for `cpu_thermal`, `pwmfan`, `fan1_input`,
  `pwm1`, and thermal cooling devices.
- Three control modes:
  - `system`: leave fan control to the kernel / firmware defaults.
  - `auto`: use the built-in quiet temperature curve.
  - `fixed`: fixed fan power for short-term testing.
- Real-time status for temperatures, fan power, RPM, estimated fan speed
  percentage, and current reason / state.
- Procd-managed daemon plus a lightweight watchdog.
- 1-second full-speed kick when starting from stopped state.
- RPM fault detection with per-level minimum RPM thresholds.
- Quiet logging by default.
- LuCI ACL and ucitrack metadata for modern OpenWrt / ImmortalWrt LuCI apply
  flows.

## 兼容性 / Compatibility

### 已测试设备 / Tested Device

| 项目 / Item | 值 / Value |
| --- | --- |
| 设备 / Device | GL.iNet GL-MT3600BE / Beryl 7 |
| 固件 / Firmware family | ImmortalWrt 25.12 / OpenWrt-style system |
| Target | mediatek / filogic |
| 包管理器 / Package manager | `apk` |
| 风扇驱动 / Kernel fan driver | `pwm-fan` |

期望的 sysfs 节点：

Expected sysfs nodes:

- CPU 温度 / CPU temperature:
  `/sys/class/hwmon/*/name = cpu_thermal` or
  `/sys/class/thermal/thermal_zone0/temp`
- 风扇驱动 / Fan driver: `/sys/class/hwmon/*/name = pwmfan`
- 风扇转速 / Fan RPM: `fan1_input`
- PWM 控制 / PWM control: `pwm1`

### 可能适配的设备 / Likely Compatible Devices

如果其他路由器同时满足以下条件，理论上也可能工作：

Other routers may work if all of the following are true:

- 设备运行 OpenWrt / ImmortalWrt 或接近 LuCI 的固件。
- 风扇通过 Linux `pwm-fan` 驱动暴露。
- 系统存在可读的 RPM 节点，例如 `fan1_input`。
- 系统存在可写的 PWM 节点，例如 `pwm1`。
- CPU 温度可从 `cpu_thermal` 或 thermal zone 读取。

通常这类设备是带风扇、并采用标准 `pwm-fan` sysfs 布局的 OpenWrt 路由器。
MediaTek Filogic 设备更可能匹配，但本插件并不强制限制在 Filogic 平台；
关键取决于 sysfs 节点是否一致。

This usually means fan-equipped OpenWrt devices with a standard `pwm-fan`
sysfs layout. MediaTek Filogic devices are the most likely candidates, but this
package is not limited to Filogic if the sysfs nodes match.

### 不适合直接使用的设备 / Not Suitable Without Porting

以下设备不建议直接使用，需要移植和测试：

This package is not suitable as-is for:

- 无风扇路由器 / fanless routers;
- 没有 RPM 转速反馈的设备 / devices whose fan has no RPM feedback;
- 只有 GPIO 开关控制的风扇 / devices controlled by GPIO-only on/off fan logic;
- 依赖厂商私有风扇守护进程且没有 `pwm1` 的设备 /
  devices using vendor-specific fan control daemons without `pwm1`;
- 需要特殊 sysfs 写法的设备 / devices where fan sysfs paths require
  non-standard writes.

### 快速兼容性检查 / Quick Compatibility Check

在路由器上执行：

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

如果找不到 `pwmfan`、`fan1_input` 和 `pwm1`，请先视为不支持，直到完成移植
和实机测试。

If you cannot find `pwmfan`, `fan1_input`, and `pwm1`, treat the device as
unsupported until it is ported and tested.

## 默认温控策略 / Default Fan Strategy

自动模式使用偏静音的夏季曲线：

Automatic mode uses a summer quiet curve:

| 温度 / Temperature | 风扇状态 / Fan state |
| --- | --- |
| `< 60°C` | 停止 / stopped |
| `>= 65°C` | 低速 50% / low, 50% |
| `>= 72°C` | 中速 70% / medium, 70% |
| `>= 79°C` | 高速 85% / high, 85% |
| `>= 86°C` | 满速保护 100% / full-speed protection, 100% |

降档和停转带回差与稳定等待：

Downshift and stop hysteresis:

| 变化 / Transition | 条件 / Requirement |
| --- | --- |
| 低速 -> 停止 / low -> stopped | `<= 60°C` 稳定 60 秒 / stable for 60 seconds |
| 中速 -> 低速 / medium -> low | `<= 68°C` 稳定 45 秒 / stable for 45 seconds |
| 高速 -> 中速 / high -> medium | `<= 75°C` 稳定 45 秒 / stable for 45 seconds |
| 满速 -> 高速 / full -> high | `<= 82°C` 稳定 30 秒 / stable for 30 seconds |

额外保护：

Additional protection:

- 风扇启动时先 100% 满速踢转 1 秒，再降到目标档位。
- 启动后有 9 秒观察期，避免转速传感器尚未刷新时误报异常。
- 温度使用最近 3 次读数平滑。
- 默认轮询周期为 3 秒。
- 风扇一旦启动，至少运行 60 秒才允许停转。

- Fan starts with a 1-second 100% kick, then drops to the target level.
- Startup RPM checks are delayed for 9 seconds to avoid false failures while the
  sensor catches up.
- Temperature is smoothed over the latest 3 samples.
- Polling interval is 3 seconds.
- Once started, the fan must run for at least 60 seconds before stopping.

RPM 异常阈值：

RPM fault thresholds:

| 档位 / Level | 连续确认前的最低转速 / Minimum RPM before fault confirmation |
| --- | --- |
| 低速 / low | 500 RPM |
| 中速 / medium | 700 RPM |
| 高速 / high | 900 RPM |
| 满速 / full | 1000 RPM |

RPM 异常需要连续出现 3 次，才会进入满速保护。

The fault must be seen 3 times in a row before entering full-speed protection.

## 风速百分比 / Fan Speed Percentage

页面会同时显示“风力”和“转速”：

The UI shows both fan power and fan speed:

- `风力 / fan power`：写入风扇驱动的 PWM 百分比。
- `转速 / fan speed`：当前 RPM 除以估算最高 RPM 得出的百分比。

默认最高转速估算值为 `6500 RPM`。这不是官方硬件标称值。如果运行期间观测到
更高 RPM，服务会使用本次运行中观测到的最高值来显示，直到服务重启。

The default maximum RPM estimate is `6500 RPM`. This is not an official
hardware rating. If a higher RPM is observed during runtime, the daemon uses the
observed peak for display until the service restarts.

## 日志 / Logging

fancontrol 默认静默运行。正常轮询、正常看门狗检查、正常切档都不会写入
syslog，避免长期运行时产生无意义日志。

Fancontrol is quiet by default. Normal polling, normal watchdog checks, and
normal level changes do not write syslog entries.

如需临时排错，可以创建以下文件开启调试日志：

Debug logging can be enabled temporarily by creating:

```sh
touch /tmp/fancontrol.debug
```

关闭调试日志：

Disable it again with:

```sh
rm -f /tmp/fancontrol.debug
```

运行状态保存在 `/var/run`，在 OpenWrt 类系统中通常是内存路径。

Runtime state is stored under `/var/run`, which is memory-backed on OpenWrt-like
systems.

## 构建 / Build

把本包放入 OpenWrt / ImmortalWrt package feed 或 package tree 后，使用常规
SDK 流程构建。

Place this package under an OpenWrt / ImmortalWrt package feed or package tree,
then build it with the normal SDK workflow.

示例 / Example:

```sh
make package/luci-app-fancontrol/compile V=s
```

本包标记为 `PKGARCH:=all`。

The package is marked as `PKGARCH:=all`.

## 手动部署测试 / Manual Deployment For Testing

快速测试时，可以把 `root/` 目录内容复制到目标路由器：

For quick testing on a router, copy the `root/` contents to the target system:

```sh
scp -r root/* root@<router-ip>:/
ssh root@<router-ip>
chmod +x /usr/bin/fancontrol /etc/init.d/fancontrol
/etc/init.d/rpcd reload
/etc/init.d/ucitrack restart
/etc/init.d/fancontrol enable
/etc/init.d/fancontrol restart
rm -rf /tmp/luci-*
```

然后打开 LuCI，进入 **系统 > 风扇控制**。

Then open LuCI and go to **System > Fan Control**.

## 常用命令 / Useful Commands

```sh
/usr/bin/fancontrol status
/usr/bin/fancontrol apply
/usr/bin/fancontrol system
/etc/init.d/fancontrol restart
logread -e fancontrol
```

## 安全说明 / Safety Notes

- 默认模式为 `system`，安装后不会立即接管风扇。
- 固定风力模式只建议临时调试使用。
- 风扇控制会写硬件 sysfs 节点，在 GL-MT3600BE 以外的设备上使用前请先确认兼容性。
- 因固件不匹配、硬件不兼容或手动危险修改导致的硬件损坏，作者和贡献者不承担责任。

- The default mode is `system`; the package does not take over fan control until
  automatic or fixed mode is selected.
- Fixed mode is intended for short-term testing only.
- Fan control touches hardware sysfs nodes. Verify compatibility before using it
  on devices other than GL-MT3600BE.
- The author and contributors are not responsible for hardware damage caused by
  incorrect firmware, incompatible hardware, or unsafe manual changes.

## 许可证 / License

MIT. See [LICENSE](LICENSE).
