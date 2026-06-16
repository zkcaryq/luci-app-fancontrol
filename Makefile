include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-fancontrol
PKG_VERSION:=1.1.0
PKG_RELEASE:=2
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-fancontrol
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Simple fan control for GL-MT3600BE
  DEPENDS:=+luci-base +rpcd
  PKGARCH:=all
endef

define Package/luci-app-fancontrol/description
  Simple LuCI fan control page with global temperature protection, fan RPM,
  recommended and custom automatic temperature curves.
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
