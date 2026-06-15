# luci-app-fancontrol

**简体中文** | [English](README.en.md)

适用于 GL.iNet GL-MT3600BE / Beryl 7 的 LuCI 风扇控制插件，面向
ImmortalWrt / OpenWrt 风格固件，已适配 `apk` 包管理环境。

安装后会在 LuCI 的 **系统 > 风扇控制** 下新增页面。页面会显示 CPU
温度、无线芯片温度、网口温度、风扇转速、估算转速百分比和当前控制模式。
默认安装后为 `system` 模式，不会立即接管风扇；只有用户选择自动温控或固定
风力后才会接管控制。

## 截图

以下截图来自 GL.iNet GL-MT3600BE / Beryl 7，系统为 ImmortalWrt 25.12，
LuCI 主题为 Argon。

![桌面端风扇控制页面](docs/images/fancontrol-desktop.png)

<img src="docs/images/fancontrol-mobile.png" alt="窄屏风扇控制页面" width="360">

## 功能

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

## 兼容性

### 已测试设备

| 项目 | 值 |
| --- | --- |
| 设备 | GL.iNet GL-MT3600BE / Beryl 7 |
| 固件 | ImmortalWrt 25.12 / OpenWrt 风格系统 |
| Target | mediatek / filogic |
| 包管理器 | `apk` |
| 风扇驱动 | `pwm-fan` |

期望的 sysfs 节点：

- CPU 温度：`/sys/class/hwmon/*/name = cpu_thermal` 或
  `/sys/class/thermal/thermal_zone0/temp`
- 风扇驱动：`/sys/class/hwmon/*/name = pwmfan`
- 风扇转速：`fan1_input`
- PWM 控制：`pwm1`

### 可能适配的设备

如果其他路由器同时满足以下条件，理论上也可能工作：

- 设备运行 OpenWrt / ImmortalWrt 或接近 LuCI 的固件。
- 风扇通过 Linux `pwm-fan` 驱动暴露。
- 系统存在可读的 RPM 节点，例如 `fan1_input`。
- 系统存在可写的 PWM 节点，例如 `pwm1`。
- CPU 温度可从 `cpu_thermal` 或 thermal zone 读取。

通常这类设备是带风扇、并采用标准 `pwm-fan` sysfs 布局的 OpenWrt 路由器。
MediaTek Filogic 设备更可能匹配，但本插件并不强制限制在 Filogic 平台；
关键取决于 sysfs 节点是否一致。

### 不适合直接使用的设备

以下设备不建议直接使用，需要移植和测试：

- 无风扇路由器。
- 没有 RPM 转速反馈的设备。
- 只有 GPIO 开关控制的风扇。
- 依赖厂商私有风扇守护进程且没有 `pwm1` 的设备。
- 需要特殊 sysfs 写法的设备。

### 快速兼容性检查

在路由器上执行：

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

## 默认温控策略

自动模式使用偏静音的夏季曲线：

| 温度 | 风扇状态 |
| --- | --- |
| `< 60°C` | 停止 |
| `>= 65°C` | 低速 50% |
| `>= 72°C` | 中速 70% |
| `>= 79°C` | 高速 85% |
| `>= 86°C` | 满速保护 100% |

降档和停转带回差与稳定等待：

| 变化 | 条件 |
| --- | --- |
| 低速 -> 停止 | `<= 60°C` 稳定 60 秒 |
| 中速 -> 低速 | `<= 68°C` 稳定 45 秒 |
| 高速 -> 中速 | `<= 75°C` 稳定 45 秒 |
| 满速 -> 高速 | `<= 82°C` 稳定 30 秒 |

额外保护：

- 风扇启动时先 100% 满速踢转 1 秒，再降到目标档位。
- 启动后有 9 秒观察期，避免转速传感器尚未刷新时误报异常。
- 温度使用最近 3 次读数平滑。
- 默认轮询周期为 3 秒。
- 风扇一旦启动，至少运行 60 秒才允许停转。

RPM 异常阈值：

| 档位 | 连续确认前的最低转速 |
| --- | --- |
| 低速 | 500 RPM |
| 中速 | 700 RPM |
| 高速 | 900 RPM |
| 满速 | 1000 RPM |

RPM 异常需要连续出现 3 次，才会进入满速保护。

## 风速百分比

页面会同时显示“风力”和“转速”：

- `风力`：写入风扇驱动的 PWM 百分比。
- `转速`：当前 RPM 除以估算最高 RPM 得出的百分比。

默认最高转速估算值为 `6500 RPM`。这不是官方硬件标称值。如果运行期间观测到
更高 RPM，服务会使用本次运行中观测到的最高值来显示，直到服务重启。

## 日志

fancontrol 默认静默运行。正常轮询、正常看门狗检查、正常切档都不会写入
syslog，避免长期运行时产生无意义日志。

如需临时排错，可以创建以下文件开启调试日志：

```sh
touch /tmp/fancontrol.debug
```

关闭调试日志：

```sh
rm -f /tmp/fancontrol.debug
```

运行状态保存在 `/var/run`，在 OpenWrt 类系统中通常是内存路径。

## 构建

把本包放入 OpenWrt / ImmortalWrt package feed 或 package tree 后，使用常规
SDK 流程构建。

```sh
make package/luci-app-fancontrol/compile V=s
```

本包标记为 `PKGARCH:=all`。

## 手动部署测试

快速测试时，可以把 `root/` 目录内容复制到目标路由器：

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

## 常用命令

```sh
/usr/bin/fancontrol status
/usr/bin/fancontrol apply
/usr/bin/fancontrol system
/etc/init.d/fancontrol restart
logread -e fancontrol
```

## 安全说明

- 默认模式为 `system`，安装后不会立即接管风扇。
- 固定风力模式只建议临时调试使用。
- 风扇控制会写硬件 sysfs 节点，在 GL-MT3600BE 以外的设备上使用前请先确认兼容性。
- 因固件不匹配、硬件不兼容或手动危险修改导致的硬件损坏，作者和贡献者不承担责任。

## 许可证

MIT. See [LICENSE](LICENSE).
