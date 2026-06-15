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

function fmtTempInt(value) {
	value = n(value);
	return value != null ? '%d°C'.format(Math.floor(value / 1000)) : '-';
}

function fmtSource(source) {
	if (source == 'CPU')
		return 'CPU';
	if (source == 'Wi-Fi 0')
		return 'Wi-Fi 0';
	if (source == 'Wi-Fi 1')
		return 'Wi-Fi 1';
	if (source == 'Ethernet')
		return '网口';
	return source ? source : '-';
}

function fmtReason(reason) {
	return (reason || '-').replace(/Ethernet/g, '网口');
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

function profileText(status) {
	if (status.auto_profile == 'custom' && Number(status.curve_valid) == 1)
		return '自定义温度';
	if (status.auto_profile == 'custom' && Number(status.curve_valid) != 1)
		return '自定义温度无效，已使用推荐曲线';
	return '推荐曲线';
}

function badgeClass(status) {
	if (!status || Number(status.hardware_ready) != 1 || Number(status.fault) == 1 || Number(status.temp_fault) == 1)
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
	if (Number(status.temp_fault) == 1)
		return '温度传感器异常';
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

function setCurveStep(id, title, body) {
	var titleNode = document.getElementById(id + '-title');
	var bodyNode = document.getElementById(id + '-body');
	if (titleNode)
		titleNode.textContent = title;
	if (bodyNode)
		bodyNode.textContent = body;
}

function updateCurve(status) {
	status = status || {};

	setText('fancontrol-curve-profile', profileText(status));
	setText('fancontrol-hero-main', '%s：%s 才启动，%s 以下稳定 %d 秒才停止。'.format(
		profileText(status),
		fmtTempInt(status.auto_start_low_mC),
		fmtTempInt(status.auto_drop_off_mC),
		n(status.auto_hold_off) || 90
	));

	setCurveStep('curve-off',
		'< ' + fmtTempInt(status.auto_start_low_mC),
		'停止；低速回落到 ' + fmtTempInt(status.auto_drop_off_mC) + ' 后稳定 ' + (n(status.auto_hold_off) || 90) + ' 秒才停');
	setCurveStep('curve-low',
		'>= ' + fmtTempInt(status.auto_start_low_mC),
		'低速 50%；中速回落到 ' + fmtTempInt(status.auto_drop_low_mC) + ' 后稳定 ' + (n(status.auto_hold_low) || 60) + ' 秒降回');
	setCurveStep('curve-med',
		'>= ' + fmtTempInt(status.auto_start_med_mC),
		'中速 70%；高速回落到 ' + fmtTempInt(status.auto_drop_med_mC) + ' 后稳定 ' + (n(status.auto_hold_med) || 60) + ' 秒降回');
	setCurveStep('curve-high',
		'>= ' + fmtTempInt(status.auto_start_high_mC),
		'高速 85%；满速回落到 ' + fmtTempInt(status.auto_drop_high_mC) + ' 后稳定 ' + (n(status.auto_hold_high) || 45) + ' 秒降回');
	setCurveStep('curve-full',
		'>= ' + fmtTempInt(status.auto_start_full_mC),
		'满速保护 100%，立即响应');
}

function updateStatus(status) {
	status = status || {};

	var badge = document.getElementById('fancontrol-badge');
	if (badge) {
		badge.className = badgeClass(status);
		badge.textContent = badgeText(status);
	}

	setText('fancontrol-control-temp', '%s（最高：%s）'.format(fmtTemp(status.control_temp_mC || status.temp_mC), fmtSource(status.control_temp_source)));
	setText('fancontrol-temp', fmtTemp(status.cpu_temp_mC || status.raw_temp_mC));
	setText('fancontrol-wifi', [ fmtTemp(status.wifi0_temp_mC), fmtTemp(status.wifi1_temp_mC) ].join(' / '));
	setText('fancontrol-eth', fmtTemp(status.eth_temp_mC));
	setText('fancontrol-fan', fmtFan(status));
	setText('fancontrol-mode', modeText(status.mode));
	setText('fancontrol-profile', profileText(status));
	setText('fancontrol-reason', fmtReason(status.reason));
	setText('fancontrol-default', '内核策略 %s，设备树档位 %s'.format(status.thermal_policy || 'step_wise', status.default_levels || '0% / 50% / 75% / 100%'));

	updateCurve(status);
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

function fieldValue(name) {
	var node = document.querySelector('[name="cbid.fancontrol.settings.' + name + '"]');
	return node ? node.value : null;
}

function validateCurveUi() {
	var mode = fieldValue('mode');
	var profile = fieldValue('auto_profile');
	var values, names, ranges, i, v;

	if (mode != 'auto' || profile != 'custom')
		return true;

	names = [ '停止温度', '低速启动温度', '中速启动温度', '高速启动温度', '满速保护温度' ];
	values = [
		Number(fieldValue('auto_stop_temp')),
		Number(fieldValue('auto_low_temp')),
		Number(fieldValue('auto_med_temp')),
		Number(fieldValue('auto_high_temp')),
		Number(fieldValue('auto_full_temp'))
	];
	ranges = [
		[ 45, 70 ],
		[ 55, 78 ],
		[ 60, 84 ],
		[ 68, 88 ],
		[ 80, 90 ]
	];

	for (i = 0; i < values.length; i++) {
		v = values[i];
		if (!isFinite(v) || Math.floor(v) != v || v < ranges[i][0] || v > ranges[i][1]) {
			ui.addNotification(null, E('p', '%s 必须是 %d-%d°C 的整数。'.format(names[i], ranges[i][0], ranges[i][1])), 'danger');
			return false;
		}
	}

	for (i = 1; i < values.length; i++) {
		if (values[i] - values[i - 1] < 3) {
			ui.addNotification(null, E('p', '温度必须按 停止 < 低速 < 中速 < 高速 < 满速保护 递增，且相邻至少间隔 3°C。'), 'danger');
			return false;
		}
	}

	return true;
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
	if (!validateCurveUi())
		return Promise.resolve();

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
		'.fan-curve{display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));gap:10px;margin-top:10px}.fan-step{min-height:74px;padding:10px 12px;border-radius:8px;background:#1c1c1c;border:1px solid #444}.fan-step b{display:block;margin-bottom:4px;color:#fff}.fan-step span{color:#bbb;font-size:12px;line-height:1.5}',
		'@media(max-width:900px){.fan-curve{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}}'
	]);
}

function curveStep(id) {
	return E('div', { 'class': 'fan-step' }, [
		E('b', { 'id': id + '-title' }, '-'),
		E('span', { 'id': id + '-body' }, '-')
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
					E('div', {}, [ E('strong', {}, '温控曲线：'), E('span', { 'id': 'fancontrol-hero-main' }, '读取中') ]),
					E('div', { 'class': 'fan-muted' }, '控制温度取 CPU、Wi-Fi、网口等关键探头的最高值；启动和降档会等待温度稳定，保护风扇寿命。')
				])
			]),
			E('h3', {}, '实时状态'),
			E('table', { 'class': 'table fan-status-table' }, [
				statusRow('控制温度', 'fancontrol-control-temp'),
				statusRow('CPU 温度', 'fancontrol-temp'),
				statusRow('无线芯片温度', 'fancontrol-wifi'),
				statusRow('网口温度', 'fancontrol-eth'),
				statusRow('风扇状态', 'fancontrol-fan'),
				statusRow('控制模式', 'fancontrol-mode'),
				statusRow('温控方案', 'fancontrol-profile'),
				statusRow('当前原因', 'fancontrol-reason'),
				statusRow('系统默认', 'fancontrol-default')
			])
		]);

		var curveBox = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, '自动温控曲线'),
			E('div', { 'class': 'fan-note' }, [
				'当前方案：',
				E('strong', { 'id': 'fancontrol-curve-profile' }, '读取中'),
				'。自动模式只允许调整温度点，风力档位固定为 50% / 70% / 85% / 100%，避免误设伤风扇。'
			]),
			E('div', { 'class': 'fan-curve' }, [
				curveStep('curve-off'),
				curveStep('curve-low'),
				curveStep('curve-med'),
				curveStep('curve-high'),
				curveStep('curve-full')
			])
		]);

		m = new form.Map('fancontrol', '风扇控制');
		m.description = '默认使用系统控制。自动温控可使用推荐曲线，也可只自定义温度点；固定风力仅建议临时调试。';
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

		o = s.option(form.ListValue, 'auto_profile', '温控方案');
		o.value('preset', '推荐曲线');
		o.value('custom', '自定义温度');
		o.default = 'preset';
		o.rmempty = false;
		o.depends('mode', 'auto');
		o.description = '推荐曲线适合大多数 GL-MT3600BE；自定义温度只调整温度点，不允许修改风力档位。';

		o = s.option(form.Value, 'auto_stop_temp', '停止温度');
		o.datatype = 'range(45,70)';
		o.default = '60';
		o.placeholder = '60';
		o.rmempty = false;
		o.depends({ mode: 'auto', auto_profile: 'custom' });
		o.description = '低速回落到此温度后，还需要稳定 90 秒才会停转。';

		o = s.option(form.Value, 'auto_low_temp', '低速启动');
		o.datatype = 'range(55,78)';
		o.default = '65';
		o.placeholder = '65';
		o.rmempty = false;
		o.depends({ mode: 'auto', auto_profile: 'custom' });
		o.description = '达到此温度后，会先确认约 6 秒再启动低速，避免频繁启停。';

		o = s.option(form.Value, 'auto_med_temp', '中速启动');
		o.datatype = 'range(60,84)';
		o.default = '72';
		o.placeholder = '72';
		o.rmempty = false;
		o.depends({ mode: 'auto', auto_profile: 'custom' });

		o = s.option(form.Value, 'auto_high_temp', '高速启动');
		o.datatype = 'range(68,88)';
		o.default = '79';
		o.placeholder = '79';
		o.rmempty = false;
		o.depends({ mode: 'auto', auto_profile: 'custom' });

		o = s.option(form.Value, 'auto_full_temp', '满速保护');
		o.datatype = 'range(80,90)';
		o.default = '86';
		o.placeholder = '86';
		o.rmempty = false;
		o.depends({ mode: 'auto', auto_profile: 'custom' });
		o.description = '达到满速保护温度会立即 100% 转速，不等待确认。';

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
