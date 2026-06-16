# luci-app-fancontrol

**简体中文** | [English](README.en.md)

适用于 GL.iNet GL-MT3600BE / Beryl 7 的 LuCI 风扇控制插件，面向
ImmortalWrt / OpenWrt 风格固件，已适配 `apk` 包管理环境。

安装后会在 LuCI 的 **系统 > 风扇控制** 下新增页面。默认安装后为
`system` 模式，不会立即接管风扇；只有用户选择自动温控或固定风力后才会接管。

## 截图

以下截图来自 GL.iNet GL-MT3600BE / Beryl 7，系统为 ImmortalWrt 25.12，
LuCI 主题为 Argon。

![桌面端风扇控制页面](docs/images/fancontrol-desktop.png)

<img src="docs/images/fancontrol-mobile.png" alt="窄屏风扇控制页面" width="360">

## 功能

- 在 LuCI **系统 > 风扇控制** 下提供图形页面。
- 显示 CPU、Wi-Fi、网口温度、风扇实时转速、风力百分比和转速百分比。
- 自动温控使用关键探头最高温度作为控制温度，避免 Wi-Fi 高温被 CPU 低温掩盖。
- 支持推荐曲线和自定义温度曲线。
- 自定义只开放温度点，不开放 PWM/sysfs/风力档位等高级参数。
- 固定风力模式保留为临时调试用途。
- 使用 procd 管理主进程，并带轻量看门狗。
- 默认静默运行，正常轮询和正常切档不写 fancontrol 系统日志。

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

其他带风扇的 OpenWrt / ImmortalWrt 设备如果同样使用标准 `pwm-fan` sysfs
布局，也可能适配；未实机测试前请谨慎使用。

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

如果找不到 `pwmfan`、`fan1_input` 和 `pwm1`，请先视为不支持。

## 安装

### 一键安装

在路由器 SSH 里执行其一：

```sh
wget -O- https://raw.githubusercontent.com/zkcaryq/luci-app-fancontrol/main/install.sh | sh
```

```sh
curl -fsSL https://raw.githubusercontent.com/zkcaryq/luci-app-fancontrol/main/install.sh | sh
```

更安全的方式是先下载、查看，再执行：

```sh
wget -O /tmp/install-fancontrol.sh https://raw.githubusercontent.com/zkcaryq/luci-app-fancontrol/main/install.sh
sh /tmp/install-fancontrol.sh
```

`install.sh` 是便捷源码直装方式，不受 `apk` 数据库管理，系统升级或恢复配置时
可能需要重新安装。对于长期正式使用，如果 Releases 提供 `.apk` 包，更推荐下载
`.apk` 后用 `apk add ./包名.apk` 本地安装。

安装脚本不会改软件源、不会执行 `apk upgrade`、不会重启整机、不会覆盖已有
`/etc/config/fancontrol`。脚本会把被替换的同名文件备份到 `/tmp`。

### Releases APK

本仓库带 GitHub Actions 自动构建流程。每次 `main` 分支更新后，会使用
ImmortalWrt 25.12 `mediatek/filogic` SDK 构建标准 `.apk` 包，并上传到
`continuous` 预发布 Release；以后打 `v*` 标签时，会生成对应的正式 Release。

如果你想使用受 `apk` 数据库管理的安装方式，可以从 Releases 页面下载 `.apk`，
或在路由器上安装滚动构建包：

```sh
wget -O /tmp/luci-app-fancontrol.apk https://github.com/zkcaryq/luci-app-fancontrol/releases/download/continuous/luci-app-fancontrol_latest_all.apk
apk add /tmp/luci-app-fancontrol.apk
```

当前 APK 不再强制依赖 `kmod-hwmon-pwmfan` 软件包。只要你的固件内核已经内建
或已安装 `pwm-fan` 驱动，并且系统里实际存在 `pwmfan`、`fan1_input`、`pwm1`
这些 sysfs 节点，就可以直接安装使用；如果节点不存在，插件会安装成功但无法控制风扇。

滚动构建包跟随 `main` 分支，适合尝鲜；长期稳定使用建议优先选择带版本号的
正式 Release。

### SDK 构建

把本包放入 OpenWrt / ImmortalWrt package feed 或 package tree 后，使用常规
SDK 流程构建。

```sh
make package/luci-app-fancontrol/compile V=s
```

本包标记为 `PKGARCH:=all`。

## 如何使用

1. 安装后打开 LuCI，进入 **系统 > 风扇控制**。
2. 默认是 **系统默认**，插件不接管风扇。
3. 选择 **自动温控**，再选择：
   - **推荐曲线**：适合大多数 GL-MT3600BE。
   - **自定义温度**：只调整温度点，风力档位仍由插件固定保护。
4. 点击 **保存并应用**。
5. 页面会显示控制温度、最高温度来源、风扇状态、实时转速和当前原因。

固定风力模式仅建议短时间调试，例如确认风扇是否能转、不同风力声音如何。长期
运行建议使用自动温控。

## 默认温控策略

自动模式推荐曲线：

| 温度 | 风扇状态 |
| --- | --- |
| `< 60°C` | 停止 |
| `>= 65°C` | 低速 50% |
| `>= 72°C` | 中速 70% |
| `>= 79°C` | 高速 85% |
| `>= 86°C` | 满速保护 100% |

自定义温度只允许修改这 5 个温度点：

- 停止温度：`45-70°C`
- 低速启动：`55-78°C`
- 中速启动：`60-84°C`
- 高速启动：`68-88°C`
- 满速保护：`80-90°C`

要求：`停止 < 低速 < 中速 < 高速 < 满速保护`，相邻至少间隔 `3°C`。

## 温度建议

| 偏好 | 停止 | 低速 | 中速 | 高速 | 满速保护 |
| --- | --- | --- | --- | --- | --- |
| 静音优先 | 62°C | 68°C | 75°C | 82°C | 88°C |
| 均衡推荐 | 60°C | 65°C | 72°C | 79°C | 86°C |
| 散热优先 | 58°C | 63°C | 70°C | 77°C | 84°C |

温控内部会自动计算回落阈值，不需要手动设置回差。例如低速和中速之间的回落阈值
会按整数向下取中间值，避免出现 74.5°C 这类小数判断。

## 保护策略

- 控制温度取 CPU、Wi-Fi 0、Wi-Fi 1、网口等有效温度中的最高值。
- 温度读数必须是 `0-150°C` 的有效数字，否则进入满速保护。
- 温度使用最近 3 次读数平滑。
- 风扇从停止启动时先 100% 踢转 1 秒，再降到目标档位。
- 启动后 9 秒内不判定转速异常，避免传感器刷新慢导致误报。
- 低速启动需要短暂确认，停转和降档需要等待温度稳定。
- 风扇启动后至少运行 90 秒才允许停转。

## 常用命令

```sh
/usr/bin/fancontrol status
/usr/bin/fancontrol apply
/usr/bin/fancontrol system
/etc/init.d/fancontrol restart
logread -e fancontrol
```

恢复系统默认控制：

```sh
/usr/bin/fancontrol system
```

临时开启调试日志：

```sh
touch /tmp/fancontrol.debug
rm -f /tmp/fancontrol.debug
```

## 安全说明

- 默认模式为 `system`，安装后不会立即接管风扇。
- 固定风力模式只建议临时调试使用。
- 风扇控制会写硬件 sysfs 节点，在 GL-MT3600BE 以外的设备上使用前请先确认兼容性。
- 因固件不匹配、硬件不兼容或手动危险修改导致的硬件损坏，作者和贡献者不承担责任。

## 许可证

MIT. See [LICENSE](LICENSE).
