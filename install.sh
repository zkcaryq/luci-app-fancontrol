#!/bin/sh

set -u

REPO="zkcaryq/luci-app-fancontrol"
BRANCH="${BRANCH:-main}"
TARBALL_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
TMP_BASE="/tmp"
STAMP="$(date +%Y%m%d-%H%M%S 2>/dev/null || date +%s)"
WORKDIR="${TMP_BASE}/luci-app-fancontrol-install-${STAMP}"
ARCHIVE="${WORKDIR}/source.tar.gz"
BACKUP_DIR="${TMP_BASE}/luci-app-fancontrol-backup-${STAMP}"

die() {
	echo "ERROR: $*" >&2
	exit 1
}

info() {
	echo "==> $*"
}

has_cmd() {
	command -v "$1" >/dev/null 2>&1
}

download() {
	local url="$1"
	local out="$2"

	if has_cmd curl; then
		curl -fsSL "$url" -o "$out"
	elif has_cmd wget; then
		wget -q -O "$out" "$url"
	else
		die "curl or wget is required"
	fi
}

find_hwmon_by_name() {
	local wanted="$1"
	local dir name

	for dir in /sys/class/hwmon/hwmon*; do
		[ -d "$dir" ] || continue
		name="$(cat "$dir/name" 2>/dev/null)"
		[ "$name" = "$wanted" ] && {
			printf '%s' "$dir"
			return 0
		}
	done

	return 1
}

check_luci() {
	[ -d /usr/lib/lua/luci ] && return 0
	[ -d /usr/share/luci ] && return 0
	[ -d /www/luci-static/resources ] && return 0
	return 1
}

check_hardware() {
	local dir

	dir="$(find_hwmon_by_name pwmfan)"
	[ -n "$dir" ] || return 1
	[ -e "$dir/pwm1" ] || return 1
	[ -e "$dir/fan1_input" ] || return 1
	return 0
}

backup_path() {
	local rel="$1"
	local dst="/$rel"
	local bdst="$BACKUP_DIR/$rel"

	[ -e "$dst" ] || return 0
	mkdir -p "$(dirname "$bdst")" || die "failed to create backup directory"
	cp -a "$dst" "$bdst" || die "failed to backup $dst"
}

install_path() {
	local src_root="$1"
	local rel="$2"
	local src="$src_root/root/$rel"
	local dst="/$rel"

	[ -e "$src" ] || die "missing package file: root/$rel"
	backup_path "$rel"
	mkdir -p "$(dirname "$dst")" || die "failed to create $(dirname "$dst")"
	cp -a "$src" "$dst" || die "failed to install $dst"
}

[ "$(id -u)" = "0" ] || die "please run as root on the router"
check_luci || die "LuCI environment was not found"

if ! check_hardware; then
	if [ "${FORCE:-0}" = "1" ]; then
		info "fan sysfs check failed, continuing because FORCE=1"
	else
		die "pwmfan / fan1_input / pwm1 was not found; set FORCE=1 only if you know this device is compatible"
	fi
fi

has_cmd tar || die "tar is required"
mkdir -p "$WORKDIR" || die "failed to create $WORKDIR"

info "downloading ${TARBALL_URL}"
download "$TARBALL_URL" "$ARCHIVE" || die "download failed"

info "extracting package"
tar -xzf "$ARCHIVE" -C "$WORKDIR" || die "extract failed"
SRC_DIR=""
for dir in "$WORKDIR"/luci-app-fancontrol-*; do
	[ -d "$dir" ] || continue
	SRC_DIR="$dir"
	break
done
[ -n "$SRC_DIR" ] || die "source directory not found"

info "backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR" || die "failed to create backup directory"

install_path "$SRC_DIR" "usr/bin/fancontrol"
install_path "$SRC_DIR" "etc/init.d/fancontrol"
install_path "$SRC_DIR" "usr/share/luci/menu.d/luci-app-fancontrol.json"
install_path "$SRC_DIR" "usr/share/rpcd/acl.d/luci-app-fancontrol.json"
install_path "$SRC_DIR" "usr/share/ucitrack/luci-app-fancontrol.json"
install_path "$SRC_DIR" "www/luci-static/resources/view/system/fancontrol.js"

if [ -e /etc/config/fancontrol ]; then
	info "keeping existing /etc/config/fancontrol"
else
	install_path "$SRC_DIR" "etc/config/fancontrol"
fi

chmod +x /usr/bin/fancontrol /etc/init.d/fancontrol 2>/dev/null || true

info "reloading LuCI services"
/etc/init.d/rpcd reload >/dev/null 2>&1 || /etc/init.d/rpcd restart >/dev/null 2>&1 || true
[ -x /etc/init.d/ucitrack ] && /etc/init.d/ucitrack restart >/dev/null 2>&1 || true
/etc/init.d/fancontrol enable >/dev/null 2>&1 || true
/etc/init.d/fancontrol restart >/dev/null 2>&1 || true
rm -rf /tmp/luci-* 2>/dev/null || true

info "installed luci-app-fancontrol"
info "open LuCI: System > Fan Control"
info "backup saved in: $BACKUP_DIR"
