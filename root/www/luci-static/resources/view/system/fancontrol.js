'use strict';
'require view';
'require form';
'require fs';
'require poll';
'require ui';
'require uci';

function fanStatus() {
	return L.resolveDefault(fs.exec_direct('/usr/bin/fancontrol', [ 'status' ], 'json'), {});
}

function n(value) {
	value = Number(value);
	return isFinite(value) ? value : null;
}

function fmtTemp(value) {
	value = n(value);
	return value != null ? '%.1f °C'.format(value / 1000) : '-';
}

function fmtFan(status) {
	var rpm = n(status.rpm);
	var pct = n(status.target_percent);
	var rpmPct = n(status.rpm_percent);
	var rpmMin = n(status.rpm_min);
	var rpmMax = n(status.rpm_max);
	var maxSource = status.rpm_max_source;
	var label = status.level_label || '-';
	var parts = [ label ];

	if (Number(status.fault) == 1) {
		label = '异常保护';
		pct = 100;
		parts = [ label ];
	}
	else if ((status.reason || '').indexOf('启动确认中') >= 0) {
		label = '启动确认中';
		parts = [ label ];
	}
	else if (pct == null) {
		pct = n(status.pwm_percent);
	}

	if (pct != null)
		parts.push('风力 %d%%'.format(pct));
	if (rpm != null)
		parts.push('约 %d 转/分钟'.format(rpm));
	if (rpmPct != null)
		parts.push('转速约 %d%%'.format(rpmPct));
	if (rpmMin != null && rpmMax != null)
		parts.push('转速范围 %d - 约 %d 转/分钟%s'.format(
			rpmMin,
			rpmMax,
			maxSource == 'observed' ? '（实测）' : '（估算）'
		));

	return parts.join(' · ');
}

function modeText(mode) {
	if (mode == 'auto')
		return '自动温控';
	if (mode == 'fixed')
		return '固定风力';
	return '系统默认';
}

function badgeClass(status) {
	if (!status || Number(status.hardware_ready) != 1 || Number(status.fault) == 1)
		return 'fan-badge fan-badge-red';
	if (status.mode == 'system')
		return 'fan-badge fan-badge-blue';
	if (status.mode == 'fixed')
		return 'fan-badge fan-badge-orange';
	if ((status.reason || '').indexOf('启动确认中') >= 0)
		return 'fan-badge fan-badge-green';
	if (status.level == 'full')
		return 'fan-badge fan-badge-red';
	if (status.level == 'high')
		return 'fan-badge fan-badge-orange';
	if (status.level == 'medium')
		return 'fan-badge fan-badge-yellow';
	if (status.level == 'low')
		return 'fan-badge fan-badge-cyan';
	return 'fan-badge fan-badge-green';
}

function badgeText(status) {
	if (!status || Number(status.hardware_ready) != 1)
		return '未检测到风扇硬件';
	if (Number(status.fault) == 1)
		return '风扇异常保护';
	if (status.mode == 'system')
		return '系统默认控制中';
	if (status.mode == 'fixed')
		return '固定风力运行中';
	if (Number(status.service_running) != 1)
		return '自动温控未运行';
	if ((status.reason || '').indexOf('启动确认中') >= 0)
		return '自动温控运行中 · 启动确认中';
	if (status.level == 'off')
		return '自动温控运行中 · 当前停转';
	return '自动温控运行中 · ' + (status.level_label || '散热中');
}

function setText(id, value) {
	var node = document.getElementById(id);
	if (node)
		node.textContent = value;
}

function updateStatus(status) {
	status = status || {};

	var badge = document.getElementById('fancontrol-badge');
	if (badge) {
		badge.className = badgeClass(status);
		badge.textContent = badgeText(status);
	}

	setText('fancontrol-temp', fmtTemp(status.raw_temp_mC || status.temp_mC));
	setText('fancontrol-wifi', [ fmtTemp(status.wifi0_temp_mC), fmtTemp(status.wifi1_temp_mC) ].join(' / '));
	setText('fancontrol-eth', fmtTemp(status.eth_temp_mC));
	setText('fancontrol-fan', fmtFan(status));
	setText('fancontrol-mode', modeText(status.mode));
	setText('fancontrol-reason', status.reason || '-');
	setText('fancontrol-default', '内核策略 %s，设备树档位 %s'.format(status.thermal_policy || 'step_wise', status.default_levels || '0% / 50% / 75% / 100%'));
}

function statusRow(label, id) {
	return E('tr', { 'class': 'tr' }, [
		E('td', { 'class': 'td left', 'style': 'width: 190px' }, label),
		E('td', { 'class': 'td', 'id': id }, '-')
	]);
}

function refreshStatus() {
	return fanStatus().then(function(status) {
		updateStatus(status);
		return status;
	});
}

function applyFancontrol() {
	return fs.exec('/usr/bin/fancontrol', [ 'apply' ])
		.then(function() {
			return new Promise(function(resolve) {
				window.setTimeout(resolve, 1200);
			});
		})
		.then(refreshStatus);
}

function saveAndApply(map) {
	return map.save(null, true)
		.then(function() {
			return L.resolveDefault(ui.changes.apply(false), null);
		})
		.then(applyFancontrol)
		.catch(function(err) {
			ui.addNotification(null, E('p', '应用失败：%s'.format(err.message || err)), 'danger');
		});
}

