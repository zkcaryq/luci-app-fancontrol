include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-fancontrol
PKG_VERSION:=1.0.3
PKG_RELEASE:=1
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-fancontrol
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Simple fan control for GL-MT3600BE
  DEPENDS:=+luci-base +rpcd +kmod-hwmon-pwmfan
  PKGARCH:=all
endef

define Package/luci-app-fancontrol/description
  Simple LuCI fan control page with CPU temperature, fan RPM, and basic
  temperature based start/stop controls.
endef

define Build/Compile
endef

define Package/luci-app-fancontrol/install
	$(CP) ./root/* $(1)/
endef

define Package/luci-app-fancontrol/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || /etc/init.d/fancontrol enable >/dev/null 2>&1 || true
exit 0
endef

define Package/luci-app-fancontrol/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || /etc/init.d/fancontrol stop >/dev/null 2>&1 || true
exit 0
endef

$(eval $(call BuildPackage,luci-app-fancontrol))