function styleBlock() {
	return E('style', {}, [
		'.fan-hero{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin:0 0 16px 0;padding:18px 20px;border-radius:8px;background:#222;}',
		'.fan-badge{display:inline-flex;align-items:center;min-height:34px;padding:8px 14px;border-radius:8px;font-size:18px;font-weight:700;letter-spacing:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);}',
		'.fan-badge-blue{background:#183b66;color:#d8ecff}.fan-badge-green{background:#154d2f;color:#d8ffe8}.fan-badge-cyan{background:#0d4b55;color:#d8fbff}.fan-badge-yellow{background:#5a4a12;color:#fff2b8}.fan-badge-orange{background:#633715;color:#ffe2c7}.fan-badge-red{background:#661f24;color:#ffe0e0}',
		'.fan-note{line-height:1.7;color:#ddd}.fan-note strong{color:#fff}.fan-muted{color:#aaa;font-size:12px}',
		'.fan-status-table .td{vertical-align:middle}.fan-status-table .td:first-child{width:190px;text-align:left}.fan-status-table .td:nth-child(2){text-align:left!important}',
		'.fan-curve{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:10px;margin-top:10px}.fan-step{min-height:56px;padding:10px 12px;border-radius:8px;background:#1c1c1c;border:1px solid #444}.fan-step b{display:block;margin-bottom:4px;color:#fff}',
		'@media(max-width:900px){.fan-curve{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}}'
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('fancontrol'),
			fanStatus()
		]);
	},

	render: function(data) {
		var m, s, o;
		var initialStatus = data[1] || {};

		var statusBox = E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'fan-hero' }, [
				E('div', { 'id': 'fancontrol-badge', 'class': 'fan-badge fan-badge-blue' }, '读取中'),
				E('div', { 'class': 'fan-note' }, [
					E('div', {}, [ E('strong', {}, '夏季静音曲线：'), '65°C 才启动，60°C 以下稳定 60 秒才停止。' ]),
					E('div', { 'class': 'fan-muted' }, '启动时会满速 1 秒，之后观察 9 秒确认转速；中间温度保持当前档位，避免频繁变速。')
				])
			]),
			E('h3', {}, '实时状态'),
			E('table', { 'class': 'table fan-status-table' }, [
				statusRow('CPU 温度', 'fancontrol-temp'),
				statusRow('无线芯片温度', 'fancontrol-wifi'),
				statusRow('网口温度', 'fancontrol-eth'),
				statusRow('风扇状态', 'fancontrol-fan'),
				statusRow('控制模式', 'fancontrol-mode'),
				statusRow('当前原因', 'fancontrol-reason'),
				statusRow('系统默认', 'fancontrol-default')
			])
		]);

		var curveBox = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, '自动温控曲线'),
			E('div', { 'class': 'fan-note' }, '自动模式不需要手动设置转速，系统会按温度自动分档。降档和停转会等待温度稳定，服务异常时看门狗会自动恢复。'),
			E('div', { 'class': 'fan-curve' }, [
				E('div', { 'class': 'fan-step' }, [ E('b', {}, '< 60°C'), '停止' ]),
				E('div', { 'class': 'fan-step' }, [ E('b', {}, '>= 65°C'), '低速 50%' ]),
				E('div', { 'class': 'fan-step' }, [ E('b', {}, '>= 72°C'), '中速 70%' ]),
				E('div', { 'class': 'fan-step' }, [ E('b', {}, '>= 79°C'), '高速 85%' ]),
				E('div', { 'class': 'fan-step' }, [ E('b', {}, '>= 86°C'), '满速保护 100%' ])
			])
		]);

		m = new form.Map('fancontrol', '风扇控制');
		m.description = '默认使用系统控制。自动温控采用 65°C 启动、60°C 稳定停转的夏季静音曲线；固定风力仅建议临时调试。';
		m.submit = false;
		m.reset = false;

		s = m.section(form.NamedSection, 'settings', 'settings', '设置');
		s.addremove = false;

		o = s.option(form.ListValue, 'mode', '控制方式');
		o.value('system', '系统默认');
		o.value('auto', '自动温控');
		o.value('fixed', '固定风力（调试用）');
		o.default = 'system';
		o.rmempty = false;

		o = s.option(form.Value, 'fixed_percent', '固定风力');
		o.datatype = 'range(50,100)';
		o.default = '70';
		o.placeholder = '70';
		o.rmempty = false;
		o.depends('mode', 'fixed');
		o.description = '固定模式最低 50%，避免小风扇低速卡住；长期使用建议选择自动温控。';

		o = s.option(form.Button, '_apply', '应用');
		o.inputstyle = 'apply';
		o.inputtitle = '保存并应用';
		o.onclick = function() {
			return saveAndApply(this.map);
		};

		o = s.option(form.Button, '_system', '恢复系统默认');
		o.inputstyle = 'reset';
		o.inputtitle = '交给系统控制';
		o.onclick = function() {
			return fs.exec('/usr/bin/fancontrol', [ 'system' ])
				.then(function() {
					return new Promise(function(resolve) {
						window.setTimeout(resolve, 800);
					});
				})
				.then(function() {
					return uci.load('fancontrol');
				})
				.then(refreshStatus)
				.catch(function(err) {
					ui.addNotification(null, E('p', '操作失败：%s'.format(err.message || err)), 'danger');
				});
		};

		return m.render().then(function(mapEl) {
			var root = E('div', {}, [ styleBlock(), statusBox, curveBox, mapEl ]);

			updateStatus(initialStatus);
			poll.add(refreshStatus, 3);

			return root;
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
