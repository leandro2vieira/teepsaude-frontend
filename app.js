let currentScreen = 'homeScreen';
let fotoAtualMedicacao = null;
let fotoAtualMedicacaoEdit = null;
let currentVitalType = '';
let currentVitalDetail = null;
/** Índice alinhado à lista renderizada em `renderVitalDetailContent` (respeita filtro de datas). */
let currentVitalHistoricoView = [];
/** Período do gráfico no modal de Batimento Cardíaco: 7d | 15d | 30d | year | livre */
let vitalBatimentoPeriod = '7d';
/** Filtro por toque na barra: null | { kind: 'day', iso } | { kind: 'range', start, end } */
let vitalBatimentoChartSelection = null;
/** Contexto exibido no modal de Batimento: all | sono_repouso */
let vitalBatimentoContextMode = 'all';
/** Período no modal padro (usado em Pressão Arterial): 7d | 15d | 30d | year | livre */
let vitalDefaultPeriod = '7d';
let lastMedicationAlertKey = null;
let lastVitalAlertKey = null;
let currentAlarmMedicationId = null;
let currentAlarmScheduledTime = '';
/** Dados validados antes de salvar (modal de confirmação) */
let pendingVitalSavePayload = null;
/** BPM pendente após informar batimento (mesmo modal de confirmação) */
let pendingHeartRateBpm = null;
let lastRescheduleAlertKey = null;
let pendingConfirmAction = null;
let currentDailyScheduleFilter = 'todos';
let passosSelectedDayIso = null;
let passosSelectedHour = null;
let glicemiaSelectedDayIso = null;
let oxigenacaoSelectedDayIso = null;
let pressaoSelectedDay = null; // ISO date of selected day in the pressure sparkline
let pressaoColetaEntries = []; // sorted entries of the currently open day detail
let pressaoColetaDayIso = null; // ISO date of the currently open day detail
let pressaoDiaShowAll = false; // whether the reading list is fully expanded
/** Dia selecionado no day-picker de Batimento Cardíaco (ISO YYYY-MM-DD). null = hoje */
let batimentoSelectedDayISO = null;
let corpoAvaliacaoViewMode = 'list';
let corpoAvaliacaoSelectedId = null;
let corpoAvaliacaoWizardStep = 1;
let corpoAvaliacaoDraft = null;
let corpoWizardAnimDir = 'stationary';

/** YYYY-MM-DD no calendário local. Evita `toISOString()` (UTC), que desloca o dia e quebra filtros 7d/15d e o gráfico. */
function dateToLocalISODate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayISODate() {
  return dateToLocalISODate(new Date());
}

/** Meio-dia local (Date) a partir de YYYY-MM-DD à evita `new Date('...T12:00:00')` (comportamento varia por motor e pode deslocar o dia). */
function localNoonFromISODate(iso) {
  const m = typeof iso === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return new Date(NaN);
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0, 0);
}

function getCurrentHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getStepsDailyGoalValue(vital) {
  if (!vital) return 10000;
  if (Number.isFinite(Number(vital.metaDiaria))) return Math.max(1, Math.round(Number(vital.metaDiaria)));
  const idealTxt = String(vital.ideal || '');
  const m = idealTxt.match(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)/);
  if (m) {
    const minV = Number(String(m[1]).replace(',', '.'));
    const maxV = Number(String(m[2]).replace(',', '.'));
    if (Number.isFinite(minV) && Number.isFinite(maxV)) return Math.max(1, Math.round((minV + maxV) / 2));
  }
  return 10000;
}

function aggregatePassosByDay(entries) {
  const byDay = new Map();
  (Array.isArray(entries) ? entries : []).forEach((h) => {
    const dayIso = (typeof historicoEntryDayISO === 'function') ? historicoEntryDayISO(h) : String(h?.data || '').slice(0, 10);
    const v = Number(h?.valor);
    if (!dayIso || !Number.isFinite(v)) return;
    if (!byDay.has(dayIso)) byDay.set(dayIso, { day: dayIso, total: 0, entries: [] });
    const g = byDay.get(dayIso);
    g.total = Math.max(g.total, Math.max(0, Math.round(v)));
    g.entries.push(h);
  });
  return Array.from(byDay.values()).sort((a, b) => b.day.localeCompare(a.day));
}

function aggregateGlicemiaByDay(entries) {
  const byDay = new Map();
  (Array.isArray(entries) ? entries : []).forEach((h) => {
    const dayIso = (typeof historicoEntryDayISO === 'function') ? historicoEntryDayISO(h) : String(h?.data || '').slice(0, 10);
    const v = Number(h?.valor);
    if (!dayIso || !Number.isFinite(v)) return;
    if (!byDay.has(dayIso)) byDay.set(dayIso, { day: dayIso, readings: [], sum: 0, count: 0, min: v, max: v });
    const g = byDay.get(dayIso);
    g.readings.push(h);
    g.sum += v;
    g.count++;
    if (v < g.min) g.min = v;
    if (v > g.max) g.max = v;
  });
  return Array.from(byDay.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ ...d, avg: Math.round(d.sum / d.count) }));
}

function aggregateGlicemiaByMonth(entries) {
  const byMonth = new Map();
  (Array.isArray(entries) ? entries : []).forEach((h) => {
    const dayIso = (typeof historicoEntryDayISO === 'function') ? historicoEntryDayISO(h) : String(h?.data || '').slice(0, 10);
    const v = Number(h?.valor);
    if (!dayIso || !Number.isFinite(v)) return;
    const monthKey = dayIso.slice(0, 7); // 'YYYY-MM'
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, { month: monthKey, sum: 0, count: 0, min: v, max: v });
    const m = byMonth.get(monthKey);
    m.sum += v;
    m.count++;
    if (v < m.min) m.min = v;
    if (v > m.max) m.max = v;
  });
  return Array.from(byMonth.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, avg: Math.round(m.sum / m.count) }));
}

function aggregateOxigenacaoByMonth(entries) {
  const byMonth = new Map();
  (Array.isArray(entries) ? entries : []).forEach((h) => {
    const dayIso = (typeof historicoEntryDayISO === 'function') ? historicoEntryDayISO(h) : String(h?.data || '').slice(0, 10);
    const v = Number(h?.valor);
    if (!dayIso || !Number.isFinite(v)) return;
    const monthKey = dayIso.slice(0, 7);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, { month: monthKey, sum: 0, count: 0, min: v, max: v });
    const m = byMonth.get(monthKey);
    m.sum += v;
    m.count++;
    if (v < m.min) m.min = v;
    if (v > m.max) m.max = v;
  });
  return Array.from(byMonth.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, avg: Math.round(m.sum / m.count) }));
}

function aggregateHidratacaoByMonth(entries) {
  const byMonth = new Map();
  (Array.isArray(entries) ? entries : []).forEach((h) => {
    const dayIso = (typeof historicoEntryDayISO === 'function') ? historicoEntryDayISO(h) : String(h?.data || '').slice(0, 10);
    const v = Number(h?.valor);
    if (!dayIso || !Number.isFinite(v) || v < 0) return;
    const monthKey = dayIso.slice(0, 7);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, { month: monthKey, sum: 0, count: 0, min: v, max: v });
    const m = byMonth.get(monthKey);
    m.sum += v;
    m.count++;
    if (v < m.min) m.min = v;
    if (v > m.max) m.max = v;
  });
  return Array.from(byMonth.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, avg: Math.round(m.sum / m.count) }));
}

function buildPassosHourlyBucketsForDay(dayEntries) {
  const buckets = Array.from({ length: 24 }, () => 0);
  const list = (Array.isArray(dayEntries) ? dayEntries : [])
    .slice()
    .sort((a, b) => {
      const ta = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(a) : 0;
      const tb = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(b) : 0;
      return ta - tb;
    });
  let prev = null;
  list.forEach((h) => {
    const raw = Number(h?.valor);
    if (!Number.isFinite(raw)) return;
    const hh = Number.parseInt(String(h?.hora || '').slice(0, 2), 10);
    if (!Number.isInteger(hh) || hh < 0 || hh > 23) return;
    const cur = Math.max(0, Math.round(raw));
    let delta = prev == null ? cur : (cur - prev);
    if (!Number.isFinite(delta) || delta < 0) delta = cur;
    buckets[hh] += delta;
    prev = cur;
  });
  if (buckets.every((v) => v === 0) && list.length > 0) {
    const latest = list[list.length - 1];
    const latestVal = Number(latest?.valor);
    const hh = Number.parseInt(String(latest?.hora || '').slice(0, 2), 10);
    if (Number.isFinite(latestVal) && Number.isInteger(hh) && hh >= 0 && hh <= 23) {
      buckets[hh] = Math.max(0, Math.round(latestVal));
    }
  }
  return buckets;
}

function renderPassosHourlyCanvas(dayIso, dayEntries, goal) {
  const canvas = document.getElementById('passosHourlyCanvas');
  const subtitle = document.getElementById('passosHourlySubtitle');
  if (!canvas) return;
  const hhTxt = Number.isInteger(passosSelectedHour)
    ? ` à ${String(passosSelectedHour).padStart(2, '0')}:00 à ${String(passosSelectedHour).padStart(2, '0')}:59`
    : '';
  if (subtitle) subtitle.textContent = dayIso ? `${formatDateForUI(dayIso)}${hhTxt}` : '';
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const values = buildPassosHourlyBucketsForDay(dayEntries);
  const maxV = Math.max(...values, 1);
  const targetPerHour = Math.max(1, Math.round((goal || 10000) / 24));
  const yMax = Math.max(maxV * 1.15, targetPerHour * 1.6, 1);
  const padL = 18;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const gw = width - padL - padR;
  const gh = height - padT - padB;
  const toY = (v) => padT + ((yMax - v) / yMax) * gh;

  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padL, toY(targetPerHour));
  ctx.lineTo(padL + gw, toY(targetPerHour));
  ctx.stroke();
  ctx.setLineDash([]);

  const slot = gw / 24;
  const barW = Math.max(3, Math.min(12, slot * 0.55));
  const hourHits = [];
  values.forEach((v, h) => {
    const cx = padL + h * slot + slot / 2;
    const x = cx - barW / 2;
    hourHits.push({ x0: padL + h * slot, x1: padL + (h + 1) * slot, hour: h, cx });
    if (v > 0) {
      const y = toY(v);
      const hb = Math.max(1, toY(0) - y);
      const isSelected = Number.isInteger(passosSelectedHour) && passosSelectedHour === h;
      ctx.fillStyle = isSelected ? '#2563eb' : '#67d38f'; // azul forte para selecionada
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, barW, hb, 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, barW, hb);
      }
      // Se selecionada, desenha linha vertical centralizada
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, padT);
        ctx.lineTo(cx, height - padB);
        ctx.stroke();
        ctx.restore();
      }
    }
  });

  ctx.strokeStyle = '#d9dde3';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, toY(0));
  ctx.lineTo(padL + gw, toY(0));
  ctx.stroke();

  ctx.fillStyle = '#8b93a0';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  [0, 6, 12, 18].forEach((h) => {
    const x = padL + h * slot + slot / 2;
    ctx.fillText(String(h), x, height - 4);
  });
  canvas.style.cursor = 'pointer';
  canvas.onclick = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / Math.max(1, rect.width);
    const x = (ev.clientX - rect.left) * sx;
    const hit = hourHits.find((b) => x >= b.x0 && x <= b.x1);
    if (!hit) return;
    passosSelectedHour = passosSelectedHour === hit.hour ? null : hit.hour;
    renderPassosHourlyCanvas(dayIso, dayEntries, goal);
    _updatePassosHourFooter(dayEntries, goal);
  };
}

function setPassosDayFromChart(dayIso) {
  if (!dayIso) return;
  if (!currentVitalDetail || currentVitalDetail.tipo !== 'Passos') return;
  openPassosDiaDetail(dayIso);
}

function selectGlicemiaDay(dayIso) {
  if (!currentVitalDetail || currentVitalDetail.tipo !== 'Glicemia') return;
  glicemiaSelectedDayIso = glicemiaSelectedDayIso === dayIso ? null : dayIso;
  renderSparklineChart(currentVitalHistoricoView);
  renderVitalDetailContent(currentVitalHistoricoView);
}

function clearGlicemiaDaySelection() {
  glicemiaSelectedDayIso = null;
  renderSparklineChart(currentVitalHistoricoView);
  renderVitalDetailContent(currentVitalHistoricoView);
}

function selectOxigenacaoDay(dayIso) {
  if (!currentVitalDetail || currentVitalDetail.tipo !== 'Oxigenação') return;
  openOxigenacaoDiaDetail(dayIso);
}

function openOxigenacaoDiaDetail(dayIso) {
  if (!currentVitalDetail || currentVitalDetail.tipo !== 'Oxigenação') return;
  oxigenacaoSelectedDayIso = dayIso;

  renderSparklineChart(currentVitalHistoricoView);

  var _chartArea = document.getElementById('pressaoHistoricoView');
  if (_chartArea) _chartArea.style.display = 'none';
  var _periodCtrls = document.getElementById('vitalDefaultPeriodControls');
  if (_periodCtrls) _periodCtrls.style.display = 'none';
  var _contentEl = document.getElementById('vitalDetailContent');
  if (_contentEl) _contentEl.style.display = 'none';
  var _addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (_addRow) _addRow.style.display = 'none';

  var _view = document.getElementById('oxigenacaoDiaDetailView');
  if (_view) _view.style.display = 'block';
  window._oxigenacaoDiaActive = true;

  var _p = dayIso.split('-').map(Number);
  var _dateObj = new Date(_p[0], _p[1] - 1, _p[2]);
  var _dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var _meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var _dateLabel = _dias[_dateObj.getDay()] + ', ' + String(_p[2]).padStart(2, '0') + ' ' + _meses[_p[1] - 1];
  var _lblEl = document.getElementById('oxigenacaoDiaDetailLabel');
  if (_lblEl) _lblEl.textContent = _dateLabel;

  var _titleEl = document.getElementById('vitalDetailTitle');
  if (_titleEl) _titleEl.textContent = 'Oxigenação';
  var _subEl = document.getElementById('vitalDetailSubtitle');
  if (_subEl) _subEl.textContent = _dateLabel;

  var _entries = currentVitalHistoricoView.filter(function(h) {
    var d = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
    return d === dayIso;
  }).sort(function(a, b) {
    var ta = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(a) : 0;
    var tb = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(b) : 0;
    return tb - ta;
  });

  var _detContent = document.getElementById('oxigenacaoDiaDetailContent');
  if (_detContent) {
    var _idealLow = 95;
    var _unit = '%';
    var _vals = _entries.map(function(h) { return parseFloat(h.valor); }).filter(function(v) { return Number.isFinite(v); });
    var _min = _vals.length ? Math.min.apply(null, _vals) : null;
    var _max = _vals.length ? Math.max.apply(null, _vals) : null;
    var _avg = _vals.length ? Math.round(_vals.reduce(function(s, v) { return s + v; }, 0) / _vals.length) : null;
    var _last = _vals.length ? _vals[0] : null;
    var _statusColor = _last != null && _last >= _idealLow ? '#16a34a' : (_last != null && _last >= 90 ? '#f59e0b' : '#dc2626');

    var _scaleMin = 85, _scaleMax = 100, _scaleRange = _scaleMax - _scaleMin;
    var _currentPct = _last != null ? Math.max(0, Math.min(100, ((_last - _scaleMin) / _scaleRange) * 100)) : 0;
    var _idealStartPct = ((_idealLow - _scaleMin) / _scaleRange) * 100;
    var _idealWidthPct = ((100 - _idealLow) / _scaleRange) * 100;

    var _barHtml =
      '<div class="oxig-bar-wrap">' +
        '<div class="oxig-bar-track">' +
          '<div class="oxig-bar-ideal-zone" style="left:' + _idealStartPct.toFixed(1) + '%;width:' + _idealWidthPct.toFixed(1) + '%"></div>' +
          '<div class="oxig-bar-fill" style="width:' + _currentPct.toFixed(1) + '%;background:' + _statusColor + '"></div>' +
          '<div class="oxig-bar-marker" style="left:' + _currentPct.toFixed(1) + '%;background:' + _statusColor + '"></div>' +
        '</div>' +
        '<div class="oxig-bar-labels"><span>' + _scaleMin + '%</span><span>Zona ideal</span><span>' + _scaleMax + '%</span></div>' +
      '</div>';

    var _statsHtml =
      '<div class="oxig-stats-row">' +
        (_min != null ? '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Mín</span><span class="oxig-stat-val">' + _min + _unit + '</span></div>' : '') +
        (_avg != null ? '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Média</span><span class="oxig-stat-val">' + _avg + _unit + '</span></div>' : '') +
        (_max != null ? '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Máx</span><span class="oxig-stat-val">' + _max + _unit + '</span></div>' : '') +
        '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Ideal</span><span class="oxig-stat-val">' + _idealLow + '–100' + _unit + '</span></div>' +
      '</div>';

    var _entriesHtml = _entries.map(function(h) {
      var v = parseFloat(h.valor);
      var fv = Number.isFinite(v) ? v + '%' : '–';
      var hora = h.hora ? String(h.hora).slice(0, 5) : '--:--';
      var color = Number.isFinite(v) && v >= _idealLow ? '#16a34a' : (Number.isFinite(v) && v >= 90 ? '#f59e0b' : '#ef4444');
      return '<div class="vital-list-item vital-list-item--hour-bucket">' +
        '<div class="vital-list-main vital-list-main--hour-detail">' +
          '<div class="vital-list-measure-line">' +
            '<span style="color:' + color + ';font-weight:700;">' + fv + '</span>' +
          '</div>' +
          '<div class="vital-list-time-line">' + hora + '</div>' +
        '</div>' +
        '<div class="vital-list-status">' + (Number.isFinite(v) && v >= _idealLow ? 'OK' : 'AL') + '</div>' +
      '</div>';
    }).join('');

    _detContent.innerHTML =
      '<div class="vital-detail-summary-panel vital-detail-summary-panel--oxig">' + _barHtml + _statsHtml + '</div>' +
      '<div class="pressao-dia-det-list-card">' +
        (_entries.length > 0 ? _entriesHtml : '<div class="empty-state"><div class="empty-text">Nenhum registro encontrado</div></div>') +
      '</div>';
  }
}

function closeOxigenacaoDiaDetail() {
  window._oxigenacaoDiaActive = false;

  var _view = document.getElementById('oxigenacaoDiaDetailView');
  if (_view) _view.style.display = 'none';

  var _chartArea = document.getElementById('pressaoHistoricoView');
  if (_chartArea) _chartArea.style.display = 'block';
  var _periodCtrls = document.getElementById('vitalDefaultPeriodControls');
  if (_periodCtrls) _periodCtrls.style.display = 'block';
  var _contentEl = document.getElementById('vitalDetailContent');
  if (_contentEl) _contentEl.style.display = '';
  var _addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (_addRow) _addRow.style.display = 'none';

  var _subEl = document.getElementById('vitalDetailSubtitle');
  if (_subEl) _subEl.textContent = '';
  var _titleEl = document.getElementById('vitalDetailTitle');
  if (_titleEl) _titleEl.textContent = 'Histórico de Oxigenação';

  // keep oxigenacaoSelectedDayIso so chart highlights the day
  renderSparklineChart(currentVitalHistoricoView);
}

// -- Wizard inline Glicemia ---------------------------------
let _addGlicStep = 1;
let _glicNumpadValue = '';
var glicemiaInsertData = { glicemia: 96 };

function openAddGlicemiaWizard() {
  _addGlicStep = 1;
  glicemiaInsertData = { glicemia: 96, insulina: 0, medicamentos: null, _useNow: true };

  // Reset notas
  var nota = document.getElementById('glicNotaInput');
  if (nota) nota.value = '';
  // Reset medicamentos
  document.querySelectorAll('#glicStep4 .pi-med-card').forEach(function(b) { b.classList.remove('pi-med-card--active'); });
  var glicMedBtn = document.getElementById('glicMedNextBtn');
  if (glicMedBtn) { glicMedBtn.style.opacity = '0.35'; glicMedBtn.style.pointerEvents = 'none'; }

  // Reset context
  var ctx = document.getElementById('glicemiaContextoInput');
  if (ctx) ctx.value = '';
  document.querySelectorAll('#glicemiaContextoBtns .glic-ctx-card')
    .forEach(function(b) { b.classList.remove('glic-ctx-active'); });

  // Reset confirm button
  var cfm = document.getElementById('glicConfirmCtxBtn');
  if (cfm) { cfm.style.opacity = '0.35'; cfm.style.pointerEvents = 'none'; }

  // Reset drum input overlay
  var glicDrumInp = document.getElementById('piDcInput-glicemia');
  if (glicDrumInp) { glicDrumInp.style.pointerEvents = 'none'; glicDrumInp.style.opacity = '0'; }

  // Pre-fill date/time to now (for the optional panel in step 3)
  var now = new Date();
  var dat = document.getElementById('glicemiaDataInput');
  var hor = document.getElementById('glicemiaHoraInput');
  if (dat) dat.value = String(now.getDate()).padStart(2,'0') + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' + now.getFullYear();
  if (hor) hor.value = now.toTimeString().slice(0, 5);

  // Reset step-3: mostrar opções, ocultar painel de data/hora
  var glicOpts = document.getElementById('glicS3Options');
  if (glicOpts) glicOpts.style.display = '';
  var etp = document.getElementById('glicEditTimePanel');
  if (etp) etp.style.display = 'none';
  _glicS3Mode = null;
  var cfm = document.getElementById('glicS3ConfirmBtn');
  if (cfm) cfm.style.display = 'none';
  document.querySelectorAll('.glic-s3-opt-btn').forEach(function(b) { b.classList.remove('glic-s3-selected'); });

  // Hide chart/list views
  var chart = document.getElementById('pressaoHistoricoView');
  if (chart) chart.style.display = 'none';
  var filters = document.getElementById('vitalDefaultPeriodControls');
  if (filters) filters.style.display = 'none';
  var content = document.getElementById('vitalDetailContent');
  if (content) content.style.display = 'none';
  var addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (addRow) addRow.style.display = 'none';

  // Show inline wizard
  var insertView = document.getElementById('glicemiaInsertView');
  if (insertView) insertView.style.display = 'flex';
  window._glicemiaInsertActive = true;

  var titleEl = document.getElementById('vitalDetailTitle');
  if (titleEl) titleEl.style.display = 'none';
  var _glicSubEl = document.getElementById('vitalDetailSubtitle');
  if (_glicSubEl) {
    var _dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    var _meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    _glicSubEl.textContent = _dias[now.getDay()] + ', ' + now.getDate() + ' de ' + _meses[now.getMonth()] + ' à ' + now.toTimeString().slice(0, 5);
  }

  glicemiaWizardGoStep(1);
  _piDrumRender('glicemia');
  _piDrumRender('insulina');
  _glicDrumUpdateBadge();
}

function closeAddGlicemiaWizard() {
  var insertView = document.getElementById('glicemiaInsertView');
  if (insertView) insertView.style.display = 'none';
  window._glicemiaInsertActive = false;

  var chart = document.getElementById('pressaoHistoricoView');
  if (chart) chart.style.display = '';
  var filters = document.getElementById('vitalDefaultPeriodControls');
  if (filters) filters.style.display = '';
  var content = document.getElementById('vitalDetailContent');
  if (content) content.style.display = '';
  var addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (addRow) addRow.style.display = '';

  var titleEl = document.getElementById('vitalDetailTitle');
  if (titleEl) {
    titleEl.style.display = '';
    if (currentVitalDetail) titleEl.textContent = currentVitalDetail.tipo === 'Glicemia' ? 'Glicose no Sangue' : ('Histórico de ' + currentVitalDetail.tipo);
  }
  var _closeSubEl = document.getElementById('vitalDetailSubtitle');
  if (_closeSubEl) _closeSubEl.textContent = '';
}

function glicemiaWizardGoStep(step) {
  _addGlicStep = step;
  [1, 2, 3, 4, 5, 6, 7].forEach(function(s) {
    var el = document.getElementById('glicStep' + s);
    if (el) el.style.display = s === step ? '' : 'none';
    var dot = document.querySelector('[data-glicdot="' + s + '"]');
    if (dot) {
      dot.classList.toggle('pi-progress-dot--active', s === step);
      dot.classList.toggle('done', s < step);
      if (s === step) dot.classList.remove('done');
    }
  });
  // Render insulina drum when entering step 5
  if (step === 5) {
    _piDrumRender('insulina');
  }
  // Build resumo when entering step 7
  if (step === 7) {
    _glicRenderResumo();
  }
}



function _glicemiaUpdateDisplay() {
  var disp = document.getElementById('glicDisplay');
  var badge = document.getElementById('glicRangeBadge');
  if (!disp) return;
  if (!_glicNumpadValue) {
    disp.textContent = '—';
    disp.className = 'glic-display';
    if (badge) { badge.textContent = ''; badge.className = 'glic-range-badge'; }
    return;
  }
  var val = parseInt(_glicNumpadValue, 10);
  disp.textContent = _glicNumpadValue;
  if (val < 20 || val > 600) {
    disp.className = 'glic-display glic-display--alto';
    if (badge) { badge.textContent = 'Valor fora do intervalo (20–600 mg/dL)'; badge.className = 'glic-range-badge glic-range-badge--alto'; }
  } else if (val <= 99) {
    disp.className = 'glic-display glic-display--normal';
    if (badge) { badge.textContent = '? Normal (70–99)'; badge.className = 'glic-range-badge glic-range-badge--normal'; }
  } else if (val <= 125) {
    disp.className = 'glic-display glic-display--atencao';
    if (badge) { badge.textContent = '? Atenção (100–125)'; badge.className = 'glic-range-badge glic-range-badge--atencao'; }
  } else {
    disp.className = 'glic-display glic-display--alto';
    if (badge) { badge.textContent = '? Alto (acima de 125)'; badge.className = 'glic-range-badge glic-range-badge--alto'; }
  }
}

function _glicemiaUpdateValorNextBtn() {
  var val = parseInt(_glicNumpadValue, 10);
  var btn = document.getElementById('glicValorNextBtn');
  if (!btn) return;
  var ok = _glicNumpadValue.length > 0 && val >= 20 && val <= 600;
  btn.style.opacity = ok ? '1' : '0.35';
  btn.style.pointerEvents = ok ? '' : 'none';
}

function glicemiaWizardNext() {
  // Reset context selection before showing step 2
  var ctxInput = document.getElementById('glicemiaContextoInput');
  if (ctxInput) ctxInput.value = '';
  document.querySelectorAll('#glicemiaContextoBtns .glic-ctx-card')
    .forEach(function(b) { b.classList.remove('glic-ctx-active'); });
  var cfm = document.getElementById('glicConfirmCtxBtn');
  if (cfm) { cfm.style.opacity = '0.35'; cfm.style.pointerEvents = 'none'; }
  glicemiaWizardGoStep(2);
}

function selectGlicemiaContexto(btn) {
  document.querySelectorAll('#glicemiaContextoBtns .glic-ctx-card')
    .forEach(function(b) { b.classList.remove('glic-ctx-active'); });
  btn.classList.add('glic-ctx-active');
  document.getElementById('glicemiaContextoInput').value = btn.dataset.ctx;
  // Ativa botão Confirmar
  var cfm = document.getElementById('glicConfirmCtxBtn');
  if (cfm) { cfm.style.opacity = '1'; cfm.style.pointerEvents = ''; }
}

function glicemiaConfirmContexto() {
  var ctx = (document.getElementById('glicemiaContextoInput') || {}).value;
  if (!ctx) return;
  // Update step-3 summary badge
  var badge = document.getElementById('glicStep3ValorBadge');
  if (badge) badge.textContent = _glicNumpadValue + ' mg/dL à ' + ctx;
  // Refresh datetime to now
  var now = new Date();
  var dat = document.getElementById('glicemiaDataInput');
  var hor = document.getElementById('glicemiaHoraInput');
  if (dat) dat.value = String(now.getDate()).padStart(2,'0') + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' + now.getFullYear();
  if (hor) hor.value = now.toTimeString().slice(0, 5);
  // Update "Medido agora" button subtitle with current time
  var agoraLbl = document.getElementById('glicAgoraLabel');
  if (agoraLbl) {
    var dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    var meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    var h = String(now.getHours()).padStart(2,'0');
    var m = String(now.getMinutes()).padStart(2,'0');
    agoraLbl.textContent = dias[now.getDay()] + ', ' + now.getDate() + ' ' + meses[now.getMonth()] + ' à ' + h + ':' + m;
  }
  glicemiaWizardGoStep(3);
}

var _glicS3Mode = null;

function glicSelectAgora() {
  _glicS3Mode = 'agora';
  document.querySelectorAll('.glic-s3-opt-btn').forEach(function(b) { b.classList.remove('glic-s3-selected'); });
  var agoraBtn = document.getElementById('glicAgoraBtn');
  if (agoraBtn) agoraBtn.classList.add('glic-s3-selected');
  var cfm = document.getElementById('glicS3ConfirmBtn');
  if (cfm) cfm.style.display = '';
}

function glicS3Confirm() {
  if (_glicS3Mode === 'agora') { glicemiaInsertData._useNow = true; }
  else if (_glicS3Mode === 'outro') { glicemiaInsertData._useNow = false; }
  glicemiaWizardGoStep(4);
}

function glicShowOutroHorario() {
  _glicS3Mode = 'outro';
  var opts = document.getElementById('glicS3Options');
  if (opts) opts.style.display = 'none';
  var panel = document.getElementById('glicEditTimePanel');
  if (panel) panel.style.display = '';
  var cfm = document.getElementById('glicS3ConfirmBtn');
  if (cfm) cfm.style.display = '';
}

function glicDataInputMask(inp) {
  var v = inp.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 4) v = v.slice(0,2) + '/' + v.slice(2,4) + '/' + v.slice(4);
  else if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
  inp.value = v;
}

function glicSelectMed(val) {
  document.querySelectorAll('#glicStep4 .pi-med-card').forEach(function(b) { b.classList.remove('pi-med-card--active'); });
  var btn = document.getElementById('glicMed-' + val);
  if (btn) btn.classList.add('pi-med-card--active');
  glicemiaInsertData.medicamentos = val;
  var nxt = document.getElementById('glicMedNextBtn');
  if (nxt) { nxt.style.opacity = '1'; nxt.style.pointerEvents = ''; }
}

function glicGoToResumo() {
  var _ta = document.getElementById('glicNotaInput');
  if (_ta) glicemiaInsertData.nota = _ta.value.trim();
  glicemiaWizardGoStep(7);
}

function _glicResumoRow(label, value, editStep) {
  var iconMap = {
    'Glicose': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.25c0 0-6.75 7.313-6.75 11.25a6.75 6.75 0 0 0 13.5 0C18.75 9.563 12 2.25 12 2.25Z"></path></svg>',
    'Contexto': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="9"></circle></svg>',
    'Horário': '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l3 2M9 2h6"></path></svg>',
    'Remédios': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7.07-7.07l-10 10a4.95 4.95 0 1 0 7.07 7.07Z"></path><path d="M8.5 8.5l7 7"></path></svg>',
    'Insulina': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4l-3 3"></path><path d="M14 7l3 3"></path><path d="M3 21l8-8"></path><path d="M11 13l4-4 2 2-4 4"></path><path d="M2 22l2-1-1-1-1 2Z"></path></svg>',
    'Observação': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>'
  };
  var iconClsMap = {
    'Glicose': 'glic-sum-ico--glicose',
    'Contexto': 'glic-sum-ico--contexto',
    'Horário': 'glic-sum-ico--horario',
    'Remédios': 'glic-sum-ico--remedios',
    'Insulina': 'glic-sum-ico--insulina',
    'Observação': 'glic-sum-ico--obs'
  };
  var valCls = (label === 'Observação') ? 'pi-sum-val pi-sum-val--nota glic-sum-val' : 'pi-sum-val glic-sum-val';
  return [
    '<div class="pi-sum-row glic-sum-row">',
      '<div class="pi-sum-ico glic-sum-ico ' + (iconClsMap[label] || '') + '">' + (iconMap[label] || '') + '</div>',
      '<div class="pi-sum-body">',
        '<div class="pi-sum-lbl">' + label + '</div>',
        '<div class="' + valCls + '">' + value + '</div>',
      '</div>',
      '<button type="button" class="pi-sum-edit glic-sum-edit" onclick="glicemiaWizardGoStep(' + editStep + ')" aria-label="Editar ' + label + '">Editar</button>',
    '</div>'
  ].join('');
}

function _glicRenderResumo() {
  var container = document.getElementById('glicStep7Content');
  if (!container) return;
  var val = glicemiaInsertData.glicemia || 0;
  var ctx = (document.getElementById('glicemiaContextoInput') || {}).value || '—';
  var useNow = glicemiaInsertData._useNow !== false;
  var timeStr = '—';
  if (useNow) {
    var now = new Date();
    var _dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    var _meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    timeStr = _dias[now.getDay()] + ', ' + now.getDate() + ' ' + _meses[now.getMonth()] + ' à ' + now.toTimeString().slice(0, 5);
  } else {
    var _d = (document.getElementById('glicemiaDataInput') || {}).value || '';
    var _h = (document.getElementById('glicemiaHoraInput') || {}).value || '';
    if (_d && _h) timeStr = _d + ' à ' + _h;
  }
  var valColor = val > 125 ? '#ef4444' : val > 99 ? '#f59e0b' : '#22c55e';
  var medMap = { 'tomados': 'Tomei meus remédios', 'nao_tomados': 'Não tomei hoje', 'nenhum': 'Não tomo remédios' };
  var medStr = medMap[glicemiaInsertData.medicamentos] || '—';
  var insulinaVal = glicemiaInsertData.insulina;
  var insulinaStr = (!insulinaVal || insulinaVal === 0) ? 'Não registrado' : insulinaVal + ' unidades';
  var notaStr = (glicemiaInsertData.nota || '').trim() || 'Sem observação';
  container.innerHTML = [
    '<div class="glic-resumo-list">',
      _glicResumoRow('Glicose', '<span style="color:' + valColor + ';font-weight:700;">' + val + ' mg/dL</span>', 1),
      _glicResumoRow('Contexto', ctx, 2),
      _glicResumoRow('Horário', timeStr, 3),
      _glicResumoRow('Remédios', medStr, 4),
      _glicResumoRow('Insulina', insulinaStr, 5),
      _glicResumoRow('Observação', notaStr, 6),
    '</div>',
    '<p class="glic-resumo-note">Verifique os dados antes de salvar</p>',
    '<button class="pi-next-btn glic-next-btn" onclick="saveGlicemiaEntry(null, null)">Confirmar e Salvar ?</button>'
  ].join('');
}

function glicOpenDatePicker() {
  var picker = document.getElementById('glicemiaDataPicker');
  if (!picker) return;
  // Sync current text value to picker before opening
  var txt = document.getElementById('glicemiaDataInput').value;
  if (txt && txt.length === 10) {
    var p = txt.split('/');
    picker.value = p[2] + '-' + p[1] + '-' + p[0];
  }
  if (picker.showPicker) { picker.showPicker(); } else { picker.click(); }
}

function glicDatePickerChange(picker) {
  if (!picker.value) return;
  var p = picker.value.split('-');
  document.getElementById('glicemiaDataInput').value = p[2] + '/' + p[1] + '/' + p[0];
}

function glicHideOutroHorario() {
  _glicS3Mode = null;
  var panel = document.getElementById('glicEditTimePanel');
  if (panel) panel.style.display = 'none';
  var opts = document.getElementById('glicS3Options');
  if (opts) opts.style.display = '';
  document.querySelectorAll('.glic-s3-opt-btn').forEach(function(b) { b.classList.remove('glic-s3-selected'); });
  var cfm = document.getElementById('glicS3ConfirmBtn');
  if (cfm) cfm.style.display = 'none';
}

function saveGlicemiaEntry(ev, useNow) {
  if (ev) ev.preventDefault();
  var valorRaw = glicemiaInsertData.glicemia;
  if (!valorRaw || valorRaw < 20 || valorRaw > 600) {
    glicemiaWizardGoStep(1);
    return;
  }
  var useNow = glicemiaInsertData._useNow !== false;
  var dataVal, horaVal;
  if (useNow) {
    var now = new Date();
    dataVal = now.toISOString().slice(0, 10);
    horaVal = now.toTimeString().slice(0, 5);
  } else {
    var _rawData = document.getElementById('glicemiaDataInput').value;
    horaVal = document.getElementById('glicemiaHoraInput').value;
    if (!_rawData || _rawData.length < 10) return;
    var _dp = _rawData.split('/');
    dataVal = _dp[2] + '-' + _dp[1] + '-' + _dp[0];
    if (!horaVal) {
      horaVal = new Date().toTimeString().slice(0, 5);
      document.getElementById('glicemiaHoraInput').value = horaVal;
    }
  }
  var contexto = (document.getElementById('glicemiaContextoInput') || {}).value || '';
  var nota = (document.getElementById('glicNotaInput') || {}).value || '';
  var insulinaVal = glicemiaInsertData.insulina || null;
  var medicamentosVal = glicemiaInsertData.medicamentos || null;
  var status = valorRaw > 125 ? 'alto' : valorRaw > 99 ? 'atencao' : 'normal';
  var entry = { data: dataVal, hora: horaVal, valor: valorRaw, status: status };
  if (contexto) entry.contexto = contexto;
  if (nota) entry.nota = nota;
  if (insulinaVal) entry.insulina = insulinaVal;
  if (medicamentosVal) entry.medicamentos = medicamentosVal;

  var vital = mockData.sinaisVitais.find(function(v) { return v.tipo === 'Glicemia'; });
  if (vital) {
    vital.historico.unshift(entry);
    var today = new Date().toISOString().slice(0, 10);
    if (dataVal === today) {
      vital.valor = valorRaw;
      vital.tempo = 'Agora';
      vital.dataHora = dataVal + 'T' + horaVal + ':00';
    }
    checkVitalAlert(vital);
  }

  closeAddGlicemiaWizard();

  renderSaude();
  if (currentVitalDetail && currentVitalDetail.tipo === 'Glicemia' && vital) {
    currentVitalDetail = vital;
    applyVitalDefaultPeriodView();
  }
}

function openPassosDiaDetail(dayIso) {
  if (!currentVitalDetail || currentVitalDetail.tipo !== 'Passos') return;
  passosSelectedDayIso = dayIso;
  passosSelectedHour = null;

  // Update chart selection
  renderSparklineChart(currentVitalHistoricoView);

  // Hide chart + period controls + list
  var _chartArea = document.getElementById('pressaoHistoricoView');
  if (_chartArea) _chartArea.style.display = 'none';
  var _periodCtrls = document.getElementById('vitalDefaultPeriodControls');
  if (_periodCtrls) _periodCtrls.style.display = 'none';
  var _contentEl = document.getElementById('vitalDetailContent');
  if (_contentEl) _contentEl.style.display = 'none';
  var _addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (_addRow) _addRow.style.display = 'none';

  // Show day detail panel
  var _view = document.getElementById('passosDiaDetailView');
  if (_view) _view.style.display = 'block';
  window._passaosDiaActive = true;

  // Date label
  var _p = dayIso.split('-').map(Number);
  var _dateObj2 = new Date(_p[0], _p[1] - 1, _p[2]);
  var _dias2 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var _meses2 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var _dateLabel2 = _dias2[_dateObj2.getDay()] + ', ' + String(_p[2]).padStart(2, '0') + ' ' + _meses2[_p[1] - 1];
  var _lblEl = document.getElementById('passosDiaDetailLabel');
  if (_lblEl) _lblEl.textContent = _dateLabel2;

  // Navbar title + subtitle
  var _titleEl2 = document.getElementById('vitalDetailTitle');
  if (_titleEl2) _titleEl2.textContent = 'Passos';
  var _subEl2 = document.getElementById('vitalDetailSubtitle');
  if (_subEl2) _subEl2.textContent = _dateLabel2;

  // Render summary + hourly chart
  var _goal2 = getStepsDailyGoalValue(currentVitalDetail);
  var _dayRows2 = aggregatePassosByDay(currentVitalHistoricoView);
  var _selRow2 = _dayRows2.find(function(r) { return r.day === dayIso; });
  if (!_selRow2) return;

  var _daySteps2 = Math.max(0, Math.round(Number(_selRow2.total || 0)));
  var _dayPct2 = _goal2 > 0 ? Math.max(0, Math.min(100, Math.round((_daySteps2 / _goal2) * 100))) : 0;
  var _dayDist2 = (_daySteps2 * 0.00075).toFixed(2).replace('.', ',');
  var _dayKcal2 = Math.round(_daySteps2 * 0.04);
  var _dayElev2 = Math.max(0, Math.round((_daySteps2 / 1200) * 3));

  var _detContent = document.getElementById('passosDiaDetailContent');
  if (_detContent) {
    _detContent.innerHTML =
      '<div class="passos-resumo-card">' +
        '<div class="passos-resumo-head"><div class="passos-resumo-num">' + _daySteps2.toLocaleString('pt-BR') + ' passos</div></div>' +
        '<div class="passos-resumo-bar"><span style="width:' + _dayPct2 + '%;"></span></div>' +
        '<div class="passos-resumo-scale"><span>0</span><span>Meta: ' + _goal2.toLocaleString('pt-BR') + '</span></div>' +
        '<div class="passos-resumo-meta">' +
          '<span>' + _dayDist2 + ' km</span>' +
          '<span>' + _dayKcal2 + ' kcal</span>' +
          '<span>' + _dayElev2 + ' m elevação</span>' +
        '</div>' +
      '</div>' +
      '<div class="passos-hourly-card">' +
        '<div class="passos-hourly-title">Passos por hora</div>' +
        '<div id="passosHourlySubtitle" class="passos-hourly-subtitle">' + _dateLabel2 + '</div>' +
        '<canvas id="passosHourlyCanvas" class="passos-hourly-canvas" width="720" height="180"></canvas>' +
      '</div>' +
      '<div id="passosFooterNote" class="passos-footer-note">' +
        '<div class="passos-footer-empty">Toque em uma barra para ver distância, calorias e elevação.</div>' +
      '</div>';
    renderPassosHourlyCanvas(dayIso, _selRow2.entries || [], _goal2);
  }
}

function closePassosDiaDetail() {
  window._passaosDiaActive = false;
  passosSelectedHour = null;
  // keep passosSelectedDayIso so the chart + list remain filtered

  var _view = document.getElementById('passosDiaDetailView');
  if (_view) _view.style.display = 'none';

  var _chartArea = document.getElementById('pressaoHistoricoView');
  if (_chartArea) _chartArea.style.display = 'block';
  var _periodCtrls = document.getElementById('vitalDefaultPeriodControls');
  if (_periodCtrls) _periodCtrls.style.display = 'block';
  var _contentEl = document.getElementById('vitalDetailContent');
  if (_contentEl) _contentEl.style.display = '';
  var _addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (_addRow) _addRow.style.display = 'none'; // Passos has no manual entry

  var _subEl = document.getElementById('vitalDetailSubtitle');
  if (_subEl) _subEl.textContent = '';
  var _titleEl = document.getElementById('vitalDetailTitle');
  if (_titleEl) _titleEl.textContent = 'Passos';

  // Redraw chart without selection
  renderSparklineChart(currentVitalHistoricoView);
}

function _updatePassosHourFooter(dayEntries, goal) {
  var _footerEl = document.getElementById('passosFooterNote');
  if (!_footerEl) return;
  var _hValid = Number.isInteger(passosSelectedHour) && passosSelectedHour >= 0 && passosSelectedHour <= 23;
  if (!_hValid) {
    _footerEl.innerHTML = '<div class="passos-footer-empty">Toque em uma barra para ver distância, calorias e elevação.</div>';
    return;
  }
  var _buckets = buildPassosHourlyBucketsForDay(dayEntries);
  var _hSteps = Math.max(0, Math.round(Number(_buckets[passosSelectedHour] || 0)));
  var _hDist = (_hSteps * 0.00075).toFixed(2).replace('.', ',');
  var _hKcal = Math.round(_hSteps * 0.04);
  var _hElev = Math.max(0, Math.round((_hSteps / 1200) * 3));
  _footerEl.innerHTML =
    '<div class="passos-footer-hour">' + String(passosSelectedHour).padStart(2, '0') + ':00\u2013' + String(passosSelectedHour).padStart(2, '0') + ':59</div>' +
    '<div class="passos-footer-meta">' +
      '<span>' + _hDist + ' km</span>' +
      '<span>' + _hKcal + ' kcal</span>' +
      '<span>' + _hElev + ' m elevação</span>' +
    '</div>';
}

function updateVitalDefaultPeriodChipActive() {
  document.querySelectorAll('[data-default-period]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-default-period') === vitalDefaultPeriod);
  });
}

function getVitalDefaultPeriodRange() {
  const endToday = getTodayISODate();
  const endDate = localNoonFromISODate(endToday);
  if (Number.isNaN(endDate.getTime())) {
    return { start: endToday, end: endToday };
  }

  if (vitalDefaultPeriod === 'livre') {
    const di = document.getElementById('filterVitalLivreInicio');
    const df = document.getElementById('filterVitalLivreFim');
    const vi = di && di.value;
    const vf = df && df.value;
    if (vi && vf) return vi <= vf ? { start: vi, end: vf } : { start: vf, end: vi };
    if (vi && !vf) return { start: vi, end: endToday };
    if (!vi && vf) return { start: vf, end: vf };
    const s = new Date(endDate.getTime());
    s.setDate(s.getDate() - 6);
    return { start: dateToLocalISODate(s), end: endToday };
  }

  if (vitalDefaultPeriod === 'year') {
    const y = new Date().getFullYear();
    return { start: `${y}-01-01`, end: endToday };
  }

  const daysBack = vitalDefaultPeriod === '7d' ? 6 : vitalDefaultPeriod === '15d' ? 14 : 29;
  const startD = new Date(endDate.getTime());
  startD.setDate(startD.getDate() - daysBack);
  return { start: dateToLocalISODate(startD), end: endToday };
}

function applyVitalDefaultPeriodView() {
  if (!currentVitalDetail || (currentVitalDetail.tipo !== 'Pressão Arterial' && currentVitalDetail.tipo !== 'Passos' && currentVitalDetail.tipo !== 'Glicemia' && currentVitalDetail.tipo !== 'Sono' && currentVitalDetail.tipo !== 'Oxigenação' && currentVitalDetail.tipo !== 'Hidratação')) return;
  if (currentVitalDetail.tipo === 'Glicemia') glicemiaSelectedDayIso = null;
  if (currentVitalDetail.tipo === 'Oxigenação') oxigenacaoSelectedDayIso = null;
  const { start, end } = getVitalDefaultPeriodRange();
  const filtrado = filterHistoricoByInclusiveDate(currentVitalDetail.historico, start, end);
  renderVitalDetailContent(filtrado);
  renderSparklineChart(filtrado);
}

function setVitalDefaultPeriod(period) {
  vitalDefaultPeriod = period;
  const livreRow = document.getElementById('vitalDefaultLivreRow');
  if (livreRow) livreRow.style.display = period === 'livre' ? 'block' : 'none';
  if (period === 'livre') {
    const di = document.getElementById('filterVitalLivreInicio');
    const df = document.getElementById('filterVitalLivreFim');
    const end = getTodayISODate();
    if (di && df && !di.value && !df.value) {
      const s = localNoonFromISODate(end);
      s.setDate(s.getDate() - 6);
      di.value = dateToLocalISODate(s);
      df.value = end;
    }
  }
  updateVitalDefaultPeriodChipActive();
  applyVitalDefaultPeriodView();
}

function formatDateForUI(isoDate) {
  return typeof formatISODateBR === 'function' ? formatISODateBR(isoDate) : isoDate;
}

function formatDateTimeForUI(isoDateTime) {
  return typeof formatISODateTimeBR === 'function' ? formatISODateTimeBR(isoDateTime) : isoDateTime;
}

function getHeartRateForPressureEntry(pressureEntry) {
  if (!pressureEntry) return null;
  if (pressureEntry.heartRate != null && Number.isFinite(Number(pressureEntry.heartRate))) {
    return Number(pressureEntry.heartRate);
  }
  const batimento = mockData?.sinaisVitais?.find((v) => v.tipo === 'Batimento Cardíaco');
  const hist = Array.isArray(batimento?.historico) ? batimento.historico : [];
  if (!hist.length) return null;

  const pDate = String(pressureEntry.data || '');
  const pHora = pressureEntry.hora ? String(pressureEntry.hora).slice(0, 5) : '';

  // Prioriza correspondência exata de data/hora.
  const exact = hist.find((h) => String(h.data || '') === pDate && String(h.hora || '').slice(0, 5) === pHora);
  if (exact && Number.isFinite(Number(exact.valor))) return Number(exact.valor);

  // Fallback: leitura mais próxima no mesmo dia (até 2h).
  const pMs = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(pressureEntry) : NaN;
  if (!Number.isFinite(pMs)) return null;
  let best = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  hist.forEach((h) => {
    if (String(h.data || '') !== pDate) return;
    const hMs = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(h) : NaN;
    const v = Number(h?.valor);
    if (!Number.isFinite(hMs) || !Number.isFinite(v)) return;
    const delta = Math.abs(hMs - pMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = v;
    }
  });
  return bestDelta <= 2 * 60 * 60 * 1000 ? best : null;
}

function togglePressaoDiaColetas(dayKey) {
  const el = document.getElementById(`pressaoColetas-${dayKey}`);
  const btn = document.getElementById(`pressaoColetasBtn-${dayKey}`);
  if (!el || !btn) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  btn.classList.toggle('is-open', !isOpen);
}

function isBatimentoSonoOuRepouso(h) {
  if (!h) return false;
  return h.contextoColeta === 'sono' || h.contextoColeta === 'repouso';
}

function filterBatimentoByContext(entries) {
  const arr = Array.isArray(entries) ? entries : [];
  if (vitalBatimentoContextMode !== 'sono_repouso') return arr;
  return arr.filter(isBatimentoSonoOuRepouso);
}

function getBatimentoContextModeLabel() {
  return vitalBatimentoContextMode === 'sono_repouso' ? 'Sono + Repouso' : 'Todos';
}

function updateBatimentoContextChip() {
  document.querySelectorAll('[data-batimento-context-mode]').forEach((chip) => {
    const mode = chip.getAttribute('data-batimento-context-mode');
    const active = mode === vitalBatimentoContextMode;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function setVitalBatimentoContextMode(mode) {
  const next = mode === 'sono_repouso' ? 'sono_repouso' : 'all';
  if (vitalBatimentoContextMode === next) {
    updateBatimentoContextChip();
    return;
  }
  const minutoModal = document.getElementById('batimentoMinutoModal');
  const wasMinutoOpen = !!(minutoModal && minutoModal.classList.contains('active'));
  const reopenHour = wasMinutoOpen && Number.isInteger(batimentoMinutoCurrentHour)
    ? batimentoMinutoCurrentHour
    : null;

  vitalBatimentoContextMode = next;
  updateBatimentoContextChip();
  updateVitalBatimentoModalView();

  if (
    reopenHour != null &&
    currentVitalDetail &&
    currentVitalDetail.tipo === 'Batimento Cardíaco' &&
    vitalBatimentoChartSelection &&
    vitalBatimentoChartSelection.kind === 'day'
  ) {
    requestAnimationFrame(() => openBatimentoMinutoDetalhe(reopenHour, null));
  }
}

function getIdealLabel(value) {
  return typeof formatIdealLabel === 'function' ? formatIdealLabel(value) : value;
}

function toIdealObjectFromInput(value) {
  return typeof parseIdealObject === 'function' ? parseIdealObject(value) : value;
}

/**
 * Faixa ideal (BPM) definida em Meus Indicadores ? valor ideal (ex.: 60-100).
 * Usada em todo o fluxo de batimento: gráficos, Baixo/Normal/Alto e listas que comparam ao ideal.
 */
function getBatimentoIdealRangeForChart(vital) {
  if (!vital || vital.tipo !== 'Batimento Cardíaco') return null;
  let ideal = vital.ideal;
  if (ideal == null) return null;
  if (typeof ideal === 'string') {
    ideal = typeof parseIdealObject === 'function' ? parseIdealObject(ideal) : null;
  }
  if (!ideal || ideal.type !== 'range' || ideal.min == null || ideal.max == null) return null;
  if (!Number.isFinite(ideal.min) || !Number.isFinite(ideal.max)) return null;
  return { min: ideal.min, max: ideal.max };
}

/** Garante que o modal usa o mesmo objeto do indicador em mockData (ideal + histórico atualizados). */
function syncCurrentBatimentoVitalFromMockData() {
  if (!currentVitalDetail || currentVitalDetail.tipo !== 'Batimento Cardíaco' || currentVitalDetail.id == null) {
    return;
  }
  const fresh = mockData.sinaisVitais.find((v) => v.id === currentVitalDetail.id);
  if (!fresh || fresh.tipo !== 'Batimento Cardíaco') return;
  currentVitalDetail = fresh;
  if (currentVitalDetail.ideal != null && typeof currentVitalDetail.ideal === 'string' && typeof parseIdealObject === 'function') {
    currentVitalDetail.ideal = parseIdealObject(currentVitalDetail.ideal);
  }
}

function showSystemToast(message, type = 'success') {
  let toast = document.getElementById('systemToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'systemToast';
    toast.className = 'system-toast';
    document.body.appendChild(toast);
  }

  toast.classList.remove('success', 'warning', 'show');
  toast.classList.add(type);
  toast.textContent = message;
  requestAnimationFrame(() => toast.classList.add('show'));

  if (toast._hideTimer) clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function showFeedbackModal(message, type = 'info', title = '') {
  const modal = document.getElementById('feedbackModal');
  const iconEl = document.getElementById('feedbackModalIcon');
  const titleEl = document.getElementById('feedbackModalTitle');
  const messageEl = document.getElementById('feedbackModalMessage');
  const contentEl = modal ? modal.querySelector('.feedback-modal-content') : null;
  if (!modal || !iconEl || !titleEl || !messageEl || !contentEl) {
    showSystemToast(message, type === 'error' ? 'warning' : 'success');
    return;
  }

  const config = {
    success: {
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
      title: 'Concluído'
    },
    warning: {
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      title: 'Aviso'
    },
    error: {
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      title: 'Erro'
    },
    info: {
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="12" y1="7" x2="12.01" y2="7"/></svg>',
      title: 'Informação'
    }
  };
  const current = config[type] || config.info;

  contentEl.classList.remove('type-success', 'type-warning', 'type-error');
  if (type === 'success') contentEl.classList.add('type-success');
  if (type === 'warning') contentEl.classList.add('type-warning');
  if (type === 'error') contentEl.classList.add('type-error');

  iconEl.innerHTML = current.icon;
  titleEl.textContent = title || current.title;
  messageEl.textContent = message;
  modal.classList.add('active');
}

function openConfirmModal(message, onConfirm, title = 'Confirmar ação') {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmModalTitle');
  const messageEl = document.getElementById('confirmModalMessage');
  if (!modal || !titleEl || !messageEl) {
    const fallbackOk = window.confirm(message);
    if (fallbackOk && typeof onConfirm === 'function') onConfirm();
    return;
  }
  titleEl.textContent = title;
  messageEl.textContent = message;
  pendingConfirmAction = typeof onConfirm === 'function' ? onConfirm : null;
  modal.classList.add('active');
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.remove('active');
  pendingConfirmAction = null;
}

// Fallback global: qualquer alert nativo vira modal padrão.
if (typeof window !== 'undefined') {
  window.alert = function(message) {
    showFeedbackModal(String(message || ''), 'info');
  };
}

function getMedicationStatusForDate(med, dateISO, horario, nowHHMM = null) {
  const registro = med.historico.find(h => h.data === dateISO && h.hora === horario);
  if (registro && registro.status === 'tomado') return 'tomado';

  if (dateISO < getTodayISODate()) return 'atrasado';
  if (dateISO === getTodayISODate()) {
    const currentTime = nowHHMM || getCurrentHHMM();
    if (horario < currentTime) return 'atrasado';
  }
  return 'pendente';
}

function getMedicationDayEntries(dateISO) {
  const nowHHMM = getCurrentHHMM();
  const entries = [];

  mockData.medicacoes.forEach(med => {
    med.horarios.forEach(horario => {
      entries.push({
        medId: med.id,
        nome: med.nome,
        dosagem: med.dosagem,
        horario,
        status: getMedicationStatusForDate(med, dateISO, horario, nowHHMM)
      });
    });
  });

  entries.sort((a, b) => a.horario.localeCompare(b.horario));
  return entries;
}

function ensureConfigColetaPressao() {
  if (!mockData.configColetaPressao || typeof mockData.configColetaPressao.fonte !== 'string') {
    mockData.configColetaPressao = { fonte: 'Manual' };
  }
  const ok = ['Manual', 'Pulseira', 'Google Fit', 'Apple Health'];
  if (!ok.includes(mockData.configColetaPressao.fonte)) {
    mockData.configColetaPressao.fonte = 'Manual';
  }
}

function getFontePressaoConfig() {
  ensureConfigColetaPressao();
  return mockData.configColetaPressao.fonte;
}

function applyVitalFonteValue(value) {
  const input = document.getElementById('fonteVitalInput');
  if (input) input.value = value;
  document.querySelectorAll('.vital-fonte-btn').forEach((btn) => {
    btn.classList.toggle('selected', btn.getAttribute('data-value') === value);
  });
  const checklist = document.getElementById('pulseiraChecklist');
  if (checklist) checklist.style.display = value === 'Pulseira' ? 'block' : 'none';
  if (value !== 'Pulseira') resetPulseiraStepButtons();
  const isPressure = currentVitalType === 'Pressão Arterial';
  const pressureContainer = document.getElementById('pressureInputContainer');
  const pressureCaptureContainer = document.getElementById('pressureCaptureContainer');
  if (isPressure) {
    if (value === 'Manual') {
      if (pressureContainer) pressureContainer.style.display = 'block';
      if (pressureCaptureContainer) pressureCaptureContainer.style.display = 'none';
      clearVitalCaptureState();
      setTimeout(() => document.getElementById('sistolicaInput')?.focus(), 100);
    } else {
      if (pressureContainer) pressureContainer.style.display = 'none';
      if (pressureCaptureContainer) pressureCaptureContainer.style.display = 'block';
      setAutoCaptureHint(value);
      clearVitalCaptureState();
      if (value === 'Pulseira') resetPulseiraStepButtons();
    }
  }
}

function ensureBottomNavConfig() {
  if (!mockData.configBottomNav) {
    mockData.configBottomNav = {};
  }

  const defaults = {
    saudeScreen: true,
    composicaoScreen: true,
    medicacoesScreen: true,
    agendaScreen: true
  };

  Object.keys(defaults).forEach((screenId) => {
    if (typeof mockData.configBottomNav[screenId] !== 'boolean') {
      mockData.configBottomNav[screenId] = defaults[screenId];
    }
  });
}

function applyBottomNavVisibility() {
  ensureBottomNavConfig();

  const config = mockData.configBottomNav;
  const controlledScreens = ['saudeScreen', 'composicaoScreen', 'medicacoesScreen', 'agendaScreen'];

  controlledScreens.forEach((screenId) => {
    const navItem = document.querySelector(`.tab-link[data-screen="${screenId}"]`);
    if (!navItem) return;
    navItem.style.display = config[screenId] ? '' : 'none';
  });

  if (currentScreen && controlledScreens.includes(currentScreen) && !config[currentScreen]) {
    switchScreen('homeScreen');
    document.querySelectorAll('.tab-link').forEach(i => i.classList.remove('tab-link-active'));
    const homeNavItem = document.querySelector('.tab-link[data-screen="homeScreen"]');
    if (homeNavItem) homeNavItem.classList.add('tab-link-active');
  }
}

function toggleBottomNavItem(screenId, toggleEl) {
  ensureBottomNavConfig();
  const isEnabled = !!mockData.configBottomNav[screenId];
  mockData.configBottomNav[screenId] = !isEnabled;

  if (toggleEl) {
    toggleEl.classList.toggle('active', mockData.configBottomNav[screenId]);
  }

  applyBottomNavVisibility();
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  ensureBottomNavConfig();
  ensureConfigColetaPressao();
  refreshHeaderUser();
  updateHeaderForScreen('homeScreen');
  renderHome();
  setupNavigation();
  applyBottomNavVisibility();
  setupEcgDetailModal();
  setupMedicacaoModal();
  setupEditMedicacaoModal();
  setupAlarmModal();
  setupVitalAlarmModal();
  setupCompartilhamentoModal();
  setupVitalModals();
  setupFotoUpload();
  checkMedicationAlerts();
  checkRescheduledMeasurementAlerts();
});

function getUsuarioPrimeiroNome() {
  return mockData.usuario.nome.split(' ')[0];
}

function getGreeting() {
  var h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getTodayLongDate() {
  var DIAS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  var d = new Date();
  return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
}

function getIniciaisNome(nome) {
  const p = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/** Avatar no header: foto em data URL, ou iniciais do nome. */
function applyHeaderAvatar() {
  const u = mockData.usuario;
  const el = document.getElementById('headerAvatar');
  if (!el) return;
  const url = u.fotoPerfilUrl;
  if (typeof url === 'string' && url.length > 0) {
    el.innerHTML = `<img src="${url}" alt="">`;
    el.classList.add('header-avatar--photo');
    return;
  }
  el.classList.remove('header-avatar--photo');
  el.style.color = '#2563eb';
  const initials = getIniciaisNome(u.nome);
  if (initials && initials !== '?' && /^[A-Z]{1,3}$/.test(initials)) {
    el.textContent = initials;
    return;
  }
  el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
}

function updateHeaderUserName() {
  var nameEl = document.getElementById('headerUserName');
  if (nameEl) nameEl.textContent = getUsuarioPrimeiroNome();
  var greetEl = document.getElementById('headerGreeting');
  if (greetEl) greetEl.textContent = getGreeting();
  var dateEl = document.getElementById('headerDate');
  if (dateEl) dateEl.textContent = getTodayLongDate();
}

const SCREEN_HEADER = {
  homeScreen: { actions: '' },
  saudeScreen: { actions: '' },
  composicaoScreen: {
    actions:
      '<button type="button" class="header-corpo-chart-btn" onclick="openCorpoComparacao()" title="Comparar avaliações"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg></button>'
  },
  medicacoesScreen: {
    actions:
      '<button type="button" class="med-chip-btn med-chip-btn-primary med-header-add-btn" onclick="openAddMedicacaoEntry()" title="Adicionar medicação">+ Adicionar</button>'
  },
  agendaScreen: {
    actions:
      '<button type="button" class="add-button header-agenda-add" onclick="openAddAgendaModal()" aria-label="Novo agendamento">+</button>'
  },
  perfilScreen: { actions: '' }
};

function updateHeaderForScreen(screenId) {
  const meta = SCREEN_HEADER[screenId] || SCREEN_HEADER.homeScreen;
  const actionsEl = document.getElementById('headerScreenActions');
  if (actionsEl) actionsEl.innerHTML = meta.actions || '';
}

function setGlobalHeaderVisible(visible) {
  var headerEl = document.getElementById('header');
  if (!headerEl) return;
  headerEl.style.display = visible ? '' : 'none';
}

/** Nome e avatar no cabeçalho. */
function refreshHeaderUser() {
  updateHeaderUserName();
  applyHeaderAvatar();
}

// ===== RENDERIZAÇÃO DE TELAS =====

function renderHome() {
  const hoje = getTodayISODate();
  const dayEntries = getMedicationDayEntries(hoje);
  const atrasadas = dayEntries.filter(e => e.status === 'atrasado');

  const nowHtml = atrasadas.length > 0
    ? `<div class="home-status-card home-status-card--warning home-status-card--clickable" onclick="switchScreen('medicacoesScreen')">
        <span class="home-status-icon home-status-icon--warning"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
        <div class="home-status-text">
          <div class="home-status-title">${atrasadas.length} em atraso</div>
          <div class="home-status-sub">Medicacoes atrasadas</div>
        </div>
      </div>`
    : `<div class="home-status-card home-status-card--ok home-status-card--clickable" onclick="switchScreen('medicacoesScreen')">
        <span class="home-status-icon home-status-icon--ok"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>
        <div class="home-status-text">
          <div class="home-status-title">Tudo em dia!</div>
          <div class="home-status-sub">Medicacoes em ordem</div>
        </div>
      </div>`;
  document.getElementById('homeNow').innerHTML = nowHtml;

  const vitais = mockData.sinaisVitais
    .filter(v => (mockData.configSinaisVitais[v.tipo] || {}).exibirDashboard)
    .slice(0, 3);
  // Always include Glicemia
  const glicemia = mockData.sinaisVitais.find(v => v.tipo === 'Glicemia');
  if (glicemia && !vitais.some(v => v.tipo === 'Glicemia')) vitais.push(glicemia);
  // Always include Sono
  const sono = mockData.sinaisVitais.find(v => v.tipo === 'Sono');
  if (sono && !vitais.some(v => v.tipo === 'Sono')) vitais.push(sono);
  // Always include Oxigenação
  const oxig = mockData.sinaisVitais.find(v => v.tipo === 'Oxigenação' || v.tipo === 'Oxigenação');
  if (oxig && !vitais.some(v => v.tipo === oxig.tipo)) vitais.push(oxig);
  // Always include Hidratação
  const hidra = mockData.sinaisVitais.find(v => v.tipo === 'Hidratação' || v.tipo === 'Hidratação');
  if (hidra && !vitais.some(v => v.tipo === hidra.tipo)) vitais.push(hidra);
  const vitalsHtml = vitais.map(v => createVitalCard(v, { layout: 'home' })).join('');
  document.getElementById('homeVitals').innerHTML = vitalsHtml || '<div class="card-info home-empty-card">Nenhum sinal configurado para o Dashboard.</div>';

  var subtitleEl = document.getElementById('homeSaudeSubtitle');
  if (subtitleEl) subtitleEl.textContent = 'Hoje - ' + vitais.length + ' indicadores';

  const _d15 = new Date(); _d15.setDate(_d15.getDate() + 15);
  const hoje15 = _d15.getFullYear() + '-' + String(_d15.getMonth()+1).padStart(2,'0') + '-' + String(_d15.getDate()).padStart(2,'0');
  const consultaHtml = mockData.consultas.length > 0
    ? createConsultaCard(Object.assign({}, mockData.consultas[0], { data: hoje15 }), 'home')
    : '<div class="empty-state"><div class="empty-text">Nenhuma consulta agendada</div></div>';
  document.getElementById('homeConsulta').innerHTML = consultaHtml;
}

function addHidratação(ml) {
  const hidra = mockData.sinaisVitais.find(v => v.tipo === 'Hidratação');
  if (!hidra) return;
  const now = new Date();
  const hora = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const data = getTodayISODate();
  hidra.valor = (parseFloat(hidra.valor) || 0) + ml;
  const idealMatch = hidra.ideal ? String(hidra.ideal).match(/(\d+)/) : null;
  const idealLow = idealMatch ? Number(idealMatch[1]) : 2000;
  hidra.status = hidra.valor >= idealLow ? 'normal' : 'atencao';
  hidra.dataHora = data + 'T' + hora + ':00';
  hidra.dataHoraISO = hidra.dataHora;
  hidra.historico.unshift({ data, hora, valor: hidra.valor, status: hidra.status });
  renderHome();
  // also refresh detail modal if it's open for Hidratação
  var _modal = document.getElementById('vitalDetailModal');
  if (_modal && _modal.classList.contains('active') && typeof currentVitalDetail !== 'undefined' && currentVitalDetail && currentVitalDetail.tipo === 'Hidratação') {
    renderVitalDetailContent(currentVitalDetail.historico);
    renderSparklineChart(currentVitalHistoricoView && currentVitalHistoricoView.length ? currentVitalHistoricoView : currentVitalDetail.historico);
  }
}

function addOxigenação(pct) {
  var oxi = mockData.sinaisVitais.find(function(v) { return v.tipo === 'Oxigenação'; });
  if (!oxi) return;
  var now = new Date();
  var hora = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  var data = getTodayISODate();
  var status = pct >= 95 ? 'normal' : (pct >= 90 ? 'atencao' : 'critico');
  oxi.valor = pct;
  oxi.status = status;
  oxi.tempo = 'Agora';
  oxi.dataHora = data + 'T' + hora + ':00';
  oxi.dataHoraISO = oxi.dataHora;
  oxi.historico.unshift({ data: data, hora: hora, valor: pct, status: status });
  renderHome();
  var _modal = document.getElementById('vitalDetailModal');
  if (_modal && _modal.classList.contains('active') && typeof currentVitalDetail !== 'undefined' && currentVitalDetail && currentVitalDetail.tipo === 'Oxigenação') {
    renderVitalDetailContent(currentVitalDetail.historico);
    renderSparklineChart(currentVitalHistoricoView && currentVitalHistoricoView.length ? currentVitalHistoricoView : currentVitalDetail.historico);
  }
}

var oxigInsertData = { val: 98 };

function openOxigInsertView() {
  var chart = document.getElementById('pressaoHistoricoView');
  if (chart) chart.style.display = 'none';
  var filters = document.getElementById('vitalDefaultPeriodControls');
  if (filters) filters.style.display = 'none';
  var content = document.getElementById('vitalDetailContent');
  if (content) content.style.display = 'none';
  var addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (addRow) addRow.style.display = 'none';
  var titleEl = document.getElementById('vitalDetailTitle');
  if (titleEl) titleEl.textContent = 'Saturação de O?,,';
  oxigInsertData.val = 98;
  var view = document.getElementById('oxigInsertView');
  if (view) {
    view.style.display = 'flex';
    _oxigRenderGrid(98);
    _oxigUpdateBadge(98);
    _oxigUpdateDisplay(98);
  }
}

function closeOxigInsertView() {
  var view = document.getElementById('oxigInsertView');
  if (view) view.style.display = 'none';
  var chart = document.getElementById('pressaoHistoricoView');
  if (chart) chart.style.display = '';
  var filters = document.getElementById('vitalDefaultPeriodControls');
  if (filters) filters.style.display = '';
  var content = document.getElementById('vitalDetailContent');
  if (content) content.style.display = '';
  var addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (addRow) addRow.style.display = '';
  var titleEl = document.getElementById('vitalDetailTitle');
  if (titleEl) titleEl.textContent = 'Histórico de Oxigenação';
}

function oxigSelectValue(v) {
  oxigInsertData.val = v;
  _oxigRenderGrid(v);
  _oxigUpdateBadge(v);
  _oxigUpdateDisplay(v);
}

function stepOxig(delta) {
  var newVal = Math.max(50, Math.min(100, (oxigInsertData.val || 98) + delta));
  oxigSelectValue(newVal);
}

function _oxigRenderGrid(selected) {
  var cells = document.querySelectorAll('#oxigGrid .oxi-cell');
  cells.forEach(function(c) {
    var v = parseInt(c.getAttribute('data-val'), 10);
    c.classList.toggle('oxi-cell--selected', v === selected);
  });
}

function _oxigUpdateBadge(v) {
  var badge = document.getElementById('oxigBadge');
  if (!badge) return;
  if (v >= 95) {
    badge.className = 'oxi-badge oxi-badge--normal';
    badge.textContent = 'Normal';
  } else if (v >= 90) {
    badge.className = 'oxi-badge oxi-badge--atencao';
    badge.textContent = 'Atenção';
  } else {
    badge.className = 'oxi-badge oxi-badge--critico';
    badge.textContent = 'Crítico';
  }
}

function _oxigUpdateDisplay(v) {
  var el = document.getElementById('oxigCurrentVal');
  if (!el) return;
  el.innerHTML = v + '<span class="oxi-unit">%</span>';
}

function oxigConfirm() {
  var v = oxigInsertData.val;
  if (!v || v <= 0) return;
  addOxigenação(v);
  closeOxigInsertView();
}

function openHidraInsertView() {
  var chart = document.getElementById('pressaoHistoricoView');
  if (chart) chart.style.display = 'none';
  var filters = document.getElementById('vitalDefaultPeriodControls');
  if (filters) filters.style.display = 'none';
  var content = document.getElementById('vitalDetailContent');
  if (content) content.style.display = 'none';
  var addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (addRow) addRow.style.display = 'none';
  var titleEl = document.getElementById('vitalDetailTitle');
  if (titleEl) titleEl.textContent = 'Adicionar Água';
  hidraInsertData.ml = 250;
  var view = document.getElementById('hidraInsertView');
  if (view) {
    view.style.display = 'flex';
    var inp = document.getElementById('hidraNumInput');
    if (inp) {
      inp.value = 250;
      setTimeout(function() { inp.focus(); inp.select(); }, 120);
    }
  }
}

function closeHidraInsertView() {
  var view = document.getElementById('hidraInsertView');
  if (view) view.style.display = 'none';
  var chart = document.getElementById('pressaoHistoricoView');
  if (chart) chart.style.display = '';
  var filters = document.getElementById('vitalDefaultPeriodControls');
  if (filters) filters.style.display = '';
  var content = document.getElementById('vitalDetailContent');
  if (content) content.style.display = '';
  var addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (addRow) addRow.style.display = '';
  var titleEl = document.getElementById('vitalDetailTitle');
  if (titleEl && typeof currentVitalDetail !== 'undefined' && currentVitalDetail) {
    titleEl.textContent = 'Histórico de Hidratação';
  }
}

function hidraDrumConfirm() {
  var v = hidraInsertData.ml;
  if (!v || v <= 0) return;
  addHidratação(v);
  closeHidraInsertView();
}

function onHidraNumInput(el) {
  var v = parseInt(el.value, 10);
  if (!isNaN(v) && v > 0) {
    hidraInsertData.ml = Math.min(9999, Math.max(1, v));
  }
}

function stepHidra(delta) {
  var newVal = Math.max(50, Math.min(9999, (hidraInsertData.ml || 250) + delta));
  hidraInsertData.ml = newVal;
  var inp = document.getElementById('hidraNumInput');
  if (inp) inp.value = newVal;
}

function hidraQuickAdd(ml) {
  addHidratação(ml);
  closeHidraInsertView();
}

function renderSaude() {
  const ativos = mockData.sinaisVitais
    .filter(v => (mockData.configSinaisVitais[v.tipo] || {}).exibirSaude !== false);

  const isOutOfIdeal = (v) => {
    if (!v || v.valor == null || !v.ideal) return false;
    const ideal = v.ideal;
    const getNum = (val) => {
      if (v.tipo === 'Pressão Arterial') {
        if (val && typeof val === 'object' && val.sistolica != null) return parseFloat(val.sistolica);
        if (typeof val === 'string' && val.includes('/')) return parseFloat(val.split('/')[0]);
      }
      const n = parseFloat(val);
      return Number.isNaN(n) ? null : n;
    };
    const current = getNum(v.valor);
    if (current == null) return false;

    if (ideal.type === 'range' && ideal.min != null && ideal.max != null) return current < ideal.min || current > ideal.max;
    if (ideal.type === 'max' && ideal.max != null) return current > ideal.max;
    if (ideal.type === 'min' && ideal.min != null) return current < ideal.min;
    if (ideal.type === 'target' && ideal.target != null) return current !== ideal.target;
    if (ideal.type === 'pressure' && ideal.systolic != null) return current > ideal.systolic;
    return false;
  };

  const foraDoIdeal = ativos.filter(isOutOfIdeal);
  const principaisTipos = new Set(['Pressão Arterial', 'Batimento Cardíaco', 'Oxigenação', 'Glicemia', 'Sono']);
  const principais = ativos.filter(v => !foraDoIdeal.includes(v) && principaisTipos.has(v.tipo));
  const outros = ativos.filter(v => !foraDoIdeal.includes(v) && !principaisTipos.has(v.tipo));

  let html = '';

  let firstRendered = false;

  if (foraDoIdeal.length) {
    html += `<div class="subsection-title">Fora do ideal</div>`;
    html += foraDoIdeal.map((v, i) => createVitalCard(v, { featured: !firstRendered && i === 0 })).join('');
    firstRendered = true;
  }

  if (principais.length) {
    html += `<div class="subsection-title">Principais</div>`;
    html += principais.map((v, i) => createVitalCard(v, { featured: !firstRendered && i === 0 })).join('');
    firstRendered = true;
  }

  if (outros.length) {
    html += `<div class="subsection-title">Outros</div>`;
    html += outros.map((v, i) => createVitalCard(v, { featured: !firstRendered && i === 0 })).join('');
  }

  if (mockData.ecgs.length > 0) {
    html += mockData.ecgs.map(createEcgCard).join('');
  }

  document.getElementById('saudeContent').innerHTML = html ||
    '<div class="empty-state"><div class="empty-text">Nenhum sinal ativo</div></div>';
}

function renderMedicacoes() {
  const today = getTodayISODate();
  const nowHHMM = getCurrentHHMM();

  const medsWithOrder = [...mockData.medicacoes].map((med) => {
    const horariosOrdenados = [...(med.horarios || [])].sort((a, b) => a.localeCompare(b));
    const slots = horariosOrdenados.map((h) => ({
      horario: h,
      status: getMedicationStatusForDate(med, today, h, nowHHMM)
    }));
    const nextSlot = slots.find((s) => s.status !== 'tomado') || null;
    const firstHorario = horariosOrdenados[0] || '99:99';
    return {
      med,
      hasPending: !!nextSlot,
      nextHorario: nextSlot ? nextSlot.horario : '99:99',
      firstHorario
    };
  });

  const paraTomar = medsWithOrder
    .filter((x) => x.hasPending)
    .sort((a, b) => {
      if (a.nextHorario !== b.nextHorario) return a.nextHorario.localeCompare(b.nextHorario);
      if (a.firstHorario !== b.firstHorario) return a.firstHorario.localeCompare(b.firstHorario);
      return a.med.nome.localeCompare(b.med.nome);
    })
    .map((x) => x.med);

  const tomadasHoje = medsWithOrder
    .filter((x) => !x.hasPending)
    .sort((a, b) => {
      if (a.firstHorario !== b.firstHorario) return a.firstHorario.localeCompare(b.firstHorario);
      return a.med.nome.localeCompare(b.med.nome);
    })
    .map((x) => x.med);

  let hojeHtml = '';
  if (paraTomar.length > 0) {
    hojeHtml += paraTomar.map(createMedicacaoCard).join('');
  }
  if (tomadasHoje.length > 0) {
    hojeHtml += '    <div class="subsection-title">Já tomadas hoje</div>';
    hojeHtml += tomadasHoje.map(createMedicacaoCard).join('');
  }

  document.getElementById('medicacoesHoje').innerHTML = hojeHtml ||
    '<div class="empty-state"><div class="empty-text">Nenhuma medicação cadastrada para hoje.</div></div>';

  renderMedicationOverdueSection();
  updateMedicationCalendarHeader();
}

function renderAgenda() {
  let html = '';

  const consultasOrdenadas = [...mockData.consultas].sort((a, b) => (a.data + ' ' + (a.hora || '00:00')).localeCompare(b.data + ' ' + (b.hora || '00:00')));
  const examesAgendadosOrdenados = [...mockData.examesAgendados].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  const proximos = [...consultasOrdenadas.map(c => ({ tipo: 'consulta', item: c })), ...examesAgendadosOrdenados.map(e => ({ tipo: 'exame', item: e }))]
    .sort((a, b) => {
      const aKey = a.tipo === 'consulta' ? `${a.item.data} ${(a.item.hora || '00:00')}` : `${a.item.data} 00:00`;
      const bKey = b.tipo === 'consulta' ? `${b.item.data} ${(b.item.hora || '00:00')}` : `${b.item.data} 00:00`;
      return aKey.localeCompare(bKey);
    });

  if (proximos.length > 0) {
    const primeiro = proximos[0];
    html += '<div class="agenda-section">';
    html += '<div class="subsection-title">Próximo compromisso</div>';
    html += primeiro.tipo === 'consulta'
      ? createConsultaCard(primeiro.item, 'home')
      : createExameCard(primeiro.item, false);
    html += '</div>';
  }

  if (consultasOrdenadas.length > 0) {
    html += '<div class="agenda-section">';
    html += '<div class="subsection-title">Consultas agendadas</div>';
    html += consultasOrdenadas.map(c => createConsultaCard(c, 'home')).join('');
    html += '</div>';
  }

  if (examesAgendadosOrdenados.length > 0) {
    html += '<div class="agenda-section">';
    html += '<div class="subsection-title">Exames agendados</div>';
    html += examesAgendadosOrdenados.map(e => createExameCard(e, false)).join('');
    html += '</div>';
  }

  if (mockData.examesRealizados.length > 0) {
    html += '<div class="agenda-section">';
    html += '<div class="subsection-title">Exames realizados</div>';
    html += mockData.examesRealizados.map(e => createExameCard(e, true)).join('');
    html += '</div>';
  }

  if (!html) {
    html = '<div class="empty-state"><div class="empty-text">Nenhum agendamento</div></div>';
  }

  document.getElementById('agendaContent').innerHTML = html;
}

function renderCompartilhamentoInPerfil() {
  let html = '';

  if (mockData.compartilhamentos.length > 0) {
    html = mockData.compartilhamentos.map(createCompartilhamentoCard).join('');
  } else {
    html = '<div class="empty-state"><div class="empty-text">Nenhum compartilhamento ativo</div></div>';
  }

  const compartilhamentoContent = document.getElementById('compartilhamentoContent');
  if (compartilhamentoContent) {
    compartilhamentoContent.innerHTML = html;
  }
}

function togglePerfilMask(elId) {
  var el = document.getElementById(elId);
  if (!el) return;
  var showing = el.dataset.showing === 'true';
  el.textContent = showing ? el.dataset.masked : el.dataset.real;
  el.dataset.showing = showing ? 'false' : 'true';
}

function togglePerfilMenuSection() {
  var sec = document.getElementById('perfilMenuSection');
  var chevron = document.getElementById('perfilMenuChevron');
  if (!sec) return;
  var open = sec.style.display !== 'none';
  sec.style.display = open ? 'none' : '';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(90deg)';
}

function renderPerfil() {
  const usuario = mockData.usuario;
  const idade = calcularIdade(usuario.dataNascimento);
  ensureBottomNavConfig();

  // Helpers para mascarar dados sensA-veis
  function maskCpf(cpf) {
    return cpf ? cpf.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, '?????????.?????????.$3-$4') : '–';
  }
  function maskTel(tel) {
    return tel ? tel.replace(/(\(\d{2}\))\s(\d{4,5})-(\d{4})/, '$1 ???????????????-$3') : '–';
  }

  const navControlItems = [
    {
      screenId: 'saudeScreen',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
      title: 'Saúde',
      subtitle: 'Mostrar no menu inferior',
      personalize: 'vitais'
    },
    {
      screenId: 'composicaoScreen',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="14" width="4" height="6" rx="1"/><rect x="9" y="9" width="4" height="11" rx="1"/><rect x="16" y="4" width="4" height="16" rx="1"/></svg>`,
      title: 'Corpo',
      subtitle: 'Mostrar no menu inferior',
      personalize: 'corpo'
    },
    {
      screenId: 'medicacoesScreen',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/><circle cx="18" cy="18" r="3"/><path d="m22 22-1.5-1.5"/></svg>`,
      title: 'Medicações',
      subtitle: 'Mostrar no menu inferior',
      personalize: null
    },
    {
      screenId: 'agendaScreen',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      title: 'Agenda',
      subtitle: 'Mostrar no menu inferior',
      personalize: null
    }
  ];

  const navControlsHtml = navControlItems
    .map((item) => {
      const gear =
        item.personalize === 'vitais'
          ? `<button type="button" class="config-gear-btn config-gear-btn--nav-row" onclick="event.stopPropagation(); openVitaisConfigModal()" aria-label="Personalizar o que aparece em Saúde e no Dashboard"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>`
          : '';
      return `
    <div class="config-item">
      <div class="config-item-content">
        <div class="config-icon">${item.icon}</div>
        <div class="config-text">
          <div class="config-title">${item.title}</div>
          <div class="config-subtitle">${item.subtitle}</div>
        </div>
      </div>
      <div class="config-item-nav-actions">
        ${gear}
        <button
          type="button"
          class="toggle ${mockData.configBottomNav[item.screenId] ? 'active' : ''}"
          onclick="toggleBottomNavItem('${item.screenId}', this)"
          aria-label="Alternar exibição de ${item.title} no menu inferior"
        ></button>
      </div>
    </div>`;
    })
    .join('');

  // Iniciais para o avatar
  const iniciais = getIniciaisNome(usuario.nome);

  // Avatar: foto ou iniciais
  const avatarHtml = usuario.fotoPerfilUrl
    ? `<img src="${usuario.fotoPerfilUrl}" class="perfil-hero-avatar" alt="Foto de perfil" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="perfil-hero-avatar perfil-hero-avatar--initials" style="display:none">${iniciais}</div>`
    : `<div class="perfil-hero-avatar perfil-hero-avatar--initials">${iniciais}</div>`;

  let html = `
    <!-- ?"–? HERO ?"–? -->
    <div class="perfil-hero">
      <div class="perfil-hero-avatar-wrap">
        ${avatarHtml}
      </div>
      <div class="perfil-hero-name">${usuario.nome}</div>
      <div class="perfil-hero-meta">${idade} anos | Paciente</div>

      <!-- Dados pessoais com máscara -->
      <div class="perfil-hero-dados">
        <div class="perfil-dado-row">
          <span class="perfil-dado-lbl">E-mail</span>
          <span class="perfil-dado-val">${usuario.email}</span>
        </div>
        <div class="perfil-dado-row">
          <span class="perfil-dado-lbl">CPF</span>
          <span class="perfil-dado-val perfil-dado-masked" data-real="${usuario.cpf}" data-masked="${maskCpf(usuario.cpf)}" id="perfilCpf">${maskCpf(usuario.cpf)}</span>
          <button type="button" class="perfil-reveal-btn" onclick="togglePerfilMask('perfilCpf')" aria-label="Revelar CPF">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <div class="perfil-dado-row">
          <span class="perfil-dado-lbl">Telefone</span>
          <span class="perfil-dado-val perfil-dado-masked" data-real="${usuario.telefone}" data-masked="${maskTel(usuario.telefone)}" id="perfilTel">${maskTel(usuario.telefone)}</span>
          <button type="button" class="perfil-reveal-btn" onclick="togglePerfilMask('perfilTel')" aria-label="Revelar telefone">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ?"–? CONFIGURAÇÕES->
    <div class="perfil-section-title">Configurações</div>
    <div class="config-item" onclick="openMeusIndicadoresModal()" style="cursor:pointer;">
      <div class="config-item-content">
        <div class="config-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
        <div class="config-text">
          <div class="config-title">Meus Indicadores</div>
          <div class="config-subtitle">Gerenciar sinais vitais e composição</div>
        </div>
      </div>
      <div>???</div>
    </div>

    <!-- Personalizar menu – colapsável -->
    <div class="config-item config-item--collapsible" onclick="togglePerfilMenuSection()" style="cursor:pointer;" id="perfilMenuToggleRow">
      <div class="config-item-content">
        <div class="config-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></div>
        <div class="config-text">
          <div class="config-title">Personalizar menu</div>
          <div class="config-subtitle">Escolher o que aparece na barra inferior</div>
        </div>
      </div>
      <span id="perfilMenuChevron" style="font-size:18px;color:#94a3b8;transition:transform 0.2s;">???</span>
    </div>
    <div id="perfilMenuSection" style="display:none;">
      ${navControlsHtml}
    </div>

    <!-- ?"–? DISPOSITIVOS ?"–? -->
    <div class="perfil-section-title">Dispositivos</div>
    <div class="config-item" onclick="openAddDispositivoModal()" style="cursor:pointer;">
      <div class="config-item-content">
        <div class="config-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 3 10 6.5 13.5"/><polyline points="17.5 6.5 21 10 17.5 13.5"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
        <div class="config-text">
          <div class="config-title">Cadastrar Dispositivo</div>
          <div class="config-subtitle">Conectar relógio, balança ou app</div>
        </div>
      </div>
      <div>???</div>
    </div>
    <div id="dispositivosContent"></div>

    <!-- ?"–? COMPARTILHAMENTO ?"–? -->
    <div class="perfil-section-title">Compartilhamento</div>
    <div class="config-item" id="addCompartilhamentoBtn" style="cursor:pointer;">
      <div class="config-item-content">
        <div class="config-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
        <div class="config-text">
          <div class="config-title">Compartilhar com MAcdico</div>
          <div class="config-subtitle">Liberar acesso aos seus dados de saúde</div>
        </div>
      </div>
      <div>???</div>
    </div>
    <div id="compartilhamentoContent" style="margin-top:8px;"></div>

    <!-- ?"–? CONTA ?"–? -->
    <div class="perfil-section-title">Conta</div>
    <div class="config-item" style="cursor:pointer;">
      <div class="config-item-content">
        <div class="config-icon" style="color:#3b82f6;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
        <div class="config-text">
          <div class="config-title">Notificações</div>
          <div class="config-subtitle">Lembretes de medicação e alertas</div>
        </div>
      </div>
      <div>???</div>
    </div>
    <div class="config-item" style="cursor:pointer;">
      <div class="config-item-content">
        <div class="config-icon" style="color:#6d28d9;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
        <div class="config-text">
          <div class="config-title">Privacidade e Segurança</div>
          <div class="config-subtitle">Gerenciar seus dados pessoais</div>
        </div>
      </div>
      <div>???</div>
    </div>
    <div class="config-item config-item--danger" style="cursor:pointer; margin-bottom:32px;">
      <div class="config-item-content">
        <div class="config-icon" style="color:#ef4444;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>
        <div class="config-text">
          <div class="config-title" style="color:#ef4444;">Sair da conta</div>
          <div class="config-subtitle">Encerrar sessão no app</div>
        </div>
      </div>
    </div>

    <!-- ?"–? DEMO ?"–? -->
    <div class="perfil-section-title" style="color:#64748b;font-size:11px;letter-spacing:0.5px;">Demo</div>
    <div class="config-item" onclick="simulatePushNotification()" style="cursor:pointer;">
      <div class="config-item-content">
        <div class="config-icon" style="color:#f59e0b;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="12" y1="2" x2="12" y2="3"/></svg>
        </div>
        <div class="config-text">
          <div class="config-title">Simular Notificação Push</div>
          <div class="config-subtitle">Demonstração de alerta de medição</div>
        </div>
      </div>
      <div style="color:#64748b;font-size:13px;">???</div>
    </div>
    <div class="config-item" onclick="simulateAlertPopup()" style="cursor:pointer;margin-bottom:40px;">
      <div class="config-item-content">
        <div class="config-icon" style="color:#ef4444;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div class="config-text">
          <div class="config-title">Simular Alerta Pop-up</div>
          <div class="config-subtitle">Demonstração de aviso de medição</div>
        </div>
      </div>
      <div style="color:#64748b;font-size:13px;">???</div>
    </div>
  `;

  document.getElementById('perfilContent').innerHTML = html;

  document.getElementById('addCompartilhamentoBtn').addEventListener('click', () => {
    document.getElementById('addCompartilhamentoModal').classList.add('active');
  });

  renderCompartilhamentoInPerfil();
  renderDispositivos();
}

function simulatePushNotification() {
  // Remove any existing banner
  var _old = document.getElementById('pushNotifBanner');
  if (_old) { _old.remove(); }

  var _dur = 5000; // ms visible
  var _banner = document.createElement('div');
  _banner.id = 'pushNotifBanner';
  _banner.className = 'push-notif-banner';
  _banner.innerHTML = [
    '<div class="push-notif-header">',
      '<div class="push-notif-icon">',
        '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
      '</div>',
      '<span class="push-notif-appname">Teep Sa\u00fade</span>',
      '<span class="push-notif-time">agora</span>',
      '<button class="push-notif-dismiss" onclick="(function(){var b=document.getElementById(\'pushNotifBanner\');if(b)b.classList.remove(\'show\');setTimeout(function(){if(b)b.remove();},420);})()" aria-label="Fechar notifica\u00e7\u00e3o">\u2715</button>',
    '</div>',
    '<div class="push-notif-title">\ud83d\udc89 Lembrete de Sa\u00fade</div>',
    '<div class="push-notif-body">Est\u00e1 na hora de medir sua press\u00e3o arterial. Toque para registrar agora.</div>',
    '<div class="push-notif-progress"><div class="push-notif-progress-bar" id="pushNotifProgressBar"></div></div>'
  ].join('');
  document.body.appendChild(_banner);

  // Vibrate on mobile if available
  if (navigator.vibrate) navigator.vibrate([120, 60, 80]);

  // Show with animation
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      _banner.classList.add('show');
      // Animate shrinking progress bar over _dur ms
      var _bar = document.getElementById('pushNotifProgressBar');
      if (_bar) {
        _bar.style.transition = 'none';
        _bar.style.width = '100%';
        requestAnimationFrame(function() {
          _bar.style.transition = 'width ' + (_dur / 1000) + 's linear';
          _bar.style.width = '0%';
        });
      }
    });
  });

  // Auto-dismiss
  var _tid = setTimeout(function() {
    _banner.classList.remove('show');
    setTimeout(function() { if (_banner.parentNode) _banner.remove(); }, 420);
  }, _dur);

  // Clicking banner body closes it
  _banner.addEventListener('click', function(e) {
    if (e.target.classList.contains('push-notif-dismiss')) return;
    clearTimeout(_tid);
    _banner.classList.remove('show');
    setTimeout(function() { if (_banner.parentNode) _banner.remove(); }, 420);
  });
}

function simulateAlertPopup() {
  var _old = document.getElementById('alertPopupOverlay');
  if (_old) _old.remove();

  var _overlay = document.createElement('div');
  _overlay.id = 'alertPopupOverlay';
  _overlay.className = 'alert-popup-overlay';
  _overlay.innerHTML = [
    '<div class="alert-popup-box">',
      '<div class="alert-popup-type-badge">',
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        'Press\u00e3o Arterial',
      '</div>',
      '<div class="alert-popup-icon-ring">',
        '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
      '</div>',
      '<div class="alert-popup-title">Hora da Medi\u00e7\u00e3o!</div>',
      '<div class="alert-popup-msg">Sua press\u00e3o arterial ainda n\u00e3o foi registrada hoje. Fa\u00e7a a medi\u00e7\u00e3o agora para manter seu hist\u00f3rico em dia.</div>',
      '<div class="alert-popup-actions">',
        '<button class="alert-popup-btn-primary" onclick="registrarVitalFromAlert(\'Press\u00e3o Arterial\')">Registrar agora</button>',
        '<button class="alert-popup-btn-secondary" onclick="closeAlertPopup()">Lembrar em 30 minutos</button>',
      '</div>',
    '</div>'
  ].join('');

  _overlay.addEventListener('click', function(e) {
    if (e.target === _overlay) closeAlertPopup();
  });

  document.body.appendChild(_overlay);

  if (navigator.vibrate) navigator.vibrate([100]);

  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      _overlay.classList.add('show');
    });
  });
}

function closeAlertPopup() {
  var _overlay = document.getElementById('alertPopupOverlay');
  if (!_overlay) return;
  _overlay.classList.remove('show');
  setTimeout(function() { if (_overlay.parentNode) _overlay.remove(); }, 280);
}

function registrarVitalFromAlert(tipo) {
  closeAlertPopup();
  var v = mockData.sinaisVitais.find(function(x) { return x.tipo === tipo; });
  if (!v) return;
  setTimeout(function() {
    openVitalDetailModal(tipo, v.id);
    setTimeout(function() {
      if (tipo === 'Press\u00e3o Arterial') {
        openPressaoInsertForm();
      } else {
        openAddVitalModal(tipo);
      }
    }, 150);
  }, 310);
}

// ===== NAVEGAÇÃO =====

function setupNavigation() {
  document.querySelectorAll('.tab-link').forEach(item => {
    item.addEventListener('click', () => {
      const screenId = item.dataset.screen;
      switchScreen(screenId);
      
      document.querySelectorAll('.tab-link').forEach(i => i.classList.remove('tab-link-active'));
      item.classList.add('tab-link-active');
    });
  });
}

function switchScreen(screenId) {
  var prevScreen = document.querySelector('.screen.active');
  var nextScreen = document.getElementById(screenId);
  if (!nextScreen || nextScreen === prevScreen) return;

  // Garante que telas sobressalentes não fiquem visA-veis ao trocar de aba.
  document.querySelectorAll('.screen.active').forEach(function(screen) {
    if (screen !== prevScreen && screen !== nextScreen) {
      screen.classList.remove('active', 'screen--leaving', 'screen--entering');
    }
  });

  if (prevScreen) {
    prevScreen.classList.add('screen--leaving');
    prevScreen.addEventListener('animationend', function handler() {
      prevScreen.classList.remove('active', 'screen--leaving');
      prevScreen.removeEventListener('animationend', handler);
    }, { once: true });
  }

  nextScreen.classList.add('active', 'screen--entering');
  nextScreen.addEventListener('animationend', function handler() {
    nextScreen.classList.remove('screen--entering');
    nextScreen.removeEventListener('animationend', handler);
  }, { once: true });

  currentScreen = screenId;
  setGlobalHeaderVisible(true);
  updateHeaderForScreen(screenId);

  if (screenId === 'homeScreen') renderHome();
  else if (screenId === 'saudeScreen') renderSaude();
  else if (screenId === 'composicaoScreen') renderComposicao();
  else if (screenId === 'medicacoesScreen') renderMedicacoes();
  else if (screenId === 'agendaScreen') renderAgenda();
  else if (screenId === 'perfilScreen') renderPerfil();
}

// ===== MODAL DE MEDICAÇÃO =====

function setSemDataFimMedicacaoUI(mode, semFimOn) {
  const btn = document.getElementById(mode === 'add' ? 'toggleSemDataFimMed' : 'toggleSemDataFimMedEdit');
  const grp = document.getElementById(mode === 'add' ? 'duracaoDiasMedGroup' : 'editDuracaoDiasMedGroup');
  const inp = document.getElementById(mode === 'add' ? 'duracaoDiasMedInput' : 'editDuracaoDiasMedInput');
  const hint = document.getElementById(mode === 'add' ? 'estoqueSugeridoAddText' : 'estoqueSugeridoEditText');
  if (!btn || !grp) return;
  btn.classList.toggle('active', !!semFimOn);
  grp.style.display = semFimOn ? 'none' : 'block';
  if (inp && semFimOn) inp.value = '';
  if (hint && semFimOn) hint.textContent = '';
}

function getDosesPorDiaFromHorarioInputs(selector) {
  const filled = [...document.querySelectorAll(selector)].filter((i) => i.value).length;
  if (filled > 0) return filled;
  return 0;
}

function getDosesPorDiaFromFrequencia(frequencia) {
  if (frequencia === '1x ao dia') return 1;
  if (frequencia === '2x ao dia') return 2;
  if (frequencia === '3x ao dia') return 3;
  if (frequencia === '4x ao dia') return 4;
  if (frequencia === 'Conforme necessário') return 1;
  return 0;
}

function refreshEstoqueSugeridoAdd() {
  const hint = document.getElementById('estoqueSugeridoAddText');
  if (!hint) return;
  const sem = document.getElementById('toggleSemDataFimMed')?.classList.contains('active');
  if (sem) {
    hint.textContent = '';
    return;
  }
  const d = parseInt(document.getElementById('duracaoDiasMedInput')?.value, 10);
  const freq = document.getElementById('frequenciaMedInput')?.value;
  let dosesPorDia = getDosesPorDiaFromHorarioInputs('.horario-input');
  if (dosesPorDia === 0 && freq) dosesPorDia = getDosesPorDiaFromFrequencia(freq);
  if (!d || d < 1) {
    hint.textContent = '';
    return;
  }
  if (dosesPorDia < 1) {
    hint.textContent = 'Defina a frequência e os horários para calcular o estoque sugerido.';
    return;
  }
  const sug = d * dosesPorDia;
  hint.textContent = `Sugestão de estoque para o período: ${sug} unidades (${d} dia(s) A- ${dosesPorDia} dose(s)/dia).`;
}

function refreshEstoqueSugeridoEdit() {
  const hint = document.getElementById('estoqueSugeridoEditText');
  if (!hint) return;
  const sem = document.getElementById('toggleSemDataFimMedEdit')?.classList.contains('active');
  if (sem) {
    hint.textContent = '';
    return;
  }
  const d = parseInt(document.getElementById('editDuracaoDiasMedInput')?.value, 10);
  const freq = document.getElementById('editFrequenciaMedInput')?.value;
  let dosesPorDia = getDosesPorDiaFromHorarioInputs('.edit-horario-input');
  if (dosesPorDia === 0 && freq) dosesPorDia = getDosesPorDiaFromFrequencia(freq);
  if (!d || d < 1) {
    hint.textContent = '';
    return;
  }
  if (dosesPorDia < 1) {
    hint.textContent = 'Defina a frequência e os horários para calcular o estoque sugerido.';
    return;
  }
  const sug = d * dosesPorDia;
  hint.textContent = `Sugestão de estoque para o período: ${sug} unidades (${d} dia(s) A- ${dosesPorDia} dose(s)/dia).`;
}

function toggleSemDataFimMedicacao(mode) {
  const btn = document.getElementById(mode === 'add' ? 'toggleSemDataFimMed' : 'toggleSemDataFimMedEdit');
  if (!btn) return;
  const next = !btn.classList.contains('active');
  setSemDataFimMedicacaoUI(mode, next);
  if (mode === 'add') refreshEstoqueSugeridoAdd();
  else refreshEstoqueSugeridoEdit();
}

/** Wizard adicionar medicação (4 etapas) */
let addMedStep = 1;
const ADD_MED_TITLES = ['Qual medicamento?', 'Com que frequência?', 'Quando lembrar?', 'Estoque e alertas'];

function updateAddMedProgressUI() {
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById(`addMedDot${i}`);
    if (dot) {
      dot.classList.remove('active', 'done');
      if (i < addMedStep) dot.classList.add('done');
      else if (i === addMedStep) dot.classList.add('active');
    }
  }
  const t = document.getElementById('addMedicacaoModalTitle');
  if (t) t.textContent = ADD_MED_TITLES[addMedStep - 1] || 'Adicionar Medicação';
}

function updateAddMedNavButtons() {
  const back = document.getElementById('addMedWizardBack');
  const next = document.getElementById('addMedWizardNext');
  const save = document.getElementById('addMedWizardSave');
  if (back) back.style.display = addMedStep > 1 ? 'block' : 'none';
  if (next) next.style.display = addMedStep < 4 ? '' : 'none';
  if (save) save.style.display = addMedStep === 4 ? 'block' : 'none';
}

function resetAddMedFrequenciaExpand() {
  const s = document.getElementById('frequenciaMedInput');
  const moreBtn = document.getElementById('addMedFreqMoreBtn');
  if (s) {
    s.classList.add('visually-hidden');
    s.style.width = '';
    s.style.marginTop = '';
  }
  if (moreBtn) moreBtn.style.display = '';
}

function initAddMedicacaoWizard() {
  addMedStep = 1;
  resetAddMedFrequenciaExpand();
  document.querySelectorAll('#addMedFreqButtons .add-med-freq-btn[data-freq]').forEach((b) => b.classList.remove('selected'));
  const fi = document.getElementById('frequenciaMedInput');
  if (fi) fi.value = '';
  document.querySelectorAll('#addMedicacaoForm .add-med-step').forEach((el) => {
    el.style.display = el.getAttribute('data-step') === '1' ? 'block' : 'none';
  });
  updateAddMedProgressUI();
  updateAddMedNavButtons();
  updateMedManualRegisterBtn();
}

function validateAddMedStep(step) {
  const nome = document.getElementById('selectedMedName')?.value;
  const dosagem = document.getElementById('dosagemMedInput')?.value;
  const semDataFim = document.getElementById('toggleSemDataFimMed')?.classList.contains('active');
  const dur = parseInt(document.getElementById('duracaoDiasMedInput')?.value, 10);
  if (step === 1) {
    if (!nome) return 'Selecione um medicamento para continuar.';
    if (!dosagem) return 'Selecione a dosagem.';
    if (!semDataFim && (!dur || dur < 1)) {
      return 'Informe por quantos dias o medicamento será tomado ou ative uso contA-nuo (sem período previsto).';
    }
  }
  if (step === 2) {
    const f = document.getElementById('frequenciaMedInput')?.value;
    if (!f) return 'Selecione com que frequência você toma este medicamento.';
  }
  if (step === 3) {
    const dataInicio = document.getElementById('dataInicioMedInput')?.value;
    const horarios = Array.from(document.querySelectorAll('.horario-input')).map((i) => i.value).filter(Boolean);
    if (!dataInicio) return 'Informe a data de inA-cio.';
    if (horarios.length === 0) return 'Informe os horários dos lembretes.';
  }
  return null;
}

function goToAddMedStep(step, skipValidation) {
  if (step < 1 || step > 4) return;
  if (!skipValidation && step > addMedStep) {
    const err = validateAddMedStep(addMedStep);
    if (err) {
      showFeedbackModal(err, 'warning');
      return;
    }
  }
  addMedStep = step;
  document.querySelectorAll('#addMedicacaoForm .add-med-step').forEach((el) => {
    const s = parseInt(el.getAttribute('data-step'), 10);
    el.style.display = s === step ? 'block' : 'none';
  });
  if (step === 3) {
    updateHorariosFields();
    if (typeof refreshEstoqueSugeridoAdd === 'function') refreshEstoqueSugeridoAdd();
  }
  updateAddMedProgressUI();
  updateAddMedNavButtons();
  if (step === 2) syncAddMedFreqButtons();
}

function setAddMedFrequencia(val) {
  const s = document.getElementById('frequenciaMedInput');
  if (!s) return;
  s.value = val;
  updateHorariosFields();
  document.querySelectorAll('#addMedFreqButtons .add-med-freq-btn[data-freq]').forEach((b) => {
    b.classList.toggle('selected', b.getAttribute('data-freq') === val);
  });
}

function syncAddMedFreqButtons() {
  const s = document.getElementById('frequenciaMedInput');
  if (!s) return;
  const val = s.value;
  document.querySelectorAll('#addMedFreqButtons .add-med-freq-btn[data-freq]').forEach((b) => {
    b.classList.toggle('selected', b.getAttribute('data-freq') === val);
  });
}

function expandAddMedFrequenciaSelect() {
  const s = document.getElementById('frequenciaMedInput');
  const moreBtn = document.getElementById('addMedFreqMoreBtn');
  if (!s) return;
  s.classList.remove('visually-hidden');
  s.style.width = '100%';
  s.style.marginTop = '12px';
  if (moreBtn) moreBtn.style.display = 'none';
  setTimeout(() => s.focus(), 80);
}

function escapeHtmlText(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function updateMedManualRegisterBtn() {
  const inp = document.getElementById('searchMedInput');
  const btn = document.getElementById('medRegisterManualBtn');
  if (!btn) return;
  const ok = inp && inp.value.trim().length >= 2;
  btn.disabled = !ok;
}

function registerCustomMedicamentoFromSearch() {
  const termo = document.getElementById('searchMedInput')?.value.trim() || '';
  if (termo.length < 2) {
    showFeedbackModal('Digite pelo menos 2 caracteres do nome do medicamento.', 'warning');
    return;
  }
  document.getElementById('selectedMedName').value = termo;
  const displayName = document.getElementById('medSelectedDisplayName');
  if (displayName) displayName.textContent = termo;
  const dosagemSelect = document.getElementById('dosagemMedInput');
  dosagemSelect.innerHTML = `
    <option value="">Selecione a dosagem</option>
    <option value="Conforme prescrição">Conforme prescrição</option>
    <option value="Uso conforme orientação mAcdica">Uso conforme orientação mAcdica</option>
    <option value="1 comprimido">1 comprimido</option>
    <option value="5 ml">5 ml</option>
    <option value="10 ml">10 ml</option>
    <option value="Variável / ajuste pelo médico">Variável / ajuste pelo médico</option>
  `;
  setAddMedicacaoMedPickPhase(false);
  const searchResults = document.getElementById('searchResults');
  if (searchResults) {
    searchResults.style.display = 'none';
    searchResults.innerHTML = '';
  }
  setTimeout(() => dosagemSelect.focus(), 80);
}

/** Campos que `form.reset()` não restaura (toggles, select dinâmico, lista de busca). */
function resetAddMedicacaoModalState() {
  const dosagemSelect = document.getElementById('dosagemMedInput');
  if (dosagemSelect) {
    dosagemSelect.innerHTML = '<option value="">Selecione a dosagem</option>';
  }
  ['toggleDashboardMed', 'toggleLembreteMed', 'toggleAtrasadaMed', 'toggleEstoqueMed'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  });
  setSemDataFimMedicacaoUI('add', false);
  const searchResults = document.getElementById('searchResults');
  if (searchResults) {
    searchResults.style.display = 'none';
    searchResults.innerHTML = '';
  }
  const searchInput = document.getElementById('searchMedInput');
  if (searchInput) searchInput.value = '';
  setAddMedicacaoMedPickPhase(true);
  initAddMedicacaoWizard();
  updateMedManualRegisterBtn();
}

function cleanupAddMedicacaoForm() {
  const addForm = document.getElementById('addMedicacaoForm');
  if (addForm) addForm.reset();
  const horarios = document.getElementById('horariosContainer');
  if (horarios) horarios.innerHTML = '';
  const selected = document.getElementById('selectedMedName');
  if (selected) selected.value = '';
  removerFoto();
  resetAddMedicacaoModalState();
}

function openAddMedicacaoEntry() {
  const addModal = document.getElementById('addMedicacaoModal');
  initAddMedicacaoWizard();
  const di = document.getElementById('dataInicioMedInput');
  if (di) di.value = getTodayISODate();
  const dur = document.getElementById('duracaoDiasMedInput');
  if (dur) dur.value = '';
  const hint = document.getElementById('estoqueSugeridoAddText');
  if (hint) hint.textContent = '';
  if (addModal) addModal.classList.add('active');
  updateMedManualRegisterBtn();
  setTimeout(() => refreshEstoqueSugeridoAdd(), 0);
}

function setupMedicacaoModal() {
  const addModal = document.getElementById('addMedicacaoModal');
  const cancelAddBtn = document.getElementById('cancelAddBtn');
  const addForm = document.getElementById('addMedicacaoForm');

  const closeModal = () => {
    addModal.classList.remove('active');
    cleanupAddMedicacaoForm();
  };

  const addMedNext = document.getElementById('addMedWizardNext');
  const addMedBack = document.getElementById('addMedWizardBack');
  if (addMedNext) addMedNext.addEventListener('click', () => goToAddMedStep(addMedStep + 1));
  if (addMedBack) addMedBack.addEventListener('click', () => goToAddMedStep(addMedStep - 1, true));
  if (addModal) {
    addModal.addEventListener('input', (e) => {
      if (e.target && (e.target.id === 'duracaoDiasMedInput' || e.target.id === 'dataInicioMedInput')) {
        refreshEstoqueSugeridoAdd();
      }
    });
  }
  if (cancelAddBtn) cancelAddBtn.addEventListener('click', closeModal);
  if (addModal) addModal.addEventListener('click', (e) => { if (e.target === addModal) closeModal(); });

  if (!addForm) return;

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (addMedStep !== 4) return;
    const nome = document.getElementById('selectedMedName').value;
    const dosagem = document.getElementById('dosagemMedInput').value;
    const frequencia = document.getElementById('frequenciaMedInput').value;
    const dataInicio = document.getElementById('dataInicioMedInput').value;
    const semDataFim = document.getElementById('toggleSemDataFimMed')?.classList.contains('active');
    const duracaoDias = semDataFim ? null : parseInt(document.getElementById('duracaoDiasMedInput')?.value, 10);
    const estoqueAtual = document.getElementById('estoqueAtualMedInput').value;
    const estoqueMinimo = document.getElementById('estoqueMinMedInput').value;

    const horarios = Array.from(document.querySelectorAll('.horario-input')).map(i => i.value).filter(Boolean);

    if (!nome) { showFeedbackModal('Selecione um medicamento para continuar.', 'warning'); return; }
    if (!dosagem) { showFeedbackModal('Selecione a dosagem para continuar.', 'warning'); return; }
    if (!estoqueAtual) { showFeedbackModal('Informe o estoque atual.', 'warning'); return; }
    if (!estoqueMinimo) { showFeedbackModal('Informe o estoque mínimo para aviso.', 'warning'); return; }
    if (parseInt(estoqueAtual, 10) < parseInt(estoqueMinimo, 10)) {
      showFeedbackModal('O estoque atual deve ser maior ou igual ao estoque mínimo.', 'warning');
      return;
    }
    if (!semDataFim && (!duracaoDias || duracaoDias < 1)) {
      showFeedbackModal('Informe por quantos dias o medicamento será tomado (ex.: 10, 20).', 'warning');
      return;
    }
    const dataFim = semDataFim ? '' : (typeof computeDataFimFromInicioDuracao === 'function'
      ? computeDataFimFromInicioDuracao(dataInicio, duracaoDias)
      : '');
    if (!semDataFim && !dataFim) {
      showFeedbackModal('Verifique a data de inA-cio e a duração em dias.', 'warning');
      return;
    }
    if (horarios.length === 0) {     showFeedbackModal('Informe pelo menos um horário.', 'warning'); return; }

    const saveMedicacao = () => {
      const exibirDashboard = document.getElementById('toggleDashboardMed').classList.contains('active');
      const alertas = {
        lembrete: document.getElementById('toggleLembreteMed').classList.contains('active'),
        antecedencia: parseInt(document.getElementById('antecedenciaMedInput').value),
        atrasada: document.getElementById('toggleAtrasadaMed').classList.contains('active'),
        estoqueBaixo: document.getElementById('toggleEstoqueMed').classList.contains('active')
      };

      const newId = Math.max(...mockData.medicacoes.map(m => m.id), 0) + 1;
      mockData.medicacoes.push({
        id: newId, nome, dosagem, horarios, frequencia, dataInicio, dataFim,
        duracaoDias: semDataFim ? null : duracaoDias,
        estoqueAtual: parseInt(estoqueAtual, 10) || 30, estoqueMinimo: parseInt(estoqueMinimo, 10) || 7,
        exibirDashboard, alertas, categoria: 'medicacao', foto: fotoAtualMedicacao, historico: []
      });

      showFeedbackModal(`${nome} ${dosagem} adicionado com sucesso.`, 'success');
      addModal.classList.remove('active');
      cleanupAddMedicacaoForm();
      renderMedicacoes();
    };

    if (!semDataFim && duracaoDias && horarios.length > 0) {
      const need = duracaoDias * horarios.length;
      const est = parseInt(estoqueAtual, 10);
      if (!Number.isNaN(est) && est < need) {
        openConfirmModal(
          `O estoque informado (${est}) Ac menor que o necessário para o período (${need} unidades = ${duracaoDias} dia(s) A- ${horarios.length} dose(s)/dia). Deseja continuar mesmo assim?`,
          saveMedicacao,
          'Estoque abaixo do necessário'
        );
        return;
      }
    }

    saveMedicacao();
  });
}

// ===== MODAL DE ALARME =====

function setupAlarmModal() {
  const alarmModal = document.getElementById('alarmModal');
  const dismissBtn = document.getElementById('dismissAlarmBtn');
  const takeBtn = document.getElementById('takeAlarmBtn');

  const closeAlarmModal = () => {
    alarmModal.classList.remove('active');
  };

  dismissBtn.addEventListener('click', () => {
    closeAlarmModal();
    openOverdueMedicationsModal();
  });

  takeBtn.addEventListener('click', () => {
    if (currentAlarmMedicationId && currentAlarmScheduledTime) {
      markMedicationByIdAndTime(currentAlarmMedicationId, currentAlarmScheduledTime, getTodayISODate(), true);
    } else {
      const medName = document.getElementById('alarmMedName').textContent;
      showFeedbackModal(`${medName} marcado como tomado.`, 'success');
    }
    closeAlarmModal();
  });

  alarmModal.addEventListener('click', (e) => {
    if (e.target === alarmModal) closeAlarmModal();
  });
}

function showMedicationAlarm(medicacaoId, horario) {
  const medicacao = mockData.medicacoes.find(m => m.id === medicacaoId);
  if (medicacao) {
    currentAlarmMedicationId = medicacaoId;
    currentAlarmScheduledTime = horario || '';
    document.getElementById('alarmMedName').textContent = `${medicacao.nome} ${medicacao.dosagem}`;
    document.getElementById('alarmTime').textContent = horario || '--:--';
    document.getElementById('alarmModal').classList.add('active');
  }
}

function showVitalAlarm(vital, valorAtual, tipoAlerta) {
  const modal = document.getElementById('vitalAlarmModal');
  if (!modal) return;

  const titleEl = document.getElementById('vitalAlarmTitle');
  const descEl = document.getElementById('vitalAlarmDescription');
  const valueEl = document.getElementById('vitalAlarmValue');

  if (titleEl) titleEl.textContent = `Alerta de ${vital.tipo}`;
  if (valueEl) valueEl.textContent = `${valorAtual} ${vital.unidade || ''}`;
  if (descEl) {
    const direction = tipoAlerta === 'acima' ? 'acima do limite' : 'abaixo do limite';
    descEl.textContent = `Valor ${direction} configurado para este sinal.`;
  }

  modal.classList.add('active');
}

function getVitalComparableValue(vital, value) {
  if (vital.tipo === 'Pressão Arterial') {
    if (value && typeof value === 'object' && value.sistolica != null) return parseFloat(value.sistolica);
    if (typeof value === 'string' && value.includes('/')) return parseFloat(value.split('/')[0]);
  }
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

function checkVitalAlert(vital) {
  if (!vital || !vital.alerta || !vital.alerta.ativo) return;

  const current = getVitalComparableValue(vital, vital.valor);
  if (current == null) return;

  const acima = vital.alerta.acima != null ? parseFloat(vital.alerta.acima) : null;
  const abaixo = vital.alerta.abaixo != null ? parseFloat(vital.alerta.abaixo) : null;

  let tipoAlerta = null;
  if (acima != null && current > acima) tipoAlerta = 'acima';
  if (!tipoAlerta && abaixo != null && current < abaixo) tipoAlerta = 'abaixo';
  if (!tipoAlerta) return;

  const key = `${vital.id}-${tipoAlerta}-${current}`;
  if (key === lastVitalAlertKey) return;
  lastVitalAlertKey = key;
  showVitalAlarm(vital, current, tipoAlerta);
}

// ===== MODAL DE COMPARTILHAMENTO =====

function setupCompartilhamentoModal() {
  const modal = document.getElementById('addCompartilhamentoModal');
  const cancelBtn = document.getElementById('cancelCompartilhamentoBtn');
  const form = document.getElementById('addCompartilhamentoForm');

  const closeModal = () => { modal.classList.remove('active'); form.reset(); };

  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const medico = document.getElementById('medicoCompartilhamentoInput').value;
    const especialidade = document.getElementById('especialidadeCompartilhamentoInput').value;
    const dados = Array.from(document.querySelectorAll('input[name="dados"]:checked')).map(el => el.value);

    if (dados.length === 0) {
      showFeedbackModal('Selecione pelo menos um tipo de dado para compartilhar.', 'warning');
      return;
    }

    const newId = Math.max(...mockData.compartilhamentos.map(c => c.id), 0) + 1;
    mockData.compartilhamentos.push({
      id: newId,
      medico,
      especialidade,
      dadosCompartilhados: dados,
      dataAutorizacao: getTodayISODate(),
      ativo: true
    });

    showFeedbackModal(`Dados compartilhados com ${medico}.`, 'success');
    modal.classList.remove('active');
    form.reset();
    renderCompartilhamentoInPerfil();
  });
}

// ===== FUNÇÕES AUXILIARES =====

function calcularIdade(dataNascimento) {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

// ===== EDITAR MEDICAÇÃO =====

let currentEditMedId = null;

function setupEditMedicacaoModal() {
  const modal = document.getElementById('editMedicacaoModal');
  const cancelBtn = document.getElementById('cancelEditBtn');
  const form = document.getElementById('editMedicacaoForm');

  const closeModal = () => {
    modal.classList.remove('active');
    form.reset();
    setSemDataFimMedicacaoUI('edit', false);
    removerFotoEdit();
  };

  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  const deleteFromEditBtn = document.getElementById('deleteMedicacaoFromEditBtn');
  if (deleteFromEditBtn) {
    deleteFromEditBtn.addEventListener('click', () => {
      if (currentEditMedId == null) return;
      const id = currentEditMedId;
      if (typeof deleteMedicacao === 'function' && deleteMedicacao(id)) {
        currentEditMedId = null;
      }
    });
  }

  modal.addEventListener('input', (e) => {
    if (e.target && (e.target.id === 'editDuracaoDiasMedInput' || e.target.id === 'editDataInicioMedInput')) {
      refreshEstoqueSugeridoEdit();
    }
  });

  modal.addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-desmarcar-tomado-btn');
    if (!btn) return;
    e.preventDefault();
    const medId = parseInt(btn.getAttribute('data-med-id'), 10);
    const d = btn.getAttribute('data-d');
    const h = btn.getAttribute('data-h');
    if (!medId || !d || !h) return;
    if (undoMedicationTaken(medId, d, h)) {
      const m = mockData.medicacoes.find((x) => x.id === medId);
      if (m && modal.classList.contains('active')) renderEditMedicacaoTomadasList(m);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('editNomeMedInput').value;
    const dosagem = document.getElementById('editDosagemMedInput').value;
    const frequencia = document.getElementById('editFrequenciaMedInput').value;
    const dataInicio = document.getElementById('editDataInicioMedInput').value;
    const semDataFim = document.getElementById('toggleSemDataFimMedEdit')?.classList.contains('active');
    const duracaoDias = semDataFim ? null : parseInt(document.getElementById('editDuracaoDiasMedInput')?.value, 10);
    const estoqueAtual = document.getElementById('editEstoqueAtualMedInput').value;
    const estoqueMinimo = document.getElementById('editEstoqueMinMedInput').value;

    const horarios = Array.from(document.querySelectorAll('.edit-horario-input')).map(i => i.value).filter(Boolean);

    if (!estoqueAtual) { showFeedbackModal('Informe o estoque atual.', 'warning'); return; }
    if (!estoqueMinimo) { showFeedbackModal('Informe o estoque mínimo para aviso.', 'warning'); return; }
    if (parseInt(estoqueAtual, 10) < parseInt(estoqueMinimo, 10)) {
      showFeedbackModal('O estoque atual deve ser maior ou igual ao estoque mínimo.', 'warning');
      return;
    }
    if (!semDataFim && (!duracaoDias || duracaoDias < 1)) {
      showFeedbackModal('Informe por quantos dias o medicamento será tomado (ex.: 10, 20).', 'warning');
      return;
    }
    const dataFim = semDataFim ? '' : (typeof computeDataFimFromInicioDuracao === 'function'
      ? computeDataFimFromInicioDuracao(dataInicio, duracaoDias)
      : '');
    if (!semDataFim && !dataFim) {
      showFeedbackModal('Verifique a data de inA-cio e a duração em dias.', 'warning');
      return;
    }

    const saveEditMedicacao = () => {
      const med = mockData.medicacoes.find(m => m.id === currentEditMedId);
      if (med) {
        med.nome = nome;
        med.dosagem = dosagem;
        med.frequencia = frequencia;
        med.horarios = horarios.length > 0 ? horarios : med.horarios;
        med.dataInicio = dataInicio || med.dataInicio;
        med.duracaoDias = semDataFim ? null : duracaoDias;
        med.dataFim = dataFim || '';
        med.estoqueAtual = parseInt(estoqueAtual, 10) || med.estoqueAtual || 30;
        med.estoqueMinimo = parseInt(estoqueMinimo, 10) || 7;
        if (fotoAtualMedicacaoEdit) med.foto = fotoAtualMedicacaoEdit;
      }

      showFeedbackModal(`${nome} atualizado com sucesso.`, 'success');
      modal.classList.remove('active');
      form.reset();
      setSemDataFimMedicacaoUI('edit', false);
      removerFotoEdit();
      renderMedicacoes();
    };

    if (!semDataFim && duracaoDias && horarios.length > 0) {
      const need = duracaoDias * horarios.length;
      const est = parseInt(estoqueAtual, 10);
      if (!Number.isNaN(est) && est < need) {
        openConfirmModal(
          `O estoque informado (${est}) Ac menor que o necessário para o período (${need} unidades = ${duracaoDias} dia(s) A- ${horarios.length} dose(s)/dia). Deseja continuar mesmo assim?`,
          saveEditMedicacao,
          'Estoque abaixo do necessário'
        );
        return;
      }
    }

    saveEditMedicacao();
  });
}

function openEditMedicacaoModal(medicacaoId) {
  const med = mockData.medicacoes.find(m => m.id === medicacaoId);
  if (med) {
    currentEditMedId = medicacaoId;
    document.getElementById('editNomeMedInput').value = med.nome;
    document.getElementById('editDosagemMedInput').value = med.dosagem;
    document.getElementById('editFrequenciaMedInput').value = med.frequencia;
    document.getElementById('editDataInicioMedInput').value = med.dataInicio || getTodayISODate();
    const temDataFim = !!(med.dataFim && String(med.dataFim).trim() !== '');
    setSemDataFimMedicacaoUI('edit', !temDataFim);
    let dur = med.duracaoDias;
    if ((dur == null || dur === undefined) && med.dataInicio && med.dataFim && typeof inferDuracaoDiasFromInicioFim === 'function') {
      dur = inferDuracaoDiasFromInicioFim(med.dataInicio, med.dataFim);
    }
    document.getElementById('editDuracaoDiasMedInput').value = temDataFim && dur != null ? String(dur) : '';
    document.getElementById('editEstoqueAtualMedInput').value = med.estoqueAtual || 30;
    document.getElementById('editEstoqueMinMedInput').value = med.estoqueMinimo || 7;
    updateEditHorariosFields();
    // Preencher horários existentes após renderizar os campos
    setTimeout(() => {
      const inputs = document.querySelectorAll('.edit-horario-input');
      inputs.forEach((input, i) => {
        if (med.horarios[i]) input.value = med.horarios[i];
      });
    }, 50);
    setTimeout(() => refreshEstoqueSugeridoEdit(), 80);

    if (med.foto && typeof med.foto === 'string' && med.foto.startsWith('data:')) {
      fotoAtualMedicacaoEdit = med.foto;
      document.getElementById('editPhotoPreview').style.display = 'block';
      document.getElementById('editPhotoUploadArea').querySelector('.photo-upload-placeholder').style.display = 'none';
      document.getElementById('editPhotoPreviewImg').src = med.foto;
    } else {
      removerFotoEdit();
    }

    renderEditMedicacaoTomadasList(med);
    document.getElementById('editMedicacaoModal').classList.add('active');
  }
}

function openMedicationPhotoModalById(medId) {
  const med = mockData.medicacoes.find(m => m.id === medId);
  if (!med || !med.foto || !(typeof med.foto === 'string') || !med.foto.startsWith('data:')) return;

  const modal = document.getElementById('medicationPhotoModal');
  const img = document.getElementById('medicationPhotoModalImg');
  const title = document.getElementById('medicationPhotoModalTitle');
  if (!modal || !img || !title) return;

  img.src = med.foto;
  title.textContent = `Foto - ${med.nome} ${med.dosagem}`;
  modal.classList.add('active');
}

// ===== ALERTAS DE HORÁRIO =====

function checkMedicationAlerts() {
  const agora = new Date();
  const horaAtual = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
  const hoje = getTodayISODate();

  mockData.medicacoes.forEach(med => {
    if (!med.alertas || !med.alertas.lembrete) return;
    if (!med.horarios || !med.horarios.includes(horaAtual)) return;

    const jaTomado = med.historico.some(h => h.data === hoje && h.hora === horaAtual && h.status === 'tomado');
    if (jaTomado) return;

    const key = `${med.id}-${hoje}-${horaAtual}`;
    if (key === lastMedicationAlertKey) return;
    lastMedicationAlertKey = key;
    showMedicationAlarm(med.id, horaAtual);
  });
}

function setupVitalAlarmModal() {
  const modal = document.getElementById('vitalAlarmModal');
  const closeBtn = document.getElementById('closeVitalAlarmBtn');
  const okBtn = document.getElementById('ackVitalAlarmBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  if (okBtn) okBtn.addEventListener('click', () => modal.classList.remove('active'));
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }
}

function buildVitalAlertFromForm() {
  const toggle = document.getElementById('toggleAlertaVital');
  if (!toggle || !toggle.classList.contains('active')) return null;

  const acimaRaw = document.getElementById('alertaAcimaInput').value;
  const abaixoRaw = document.getElementById('alertaAbaixoInput').value;
  const acima = acimaRaw !== '' ? parseFloat(acimaRaw) : null;
  const abaixo = abaixoRaw !== '' ? parseFloat(abaixoRaw) : null;

  if (acima == null && abaixo == null) return null;
  return { ativo: true, acima, abaixo };
}

function checkAllVitalsAlertsOnce() {
  mockData.sinaisVitais.forEach(v => checkVitalAlert(v));
}

function trySendBrowserNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch (_) {}
  }
}

function checkRescheduledMeasurementAlerts() {
  if (!mockData.measurementReschedules || !mockData.measurementReschedules.length) return;

  const now = new Date();
  mockData.measurementReschedules.forEach((item, idx) => {
    if (!item || !item.proximaMedicao || item.alertedAt) return;
    const when = new Date(item.proximaMedicao);
    if (Number.isNaN(when.getTime())) return;
    if (when > now) return;

    const key = `${item.proximaMedicao}-${idx}`;
    if (key === lastRescheduleAlertKey) return;
    lastRescheduleAlertKey = key;

    item.alertedAt = `${getTodayISODate()}T${getCurrentHHMM()}:00`;
    const dateTxt = formatDateForUI(item.proximaMedicao.slice(0, 10));
    const timeTxt = item.proximaMedicao.slice(11, 16);
    const msg = `Hora da próxima medição (${dateTxt} as ${timeTxt}).`;
    showFeedbackModal(msg, 'warning', 'Lembrete de medição');
    if (item.notificar) {
      trySendBrowserNotification('Lembrete de medição', msg);
    }
  });
}

setInterval(() => {
  checkMedicationAlerts();
  checkAllVitalsAlertsOnce();
  checkRescheduledMeasurementAlerts();
}, 60000);

window.addEventListener('load', () => {
  checkMedicationAlerts();
  checkAllVitalsAlertsOnce();
  checkRescheduledMeasurementAlerts();
});

// ===== GERENCIAR FOTO DE MEDICACAO =====

function setupFotoUpload() {
  const fotoInput = document.getElementById('fotoMedInput');
  const editFotoInput = document.getElementById('editFotoMedInput');
  
  if (fotoInput) {
    fotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          fotoAtualMedicacao = event.target.result;
          document.getElementById('photoPreview').style.display = 'block';
          document.getElementById('photoUploadArea').querySelector('.photo-upload-placeholder').style.display = 'none';
          document.getElementById('photoPreviewImg').src = fotoAtualMedicacao;
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  if (editFotoInput) {
    editFotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          fotoAtualMedicacaoEdit = event.target.result;
          document.getElementById('editPhotoPreview').style.display = 'block';
          document.getElementById('editPhotoUploadArea').querySelector('.photo-upload-placeholder').style.display = 'none';
          document.getElementById('editPhotoPreviewImg').src = fotoAtualMedicacaoEdit;
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

function removerFoto() {
  fotoAtualMedicacao = null;
  document.getElementById('fotoMedInput').value = '';
  document.getElementById('photoPreview').style.display = 'none';
  document.getElementById('photoUploadArea').querySelector('.photo-upload-placeholder').style.display = 'block';
}

function removerFotoEdit() {
  fotoAtualMedicacaoEdit = null;
  document.getElementById('editFotoMedInput').value = '';
  document.getElementById('editPhotoPreview').style.display = 'none';
  document.getElementById('editPhotoUploadArea').querySelector('.photo-upload-placeholder').style.display = 'block';
}


// ===== MODAL DE AGENDAMENTO =====

function openAddAgendaModal() {
  const addAgendaModal = document.getElementById('addAgendaModal');
  if (addAgendaModal) addAgendaModal.classList.add('active');
}

function setupAgendaModal() {
  const addAgendaBtn = document.getElementById('addAgendaBtn');
  const addAgendaModal = document.getElementById('addAgendaModal');
  const cancelAddAgendaBtn = document.getElementById('cancelAddAgendaBtn');
  const addAgendaForm = document.getElementById('addAgendaForm');

  const closeModal = () => { addAgendaModal.classList.remove('active'); addAgendaForm.reset(); };

  if (addAgendaBtn) addAgendaBtn.addEventListener('click', openAddAgendaModal);
  cancelAddAgendaBtn.addEventListener('click', closeModal);
  addAgendaModal.addEventListener('click', (e) => { if (e.target === addAgendaModal) closeModal(); });

  addAgendaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const tipo = document.getElementById('tipoAgendaInput').value;
    const nome = document.getElementById('nomeAgendaInput').value;
    const medico = document.getElementById('medicoAgendaInput').value;
    const especialidade = document.getElementById('especialidadeAgendaInput').value;
    const data = document.getElementById('dataAgendaInput').value;
    const horario = document.getElementById('horarioAgendaInput').value;
    const local = document.getElementById('localAgendaInput').value;
    const tipoAtendimento = document.getElementById('tipoAtendimentoInput').value;
    const motivo = document.getElementById('motivoAgendaInput').value;

    if (tipo === 'consulta') {
      const newId = Math.max(...mockData.consultas.map(c => c.id), 0) + 1;
      mockData.consultas.push({
        id: newId, medico, especialidade, data, hora: horario, tipo: tipoAtendimento,
        status: 'Agendado', local, motivo: motivo || 'Consulta', categoria: 'agenda',
        alerta: { ativo: document.getElementById('toggleLembreteAgenda').classList.contains('active'), antecedencia: parseInt(document.getElementById('antecedenciaAgendaInput').value) }
      });
    } else if (tipo === 'exame') {
      const newId = Math.max(...mockData.examesAgendados.map(e => e.id), 0) + 1;
      mockData.examesAgendados.push({
        id: newId, nome, data, local, medico, status: 'Agendado', categoria: 'agenda',
        alerta: { ativo: document.getElementById('toggleLembreteAgenda').classList.contains('active'), antecedencia: parseInt(document.getElementById('antecedenciaAgendaInput').value) }
      });
    }

    showFeedbackModal(`${nome || 'Agendamento'} adicionado com sucesso.`, 'success');
    addAgendaModal.classList.remove('active');
    addAgendaForm.reset();
    renderAgenda();
  });
}


// ===== RENDERIZAÇÃO DE COMPOSIÇÃO CORPORAL =====

function renderComposicao() {
  ensureCorpoAvaliacoesData();

  var listView = document.getElementById('corpoAvaliacoesListView');
  var detailView = document.getElementById('corpoAvaliacaoDetailView');
  var wizardView = document.getElementById('corpoAvaliacaoWizardView');
  var compareView = document.getElementById('corpoComparacaoView');
  if (!listView || !detailView || !wizardView) return;

  var isList = corpoAvaliacaoViewMode === 'list';
  var isDetail = corpoAvaliacaoViewMode === 'detail';
  var isWizard = corpoAvaliacaoViewMode === 'wizard';
  var isCompare = corpoAvaliacaoViewMode === 'comparacao';

  listView.style.display = isList ? '' : 'none';
  detailView.style.display = isDetail ? '' : 'none';
  wizardView.style.display = isWizard ? '' : 'none';
  if (compareView) compareView.style.display = isCompare ? '' : 'none';

  renderCorpoAvaliacoesList();
  if (isDetail) renderCorpoAvaliacaoDetail();
  if (isWizard) renderCorpoAvaliacaoWizardStep();

  setGlobalHeaderVisible(isList);
}

var CORPO_GERAL_FIELDS = [
  { key: 'peso', label: 'Peso', unit: 'kg', decimals: 1 },
  { key: 'altura', label: 'Altura', unit: 'm', decimals: 2 },
  { key: 'imc', label: 'IMC', unit: '', decimals: 1 },
  { key: 'percMassaGorda', label: '% massa gorda', unit: '%', decimals: 1 },
  { key: 'percMassaMagra', label: '% massa magra', unit: '%', decimals: 1 },
  { key: 'massaGordaKg', label: 'Massa gorda', unit: 'kg', decimals: 1 },
  { key: 'massaMagraKg', label: 'Massa magra', unit: 'kg', decimals: 1 },
  { key: 'rcq', label: 'Razão cintura/quadril', unit: '', decimals: 2 }
];

var CORPO_CIRC_FIELDS = [
  { key: 'ombro', label: 'Ombro', unit: 'cm' },
  { key: 'peitoral', label: 'Peitoral', unit: 'cm' },
  { key: 'cintura', label: 'Cintura', unit: 'cm' },
  { key: 'abdomen', label: 'Abdômen', unit: 'cm' },
  { key: 'quadril', label: 'Quadril', unit: 'cm' },
  { key: 'bracoEsqRelaxado', label: 'Braço esquerdo relaxado', unit: 'cm' },
  { key: 'bracoDirRelaxado', label: 'Braço direito relaxado', unit: 'cm' },
  { key: 'bracoEsqContraido', label: 'Braço esquerdo contraído', unit: 'cm' },
  { key: 'bracoDirContraido', label: 'Braço direito contraído', unit: 'cm' },
  { key: 'panturrilhaEsq', label: 'Panturrilha esquerda', unit: 'cm' },
  { key: 'panturrilhaDir', label: 'Panturrilha direita', unit: 'cm' },
  { key: 'coxaEsq', label: 'Coxa esquerda', unit: 'cm' },
  { key: 'coxaDir', label: 'Coxa direita', unit: 'cm' }
];

var CORPO_DOBRAS_FIELDS = [
  { key: 'abdominal', label: 'Abdominal', unit: 'mm' },
  { key: 'triceps', label: 'Tríceps', unit: 'mm' },
  { key: 'suprailiaca', label: 'Suprailíaca', unit: 'mm' },
  { key: 'axilarMedia', label: 'Axilar média', unit: 'mm' },
  { key: 'subescapular', label: 'Subescapular', unit: 'mm' },
  { key: 'torax', label: 'Tórax', unit: 'mm' },
  { key: 'coxa', label: 'Coxa', unit: 'mm' }
];

// --- Wizard 1-measurement-per-screen ---

var CORPO_WIZARD_STEPS_BUILTIN = [
  { type: 'date', title: 'Data da avaliação' },
  { type: 'measure', group: 'geral', key: 'peso', label: 'Peso', unit: 'kg', decimals: 1, icon: 'weight' },
  { type: 'measure', group: 'geral', key: 'altura', label: 'Altura', unit: 'm', decimals: 2, icon: 'height' },
  { type: 'measure', group: 'geral', key: 'percMassaGorda', label: '% Massa Gorda', unit: '%', decimals: 1, icon: 'fat' },
  { type: 'measure', group: 'geral', key: 'rcq', label: 'Razão Cintura/Quadril', unit: '', decimals: 2, icon: 'waist' },
  { type: 'measure', group: 'circunferencias', key: 'ombro', label: 'Ombro', unit: 'cm', icon: 'shoulder' },
  { type: 'measure', group: 'circunferencias', key: 'peitoral', label: 'Peitoral', unit: 'cm', icon: 'chest' },
  { type: 'measure', group: 'circunferencias', key: 'cintura', label: 'Cintura', unit: 'cm', icon: 'waist' },
  { type: 'measure', group: 'circunferencias', key: 'abdomen', label: 'Abdômen', unit: 'cm', icon: 'abdomen' },
  { type: 'measure', group: 'circunferencias', key: 'quadril', label: 'Quadril', unit: 'cm', icon: 'hip' },
  { type: 'measure', group: 'circunferencias', key: 'bracoEsqRelaxado', label: 'Braço Relaxado', unit: 'cm', icon: 'arm', dual: true, key2: 'bracoDirRelaxado', label2: 'Direito Relaxado', sideLabel: 'Esquerdo' },
  { type: 'measure', group: 'circunferencias', key: 'bracoEsqContraido', label: 'Braço Contraído', unit: 'cm', icon: 'armFlex', dual: true, key2: 'bracoDirContraido', label2: 'Direito Contraído', sideLabel: 'Esquerdo' },
  { type: 'measure', group: 'circunferencias', key: 'panturrilhaEsq', label: 'Panturrilha', unit: 'cm', icon: 'calf', dual: true, key2: 'panturrilhaDir', label2: 'Direita', sideLabel: 'Esquerda' },
  { type: 'measure', group: 'circunferencias', key: 'coxaEsq', label: 'Coxa', unit: 'cm', icon: 'thigh', dual: true, key2: 'coxaDir', label2: 'Direita', sideLabel: 'Esquerda' },
  { type: 'measure', group: 'dobras', key: 'abdominal', label: 'Dobra Abdominal', unit: 'mm', icon: 'fold' },
  { type: 'measure', group: 'dobras', key: 'triceps', label: 'Dobra Tríceps', unit: 'mm', icon: 'fold' },
  { type: 'measure', group: 'dobras', key: 'suprailiaca', label: 'Dobra Suprailíaca', unit: 'mm', icon: 'fold' },
  { type: 'measure', group: 'dobras', key: 'axilarMedia', label: 'Dobra Axilar Média', unit: 'mm', icon: 'fold' },
  { type: 'measure', group: 'dobras', key: 'subescapular', label: 'Dobra Subescapular', unit: 'mm', icon: 'fold' },
  { type: 'measure', group: 'dobras', key: 'torax', label: 'Dobra Tórax', unit: 'mm', icon: 'fold' },
  { type: 'measure', group: 'dobras', key: 'coxa', label: 'Dobra Coxa', unit: 'mm', icon: 'fold' },
];

var CORPO_WIZARD_STEPS = [];
var CORPO_WIZARD_TOTAL_STEPS = 0;

function rebuildCorpoWizardSteps() {
  CORPO_WIZARD_STEPS.length = 0;
  var allFields = getCorpoAllFields();
  allFields.forEach(function(f) {
    if (!f.visible) return;
    if (f.type === 'date') {
      CORPO_WIZARD_STEPS.push({ type: 'date', title: f.label });
    } else {
      var step = {
        type: 'measure', group: f.group, key: f.key, label: f.label,
        unit: f.unit || '', decimals: f.decimals || 0, icon: f.icon || ''
      };
      if (f.dual) {
        step.dual = true;
        step.key2 = f.key2;
        step.label2 = f.label2;
        step.sideLabel = f.sideLabel;
      }
      if (f.group === 'custom') {
        step._customMin = f.customMin;
        step._customMax = f.customMax;
        if (f.customMin != null && f.customMax != null) {
          CORPO_VALIDATION[f.key] = {
            min: f.customMin, max: f.customMax,
            msg: f.customMsg || (f.label + ' deve estar entre ' + f.customMin + ' e ' + f.customMax)
          };
        }
      }
      if (f.photoUrl) step.photoUrl = f.photoUrl;
      CORPO_WIZARD_STEPS.push(step);
    }
  });
  CORPO_WIZARD_STEPS.push({ type: 'review' });
  CORPO_WIZARD_TOTAL_STEPS = CORPO_WIZARD_STEPS.length;
}

var CORPO_VALIDATION = {
  peso:                    { min: 20,  max: 350, msg: 'Peso deve estar entre 20 e 350 kg' },
  altura:                  { min: 0.5, max: 2.5, msg: 'Altura deve estar entre 0,50 e 2,50 m' },
  percMassaGorda:          { min: 3,   max: 70,  msg: '% massa gorda deve estar entre 3% e 70%' },
  rcq:                     { min: 0.5, max: 1.5, msg: 'Razão cintura/quadril deve estar entre 0,50 e 1,50' },
  ombro:                   { min: 50,  max: 200, msg: 'Ombro deve estar entre 50 e 200 cm' },
  peitoral:                { min: 50,  max: 200, msg: 'Peitoral deve estar entre 50 e 200 cm' },
  cintura:                 { min: 40,  max: 200, msg: 'Cintura deve estar entre 40 e 200 cm' },
  abdomen:                 { min: 40,  max: 200, msg: 'Abdômen deve estar entre 40 e 200 cm' },
  quadril:                 { min: 40,  max: 200, msg: 'Quadril deve estar entre 40 e 200 cm' },
  bracoEsqRelaxado:        { min: 10,  max: 80,  msg: 'Braço relaxado deve estar entre 10 e 80 cm' },
  bracoDirRelaxado:        { min: 10,  max: 80,  msg: 'Braço direito relaxado deve estar entre 10 e 80 cm' },
  bracoEsqContraido:       { min: 10,  max: 80,  msg: 'Braço contraído deve estar entre 10 e 80 cm' },
  bracoDirContraido:       { min: 10,  max: 80,  msg: 'Braço direito contraído deve estar entre 10 e 80 cm' },
  panturrilhaEsq:          { min: 10,  max: 80,  msg: 'Panturrilha deve estar entre 10 e 80 cm' },
  panturrilhaDir:          { min: 10,  max: 80,  msg: 'Panturrilha direita deve estar entre 10 e 80 cm' },
  coxaEsq:                 { min: 10,  max: 100, msg: 'Coxa deve estar entre 10 e 100 cm' },
  coxaDir:                 { min: 10,  max: 100, msg: 'Coxa direita deve estar entre 10 e 100 cm' },
  abdominal:               { min: 2,   max: 80,  msg: 'Dobra abdominal deve estar entre 2 e 80 mm' },
  triceps:                 { min: 2,   max: 60,  msg: 'Dobra tríceps deve estar entre 2 e 60 mm' },
  suprailiaca:             { min: 2,   max: 60,  msg: 'Dobra suprailíaca deve estar entre 2 e 60 mm' },
  axilarMedia:             { min: 2,   max: 60,  msg: 'Dobra axilar média deve estar entre 2 e 60 mm' },
  subescapular:            { min: 2,   max: 60,  msg: 'Dobra subescapular deve estar entre 2 e 60 mm' },
  torax:                   { min: 2,   max: 60,  msg: 'Dobra tórax deve estar entre 2 e 60 mm' },
  coxa:                    { min: 2,   max: 80,  msg: 'Dobra coxa deve estar entre 2 e 80 mm' },
};

rebuildCorpoWizardSteps();

function getCorpoMeasurementIcon(iconName) {
  var icons = {
    weight: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="28" width="32" height="28" rx="4"/><circle cx="32" cy="42" r="6"/><line x1="24" y1="28" x2="20" y2="18"/><line x1="40" y1="28" x2="44" y2="18"/><line x1="20" y1="18" x2="44" y2="18"/></svg>',
    height: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="32" y1="8" x2="32" y2="56"/><polyline points="24,16 32,8 40,16"/><polyline points="24,48 32,56 40,48"/><line x1="24" y1="24" x2="40" y2="24"/><line x1="24" y1="40" x2="40" y2="40"/></svg>',
    imc: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="24"/><text x="32" y="38" text-anchor="middle" font-size="16" font-weight="700" fill="currentColor" stroke="none">IMC</text></svg>',
    fat: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="32" cy="34" rx="18" ry="20"/><path d="M26 28 Q32 20 38 28"/></svg>',
    muscle: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 40 Q16 32 20 24 Q24 18 32 18 Q40 18 44 24 Q48 32 44 40"/><line x1="24" y1="40" x2="40" y2="40"/><line x1="32" y1="18" x2="32" y2="40"/></svg>',
    waist: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20 Q24 36 20 48"/><path d="M44 20 Q40 36 44 48"/><line x1="20" y1="34" x2="44" y2="34" stroke-dasharray="4,3"/></svg>',
    shoulder: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 36 Q16 20 32 16 Q48 20 52 36"/><line x1="12" y1="36" x2="12" y2="52"/><line x1="52" y1="36" x2="52" y2="52"/></svg>',
    chest: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 24 Q32 16 48 24 Q48 44 32 48 Q16 44 16 24Z"/><line x1="32" y1="24" x2="32" y2="48"/></svg>',
    abdomen: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="32" cy="34" rx="16" ry="20"/><line x1="32" y1="18" x2="32" y2="50" stroke-dasharray="4,3"/></svg>',
    hip: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 22 Q20 42 24 52"/><path d="M48 22 Q44 42 40 52"/><line x1="16" y1="36" x2="48" y2="36" stroke-dasharray="4,3"/></svg>',
    arm: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 12 Q20 28 22 44 Q24 52 28 52 Q32 52 34 44 Q36 28 32 12"/><line x1="22" y1="32" x2="34" y2="32" stroke-dasharray="4,3"/></svg>',
    armFlex: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 44 Q16 32 20 20 Q24 12 32 16 Q38 20 36 32 Q34 40 30 44"/><circle cx="28" cy="26" r="4"/></svg>',
    calf: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M26 8 Q22 24 24 40 Q26 52 30 56 Q34 52 36 40 Q38 24 34 8"/><line x1="24" y1="32" x2="36" y2="32" stroke-dasharray="4,3"/></svg>',
    thigh: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8 Q18 28 20 48 Q22 56 28 56 Q34 56 36 48 Q38 28 34 8"/><line x1="20" y1="30" x2="36" y2="30" stroke-dasharray="4,3"/></svg>',
    fold: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16 Q32 8 44 16 Q48 32 44 48 Q32 56 20 48 Q16 32 20 16Z"/><path d="M28 28 Q32 24 36 28 Q38 34 36 38 Q32 42 28 38 Q26 34 28 28Z"/></svg>'
  };
  if (iconName === 'custom') {
    return '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="24"/><line x1="32" y1="16" x2="32" y2="48"/><line x1="16" y1="32" x2="48" y2="32"/></svg>';
  }
  return icons[iconName] || icons.waist;
}

function ensureCorpoAvaliacoesData() {
  if (!Array.isArray(mockData.avaliacoesAntropometricas)) {
    mockData.avaliacoesAntropometricas = [];
  }
}

function getCorpoAvaliacoesSorted() {
  ensureCorpoAvaliacoesData();
  return mockData.avaliacoesAntropometricas.slice().sort(function(a, b) {
    return String(b.data || '').localeCompare(String(a.data || ''));
  });
}

function getCorpoAvaliacaoOrdinalLabel(index) {
  return 'Avaliação Física';
}

function getNextCorpoAvaliacaoOrdinalLabel() {
  ensureCorpoAvaliacoesData();
  return getCorpoAvaliacaoOrdinalLabel(mockData.avaliacoesAntropometricas.length);
}

function formatCorpoWizardDateBR(isoDate) {
  if (!isoDate) return '';
  return formatDateForUI(isoDate);
}

function normalizeCorpoWizardDateInput(rawValue) {
  var digits = String(rawValue || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
}

function parseCorpoWizardDateInputToISO(rawValue) {
  var txt = String(rawValue || '').trim();
  if (!txt) return '';
  var normalized = txt.replace(/\./g, '/').replace(/-/g, '/');
  if (typeof toISODate === 'function') return toISODate(normalized) || '';
  var m = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  return m[3] + '-' + m[2] + '-' + m[1];
}

function formatCorpoMeasure(value, unit, decimals) {
  var n = Number(value);
  if (!Number.isFinite(n)) return '-';
  var precision = Number.isFinite(decimals) ? decimals : 1;
  var txt = n.toLocaleString('pt-BR', { minimumFractionDigits: precision, maximumFractionDigits: precision });
  return unit ? (txt + ' ' + unit) : txt;
}

function getStepIndexForField(group, key) {
  for (var i = 0; i < CORPO_WIZARD_STEPS.length; i++) {
    var s = CORPO_WIZARD_STEPS[i];
    if (s.group === group && s.key === key) return i + 1;
    if (s.dual && s.group === group && s.key2 === key) return i + 1;
  }
  return -1;
}

function corpoWizardGoToStep(n) {
  syncCorpoWizardDraftFromInputs();
  if (n < 1) n = 1;
  if (n > CORPO_WIZARD_TOTAL_STEPS) n = CORPO_WIZARD_TOTAL_STEPS;
  var dir = n > corpoAvaliacaoWizardStep ? 'forward' : n < corpoAvaliacaoWizardStep ? 'back' : 'stationary';
  corpoWizardAnimDir = dir;
  corpoAvaliacaoWizardStep = n;
  renderCorpoAvaliacaoWizardStep();
}

var _corpoStepTimer = null;
var _corpoStepInputId = null;
function corpoStepStart(inputId, dir, step) {
  _corpoStepInputId = inputId;
  var el = document.getElementById(inputId);
  if (!el) return;
  var v = parseFloat(el.value) || 0;
  el.value = Math.round((v + dir * step) * 100) / 100;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  if (_corpoStepTimer) clearInterval(_corpoStepTimer);
  _corpoStepTimer = setInterval(function() {
    var el2 = document.getElementById(inputId);
    if (!el2) { corpoStepStop(); return; }
    var v2 = parseFloat(el2.value) || 0;
    el2.value = Math.round((v2 + dir * step) * 100) / 100;
    el2.dispatchEvent(new Event('input', { bubbles: true }));
  }, 100);
}
function corpoStepStop() {
  if (_corpoStepTimer) { clearInterval(_corpoStepTimer); _corpoStepTimer = null; }
  _corpoStepInputId = null;
}

var _corpoSwipeData = null;
function corpoTouchStart(ev) {
  var t = ev.touches ? ev.touches[0] : ev;
  _corpoSwipeData = { x: t.clientX, y: t.clientY, t: Date.now() };
}
function corpoTouchEnd(ev) {
  if (!_corpoSwipeData) return;
  var t = ev.changedTouches ? ev.changedTouches[0] : ev;
  var dx = t.clientX - _corpoSwipeData.x;
  var dy = t.clientY - _corpoSwipeData.y;
  var dt = Date.now() - _corpoSwipeData.t;
  _corpoSwipeData = null;
  var target = ev.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA' || target.closest('.corpo-wiz-step-btn'))) return;
  if (dt > 500) return;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx < 0) corpoWizardNext();
    else corpoWizardBack();
  }
}

function renderCorpoAvaliacoesList() {
  var listEl = document.getElementById('corpoAvaliacoesList');
  if (!listEl) return;
  var list = getCorpoAvaliacoesSorted();
  if (!list.length) {
    listEl.innerHTML =
      '<div class="corpo-av-empty">' +
        '<div class="corpo-av-empty-icon">' +
          '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12Q6 6 12 6Q18 6 18 12Q18 18 12 18Q6 18 6 12Z"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>' +
        '</div>' +
        '<div class="corpo-av-empty-title">Nenhuma avaliação</div>' +
        '<div class="corpo-av-empty-text">Registre sua primeira avaliação para acompanhar sua evolução.</div>' +
      '</div>';
    return;
  }

  listEl.innerHTML = list.map(function(item, idx) {
    var title = (item.nome && String(item.nome).trim()) ? String(item.nome).trim() : getCorpoAvaliacaoOrdinalLabel(idx);
    var dateTxt = item.data ? formatDateForUI(item.data) : 'Sem data';
    var latestClass = idx === 0 ? ' corpo-av-row--latest' : '';
    return (
      '<div class="corpo-av-row' + latestClass + '" onclick="openCorpoAvaliacaoDetail(' + item.id + ')" style="cursor:pointer;">' +
        '<div class="corpo-av-row-main">' +
          '<div class="corpo-av-row-title">' + title + '</div>' +
          '<div class="corpo-av-row-date">' + dateTxt + '</div>' +
        '</div>' +
        '<div class="corpo-av-row-actions">' +
          '<button type="button" class="corpo-av-del-btn" onclick="event.stopPropagation();deleteCorpoAvaliacao(' + item.id + ')" aria-label="Excluir avaliação">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function openCorpoAvaliacaoDetail(id) {
  corpoAvaliacaoSelectedId = id;
  corpoAvaliacaoViewMode = 'detail';
  renderComposicao();
}

function closeCorpoAvaliacaoDetail() {
  corpoAvaliacaoViewMode = 'list';
  corpoAvaliacaoSelectedId = null;
  renderComposicao();
}

function deleteCorpoAvaliacao(id) {
  if (!confirm('Excluir esta avaliação?')) return;
  mockData.avaliacoesAntropometricas = mockData.avaliacoesAntropometricas.filter(function(a) { return a.id !== id; });
  if (corpoAvaliacaoSelectedId === id) {
    corpoAvaliacaoViewMode = 'list';
    corpoAvaliacaoSelectedId = null;
  }
  renderComposicao();
}

function openCorpoComparacao() {
  corpoAvaliacaoViewMode = 'comparacao';
  renderComposicao();
  var today = new Date();
  var from = new Date(today);
  from.setMonth(from.getMonth() - 6);
  from.setDate(1);
  var fromEl = document.getElementById('corpoCompareDateFrom');
  var toEl = document.getElementById('corpoCompareDateTo');
  if (fromEl) fromEl.value = from.toISOString().slice(0, 10);
  if (toEl) toEl.value = today.toISOString().slice(0, 10);
}

function closeCorpoComparacao() {
  corpoAvaliacaoViewMode = 'list';
  renderComposicao();
}

function getCorpoAvaliacoesByDateRange(fromDate, toDate) {
  var list = getCorpoAvaliacoesSorted();
  return list.filter(function(item) {
    if (!item.data) return false;
    return item.data >= fromDate && item.data <= toDate;
  });
}

function renderCorpoComparacaoTable() {
  var wrap = document.getElementById('corpoComparacaoTableWrap');
  if (!wrap) return;
  var fromEl = document.getElementById('corpoCompareDateFrom');
  var toEl = document.getElementById('corpoCompareDateTo');
  var fromDate = fromEl ? fromEl.value : '';
  var toDate = toEl ? toEl.value : '';
  if (!fromDate || !toDate) { wrap.innerHTML = '<div class="corpo-compare-empty">Selecione um período válido.</div>'; return; }

  var items = getCorpoAvaliacoesByDateRange(fromDate, toDate);
  if (items.length < 2) { wrap.innerHTML = '<div class="corpo-compare-empty">É necessário pelo menos 2 avaliações no período selecionado.</div>'; return; }

  var groups = [
    { label: 'Geral', fields: CORPO_GERAL_FIELDS, group: 'geral' },
    { label: 'Circunferências', fields: CORPO_CIRC_FIELDS, group: 'circunferencias' },
    { label: 'Dobras', fields: CORPO_DOBRAS_FIELDS, group: 'dobras' }
  ];
  var customFields = getCorpoActiveCustomFields();
  if (customFields.length) {
    groups.push({ label: 'Personalizados', fields: customFields.map(function(cf) { return { key: cf.key, label: cf.label, unit: cf.unit, decimals: cf.decimals }; }), group: 'custom' });
  }

  var html = '<div class="corpo-compare-scroll"><table class="corpo-compare-table"><thead><tr><th class="corpo-compare-th-label">Medida</th>';
  for (var i = 0; i < items.length; i++) {
    html += '<th class="corpo-compare-th-date">' + formatDateForUI(items[i].data) + '</th>';
  }
  html += '</tr></thead><tbody>';

  for (var g = 0; g < groups.length; g++) {
    var grp = groups[g];
    html += '<tr class="corpo-compare-group-row"><td class="corpo-compare-group-label" colspan="' + (items.length + 1) + '">' + grp.label + '</td></tr>';
    for (var f = 0; f < grp.fields.length; f++) {
      var field = grp.fields[f];
      var decimals = Number.isFinite(field.decimals) ? field.decimals : 1;
      html += '<tr><td class="corpo-compare-row-label">' + field.label + '</td>';
      for (var a = 0; a < items.length; a++) {
        var source = items[a][grp.group] || {};
        var val = source[field.key];
        var formatted = formatCorpoMeasure(val, field.unit, decimals);
        var variation = '';
        if (a > 0) {
          var prevSource = items[a - 1][grp.group] || {};
          var prevVal = prevSource[field.key];
          variation = getVariacaoHtml(val, prevVal, field.unit);
        }
        html += '<td class="corpo-compare-cell">' + formatted + variation + '</td>';
      }
      html += '</tr>';
    }
  }

  html += '</tbody></table></div>';
  wrap.innerHTML = html;

  var scrollEl = wrap.querySelector('.corpo-compare-scroll');
  if (scrollEl) setupDragScroll(scrollEl);
}

function setupDragScroll(el) {
  var isDragging = false, startX, scrollLeft;
  el.addEventListener('mousedown', function(e) {
    isDragging = true;
    el.style.cursor = 'grabbing';
    startX = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
  });
  el.addEventListener('mouseleave', function() { isDragging = false; el.style.cursor = 'grab'; });
  el.addEventListener('mouseup', function() { isDragging = false; el.style.cursor = 'grab'; });
  el.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    e.preventDefault();
    var x = e.pageX - el.offsetLeft;
    el.scrollLeft = scrollLeft - (x - startX) * 1.5;
  });
}

function renderCorpoRowsWithVariation(targetId, fields, source, prevSource, defaultUnit) {
  var el = document.getElementById(targetId);
  if (!el) return;
  var rows = fields.map(function(field) {
    var val = source ? source[field.key] : null;
    var unit = field.unit || defaultUnit || '';
    var decimals = Number.isFinite(field.decimals) ? field.decimals : 1;
    var formatted = formatCorpoMeasure(val, unit, decimals);
    var prevVal = prevSource ? prevSource[field.key] : null;
    var variation = getVariacaoHtml(val, prevVal, unit);
    return '<div class="corpo-av-data-row"><span>' + field.label + '</span><div class="corpo-av-data-row-left"><strong>' + formatted + '</strong>' + variation + '</div></div>';
  });
  el.innerHTML = rows.join('');
}

function animateCorpoKpi(el, targetValue, unit, decimals) {
  if (!el) return;
  if (!Number.isFinite(Number(targetValue))) {
    el.textContent = formatCorpoMeasure(targetValue, unit, decimals);
    return;
  }
  var target = Number(targetValue);
  var duration = 500;
  var start = performance.now();
  el.classList.add('corpo-av-kpi-value--animated');
  function tick(now) {
    var elapsed = now - start;
    var progress = Math.min(elapsed / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = target * eased;
    el.textContent = formatCorpoMeasure(current, unit, decimals);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = formatCorpoMeasure(target, unit, decimals);
  }
  requestAnimationFrame(tick);
}

function getPreviousCorpoAvaliacao(currentId) {
  var list = getCorpoAvaliacoesSorted();
  var idx = list.findIndex(function(a) { return a.id === currentId; });
  if (idx < 0 || idx >= list.length - 1) return null;
  return list[idx + 1];
}

function getVariacaoHtml(current, previous, unit) {
  if (!previous || !Number.isFinite(Number(current)) || !Number.isFinite(Number(previous))) return '';
  var diff = Number(current) - Number(previous);
  if (diff === 0) return '<span class="corpo-av-data-var corpo-av-data-var--same">0</span>';
  var sign = diff > 0 ? '+' : '';
  var cls = diff > 0 ? 'corpo-av-data-var--up' : 'corpo-av-data-var--down';
  return '<span class="corpo-av-data-var ' + cls + '">' + sign + diff.toFixed(1) + '</span>';
}

function renderCorpoAvaliacaoDetail() {
  var list = getCorpoAvaliacoesSorted();
  var item = list.find(function(a) { return a.id === corpoAvaliacaoSelectedId; });
  if (!item) {
    corpoAvaliacaoViewMode = 'list';
    renderComposicao();
    return;
  }
  var idx = list.findIndex(function(a) { return a.id === item.id; });
  var title = (item.nome && String(item.nome).trim()) ? String(item.nome).trim() : getCorpoAvaliacaoOrdinalLabel(Math.max(0, idx));
  var titleEl = document.getElementById('corpoAvaliacaoDetailTitle');
  var dateEl = document.getElementById('corpoAvaliacaoDetailDate');
  if (titleEl) titleEl.textContent = title;
  if (dateEl) dateEl.textContent = item.data ? formatDateForUI(item.data) : 'Sem data';

  var prev = getPreviousCorpoAvaliacao(item.id);

  var kpiGorda = document.getElementById('corpoKpiMassaGorda');
  var kpiMagra = document.getElementById('corpoKpiMassaMagra');
  var kpiGordaCard = document.getElementById('corpoKpiMassaGordaCard');
  var kpiMagraCard = document.getElementById('corpoKpiMassaMagraCard');
  var kpiGordaStatus = document.getElementById('corpoKpiMassaGordaStatus');
  var kpiMagraStatus = document.getElementById('corpoKpiMassaMagraStatus');

  animateCorpoKpi(kpiGorda, item.geral && item.geral.percMassaGorda, '%', 1);
  animateCorpoKpi(kpiMagra, item.geral && item.geral.percMassaMagra, '%', 1);

  function setKpiState(cardEl, statusEl, state, text) {
    if (!cardEl || !statusEl) return;
    cardEl.classList.remove('is-good', 'is-attention', 'is-high', 'is-low');
    if (state) cardEl.classList.add(state);
    statusEl.textContent = text;
  }

  var percGorda = Number(item.geral && item.geral.percMassaGorda);
  var percMagra = Number(item.geral && item.geral.percMassaMagra);

  if (Number.isFinite(percGorda)) {
    if (percGorda <= 20) setKpiState(kpiGordaCard, kpiGordaStatus, 'is-good', 'Bom');
    else if (percGorda <= 25) setKpiState(kpiGordaCard, kpiGordaStatus, 'is-attention', 'Atenção');
    else setKpiState(kpiGordaCard, kpiGordaStatus, 'is-high', 'Alto');
  } else {
    setKpiState(kpiGordaCard, kpiGordaStatus, '', 'Sem dado');
  }

  if (Number.isFinite(percMagra)) {
    if (percMagra >= 80) setKpiState(kpiMagraCard, kpiMagraStatus, 'is-good', 'Bom');
    else if (percMagra >= 70) setKpiState(kpiMagraCard, kpiMagraStatus, 'is-attention', 'Atenção');
    else setKpiState(kpiMagraCard, kpiMagraStatus, 'is-low', 'Baixo');
  } else {
    setKpiState(kpiMagraCard, kpiMagraStatus, '', 'Sem dado');
  }

  renderCorpoRowsWithVariation('corpoAvaliacaoGeralRows', CORPO_GERAL_FIELDS, item.geral || {}, prev ? (prev.geral || {}) : {}, '');
  renderCorpoRowsWithVariation('corpoAvaliacaoCircRows', CORPO_CIRC_FIELDS, item.circunferencias || {}, prev ? (prev.circunferencias || {}) : {}, 'cm');
  renderCorpoRowsWithVariation('corpoAvaliacaoDobrasRows', CORPO_DOBRAS_FIELDS, item.dobras || {}, prev ? (prev.dobras || {}) : {}, 'mm');

  var customFields = getCorpoActiveCustomFields();
  var customSection = document.getElementById('corpoCustomSection');
  var customRows = document.getElementById('corpoAvaliacaoCustomRows');
  if (customFields.length && customSection && customRows) {
    customSection.style.display = '';
    renderCorpoRowsWithVariation('corpoAvaliacaoCustomRows', customFields, item.custom || {}, prev ? (prev.custom || {}) : {}, '');
  } else {
    if (customSection) customSection.style.display = 'none';
  }
}

function buildEmptyCorpoAvaliacaoDraft() {
  return {
    nome: getNextCorpoAvaliacaoOrdinalLabel(),
    data: getTodayISODate(),
    geral: {},
    circunferencias: {},
    dobras: {},
    custom: {}
  };
}

function openCorpoNovaAvaliacaoWizard() {
  corpoAvaliacaoDraft = buildEmptyCorpoAvaliacaoDraft();
  corpoAvaliacaoWizardStep = 1;
  corpoAvaliacaoViewMode = 'wizard';
  renderComposicao();
}

function closeCorpoNovaAvaliacaoWizard() {
  corpoAvaliacaoDraft = null;
  corpoAvaliacaoWizardStep = 1;
  corpoAvaliacaoViewMode = 'list';
  renderComposicao();
}

function syncCorpoWizardDraftFromInputs() {
  if (!corpoAvaliacaoDraft) return;
  var stepIdx = corpoAvaliacaoWizardStep - 1;
  var stepDef = CORPO_WIZARD_STEPS[stepIdx];
  if (!stepDef) return;

  if (stepDef.type === 'date') {
    var dataEl = document.getElementById('corpoWizDateInput');
    if (dataEl) {
      var isoDate = parseCorpoWizardDateInputToISO(dataEl.value);
      corpoAvaliacaoDraft.data = isoDate || '';
    }
    return;
  }

  if (stepDef.type === 'measure') {
    var group = corpoAvaliacaoDraft[stepDef.group];
    if (!group) return;
    var inputEl = document.getElementById('corpoWizInput');
    if (inputEl) {
      var raw = inputEl.value.trim();
      var v = raw ? Number(raw) : NaN;
      group[stepDef.key] = (raw && Number.isFinite(v)) ? v : null;
    }
    if (stepDef.dual) {
      var inputEl2 = document.getElementById('corpoWizInput2');
      if (inputEl2) {
        var raw2 = inputEl2.value.trim();
        var v2 = raw2 ? Number(raw2) : NaN;
        group[stepDef.key2] = (raw2 && Number.isFinite(v2)) ? v2 : null;
      }
    }
  }
}

function getHistoricoParaMedida(group, key) {
  var list = getCorpoAvaliacoesSorted();
  var results = [];
  for (var i = 0; i < list.length && results.length < 3; i++) {
    var item = list[i];
    var source = item[group];
    if (source && Number.isFinite(Number(source[key]))) {
      results.push({ data: item.data, value: Number(source[key]) });
    }
  }
  return results;
}

function renderCorpoWizardDateStep() {
  var body = document.getElementById('corpoWizardBody');
  if (!body) return;
  var dateVal = corpoAvaliacaoDraft.data ? formatCorpoWizardDateBR(corpoAvaliacaoDraft.data) : '';
  body.innerHTML =
    '<div class="corpo-wiz-date-wrap" ontouchstart="corpoTouchStart(event)" ontouchend="corpoTouchEnd(event)">' +
      '<div class="corpo-wiz-date-card">' +
        '<div class="corpo-wiz-date-icon">' +
          '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
        '</div>' +
        '<div class="corpo-wiz-date-label">Data da avaliação</div>' +
        '<div class="corpo-wiz-date-input-wrap">' +
          '<div class="corpo-wiz-date-input-inner">' +
            '<input type="text" id="corpoWizDateInput" class="corpo-wiz-date-input" inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa" value="' + dateVal + '" onkeydown="if(event.key===\'Enter\')corpoWizardNext()" />' +
            '<div class="corpo-wiz-date-picker-btn" onclick="corpoWizDatePickHandler()">' +
              '<svg class="corpo-wiz-date-picker-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
            '</div>' +
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>';

  var dateInput = document.getElementById('corpoWizDateInput');
  if (dateInput && dateInput.dataset.brDateMaskBound !== '1') {
    dateInput.dataset.brDateMaskBound = '1';
    dateInput.addEventListener('input', function() {
      this.value = normalizeCorpoWizardDateInput(this.value);
    });
    dateInput.addEventListener('blur', function() {
      var iso = parseCorpoWizardDateInputToISO(this.value);
      if (iso) this.value = formatCorpoWizardDateBR(iso);
    });
    dateInput.focus();
  }
}

function corpoWizDatePickHandler() {
  var picker = document.createElement('input');
  picker.type = 'date';
  var btn = document.querySelector('.corpo-wiz-date-picker-btn');
  var rect = btn ? btn.getBoundingClientRect() : { left: 0, top: 0, width: 40, height: 40 };
  picker.style.cssText = 'position:fixed;left:' + Math.round(rect.left) + 'px;top:' + Math.round(rect.top) + 'px;width:' + Math.round(rect.width) + 'px;height:' + Math.round(rect.height) + 'px;opacity:0.001;z-index:99999;';
  picker.addEventListener('change', function() {
    if (!this.value) return;
    var parts = this.value.split('-');
    if (parts.length === 3) {
      var textEl = document.getElementById('corpoWizDateInput');
      if (textEl) {
        textEl.value = parts[2] + '/' + parts[1] + '/' + parts[0];
        textEl.focus();
      }
    }
    if (document.body.contains(this)) {
      document.body.removeChild(this);
    }
  });
  document.body.appendChild(picker);
  setTimeout(function() {
    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
    }
  }, 10);
}

function makeCorpoStepperHtml(inputId, stepSize) {
  var step = Number.isFinite(stepSize) ? stepSize : 1;
  return (
    '<div class="corpo-wiz-stepper">' +
      '<button type="button" class="corpo-wiz-step-btn corpo-wiz-step-btn--minus" ' +
        'onpointerdown="corpoStepStart(\'' + inputId + '\',-1,' + step + ')" ' +
        'onpointerup="corpoStepStop()" onpointerleave="corpoStepStop()" ' +
        'aria-label="Diminuir">\u2212</button>' +
      '<input type="number" id="' + inputId + '" class="corpo-wiz-input-field" step="' + step + '" min="0" ' +
        'placeholder="0" value="" ' +
        'onkeydown="if(event.key===\'Enter\')corpoWizardNext()" inputmode="decimal" />' +
      '<button type="button" class="corpo-wiz-step-btn corpo-wiz-step-btn--plus" ' +
        'onpointerdown="corpoStepStart(\'' + inputId + '\',1,' + step + ')" ' +
        'onpointerup="corpoStepStop()" onpointerleave="corpoStepStop()" ' +
        'aria-label="Aumentar">+</button>' +
    '</div>'
  );
}

function makeCorpoHistoryHtml(stepDef) {
  var hist = getHistoricoParaMedida(stepDef.group, stepDef.key);
  if (!hist.length) {
    return '<div class="corpo-wiz-history"><div class="corpo-wiz-history-empty">Sem histórico ainda</div></div>';
  }
  var rows = '';
  for (var i = 0; i < hist.length; i++) {
    var h = hist[i];
    var parts = String(h.data || '').split('-');
    var shortDate = parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0].slice(2) : h.data;
    rows += '<tr><td>' + shortDate + '</td><td>' + formatCorpoMeasure(h.value, stepDef.unit, stepDef.decimals) + '</td></tr>';
  }
  return '<div class="corpo-wiz-history"><div class="corpo-wiz-history-title">Últimas medições</div><table class="corpo-wiz-history-table"><thead><tr><th>Data</th><th>Valor</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function renderCorpoWizardMeasureStep(stepDef) {
  var body = document.getElementById('corpoWizardBody');
  if (!body) return;
  var group = corpoAvaliacaoDraft[stepDef.group] || {};
  var currentVal = group[stepDef.key] != null ? String(group[stepDef.key]) : '';
  var illustrationHtml = stepDef.photoUrl
    ? '<div class="corpo-wiz-illustration corpo-wiz-illustration--photo"><img src="' + stepDef.photoUrl + '" alt="' + escHtml(stepDef.label) + '" /></div>'
    : '<div class="corpo-wiz-illustration">' + getCorpoMeasurementIcon(stepDef.icon) + '</div>';

  var subtitle = stepDef.dual ? (stepDef.sideLabel + ' / ' + stepDef.label2) : getCorpoSectionLabel(stepDef);
  var stepSz = stepDef.decimals === 2 ? 0.05 : stepDef.decimals === 1 ? 0.5 : 1;

  if (stepDef.dual) {
    var currentVal2 = group[stepDef.key2] != null ? String(group[stepDef.key2]) : '';
    body.innerHTML =
      '<div class="corpo-wiz-measure-wrap" ontouchstart="corpoTouchStart(event)" ontouchend="corpoTouchEnd(event)">' +
        illustrationHtml +
        '<div class="corpo-wiz-measure-title">' + stepDef.label + '</div>' +
        '<div class="corpo-wiz-measure-subtitle">' + (subtitle ? subtitle + ' \u00b7 ' : '') + stepDef.unit + '</div>' +
        '<div class="corpo-wiz-dual-inputs">' +
          '<div class="corpo-wiz-input-group">' +
            '<label class="corpo-wiz-input-label">' + stepDef.sideLabel + '</label>' +
            makeCorpoStepperHtml('corpoWizInput', stepSz) +
          '</div>' +
          '<div class="corpo-wiz-input-group">' +
            '<label class="corpo-wiz-input-label">' + stepDef.label2 + '</label>' +
            makeCorpoStepperHtml('corpoWizInput2', stepSz) +
          '</div>' +
          '</div>' +
          makeCorpoHistoryHtml(stepDef) +
        '</div>';
    var inp1 = document.getElementById('corpoWizInput');
    var inp2 = document.getElementById('corpoWizInput2');
    if (inp1 && currentVal) inp1.value = currentVal;
    if (inp2 && currentVal2) inp2.value = currentVal2;
    if (inp1) inp1.focus();
  } else {
    body.innerHTML =
      '<div class="corpo-wiz-measure-wrap" ontouchstart="corpoTouchStart(event)" ontouchend="corpoTouchEnd(event)">' +
        illustrationHtml +
        '<div class="corpo-wiz-measure-title">' + stepDef.label + '</div>' +
        '<div class="corpo-wiz-measure-subtitle">' + (subtitle ? subtitle + ' \u00b7 ' : '') + stepDef.unit + '</div>' +
        '<div class="corpo-wiz-input-group">' +
          makeCorpoStepperHtml('corpoWizInput', stepSz) +
        '</div>' +
        makeCorpoHistoryHtml(stepDef) +
      '</div>';
    var inp = document.getElementById('corpoWizInput');
    if (inp && currentVal) inp.value = currentVal;
    if (inp) inp.focus();
  }
}

function normalizeCorpoDraftValues() {
  if (!corpoAvaliacaoDraft) return;
  var g = corpoAvaliacaoDraft.geral;
  var peso = Number(g.peso);
  var altura = Number(g.altura);
  var percG = Number(g.percMassaGorda);
  var percM = Number(g.percMassaMagra);

  if (Number.isFinite(percG)) g.percMassaMagra = Math.max(0, 100 - percG);
  else if (Number.isFinite(percM)) g.percMassaGorda = Math.max(0, 100 - percM);

  if (Number.isFinite(peso) && Number.isFinite(altura) && altura > 0) {
    var alturaM = altura > 3 ? (altura / 100) : altura;
    g.imc = Math.round((peso / (alturaM * alturaM)) * 10) / 10;
  }

  if (Number.isFinite(peso) && Number.isFinite(Number(g.percMassaGorda))) {
    g.massaGordaKg = Math.round((peso * (Number(g.percMassaGorda) / 100)) * 10) / 10;
  }

  if (Number.isFinite(peso) && Number.isFinite(Number(g.percMassaMagra))) {
    g.massaMagraKg = Math.round((peso * (Number(g.percMassaMagra) / 100)) * 10) / 10;
  }
}

function renderCorpoWizardReview() {
  var body = document.getElementById('corpoWizardBody');
  if (!body || !corpoAvaliacaoDraft) return;

  var g = corpoAvaliacaoDraft.geral || {};
  var c = corpoAvaliacaoDraft.circunferencias || {};
  var d = corpoAvaliacaoDraft.dobras || {};
  var cust = corpoAvaliacaoDraft.custom || {};

  function reviewRow(f, grp) {
    var step = getStepIndexForField(grp, f.key);
    var val = (grp === 'circunferencias' ? c : grp === 'dobras' ? d : grp === 'custom' ? cust : g)[f.key];
    var fmt = formatCorpoMeasure(val, f.unit, f.decimals || 1);
    var clickAttr = step > 0 ? ' data-step="' + step + '" onclick="corpoWizardGoToStep(' + step + ')" style="cursor:pointer;"' : '';
    return '<div class="corpo-wiz-review-row"' + clickAttr + '><span class="corpo-wiz-review-label">' + f.label + '</span><span class="corpo-wiz-review-value">' + fmt + '</span></div>';
  }

  var geralRows = CORPO_GERAL_FIELDS.map(function(f) {
    return reviewRow(f, 'geral');
  }).join('');

  var circRows = CORPO_CIRC_FIELDS.map(function(f) {
    return reviewRow(f, 'circunferencias');
  }).join('');

  var dobraRows = CORPO_DOBRAS_FIELDS.map(function(f) {
    return reviewRow(f, 'dobras');
  }).join('');

  var customFields = getCorpoActiveCustomFields();
  var customRows = customFields.length ? customFields.map(function(f) {
    return reviewRow(f, 'custom');
  }).join('') : '';

  body.innerHTML =
    '<div class="corpo-wiz-review" ontouchstart="corpoTouchStart(event)" ontouchend="corpoTouchEnd(event)">' +
      '<div class="corpo-wiz-review-section"><div class="corpo-wiz-review-section-title">Dados gerais</div>' + geralRows + '</div>' +
      '<div class="corpo-wiz-review-section"><div class="corpo-wiz-review-section-title">Circunfer\u00eancias</div>' + circRows + '</div>' +
      '<div class="corpo-wiz-review-section"><div class="corpo-wiz-review-section-title">Dobras cut\u00e2neas</div>' + dobraRows + '</div>' +
      (customRows ? '<div class="corpo-wiz-review-section"><div class="corpo-wiz-review-section-title">Personalizados</div>' + customRows + '</div>' : '') +
    '</div>';
}

function getCorpoProgressColor(stepDef) {
  if (!stepDef) return '#2563eb';
  if (stepDef.type === 'date') return '#3b82f6';
  if (stepDef.type === 'review') return '#16a34a';
  if (stepDef.group === 'geral') return '#3b82f6';
  if (stepDef.group === 'circunferencias') return '#14b8a6';
  if (stepDef.group === 'dobras') return '#a855f7';
  if (stepDef.group === 'custom') return '#f97316';
  return '#2563eb';
}

function getCorpoSectionLabel(stepDef) {
  if (!stepDef) return '';
  if (stepDef.type === 'date') return 'Data';
  if (stepDef.type === 'review') return 'Revisar';
  if (stepDef.group === 'geral') return '';
  if (stepDef.group === 'circunferencias') return 'Circunferências';
  if (stepDef.group === 'dobras') return 'Dobras';
  if (stepDef.group === 'custom') return 'Personalizados';
  return '';
}

function renderCorpoAvaliacaoWizardStep() {
  if (!corpoAvaliacaoDraft) corpoAvaliacaoDraft = buildEmptyCorpoAvaliacaoDraft();

  var stepIdx = corpoAvaliacaoWizardStep - 1;
  var stepDef = CORPO_WIZARD_STEPS[stepIdx];
  if (!stepDef) return;

  var titleEl = document.getElementById('corpoWizardTitle');
  var subtitleEl = document.getElementById('corpoWizardSubtitle');
  var progressFill = document.getElementById('corpoWizardProgressFill');
  var nextBtn = document.getElementById('corpoWizardNextBtn');
  var saveBtn = document.getElementById('corpoWizardSaveBtn');

  var progress = Math.round((corpoAvaliacaoWizardStep / CORPO_WIZARD_TOTAL_STEPS) * 100);
  if (progressFill) {
    progressFill.style.width = progress + '%';
    progressFill.style.background = getCorpoProgressColor(stepDef);
  }

  var bodyEl = document.getElementById('corpoWizardBody');
  if (bodyEl) {
    bodyEl.className = 'corpo-wizard-body is-' + (corpoWizardAnimDir || 'stationary');
    corpoWizardAnimDir = 'stationary';
  }

  if (stepDef.type === 'date') {
    if (titleEl) titleEl.textContent = 'Nova avaliação';
    if (subtitleEl) subtitleEl.textContent = 'Data · 1 de ' + CORPO_WIZARD_TOTAL_STEPS;
    renderCorpoWizardDateStep();
  } else if (stepDef.type === 'measure') {
    if (titleEl) titleEl.textContent = stepDef.label;
    if (subtitleEl) subtitleEl.textContent = getCorpoSectionLabel(stepDef) + ' · ' + corpoAvaliacaoWizardStep + ' de ' + CORPO_WIZARD_TOTAL_STEPS;
    renderCorpoWizardMeasureStep(stepDef);
  } else if (stepDef.type === 'review') {
    normalizeCorpoDraftValues();
    if (titleEl) titleEl.textContent = 'Revisar avaliação';
    if (subtitleEl) subtitleEl.textContent = 'Revisar · ' + corpoAvaliacaoWizardStep + ' de ' + CORPO_WIZARD_TOTAL_STEPS;
    renderCorpoWizardReview();
  }

  if (nextBtn) nextBtn.style.display = stepDef.type === 'review' ? 'none' : '';
  if (saveBtn) saveBtn.style.display = stepDef.type === 'review' ? '' : 'none';
}

function corpoWizardNext() {
  syncCorpoWizardDraftFromInputs();
  var stepDef = CORPO_WIZARD_STEPS[corpoAvaliacaoWizardStep - 1];
  if (stepDef && stepDef.type === 'date' && !corpoAvaliacaoDraft.data) {
    showFeedbackModal('Informe a data da avaliação no formato dd/mm/aaaa.', 'warning');
    return;
  }
  if (stepDef && stepDef.type === 'measure') {
    var group = corpoAvaliacaoDraft[stepDef.group] || {};
    var v = group[stepDef.key];
    if (v == null || !Number.isFinite(Number(v))) {
      showFeedbackModal('Informe o valor de ' + stepDef.label + '.', 'warning');
      return;
    }
    var rule = CORPO_VALIDATION[stepDef.key];
    if (rule && (Number(v) < rule.min || Number(v) > rule.max)) {
      showFeedbackModal(rule.msg, 'warning');
      return;
    }
    if (stepDef.dual) {
      var v2 = group[stepDef.key2];
      if (v2 == null || !Number.isFinite(Number(v2))) {
        showFeedbackModal('Informe o valor de ' + stepDef.label2 + '.', 'warning');
        return;
      }
      var rule2 = CORPO_VALIDATION[stepDef.key2];
      if (rule2 && (Number(v2) < rule2.min || Number(v2) > rule2.max)) {
        showFeedbackModal(rule2.msg, 'warning');
        return;
      }
    }
  }
  normalizeCorpoDraftValues();
  if (corpoAvaliacaoWizardStep < CORPO_WIZARD_TOTAL_STEPS) {
    corpoAvaliacaoWizardStep++;
    corpoWizardAnimDir = 'forward';
    renderCorpoAvaliacaoWizardStep();
  }
}

function corpoWizardBack() {
  if (corpoAvaliacaoWizardStep <= 1) {
    closeCorpoNovaAvaliacaoWizard();
    return;
  }
  syncCorpoWizardDraftFromInputs();
  corpoAvaliacaoWizardStep--;
  corpoWizardAnimDir = 'back';
  renderCorpoAvaliacaoWizardStep();
}

function corpoWizardSave() {
  syncCorpoWizardDraftFromInputs();
  if (!corpoAvaliacaoDraft.data) {
    showFeedbackModal('Informe a data da avaliação.', 'warning');
    return;
  }
  normalizeCorpoDraftValues();

  ensureCorpoAvaliacoesData();
  var nextId = mockData.avaliacoesAntropometricas.reduce(function(max, item) {
    return Math.max(max, Number(item && item.id) || 0);
  }, 0) + 1;

  var payload = {
    id: nextId,
    nome: (corpoAvaliacaoDraft.nome || '').trim(),
    data: corpoAvaliacaoDraft.data,
    geral: Object.assign({}, corpoAvaliacaoDraft.geral),
    circunferencias: Object.assign({}, corpoAvaliacaoDraft.circunferencias),
    dobras: Object.assign({}, corpoAvaliacaoDraft.dobras),
    custom: Object.assign({}, corpoAvaliacaoDraft.custom)
  };

  mockData.avaliacoesAntropometricas.push(payload);
  corpoAvaliacaoSelectedId = nextId;
  corpoAvaliacaoViewMode = 'detail';
  corpoAvaliacaoDraft = null;
  corpoAvaliacaoWizardStep = 1;
  showFeedbackModal('Avaliação salva com sucesso.', 'success');
  renderComposicao();
}

// ===== CAMPOS PERSONALIZADOS (CORPO) =====

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getCorpoFieldConfig() {
  try {
    var raw = localStorage.getItem('corpoFieldConfig');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveCorpoFieldConfig(cfg) {
  localStorage.setItem('corpoFieldConfig', JSON.stringify(cfg));
  rebuildCorpoWizardSteps();
}

function buildCorpoDefaultConfig() {
  var fields = [];
  CORPO_WIZARD_STEPS_BUILTIN.forEach(function(step) {
    if (step.type === 'date') {
      fields.push({ key: '_date', label: step.title, type: 'date', group: '_meta', visible: true });
    } else {
      fields.push({
        key: step.key, label: step.label, type: 'measure', group: step.group,
        unit: step.unit || '', decimals: step.decimals || 0, icon: step.icon || '',
        dual: step.dual || false, key2: step.key2 || null, label2: step.label2 || null,
        sideLabel: step.sideLabel || null, visible: true
      });
    }
  });
  var customFields = getCorpoCustomFieldsLegacy();
  customFields.forEach(function(cf) {
    fields.push({
      key: cf.key, label: cf.label, type: 'measure', group: 'custom',
      unit: cf.unit || '', decimals: cf.decimals || 0, icon: 'custom',
      customMin: cf.min, customMax: cf.max, customMsg: cf.msg, visible: true
    });
  });
  return { fields: fields };
}

function getCorpoAllFields() {
  var cfg = getCorpoFieldConfig();
  if (cfg && cfg.fields && cfg.fields.length > 0) return cfg.fields;
  cfg = buildCorpoDefaultConfig();
  saveCorpoFieldConfig(cfg);
  return cfg.fields;
}

function saveCorpoAllFields(fields) {
  saveCorpoFieldConfig({ fields: fields });
  renderCorpoCustomFieldList();
}

function getCorpoCustomFieldsLegacy() {
  try {
    var raw = localStorage.getItem('corpoCustomFields');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function getCorpoActiveCustomFields() {
  return getCorpoAllFields().filter(function(f) { return f.group === 'custom' && f.visible; });
}

function generateCorpoCustomKey(label) {
  var base = 'cf_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 28);
  if (!base || base === 'cf_') base = 'cf_' + Date.now();
  var allFields = getCorpoAllFields();
  var key = base;
  var n = 1;
  while (allFields.some(function(f) { return f.key === key; })) {
    key = base + '_' + (n++);
  }
  return key;
}

var _corpoGroupLabels = { geral: 'Geral', circunferencias: 'Circunferências', dobras: 'Dobras', custom: 'Personalizados', _meta: 'Geral' };

function openCorpoCustomFieldManager() {
  var el = document.getElementById('corpoCustomFieldManager');
  if (el) el.style.display = '';
  renderCorpoCustomFieldList();
}

function closeCorpoCustomFieldManager() {
  var el = document.getElementById('corpoCustomFieldManager');
  if (el) el.style.display = 'none';
}

function renderCorpoCustomFieldList() {
  var el = document.getElementById('corpoCustomFieldList');
  if (!el) return;
  var fields = getCorpoAllFields();
  if (!fields.length) {
    el.innerHTML = '<div class="corpo-cfm-empty">Nenhum campo configurado.</div>';
    return;
  }
  var html = '';
  var lastGroup = null;
  fields.forEach(function(f, i) {
    var grp = f.group || 'custom';
    if (grp !== lastGroup) {
      lastGroup = grp;
      html += '<div class="corpo-cfm-group-title">' + (_corpoGroupLabels[grp] || grp) + '</div>';
    }
    var isHidden = !f.visible;
    var isCustom = f.group === 'custom';
    var isDate = f.type === 'date';
    var desc = '';
    if (isDate) {
      desc = 'Campo de data';
    } else {
      var parts = [];
      if (f.unit) parts.push(f.unit);
      if (f.decimals != null) parts.push(f.decimals === 0 ? 'inteiro' : f.decimals + ' dec.');
      if (f.customMin != null || f.customMax != null) parts.push((f.customMin != null ? f.customMin : '?') + '–' + (f.customMax != null ? f.customMax : '?'));
      if (f.dual) parts.push('lado esq./dir.');
      desc = parts.join(' · ');
    }
    html += '<div class="corpo-cfm-item' + (isHidden ? ' corpo-cfm-item--hidden' : '') + '">' +
      '<div class="corpo-cfm-item-drag">' +
        '<button type="button" class="corpo-cfm-drag-btn" onclick="moveCorpoField(' + i + ',-1)" aria-label="Mover para cima"' + (i === 0 ? ' disabled' : '') + '>' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>' +
        '</button>' +
        '<button type="button" class="corpo-cfm-drag-btn" onclick="moveCorpoField(' + i + ',1)" aria-label="Mover para baixo"' + (i === fields.length - 1 ? ' disabled' : '') + '>' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="corpo-cfm-item-info">' +
        '<div class="corpo-cfm-item-label">' + escHtml(f.label) + '</div>' +
        '<div class="corpo-cfm-item-desc">' + escHtml(desc) + '</div>' +
      '</div>' +
      '<div class="corpo-cfm-item-actions">' +
        '<button type="button" class="corpo-cfm-item-btn" onclick="toggleCorpoFieldVisibility(' + i + ')" aria-label="' + (isHidden ? 'Mostrar' : 'Ocultar') + '" title="' + (isHidden ? 'Mostrar no wizard' : 'Ocultar do wizard') + '">' +
          (isHidden
            ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
            : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>') +
        '</button>' +
        '<button type="button" class="corpo-cfm-item-btn" onclick="editCorpoField(' + i + ')" aria-label="Editar" title="Editar nome">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        '</button>' +
        (isCustom
          ? '<button type="button" class="corpo-cfm-item-btn corpo-cfm-item-btn--del" onclick="deleteCorpoField(' + i + ')" aria-label="Excluir" title="Excluir campo">' +
              '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>'
          : '') +
      '</div>' +
    '</div>';
  });
  el.innerHTML = html;
}

function moveCorpoField(index, direction) {
  var fields = getCorpoAllFields();
  var target = index + direction;
  if (target < 0 || target >= fields.length) return;
  var tmp = fields[index];
  fields[index] = fields[target];
  fields[target] = tmp;
  saveCorpoAllFields(fields);
}

function toggleCorpoFieldVisibility(index) {
  var fields = getCorpoAllFields();
  if (index < 0 || index >= fields.length) return;
  fields[index].visible = !fields[index].visible;
  saveCorpoAllFields(fields);
}

function editCorpoField(index) {
  var fields = getCorpoAllFields();
  var f = fields[index];
  if (!f) return;
  var formContainer = document.getElementById('corpoCustomFieldFormContainer');
  if (!formContainer) return;

  var isCustom = f.group === 'custom';
  var isDate = f.type === 'date';

  var extraFields = '';
  if (!isDate) {
    extraFields =
      '<div class="corpo-cfm-row">' +
        '<label class="corpo-cfm-field corpo-cfm-field--half">' +
          '<span class="corpo-cfm-field-label">Unidade</span>' +
          '<input type="text" id="cfmUnit" class="corpo-cfm-input-text" placeholder="Ex: cm" value="' + escHtml(f.unit || '') + '" />' +
        '</label>' +
        '<label class="corpo-cfm-field corpo-cfm-field--half">' +
          '<span class="corpo-cfm-field-label">Decimais</span>' +
          '<select id="cfmDecimals" class="corpo-cfm-select">' +
            '<option value="0"' + (f.decimals === 0 ? ' selected' : '') + '>0 (inteiro)</option>' +
            '<option value="1"' + (f.decimals === 1 ? ' selected' : '') + '>1</option>' +
            '<option value="2"' + (f.decimals === 2 ? ' selected' : '') + '>2</option>' +
          '</select>' +
        '</label>' +
      '</div>';
    if (isCustom) {
      extraFields +=
        '<div class="corpo-cfm-row">' +
          '<label class="corpo-cfm-field corpo-cfm-field--half">' +
            '<span class="corpo-cfm-field-label">Mínimo</span>' +
            '<input type="number" id="cfmMin" class="corpo-cfm-input-text" placeholder="Opcional" value="' + (f.customMin != null ? f.customMin : '') + '" />' +
          '</label>' +
          '<label class="corpo-cfm-field corpo-cfm-field--half">' +
            '<span class="corpo-cfm-field-label">Máximo</span>' +
            '<input type="number" id="cfmMax" class="corpo-cfm-input-text" placeholder="Opcional" value="' + (f.customMax != null ? f.customMax : '') + '" />' +
          '</label>' +
        '</div>';
    }
    var existingPhoto = f.photoUrl || '';
    var photoPreviewHtml = existingPhoto
      ? '<div class="corpo-cfm-photo-preview" id="cfmPhotoPreview"><img id="cfmPhotoImg" src="' + escHtml(existingPhoto) + '" alt="Preview" /><button type="button" class="corpo-cfm-photo-remove" onclick="event.stopPropagation(); removeCorpoPhoto()">\u2715</button></div>'
      : '<div class="corpo-cfm-photo-preview" id="cfmPhotoPreview" style="display:none"><img id="cfmPhotoImg" src="" alt="Preview" /><button type="button" class="corpo-cfm-photo-remove" onclick="event.stopPropagation(); removeCorpoPhoto()">\u2715</button></div>';
    var photoPlaceholderHtml = existingPhoto
      ? '<div class="corpo-cfm-photo-placeholder" id="cfmPhotoPlaceholder" style="display:none"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Toque para adicionar uma foto</span></div>'
      : '<div class="corpo-cfm-photo-placeholder" id="cfmPhotoPlaceholder"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Toque para adicionar uma foto</span></div>';
    extraFields +=
      '<label class="corpo-cfm-field">' +
        '<span class="corpo-cfm-field-label">Foto de instru\u00e7\u00e3o (opcional)</span>' +
        '<div class="corpo-cfm-photo-upload" id="cfmPhotoUpload" onclick="document.getElementById(\'cfmPhotoInput\').click()">' +
          '<input type="file" id="cfmPhotoInput" accept="image/*" style="display:none" onchange="handleCorpoPhotoSelect(event)">' +
          photoPlaceholderHtml +
          photoPreviewHtml +
        '</div>' +
      '</label>';
  }

  formContainer.innerHTML =
    '<div class="corpo-cfm-form" id="corpoCustomFieldForm">' +
      '<div class="corpo-cfm-form-title">Editar campo</div>' +
      '<label class="corpo-cfm-field">' +
        '<span class="corpo-cfm-field-label">' + (isDate ? 'Título' : 'Nome do campo') + '</span>' +
        '<input type="text" id="cfmLabel" class="corpo-cfm-input-text" placeholder="Ex: Peso" value="' + escHtml(f.label) + '" />' +
      '</label>' +
      extraFields +
      '<div class="corpo-cfm-form-actions">' +
        '<button type="button" class="corpo-cfm-btn corpo-cfm-btn--outline" onclick="hideCorpoCustomFieldForm()">Cancelar</button>' +
        '<button type="button" class="corpo-cfm-btn corpo-cfm-btn--solid" onclick="saveCorpoFieldEdit(' + index + ')">Salvar</button>' +
      '</div>' +
    '</div>';
  formContainer.style.display = '';
}

function saveCorpoFieldEdit(index) {
  var fields = getCorpoAllFields();
  var f = fields[index];
  if (!f) return;

  var labelEl = document.getElementById('cfmLabel');
  var label = (labelEl.value || '').trim();
  if (!label) {
    showFeedbackModal('Preencha o nome do campo.', 'warning');
    return;
  }
  f.label = label;

  if (f.type !== 'date') {
    var unitEl = document.getElementById('cfmUnit');
    var decimalsEl = document.getElementById('cfmDecimals');
    if (unitEl) f.unit = (unitEl.value || '').trim();
    if (decimalsEl) f.decimals = parseInt(decimalsEl.value, 10) || 0;

    if (f.group === 'custom') {
      var minEl = document.getElementById('cfmMin');
      var maxEl = document.getElementById('cfmMax');
      if (minEl) f.customMin = minEl.value ? Number(minEl.value) : null;
      if (maxEl) f.customMax = maxEl.value ? Number(maxEl.value) : null;
    }
    var photo = getCorpoPhotoDataUrl();
    if (photo) { f.photoUrl = photo; }
    else { delete f.photoUrl; }
  }

  saveCorpoAllFields(fields);
  hideCorpoCustomFieldForm();
  showFeedbackModal('Campo atualizado.', 'success');
}

function hideCorpoCustomFieldForm() {
  var formContainer = document.getElementById('corpoCustomFieldFormContainer');
  if (formContainer) formContainer.style.display = 'none';
}

function deleteCorpoField(index) {
  var fields = getCorpoAllFields();
  var f = fields[index];
  if (!f || f.group !== 'custom') return;
  if (!confirm('Excluir o campo "' + f.label + '" permanentemente?')) return;
  fields.splice(index, 1);
  saveCorpoAllFields(fields);
  showFeedbackModal('Campo "' + f.label + '" excluído.', 'info');
}

function showCorpoNewFieldForm() {
  var formContainer = document.getElementById('corpoCustomFieldFormContainer');
  if (!formContainer) return;

  formContainer.innerHTML =
    '<div class="corpo-cfm-form" id="corpoCustomFieldForm">' +
      '<div class="corpo-cfm-form-title">Novo campo personalizado</div>' +
      '<label class="corpo-cfm-field">' +
        '<span class="corpo-cfm-field-label">Nome do campo</span>' +
        '<input type="text" id="cfmLabel" class="corpo-cfm-input-text" placeholder="Ex: Flexão de braço" value="" />' +
      '</label>' +
      '<div class="corpo-cfm-row">' +
        '<label class="corpo-cfm-field corpo-cfm-field--half">' +
          '<span class="corpo-cfm-field-label">Unidade</span>' +
          '<input type="text" id="cfmUnit" class="corpo-cfm-input-text" placeholder="Ex: cm" value="" />' +
        '</label>' +
        '<label class="corpo-cfm-field corpo-cfm-field--half">' +
          '<span class="corpo-cfm-field-label">Decimais</span>' +
          '<select id="cfmDecimals" class="corpo-cfm-select">' +
            '<option value="0">0 (inteiro)</option>' +
            '<option value="1" selected>1</option>' +
            '<option value="2">2</option>' +
          '</select>' +
        '</label>' +
      '</div>' +
      '<div class="corpo-cfm-row">' +
        '<label class="corpo-cfm-field corpo-cfm-field--half">' +
          '<span class="corpo-cfm-field-label">Mínimo (opcional)</span>' +
          '<input type="number" id="cfmMin" class="corpo-cfm-input-text" placeholder="Opcional" value="" />' +
        '</label>' +
        '<label class="corpo-cfm-field corpo-cfm-field--half">' +
          '<span class="corpo-cfm-field-label">Máximo (opcional)</span>' +
          '<input type="number" id="cfmMax" class="corpo-cfm-input-text" placeholder="Opcional" value="" />' +
        '</label>' +
      '</div>' +
      '<label class="corpo-cfm-field">' +
        '<span class="corpo-cfm-field-label">Foto de instrução (opcional)</span>' +
        '<div class="corpo-cfm-photo-upload" id="cfmPhotoUpload" onclick="document.getElementById(\'cfmPhotoInput\').click()">' +
          '<input type="file" id="cfmPhotoInput" accept="image/*" style="display:none" onchange="handleCorpoPhotoSelect(event)">' +
          '<div class="corpo-cfm-photo-placeholder" id="cfmPhotoPlaceholder">' +
            '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
            '<span>Toque para adicionar uma foto</span>' +
          '</div>' +
          '<div class="corpo-cfm-photo-preview" id="cfmPhotoPreview" style="display:none">' +
            '<img id="cfmPhotoImg" src="" alt="Preview" />' +
            '<button type="button" class="corpo-cfm-photo-remove" onclick="event.stopPropagation(); removeCorpoPhoto()">✕</button>' +
          '</div>' +
        '</div>' +
      '</label>' +
      '<div class="corpo-cfm-form-actions">' +
        '<button type="button" class="corpo-cfm-btn corpo-cfm-btn--outline" onclick="hideCorpoCustomFieldForm()">Cancelar</button>' +
        '<button type="button" class="corpo-cfm-btn corpo-cfm-btn--solid" onclick="saveCorpoNewField()">Adicionar</button>' +
      '</div>' +
    '</div>';
  formContainer.style.display = '';
}

function handleCorpoPhotoSelect(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showFeedbackModal('Selecione um arquivo de imagem.', 'warning');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showFeedbackModal('A imagem deve ter no máximo 2 MB.', 'warning');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = document.getElementById('cfmPhotoImg');
    var placeholder = document.getElementById('cfmPhotoPlaceholder');
    var preview = document.getElementById('cfmPhotoPreview');
    if (img) img.src = e.target.result;
    if (placeholder) placeholder.style.display = 'none';
    if (preview) preview.style.display = '';
  };
  reader.readAsDataURL(file);
}

function removeCorpoPhoto() {
  var input = document.getElementById('cfmPhotoInput');
  var img = document.getElementById('cfmPhotoImg');
  var placeholder = document.getElementById('cfmPhotoPlaceholder');
  var preview = document.getElementById('cfmPhotoPreview');
  if (input) input.value = '';
  if (img) img.src = '';
  if (placeholder) placeholder.style.display = '';
  if (preview) preview.style.display = 'none';
}

function getCorpoPhotoDataUrl() {
  var img = document.getElementById('cfmPhotoImg');
  return (img && img.src && img.src.indexOf('data:image') === 0) ? img.src : null;
}

function saveCorpoNewField() {
  var labelEl = document.getElementById('cfmLabel');
  var unitEl = document.getElementById('cfmUnit');
  var decimalsEl = document.getElementById('cfmDecimals');
  var minEl = document.getElementById('cfmMin');
  var maxEl = document.getElementById('cfmMax');

  var label = (labelEl.value || '').trim();
  var unit = (unitEl.value || '').trim();
  if (!label || !unit) {
    showFeedbackModal('Preencha o nome e a unidade do campo.', 'warning');
    return;
  }

  var decimals = parseInt(decimalsEl.value, 10);
  if (!Number.isFinite(decimals)) decimals = 1;
  var min = minEl && minEl.value ? Number(minEl.value) : null;
  var max = maxEl && maxEl.value ? Number(maxEl.value) : null;
  var photo = getCorpoPhotoDataUrl();

  var key = generateCorpoCustomKey(label);
  var newField = {
    key: key, label: label, type: 'measure', group: 'custom',
    unit: unit, decimals: decimals, icon: 'custom',
    customMin: min, customMax: max, visible: true
  };
  if (photo) newField.photoUrl = photo;

  var fields = getCorpoAllFields();
  fields.push(newField);
  saveCorpoAllFields(fields);
  hideCorpoCustomFieldForm();
  showFeedbackModal('Campo "' + label + '" adicionado!', 'success');
}


// ===== MODAL DE ECG =====

function openEcgDetail(ecgId) {
  const ecg = mockData.ecgs.find(e => e.id === ecgId);
  if (!ecg) return;

  document.getElementById('ecgDetailTitle').textContent = formatDateTimeForUI(ecg.dataHora);
  
  let html = `
    <div class="card card-ecg" style="margin-bottom: 16px;">
      <div class="ecg-header ecg-header--compact">
        <div class="ecg-icon" aria-hidden="true">${ecg.icon}</div>
        <div class="ecg-value-stack">
          <div class="ecg-value-line"><span class="ecg-value-num">${ecg.frequenciaCardiaca}</span><span class="ecg-value-unit"> bpm</span></div>
          <div class="ecg-rhythm-line">${ecg.ritmo}</div>
        </div>
      </div>
      <div class="ecg-meta"><span class="ecg-date">dY". ${formatDateTimeForUI(ecg.dataHora)}</span></div>
      <div class="ecg-interpretation">${ecg.interpretacao}</div>
    </div>
  `;

  if (ecg.historico && ecg.historico.length > 0) {
    html += '<div class="section-title" style="margin-top: 16px; margin-bottom: 12px;">Histórico</div>';
    html += ecg.historico.map(h => {
      const dataFormatada = h.data;
      const hora = h.hora ? ` ·s ${h.hora}` : '';
      return `
        <div class="card card-saude" style="margin-bottom: 8px;">
          <div class="card-info"><strong>${dataFormatada}${hora}</strong></div>
          <div class="card-info">${h.frequencia} bpm · ${h.ritmo}</div>
          <div class="card-info">Interpretação: ${h.interpretacao}</div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('ecgDetailContent').innerHTML = html;
  document.getElementById('ecgDetailModal').classList.add('active');
  setGlobalHeaderVisible(false);
}

function setupEcgDetailModal() {
  const modal = document.getElementById('ecgDetailModal');
  const closeBtn = document.getElementById('closeEcgDetailModal');
  if (!modal) return;

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
      setGlobalHeaderVisible(true);
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      setGlobalHeaderVisible(true);
    }
  });
}

// ===== FECHAR MODAL DE HISTA"RICO =====

document.addEventListener('DOMContentLoaded', () => {
  const closeVitalDetailModal = document.getElementById('closeVitalDetailModal');
  if (closeVitalDetailModal) {
    closeVitalDetailModal.addEventListener('click', () => {
      if (window._batHdActive) { closeBatHourlyDetail(); return; }
      if (window._pressaoInsertActive) { closePressaoInsertForm(); return; }
      if (window._glicemiaInsertActive) { closeAddGlicemiaWizard(); return; }
      if (window._pressaoColetaActive) { closePressaoColetaDetail(); return; }
      if (window._passaosDiaActive) { closePassosDiaDetail(); return; }
      if (window._oxigenacaoDiaActive) { closeOxigenacaoDiaDetail(); return; }
      document.getElementById('vitalDetailModal').classList.remove('active');
      setGlobalHeaderVisible(true);
    });
  }

  const vitalDetailModal = document.getElementById('vitalDetailModal');
  if (vitalDetailModal) {
    // Tooltip do gráfico por hora não deve ficar "grudado" durante navegação/rolagem.
    vitalDetailModal.addEventListener('click', (e) => {
      const insideHourlyWrap = !!(e.target && e.target.closest && e.target.closest('.vital-batimento-hourly-wrap'));
      if (!insideHourlyWrap) hideBatimentoHourlyTooltip();
    });
    vitalDetailModal.addEventListener('touchmove', () => hideBatimentoHourlyTooltip(), { passive: true });
  }

  const vitalDetailContent = document.getElementById('vitalDetailContent');
  if (vitalDetailContent) {
    vitalDetailContent.addEventListener('scroll', () => hideBatimentoHourlyTooltip(), { passive: true });
  }

  const exercicioDetalheModal = document.getElementById('exercicioDetalheModal');
  const exercicioDetalheOkBtn = document.getElementById('exercicioDetalheOkBtn');
  if (exercicioDetalheOkBtn) {
    exercicioDetalheOkBtn.addEventListener('click', () => closeExercicioDetalheModal());
  }
  if (exercicioDetalheModal) {
    exercicioDetalheModal.addEventListener('click', (e) => {
      if (e.target === exercicioDetalheModal) closeExercicioDetalheModal();
    });
  }

  const sonoDetalheModal = document.getElementById('sonoDetalheModal');
  const sonoDetalheOkBtn = document.getElementById('sonoDetalheOkBtn');
  if (sonoDetalheOkBtn) {
    sonoDetalheOkBtn.addEventListener('click', () => closeSonoDetalheModal());
  }
  if (sonoDetalheModal) {
    sonoDetalheModal.addEventListener('click', (e) => {
      if (e.target === sonoDetalheModal) closeSonoDetalheModal();
    });
  }

  const bminModal = document.getElementById('batimentoMinutoModal');
  const bminCloseBtn = document.getElementById('closeBatimentoMinutoModal');
  if (bminCloseBtn) bminCloseBtn.addEventListener('click', closeBatimentoMinutoModal);
  if (bminModal) bminModal.addEventListener('click', (e) => { if (e.target === bminModal) closeBatimentoMinutoModal(); });
  window.addEventListener('resize', () => {
    if (bminModal && bminModal.classList.contains('active')) {
      const canvas = document.getElementById('batimentoMinutoCanvas');
      if (canvas && canvas._readings) renderBatimentoMinutoCanvas(canvas._readings);
    }
  });

  setupAgendaModal();

  window.addEventListener('resize', () => {
    const m = document.getElementById('exercicioDetalheModal');
    if (m && m.classList.contains('active') && window._lastExercicioSessaoCanvas) {
      renderExercicioHrCanvas(window._lastExercicioSessaoCanvas);
    }
  });
});


// ===== CLOCK WIDGET =====

function initClockWidget() {
  updateClockDisplay();
  setInterval(updateClockDisplay, 1000);
}

function updateClockDisplay() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeString = `${hours}:${minutes}`;
  
  const clockTimeEl = document.getElementById('clockTime');
  if (clockTimeEl) {
    clockTimeEl.textContent = timeString;
  }
  
  updateMedicationSummary();
}

function updateMedicationSummary() {
  const hoje = getTodayISODate();
  const entries = getMedicationDayEntries(hoje);
  const atrasadas = entries.filter((e) => e.status === 'atrasado').length;

  const atrasadasEl = document.getElementById('medAtrasadas');
  if (atrasadasEl) atrasadasEl.textContent = atrasadas;
}

function updateMedicationCalendarHeader() {
  const label = document.getElementById('medCalendarTodayLabel');
  if (label) label.textContent = formatDateForUI(getTodayISODate());
}

function renderMedicationOverdueSection() {
  const container = document.getElementById('medicationsOverdueNow');
  if (!container) return;

  const today = getTodayISODate();
  const overdueEntries = getMedicationDayEntries(today).filter(e => e.status === 'atrasado');

  if (!overdueEntries.length) {
    container.innerHTML = '';
    return;
  }

  const entry = overdueEntries[0];
  const mais = overdueEntries.length - 1;

  container.innerHTML = `
    <div class="med-overdue-section">
      <div class="med-overdue-title">Atrasada agora${overdueEntries.length > 1 ? ` <span class="med-overdue-count">(${overdueEntries.length})</span>` : ''}</div>
      <div class="med-overdue-item">
        <div class="med-overdue-label">
          <span class="med-overdue-time">${entry.horario}</span>
          ${entry.nome} ${entry.dosagem}
        </div>
        <button class="med-overdue-btn" onclick="markMedicationByIdAndTime(${entry.medId}, '${entry.horario}', '${today}')">Tomar</button>
      </div>
      ${mais > 0 ? `<p class="med-overdue-more">Mais ${mais} dose${mais === 1 ? '' : 's'} atrasada${mais === 1 ? '' : 's'} nos horários abaixo.</p>` : ''}
    </div>
  `;
}

// ===== DAILY SCHEDULE MODAL =====

function openDailyScheduleModal(initialFilter = 'todos') {
  const hoje = getTodayISODate();
  document.getElementById('dailyScheduleTitle').textContent = `Agenda de Medicações - ${formatDateForUI(hoje)}`;
  currentDailyScheduleFilter = initialFilter;
  renderDailySchedule(initialFilter);
  setDailyScheduleActiveFilter(initialFilter);
  document.getElementById('dailyScheduleModal').classList.add('active');
}

function renderDailySchedule(filtro = 'todos', dateISO = getTodayISODate()) {
  const hoje = dateISO;
  const agora = new Date();
  const horaAtual = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
  currentDailyScheduleFilter = filtro;

  const rows = [];

  mockData.medicacoes.forEach(med => {
    med.horarios.forEach(horario => {
      const status = getMedicationStatusForDate(med, hoje, horario, horaAtual);

      if (filtro !== 'todos' && status !== filtro) return;

      const statusText = status === 'tomado'
        ? 'Tomado'
        : status === 'atrasado'
        ? 'Atrasado'
        : 'Pendente';

      rows.push({
        medId: med.id,
        nome: med.nome,
        dosagem: med.dosagem,
        horario,
        status,
        statusText
      });
    });
  });

  rows.sort((a, b) => {
    if (a.horario !== b.horario) return a.horario.localeCompare(b.horario);
    return a.nome.localeCompare(b.nome);
  });

  let html = '';
  if (!rows.length) {
    html = '<div class="empty-state"><div class="empty-text">Nenhuma medicação para este filtro</div></div>';
  } else {
    html = rows.map((row) => `
      <div class="schedule-item schedule-item--${row.status}">
        <div class="schedule-item-left">
          <div class="schedule-med">${row.nome} ${row.dosagem}</div>
          <div class="schedule-meta">Horário: ${row.horario}</div>
        </div>
        <div class="schedule-item-right">
          <span class="schedule-status schedule-status--${row.status}">${row.statusText}</span>
          <button class="schedule-btn" onclick="openTakeModal('${row.nome}', '${row.dosagem}', '${row.horario}', ${row.medId})">Tomar</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('dailyScheduleContent').innerHTML = html;
}

function setDailyScheduleActiveFilter(status) {
  document.querySelectorAll('#dailyScheduleModal .filter-btn').forEach((btn) => {
    const txt = (btn.textContent || '').toLowerCase();
    const isActive = (status === 'todos' && txt.includes('todos'))
      || (status === 'tomado' && txt.includes('tomadas'))
      || (status === 'pendente' && txt.includes('pendentes'))
      || (status === 'atrasado' && txt.includes('atrasadas'));
    btn.classList.toggle('active', isActive);
  });
}

function filterScheduleByStatus(status, btnEl = null) {
  currentDailyScheduleFilter = status;
  if (btnEl) {
    document.querySelectorAll('#dailyScheduleModal .filter-btn').forEach(btn => btn.classList.remove('active'));
    btnEl.classList.add('active');
  } else {
    setDailyScheduleActiveFilter(status);
  }
  renderDailySchedule(status);
}

function openOverdueMedicationsModal() {
  openDailyScheduleModal('atrasado');
}

function markMedicationByIdAndTime(medId, horario, dateISO = getTodayISODate(), shouldAlert = true) {
  const med = mockData.medicacoes.find(m => m.id === medId);
  if (!med) return false;

  const indiceHorario = med.historico.findIndex(h => h.data === dateISO && h.hora === horario);
  if (indiceHorario >= 0) {
    med.historico[indiceHorario].status = 'tomado';
  } else {
    med.historico.push({
      data: dateISO,
      hora: horario,
      status: 'tomado'
    });
  }

  updateMedicationSummary();
  renderMedicationOverdueSection();
  if (document.getElementById('dailyScheduleModal')?.classList.contains('active')) {
    renderDailySchedule(currentDailyScheduleFilter);
    setDailyScheduleActiveFilter(currentDailyScheduleFilter);
  }
  if (document.getElementById('medicationCalendarModal')?.classList.contains('active')) {
    renderMedicationCalendarDay();
  }
  if (shouldAlert) {
    showSystemToast(`${med.nome} ${med.dosagem} tomado as ${horario}.`, 'success');
  }
  return true;
}

function undoMedicationTaken(medId, dateISO, horario) {
  const med = mockData.medicacoes.find(m => m.id === medId);
  if (!med || !med.historico) return false;
  const idx = med.historico.findIndex(
    (h) => h.data === dateISO && h.hora === horario && h.status === 'tomado'
  );
  if (idx < 0) return false;
  med.historico.splice(idx, 1);
  updateMedicationSummary();
  renderMedicationOverdueSection();
  renderMedicacoes();
  if (document.getElementById('dailyScheduleModal')?.classList.contains('active')) {
    renderDailySchedule('todos');
  }
  if (document.getElementById('medicationCalendarModal')?.classList.contains('active')) {
    renderMedicationCalendarDay();
  }
  showSystemToast('Marcação de tomado removida.', 'success');
  return true;
}

function handleMedicationScheduleClick(medId, horario, status, nome, dosagem, dateISO = getTodayISODate()) {
  if (status === 'tomado') {
    openConfirmModal(
      `Desfazer "${nome} ${dosagem}" marcado como tomado ·s ${horario}?`,
      () => {
        const undone = undoMedicationTaken(medId, dateISO, horario);
        if (!undone) {
          showFeedbackModal('Não foi possA-vel desfazer essa marcação.', 'warning');
        }
      },
      'Cancelar registro'
    );
    return;
  }
  openTakeModal(nome, dosagem, horario, medId);
}

function renderEditMedicacaoTomadasList(med) {
  const container = document.getElementById('editTomadasCorrecaoContainer');
  if (!container || !med) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const tomados = (med.historico || [])
    .filter((h) => h.status === 'tomado' && h.data >= cutoffStr)
    .sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`));

  if (tomados.length === 0) {
    container.innerHTML =
      '<p class="form-hint" style="margin:0;">Nenhuma dose marcada como tomada nos Últimos 14 dias.</p>';
    return;
  }

  const fmt = typeof formatDateForUI === 'function' ? formatDateForUI : (d) => d;
  container.innerHTML = `
    <p class="form-hint" style="margin:0 0 8px 0;">Toque em <strong>Desfazer</strong> para cancelar um registro errado.</p>
    ${tomados
    .map((h) => {
      const label = `${fmt(h.data)} · ${h.hora}`;
      const d = String(h.data || '').replace(/"/g, '');
      const hh = String(h.hora || '').replace(/"/g, '');
      return `
      <div class="edit-tomada-row">
        <span class="edit-tomada-label">${label}</span>
        <button type="button" class="button-cancel edit-desmarcar-tomado-btn"
          data-med-id="${med.id}"
          data-d="${d}"
          data-h="${hh}">Desfazer</button>
      </div>`;
    })
    .join('')}
  `;
}

function openMedicationCalendarModal() {
  const input = document.getElementById('medicationCalendarDateInput');
  if (input) input.value = getTodayISODate();
  renderMedicationCalendarDay();
  document.getElementById('medicationCalendarModal').classList.add('active');
}

function renderMedicationCalendarDay() {
  const input = document.getElementById('medicationCalendarDateInput');
  const selectedDate = (input && input.value) ? input.value : getTodayISODate();
  const entries = getMedicationDayEntries(selectedDate);
  const grouped = new Map();

  entries.forEach(entry => {
    const key = `${entry.medId}-${entry.nome}-${entry.dosagem}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        medId: entry.medId,
        nome: entry.nome,
        dosagem: entry.dosagem,
        slots: []
      });
    }
    grouped.get(key).slots.push({ horario: entry.horario, status: entry.status });
  });

  const totalTaken = entries.filter(e => e.status === 'tomado').length;
  const totalPending = entries.filter(e => e.status === 'pendente').length;
  const totalMissed = entries.filter(e => e.status === 'atrasado').length;

  const summaryEl = document.getElementById('medicationCalendarSummary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <span class="calendar-day-pill ok">${totalTaken} tomadas</span>
      <span class="calendar-day-pill pending">${totalPending} pendentes</span>
      <span class="calendar-day-pill missed">${totalMissed} atrasadas</span>
    `;
  }

  const titleEl = document.getElementById('medicationCalendarTitle');
  if (titleEl) {
    titleEl.textContent = `Calendário de Medicações - ${formatDateForUI(selectedDate)}`;
  }

  const content = document.getElementById('medicationCalendarContent');
  if (!content) return;

  if (!grouped.size) {
    content.innerHTML = '<div class="empty-state"><div class="empty-text">Nenhuma medicação para este dia</div></div>';
    return;
  }

  content.innerHTML = Array.from(grouped.values()).map(group => `
    <div class="calendar-med-item">
      <div class="calendar-med-header">
        <div class="calendar-med-name">${group.nome}</div>
        <div class="calendar-med-dose">${group.dosagem}</div>
      </div>
      <div class="calendar-med-slots">
        ${group.slots.map(slot => `
          <span class="calendar-slot ${slot.status}">
            ${slot.horario}
          </span>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ===== MEDICATION SEARCH =====

function searchMedicamentos(termo) {
  const searchResults = document.getElementById('searchResults');
  updateMedManualRegisterBtn();

  if (!termo.trim()) {
    searchResults.style.display = 'none';
    searchResults.innerHTML = '';
    return;
  }

  const termoEsc = escapeHtmlText(termo.trim());

  const resultados = mockData.catalogoMedicamentos.filter(med =>
    med.nome.toLowerCase().includes(termo.toLowerCase())
  );

  if (resultados.length === 0) {
    searchResults.innerHTML = `
      <div class="search-no-result-panel">
        <p class="search-no-result-text">Nenhum resultado no catálogo para "${termoEsc}".</p>
        <p class="search-no-result-hint">Use o botão <strong>Cadastrar com este nome</strong> abaixo do campo de busca.</p>
      </div>`;
    searchResults.style.display = 'block';
    return;
  }
  
  const labelForForma = (key) => {
    const map = {
      comprimido: 'Comprimidos',
      capsula: 'Cápsulas',
      gotas: 'Gotas',
      xarope: 'Xaropes',
      solucao: 'Solução (ml)',
      colher: 'Colher (chá/sopa)',
      injetavel: 'Injetáveis',
      spray: 'Spray/Inalador',
      unidade: 'Unidade'
    };
    return map[key] || 'Outros';
  };

  const keyForMed = (med) => {
    const first = (med.formas && med.formas.length) ? med.formas[0] : 'outros';
    return first;
  };

  const grouped = new Map();
  resultados.forEach((med) => {
    const key = keyForMed(med);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(med);
  });

  const orderedKeys = Array.from(grouped.keys()).sort((a, b) => labelForForma(a).localeCompare(labelForForma(b)));

  let html = '';
  orderedKeys.forEach((key) => {
    const items = grouped.get(key).sort((a, b) => a.nome.localeCompare(b.nome));
    html += `<div style="padding: 6px 8px; font-size: 11px; color: #666; font-weight: 700; background: #fafafa; border-bottom: 1px solid #eee;">${labelForForma(key)}</div>`;
    items.forEach(med => {
      const formasTxt = (med.formas && med.formas.length) ? med.formas.join(' ??? ') : '';
      html += `
        <div class="search-result-item" onclick="selectMedicamento(${med.id})">
          <div class="search-result-name">${med.nome}</div>
          ${formasTxt ? `<div class="search-result-meta">${formasTxt}</div>` : ''}
        </div>
      `;
    });
  });

  html += `
    <div class="med-search-custom-footer">
      <button type="button" class="med-search-custom-btn" onclick="registerCustomMedicamentoFromSearch()">
        Não Ac nenhum destes – cadastrar "${termoEsc}" manualmente
      </button>
    </div>`;

  searchResults.innerHTML = html;
  searchResults.style.display = 'block';
}

/** Um remAcdio por vez: mostra busca ou o nome escolhido + ??oTrocar???. */
function setAddMedicacaoMedPickPhase(showSearch) {
  const searchRow = document.getElementById('medSearchRow');
  const selectedRow = document.getElementById('medSelectedRow');
  const searchInput = document.getElementById('searchMedInput');
  if (searchRow) searchRow.style.display = showSearch ? 'block' : 'none';
  if (selectedRow) selectedRow.style.display = showSearch ? 'none' : 'flex';
  if (showSearch) {
    const label = document.getElementById('medSelectedDisplayName');
    if (label) label.textContent = '';
  }
  if (showSearch && searchInput) setTimeout(() => searchInput.focus(), 80);
}

function trocarMedicamentoSelecionado() {
  const hidden = document.getElementById('selectedMedName');
  if (hidden) hidden.value = '';
  const label = document.getElementById('medSelectedDisplayName');
  if (label) label.textContent = '';
  const dosagemSelect = document.getElementById('dosagemMedInput');
  if (dosagemSelect) dosagemSelect.innerHTML = '<option value="">Selecione a dosagem</option>';
  const searchResults = document.getElementById('searchResults');
  if (searchResults) {
    searchResults.style.display = 'none';
    searchResults.innerHTML = '';
  }
  const searchInput = document.getElementById('searchMedInput');
  if (searchInput) searchInput.value = '';
  setAddMedicacaoMedPickPhase(true);
  updateMedManualRegisterBtn();
}

function selectMedicamento(medId) {
  const med = mockData.catalogoMedicamentos.find(m => m.id === medId);
  if (!med) return;

  document.getElementById('selectedMedName').value = med.nome;
  const displayName = document.getElementById('medSelectedDisplayName');
  if (displayName) displayName.textContent = med.nome;
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('searchMedInput').value = '';

  const dosagemSelect = document.getElementById('dosagemMedInput');
  dosagemSelect.innerHTML = '<option value="">Selecione a dosagem</option>';

  med.dosagens.forEach(dosagem => {
    const option = document.createElement('option');
    option.value = dosagem;
    option.textContent = dosagem;
    dosagemSelect.appendChild(option);
  });

  setAddMedicacaoMedPickPhase(false);
}

// ===== FREQUENCY TIME PICKER =====

function updateHorariosFields() {
  const frequencia = document.getElementById('frequenciaMedInput').value;
  const container = document.getElementById('horariosContainer');
  
  container.innerHTML = '';
  
  if (!frequencia) return;
  
  let numHorarios = 0;
  if (frequencia === '1x ao dia') numHorarios = 1;
  else if (frequencia === '2x ao dia') numHorarios = 2;
  else if (frequencia === '3x ao dia') numHorarios = 3;
  else if (frequencia === '4x ao dia') numHorarios = 4;
  else if (frequencia === 'Conforme necessário') numHorarios = 1;
  
  for (let i = 0; i < numHorarios; i++) {
    const label = numHorarios === 1 ? 'Horário' : `Horário ${i + 1}`;
    const html = `
      <div class="form-group">
        <label class="form-label">${label}</label>
        <input type="time" class="form-input horario-input" data-index="${i}" required>
      </div>
    `;
    container.innerHTML += html;
  }
  if (typeof refreshEstoqueSugeridoAdd === 'function') refreshEstoqueSugeridoAdd();
}

function updateEditHorariosFields() {
  const frequencia = document.getElementById('editFrequenciaMedInput').value;
  const container = document.getElementById('editHorariosContainer');
  
  container.innerHTML = '';
  
  if (!frequencia) return;
  
  let numHorarios = 0;
  if (frequencia === '1x ao dia') numHorarios = 1;
  else if (frequencia === '2x ao dia') numHorarios = 2;
  else if (frequencia === '3x ao dia') numHorarios = 3;
  else if (frequencia === '4x ao dia') numHorarios = 4;
  else if (frequencia === 'Conforme necessário') numHorarios = 1;
  
  for (let i = 0; i < numHorarios; i++) {
    const label = numHorarios === 1 ? 'Horário' : `Horário ${i + 1}`;
    const html = `
      <div class="form-group">
        <label class="form-label">${label}</label>
        <input type="time" class="form-input edit-horario-input" data-index="${i}" required>
      </div>
    `;
    container.innerHTML += html;
  }
  if (typeof refreshEstoqueSugeridoEdit === 'function') refreshEstoqueSugeridoEdit();
}

// ===== SETUP DAILY SCHEDULE MODAL =====

document.addEventListener('DOMContentLoaded', () => {
  const closeDailyScheduleModal = document.getElementById('closeDailyScheduleModal');
  if (closeDailyScheduleModal) {
    closeDailyScheduleModal.addEventListener('click', () => {
      document.getElementById('dailyScheduleModal').classList.remove('active');
    });
  }
  
  const dailyScheduleModal = document.getElementById('dailyScheduleModal');
  if (dailyScheduleModal) {
    dailyScheduleModal.addEventListener('click', (e) => {
      if (e.target === dailyScheduleModal) {
        dailyScheduleModal.classList.remove('active');
      }
    });
  }

  const closeMedicationCalendarModal = document.getElementById('closeMedicationCalendarModal');
  const medicationCalendarModal = document.getElementById('medicationCalendarModal');
  if (closeMedicationCalendarModal) {
    closeMedicationCalendarModal.addEventListener('click', () => {
      medicationCalendarModal.classList.remove('active');
    });
  }
  if (medicationCalendarModal) {
    medicationCalendarModal.addEventListener('click', (e) => {
      if (e.target === medicationCalendarModal) {
        medicationCalendarModal.classList.remove('active');
      }
    });
  }
  
  initClockWidget();
  updateMedicationCalendarHeader();
});


// ===== TAKE MEDICATION MODAL =====

let currentTakeMedication = {
  nome: '',
  dosagem: '',
  horario: '',
  medId: null
};

function openTakeModal(nome, dosagem, horario, medId) {
  currentTakeMedication = { nome, dosagem, horario, medId };
  
  const agora = new Date();
  const horaAtual = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
  
  document.getElementById('takeMedName').textContent = `${nome} ${dosagem}`;
  document.getElementById('takeMedScheduledTime').textContent = horario;
  document.getElementById('takeMedCurrentTime').textContent = horaAtual;
  document.getElementById('takeMedTimeInput').value = horaAtual;
  
  document.getElementById('takeMedicationModal').classList.add('active');
}

function confirmTakeMedication(useCurrentTime) {
  const { nome, dosagem, horario, medId } = currentTakeMedication;
  const med = mockData.medicacoes.find(m => m.id === medId);
  if (!med) return;
  
  const hoje = getTodayISODate();
  let horaRegistro = horario;
  
  if (useCurrentTime) {
    const agora = new Date();
    horaRegistro = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
  } else {
    horaRegistro = document.getElementById('takeMedTimeInput').value;
  }
  
  markMedicationByIdAndTime(medId, horario, hoje, false);
  
  document.getElementById('takeMedicationModal').classList.remove('active');
  renderMedicacoes();
  showSystemToast(`${nome} ${dosagem} tomado as ${horaRegistro}.`, 'success');
}

// Setup Take Medication Modal
document.addEventListener('DOMContentLoaded', () => {
  const takeMedModal = document.getElementById('takeMedicationModal');
  const closeTakeMedBtn = document.getElementById('closeTakeMedicationModal');
  const cancelTakeMedBtn = document.getElementById('cancelTakeMedicationBtn');
  
  if (closeTakeMedBtn) {
    closeTakeMedBtn.addEventListener('click', () => {
      takeMedModal.classList.remove('active');
    });
  }
  
  if (cancelTakeMedBtn) {
    cancelTakeMedBtn.addEventListener('click', () => {
      takeMedModal.classList.remove('active');
    });
  }
  
  if (takeMedModal) {
    takeMedModal.addEventListener('click', (e) => {
      if (e.target === takeMedModal) {
        takeMedModal.classList.remove('active');
      }
    });
  }
});


// ===== PERIOD FILTER =====

let currentPeriodFilter = '7d';
let customPeriodStart = null;
let customPeriodEnd = null;

function openPeriodFilterModal() {
  document.getElementById('periodFilterModal').classList.add('active');
}

function setPeriodFilter(period) {
  document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  const customContainer = document.getElementById('customPeriodContainer');
  if (period === 'custom') {
    customContainer.style.display = 'block';
  } else {
    customContainer.style.display = 'none';
    currentPeriodFilter = period;
  }
}

function applyPeriodFilter() {
  const period = document.querySelector('.period-btn.active').getAttribute('onclick').match(/'([^']+)'/)[1];
  
  if (period === 'custom') {
    const startDate = document.getElementById('periodStartDate').value;
    const endDate = document.getElementById('periodEndDate').value;
    
    if (!startDate || !endDate) {
      showFeedbackModal('Selecione data de início e fim.', 'warning');
      return;
    }
    
    customPeriodStart = startDate;
    customPeriodEnd = endDate;
  }
  
  currentPeriodFilter = period;
  document.getElementById('periodFilterModal').classList.remove('active');
  renderAdherenceReport();
}

// ===== ADHERENCE REPORT =====

function openAdherenceReport() {
  renderAdherenceReport();
  document.getElementById('adherenceReportModal').classList.add('active');
}

function renderAdherenceReport() {
  const { startDate, endDate } = getPeriodDates();
  const stats = calculateAdherenceStats(startDate, endDate);
  
  document.getElementById('adherencePercentage').textContent = stats.percentage + '%';
  document.getElementById('medicationsTaken').textContent = stats.taken;
  document.getElementById('medicationsMissed').textContent = stats.missed;
  document.getElementById('adherencePeriodText').textContent = getPeriodLabel();
  
  renderAdherenceByMedication(startDate, endDate);
  renderDailyAdherence(startDate, endDate);
}

function getPeriodDates() {
  const today = new Date();
  let startDate, endDate = new Date();
  
  if (currentPeriodFilter === '7d') {
    startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (currentPeriodFilter === '30d') {
    startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (currentPeriodFilter === '90d') {
    startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (currentPeriodFilter === 'custom') {
    startDate = new Date(customPeriodStart);
    endDate = new Date(customPeriodEnd);
  }
  
  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10)
  };
}

function getPeriodLabel() {
  if (currentPeriodFilter === '7d') return 'Asltimos 7 dias';
  if (currentPeriodFilter === '30d') return 'Asltimos 30 dias';
  if (currentPeriodFilter === '90d') return 'Asltimos 90 dias';
  if (currentPeriodFilter === 'custom') return `${formatDateForUI(customPeriodStart)} a ${formatDateForUI(customPeriodEnd)}`;
}

function calculateAdherenceStats(startDate, endDate) {
  let totalExpected = 0;
  let totalTaken = 0;
  
  mockData.medicacoes.forEach(med => {
    med.horarios.forEach(horario => {
      const dataRange = getDateRange(startDate, endDate);
      dataRange.forEach(data => {
        totalExpected++;
        const registro = med.historico.find(h => h.data === data && h.hora === horario);
        if (registro && registro.status === 'tomado') {
          totalTaken++;
        }
      });
    });
  });
  
  const percentage = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 0;
  
  return {
    percentage,
    taken: totalTaken,
    missed: totalExpected - totalTaken
  };
}

function getDateRange(startDateStr, endDateStr) {
  const dates = [];
  let current = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

function renderAdherenceByMedication(startDate, endDate) {
  const dataRange = getDateRange(startDate, endDate);
  let html = '';
  
  mockData.medicacoes.forEach(med => {
    let taken = 0;
    let expected = 0;
    
    med.horarios.forEach(horario => {
      dataRange.forEach(data => {
        expected++;
        const registro = med.historico.find(h => h.data === data && h.hora === horario);
        if (registro && registro.status === 'tomado') {
          taken++;
        }
      });
    });
    
    const percentage = expected > 0 ? Math.round((taken / expected) * 100) : 0;
    const barFill = '#8a8a8a';
    
    html += `
      <div class=\"adherence-med-card\">\n        <div class=\"adherence-med-header\">\n          <div class=\"adherence-med-name\">${med.nome} ${med.dosagem}</div>\n          <div class=\"adherence-med-percentage\">${percentage}%</div>\n        </div>\n        <div class=\"adherence-med-bar\">\n          <div class=\"adherence-med-fill\" style=\"width: ${percentage}%; background-color: ${barFill};\"></div>\n        </div>\n        <div class=\"adherence-med-stats\">\n          <span>${taken}/${expected} tomadas</span>\n        </div>\n      </div>\n    `;
  });
  
  document.getElementById('adherenceByMedicationContent').innerHTML = html;
}

function renderDailyAdherence(startDate, endDate) {
  const dataRange = getDateRange(startDate, endDate);
  let html = '';
  
  dataRange.reverse().forEach(data => {
    let dayTaken = 0;
    let dayExpected = 0;
    
    mockData.medicacoes.forEach(med => {
      med.horarios.forEach(horario => {
        dayExpected++;
        const registro = med.historico.find(h => h.data === data && h.hora === horario);
        if (registro && registro.status === 'tomado') {
          dayTaken++;
        }
      });
    });
    
    const percentage = dayExpected > 0 ? Math.round((dayTaken / dayExpected) * 100) : 0;
    const statusText = percentage === 100 ? 'Excelente' : percentage >= 50 ? 'Atenção' : 'Baixa';
    
    html += `
      <div class=\"daily-adherence-item\">\n        <div class=\"daily-date\">${formatDateForUI(data)}</div>\n        <div class=\"daily-stats\">\n          <span>${dayTaken}/${dayExpected}</span>\n          <span class=\"daily-icon\">${statusText}</span>\n        </div>\n      </div>\n    `;
  });
  
  document.getElementById('dailyAdherenceContent').innerHTML = html;
}

// Setup Period Filter Modal
document.addEventListener('DOMContentLoaded', () => {
  const periodFilterModal = document.getElementById('periodFilterModal');
  const closePeriodFilterModal = document.getElementById('closePeriodFilterModal');
  const cancelPeriodFilterBtn = document.getElementById('cancelPeriodFilterBtn');
  const applyPeriodFilterBtn = document.getElementById('applyPeriodFilterBtn');
  
  if (closePeriodFilterModal) {
    closePeriodFilterModal.addEventListener('click', () => {
      periodFilterModal.classList.remove('active');
    });
  }
  
  if (cancelPeriodFilterBtn) {
    cancelPeriodFilterBtn.addEventListener('click', () => {
      periodFilterModal.classList.remove('active');
    });
  }
  
  if (applyPeriodFilterBtn) {
    applyPeriodFilterBtn.addEventListener('click', applyPeriodFilter);
  }
  
  if (periodFilterModal) {
    periodFilterModal.addEventListener('click', (e) => {
      if (e.target === periodFilterModal) {
        periodFilterModal.classList.remove('active');
      }
    });
  }
});

// Setup Adherence Report Modal
document.addEventListener('DOMContentLoaded', () => {
  const adherenceReportModal = document.getElementById('adherenceReportModal');
  const closeAdherenceReportModal = document.getElementById('closeAdherenceReportModal');
  const reportBtn = document.getElementById('reportBtn');
  
  if (reportBtn) {
    reportBtn.addEventListener('click', openAdherenceReport);
  }
  
  if (closeAdherenceReportModal) {
    closeAdherenceReportModal.addEventListener('click', () => {
      adherenceReportModal.classList.remove('active');
    });
  }
  
  if (adherenceReportModal) {
    adherenceReportModal.addEventListener('click', (e) => {
      if (e.target === adherenceReportModal) {
        adherenceReportModal.classList.remove('active');
      }
    });
  }
});

// Setup Medication Photo Modal
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('medicationPhotoModal');
  const closeBtn = document.getElementById('closeMedicationPhotoModal');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const confirmModal = document.getElementById('confirmModal');
  const confirmOkBtn = document.getElementById('confirmModalOkBtn');
  const confirmCancelBtn = document.getElementById('confirmModalCancelBtn');
  if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', () => {
      const action = pendingConfirmAction;
      closeConfirmModal();
      if (typeof action === 'function') action();
    });
  }
  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', closeConfirmModal);
  }
  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) closeConfirmModal();
    });
  }

  const modal = document.getElementById('feedbackModal');
  const okBtn = document.getElementById('feedbackModalOkBtn');
  if (okBtn) {
    okBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  }
});


// ===== ALERTAS =====

function renderAlertasVitais() {
  const comAlerta = mockData.sinaisVitais.filter(v => v.alerta && v.alerta.ativo);
  if (!comAlerta.length) {
    document.getElementById('alertasVitaisContent').innerHTML = '<div class="card-info" style="padding:12px;color:#999;">Nenhum alerta de sinal vital configurado.<br>Configure em Perfil -> Meus Indicadores.</div>';
    return;
  }
  document.getElementById('alertasVitaisContent').innerHTML = comAlerta.map(v => `
    <div class="vital-config-row">
      <span class="vital-config-icon">${v.icon}</span>
      <div style="flex:1;">
        <div class="vital-config-name">${v.tipo}</div>
        <div style="font-size:11px;color:#aaa;">
          ${v.alerta.acima != null ? `Acima de ${v.alerta.acima} ${v.unidade}` : ''}
          ${v.alerta.acima != null && v.alerta.abaixo != null ? ' | ' : ''}
          ${v.alerta.abaixo != null ? `Abaixo de ${v.alerta.abaixo} ${v.unidade}` : ''}
        </div>
      </div>
      <button class="toggle active" onclick="toggleAlertaVitalAtivo(${v.id}, this)"></button>
      <button onclick="editAlertaVital(${v.id})" style="background:none;border:none;font-size:14px;cursor:pointer;color:#454545;padding:4px 2px;">Editar</button>
    </div>
  `).join('');
}

function toggleAlertaVitalAtivo(id, btn) {
  const v = mockData.sinaisVitais.find(v => v.id === id);
  if (v && v.alerta) { v.alerta.ativo = !v.alerta.ativo; btn.classList.toggle('active'); }
}

function editAlertaVital(id) {
  editIndicador('vitais', id);
  document.getElementById('alertasModal').classList.remove('active');
}

function renderAlertasMeds() {
  const html = mockData.medicacoes.filter(m => m.alertas).map(m => {
    const a = m.alertas;
    const tags = [];
    if (a.lembrete) tags.push(`??? ${a.antecedencia}min antes`);
    if (a.atrasada) tags.push('?s??,? Dose atrasada');
    if (a.estoqueBaixo) tags.push('dY"? Estoque baixo');
    return `
      <div class="vital-config-row">
        <span class="vital-config-icon">dY'S</span>
        <div style="flex:1;">
          <div class="vital-config-name">${m.nome} ${m.dosagem}</div>
          <div style="font-size:11px;color:#aaa;">${tags.join(' ??? ') || 'Sem alertas'}</div>
        </div>
        <button class="toggle ${a.lembrete || a.atrasada || a.estoqueBaixo ? 'active' : ''}" onclick="toggleAlertaMed(${m.id}, this)"></button>
      </div>
    `;
  }).join('');
  document.getElementById('alertasMedsContent').innerHTML = html || '<div class="card-info" style="padding:12px;color:#999;">Nenhum alerta de medicação configurado.</div>';
}

function toggleAlertaMed(id, btn) {
  const m = mockData.medicacoes.find(m => m.id === id);
  if (!m || !m.alertas) return;
  const ativo = btn.classList.contains('active');
  m.alertas.lembrete = !ativo;
  m.alertas.atrasada = !ativo;
  m.alertas.estoqueBaixo = !ativo;
  btn.classList.toggle('active');
  renderAlertasMeds();
}

function renderAlertasAgenda() {
  const todas = [...mockData.consultas, ...mockData.examesAgendados].filter(a => a.alerta);
  if (!todas.length) {
    document.getElementById('alertasAgendaContent').innerHTML = '<div class="card-info" style="padding:12px;color:#999;">Nenhum lembrete de agenda configurado.</div>';
    return;
  }
  const antLabel = min => min >= 1440 ? `${min/1440} dia(s) antes` : `${min/60}h antes`;
  document.getElementById('alertasAgendaContent').innerHTML = todas.map(a => `
    <div class="vital-config-row">
      <span class="vital-config-icon">${a.medico ? 'dY".' : 'dY"?'}</span>
      <div style="flex:1;">
        <div class="vital-config-name">${a.medico || a.nome}</div>
        <div style="font-size:11px;color:#aaa;">${formatDateForUI(a.data)} ??? ${a.alerta.ativo ? antLabel(a.alerta.antecedencia) : 'Desativado'}</div>
      </div>
      <button class="toggle ${a.alerta.ativo ? 'active' : ''}" onclick="toggleAlertaAgenda(${a.id}, '${a.medico ? 'consulta' : 'exame'}', this)"></button>
    </div>
  `).join('');
}

function toggleAlertaAgenda(id, tipo, btn) {
  const lista = tipo === 'consulta' ? mockData.consultas : mockData.examesAgendados;
  const item = lista.find(a => a.id === id);
  if (item && item.alerta) { item.alerta.ativo = !item.alerta.ativo; btn.classList.toggle('active'); }
}

document.addEventListener('DOMContentLoaded', () => {
  const closeAlertas = document.getElementById('closeAlertasModal');
  const alertasModal = document.getElementById('alertasModal');
  if (closeAlertas) closeAlertas.addEventListener('click', () => alertasModal.classList.remove('active'));
  if (alertasModal) alertasModal.addEventListener('click', e => { if (e.target === alertasModal) alertasModal.classList.remove('active'); });
});

// ===== INDICADORES UNIFICADOS (VITAIS + CORPO) =====

let _indicadoresAba = 'vitais'; // aba ativa atual

function switchTab(modalPrefix, aba, btn) {
  // Atualizar botoes
  btn.closest('.tab-bar').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Mostrar conteudo correto
  document.getElementById(modalPrefix + 'VitaisContent').classList.toggle('active', aba === 'vitais');
  document.getElementById(modalPrefix + 'CorpoContent').classList.toggle('active', aba === 'corpo');
  _indicadoresAba = aba;
}

// ----- VALORES IDEAIS -----

function renderValoresIdeaisVitais() {
  const html = mockData.sinaisVitais.map(v => `
    <div class="vital-config-row">
      <span class="vital-config-icon">${v.icon}</span>
      <div style="flex:1;">
        <div class="vital-config-name">${v.tipo}</div>
        <div style="font-size:11px;color:#aaa;">${v.unidade}</div>
      </div>
      <input type="text" class="form-input" style="width:110px;text-align:center;font-size:13px;padding:6px 8px;"
        value="${getIdealLabel(v.ideal)}" placeholder="ex: 60-100"
        onchange="salvarValorIdealVital(${v.id}, this.value)">
    </div>
  `).join('');
  document.getElementById('valoresIdeaisVitaisContent').innerHTML = html;
}

function renderValoresIdeaisCorpo() {
  const html = mockData.composicaoCorporal.map(c => `
    <div class="vital-config-row">
      <span class="vital-config-icon">${c.icon}</span>
      <div style="flex:1;">
        <div class="vital-config-name">${c.tipo}</div>
        <div style="font-size:11px;color:#aaa;">${c.unidade}</div>
      </div>
      <input type="text" class="form-input" style="width:110px;text-align:center;font-size:13px;padding:6px 8px;"
        value="${getIdealLabel(c.ideal)}" placeholder="ex: 18.5-24.9"
        onchange="salvarValorIdealCorpo(${c.id}, this.value)">
    </div>
  `).join('');
  document.getElementById('valoresIdeaisCorpoContent').innerHTML = html;
}

function salvarValorIdealVital(id, valor) {
  const v = mockData.sinaisVitais.find(v => v.id === id);
  if (v) { v.ideal = toIdealObjectFromInput(valor); renderSaude(); }
}

function salvarValorIdealCorpo(id, valor) {
  const c = mockData.composicaoCorporal.find(c => c.id === id);
  if (c) { c.ideal = toIdealObjectFromInput(valor); renderComposicao(); }
}

// ----- MEUS INDICADORES -----

function openMeusIndicadoresModal() {
  _indicadoresAba = 'vitais';
  // Reset abas
  const modal = document.getElementById('meusIndicadoresModal');
  modal.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  modal.querySelectorAll('.tab-content').forEach((c, i) => c.classList.toggle('active', i === 0));
  renderMeusIndicadoresVitais();
  renderMeusIndicadoresCorpo();
  modal.classList.add('active');
}

function renderMeusIndicadoresVitais() {
  const html = mockData.sinaisVitais.map(v => `
    <div class="vital-config-row">
      <span class="vital-config-icon">${v.icon}</span>
      <div style="flex:1;">
        <div class="vital-config-name">${v.tipo}</div>
        <div style="font-size:11px;color:#aaa;">${v.unidade} | Ideal: ${getIdealLabel(v.ideal)}</div>
      </div>
      <span class="vital-alert-indicator ${v.alerta && v.alerta.ativo ? 'active' : 'inactive'}"
        title="${v.alerta && v.alerta.ativo ? 'Alerta configurado' : 'Sem alerta configurado'}">
        ${v.alerta && v.alerta.ativo ? 'ON' : 'OFF'}
      </span>
      <button onclick="editIndicador('vitais',${v.id})" style="background:none;border:none;font-size:14px;cursor:pointer;color:#454545;padding:4px;">Editar</button>
      <button onclick="removeIndicador('vitais',${v.id})" style="background:none;border:none;font-size:14px;cursor:pointer;color:#ddd;padding:4px;">Remover</button>
    </div>
  `).join('');
  document.getElementById('meusIndicadoresVitaisContent').innerHTML = html || '<div class="card-info" style="padding:8px;">Nenhum indicador.</div>';
}

function renderMeusIndicadoresCorpo() {
  const html = mockData.composicaoCorporal.map(c => `
    <div class="vital-config-row">
      <span class="vital-config-icon">${c.icon}</span>
      <div style="flex:1;">
        <div class="vital-config-name">${c.tipo}</div>
        <div style="font-size:11px;color:#aaa;">${c.unidade} | Ideal: ${getIdealLabel(c.ideal)}</div>
      </div>
      <button onclick="editIndicador('corpo',${c.id})" style="background:none;border:none;font-size:14px;cursor:pointer;color:#454545;padding:4px;">Editar</button>
      <button onclick="removeIndicador('corpo',${c.id})" style="background:none;border:none;font-size:14px;cursor:pointer;color:#ddd;padding:4px;">Remover</button>
    </div>
  `).join('');
  document.getElementById('meusIndicadoresCorpoContent').innerHTML = html || '<div class="card-info" style="padding:8px;">Nenhum indicador.</div>';
}

function removeIndicador(categoria, id) {
  if (categoria === 'vitais') {
    const v = mockData.sinaisVitais.find(v => v.id === id);
    if (!v) return;
    openConfirmModal(
      `Remover "${v.tipo}"?`,
      () => {
        mockData.sinaisVitais = mockData.sinaisVitais.filter(x => x.id !== id);
        delete mockData.configSinaisVitais[v.tipo];
        renderMeusIndicadoresVitais();
        renderSaude();
      },
      'Confirmar remoção'
    );
  } else {
    const c = mockData.composicaoCorporal.find(c => c.id === id);
    if (!c) return;
    openConfirmModal(
      `Remover "${c.tipo}"?`,
      () => {
        mockData.composicaoCorporal = mockData.composicaoCorporal.filter(x => x.id !== id);
        delete mockData.configComposicao[c.tipo];
        renderMeusIndicadoresCorpo();
        renderComposicao();
      },
      'Confirmar remoção'
    );
  }
}

function editIndicador(categoria, id) {
  const item = categoria === 'vitais'
    ? mockData.sinaisVitais.find(v => v.id === id)
    : mockData.composicaoCorporal.find(c => c.id === id);
  if (!item) return;

  document.getElementById('novoIndicadorModalTitle').textContent = `Editar: ${item.tipo}`;
  document.getElementById('novoIndicadorCategoria').value = categoria;
  document.getElementById('editIndicadorId').value = id;
  document.getElementById('novoIndicadorNome').value = item.tipo;
  document.getElementById('novoIndicadorNome').readOnly = true;
  document.getElementById('novoIndicadorUnidade').value = item.unidade;
  document.getElementById('novoIndicadorIdeal').value = getIdealLabel(item.ideal);
  document.getElementById('novoIndicadorIcon').value = item.icon;
  document.getElementById('novoIndicadorFonte').value = item.fonte || 'Manual';
  document.getElementById('salvarIndicadorBtn').textContent = 'Salvar';

  // Alertas – só para vitais
  const alertaContainer = document.getElementById('alertaVitalContainer');
  if (categoria === 'vitais') {
    alertaContainer.classList.remove('is-hidden');
    const alerta = item.alerta || { ativo: false, acima: '', abaixo: '' };
    const toggleBtn = document.getElementById('toggleAlertaVital');
    toggleBtn.classList.toggle('active', !!alerta.ativo);
    document.getElementById('alertaVitalFields').classList.toggle('is-hidden', !alerta.ativo);
    document.getElementById('alertaAcimaInput').value = alerta.acima != null ? alerta.acima : '';
    document.getElementById('alertaAbaixoInput').value = alerta.abaixo != null ? alerta.abaixo : '';
    document.getElementById('alertaUnidadeLabel').textContent = item.unidade;
    document.getElementById('alertaUnidadeLabel2').textContent = item.unidade;
  } else {
    alertaContainer.classList.add('is-hidden');
  }

  document.getElementById('novoIndicadorModal').classList.add('active');
}

function openNovoIndicadorModal() {
  document.getElementById('novoIndicadorModalTitle').textContent = 'Novo Indicador';
  document.getElementById('novoIndicadorCategoria').value = _indicadoresAba;
  document.getElementById('editIndicadorId').value = '';
  document.getElementById('novoIndicadorNome').readOnly = false;
  document.getElementById('novoIndicadorForm').reset();
  document.getElementById('salvarIndicadorBtn').textContent = 'Adicionar';
  const alertaContainer = document.getElementById('alertaVitalContainer');
  const toggleBtn = document.getElementById('toggleAlertaVital');
  const fields = document.getElementById('alertaVitalFields');
  if (_indicadoresAba === 'vitais') {
    alertaContainer.classList.remove('is-hidden');
    toggleBtn.classList.remove('active');
    fields.classList.add('is-hidden');
    document.getElementById('alertaAcimaInput').value = '';
    document.getElementById('alertaAbaixoInput').value = '';
  } else {
    alertaContainer.classList.add('is-hidden');
  }
  document.getElementById('novoIndicadorModal').classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  // Valores Ideais
  const closeVI = document.getElementById('closeValoresIdeaisModal');
  const viModal = document.getElementById('valoresIdeaisModal');
  if (closeVI) closeVI.addEventListener('click', () => viModal.classList.remove('active'));
  if (viModal) viModal.addEventListener('click', e => { if (e.target === viModal) viModal.classList.remove('active'); });

  // Meus Indicadores
  const closeMI = document.getElementById('closeMeusIndicadoresModal');
  const miModal = document.getElementById('meusIndicadoresModal');
  if (closeMI) closeMI.addEventListener('click', () => miModal.classList.remove('active'));
  if (miModal) miModal.addEventListener('click', e => { if (e.target === miModal) miModal.classList.remove('active'); });

  // Novo/Editar Indicador
  const niModal = document.getElementById('novoIndicadorModal');
  const cancelNI = document.getElementById('cancelNovoIndicadorBtn');
  const niForm = document.getElementById('novoIndicadorForm');

  const closeNI = () => {
    niModal.classList.remove('active');
    niForm.reset();
    document.getElementById('novoIndicadorNome').readOnly = false;
  };

  if (cancelNI) cancelNI.addEventListener('click', closeNI);
  if (niModal) niModal.addEventListener('click', e => { if (e.target === niModal) closeNI(); });

  if (niForm) niForm.addEventListener('submit', e => {
    e.preventDefault();
    const categoria = document.getElementById('novoIndicadorCategoria').value;
    const editId = document.getElementById('editIndicadorId').value;
    const nome = document.getElementById('novoIndicadorNome').value.trim();
    const unidade = document.getElementById('novoIndicadorUnidade').value.trim();
    const ideal = document.getElementById('novoIndicadorIdeal').value.trim() || '-';
    const icon = document.getElementById('novoIndicadorIcon').value.trim() || 'dY"S';
    const fonte = document.getElementById('novoIndicadorFonte').value;
    const alertaVital = categoria === 'vitais' ? buildVitalAlertFromForm() : null;

    if (editId) {
      // Editar existente
      const id = parseInt(editId);
      if (categoria === 'vitais') {
        const v = mockData.sinaisVitais.find(v => v.id === id);
        if (v) {
          v.unidade = unidade;
          v.ideal = toIdealObjectFromInput(ideal);
          v.icon = icon;
          v.fonte = fonte;
          v.alerta = alertaVital;
        }
        renderMeusIndicadoresVitais();
        renderValoresIdeaisVitais();
        renderSaude();
      } else {
        const c = mockData.composicaoCorporal.find(c => c.id === id);
        if (c) { c.unidade = unidade; c.ideal = toIdealObjectFromInput(ideal); c.icon = icon; c.fonte = fonte; }
        renderMeusIndicadoresCorpo();
        renderValoresIdeaisCorpo();
        renderComposicao();
      }
    } else {
      // Novo
      if (categoria === 'vitais') {
        if (mockData.sinaisVitais.find(v => v.tipo.toLowerCase() === nome.toLowerCase())) { showFeedbackModal('Este indicador já existe.', 'warning'); return; }
        const newId = Math.max(...mockData.sinaisVitais.map(v => v.id), 0) + 1;
        mockData.sinaisVitais.push({
          id: newId, tipo: nome, valor: '-', unidade, ideal: toIdealObjectFromInput(ideal), fonte, tempo: 'Nunca medido',
          categoria: 'saude', status: 'normal', dataHora: '', icon, variacao: 'normal', tendencia: 'up',
          percentualVariacao: 0, historico: [], alerta: alertaVital
        });
        mockData.configSinaisVitais[nome] = { exibirSaude: true, exibirDashboard: false };
        renderMeusIndicadoresVitais();
        renderSaude();
      } else {
        if (mockData.composicaoCorporal.find(c => c.tipo.toLowerCase() === nome.toLowerCase())) { showFeedbackModal('Este indicador já existe.', 'warning'); return; }
        const newId = Math.max(...mockData.composicaoCorporal.map(c => c.id), 0) + 1;
        mockData.composicaoCorporal.push({ id: newId, tipo: nome, valor: '-', unidade, ideal: toIdealObjectFromInput(ideal), dataHora: '', variacao: 'normal', icon, fonte, historico: [] });
        mockData.configComposicao[nome] = { exibirCorpo: true, exibirDashboard: false };
        renderMeusIndicadoresCorpo();
        renderComposicao();
      }
    }
    closeNI();
  });
});

// ===== VALORES IDEAIS =====

// (unificado em openValoresIdeaisModal acima)

// ===== DISPOSITIVOS =====

function renderDispositivos() {
  const el = document.getElementById('dispositivosContent');
  if (!el) return;

  if (mockData.dispositivos.length === 0) {
    el.innerHTML = '<div class="card-info" style="padding: 8px; color: #999;">Nenhum dispositivo cadastrado.</div>';
    return;
  }

  const trashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  const getDispositivoIcon = (tipo) => {
    if (/relógio|pulseira|watch/i.test(tipo)) return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><polyline points="12 9 12 12 13.5 13.5"/><path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83"/></svg>`;
    if (/balança/i.test(tipo)) return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><path d="M5.5 20h13l-2-12H7.5z"/></svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
  };

  el.innerHTML = mockData.dispositivos.map(d => `
    <div class="config-item" style="margin-bottom: 8px;">
      <div class="config-item-content">
        <div class="config-icon">${getDispositivoIcon(d.tipo)}</div>
        <div class="config-text">
          <div class="config-title">${d.nome}</div>
          <div class="config-subtitle">${d.tipo} ??? ${d.sinaisColetados.length} sinais</div>
          <div class="config-subtitle" style="font-size: 10px; margin-top: 2px; color: #bbb;">${d.sinaisColetados.join(', ')}</div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
        <button class="toggle ${d.conectado ? 'active' : ''}" onclick="toggleDispositivo(${d.id}, this)"></button>
        <button onclick="removeDispositivo(${d.id})" style="background:none;border:none;cursor:pointer;color:#94a3b8;display:flex;align-items:center;padding:4px;">${trashSvg}</button>
      </div>
    </div>
  `).join('');
}

function toggleDispositivo(id, btn) {
  const d = mockData.dispositivos.find(d => d.id === id);
  if (d) { d.conectado = !d.conectado; btn.classList.toggle('active'); }
}

function removeDispositivo(id) {
  mockData.dispositivos = mockData.dispositivos.filter(d => d.id !== id);
  renderDispositivos();
}

function openAddDispositivoModal() {
  document.getElementById('dispositivoNomeInput').value = '';
  document.getElementById('dispositivoTipoSelect').value = '';
  document.getElementById('dispositivoSinaisContainer').innerHTML = '';
  document.getElementById('addDispositivoModal').classList.add('active');
}

function onTipoDispositivoChange() {
  const tipo = document.getElementById('dispositivoTipoSelect').value;
  const catalogo = mockData.catalogoDispositivos.find(c => c.tipo === tipo);
  const container = document.getElementById('dispositivoSinaisContainer');

  if (!catalogo) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="form-label" style="margin-bottom: 8px;">Sinais coletados por este dispositivo:</div>
    <div class="form-checkbox-group">
      ${catalogo.sinaisDisponiveis.map(s => `
        <div class="form-checkbox-item">
          <input type="checkbox" class="form-checkbox dispositivo-sinal-check" value="${s}" id="dsinal_${s.replace(/\s/g,'_')}" checked>
          <label for="dsinal_${s.replace(/\s/g,'_')}">${s}</label>
        </div>
      `).join('')}
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('addDispositivoModal');
  const cancelBtn = document.getElementById('cancelDispositivoBtn');
  const form = document.getElementById('addDispositivoForm');

  const closeModal = () => { modal.classList.remove('active'); form.reset(); document.getElementById('dispositivoSinaisContainer').innerHTML = ''; };

  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('dispositivoNomeInput').value.trim();
    const tipo = document.getElementById('dispositivoTipoSelect').value;
    if (!nome || !tipo) { showFeedbackModal('Preencha nome e tipo.', 'warning'); return; }

    const sinais = Array.from(document.querySelectorAll('.dispositivo-sinal-check:checked')).map(c => c.value);
    const catalogo = mockData.catalogoDispositivos.find(c => c.tipo === tipo);

    const newId = Math.max(...mockData.dispositivos.map(d => d.id), 0) + 1;
    mockData.dispositivos.push({
      id: newId,
      nome,
      tipo,
      icon: catalogo ? catalogo.icon : 'dY"?',
      conectado: true,
      sinaisColetados: sinais
    });

    closeModal();
    renderDispositivos();
  });
});

// ===== CONFIGURAÇÃO DE SINAIS VITAIS =====

function openVitaisConfigModal() {
  renderVitaisConfig();
  document.getElementById('vitaisConfigModal').classList.add('active');
}

function getVitalConfigDefaults() {
  return { exibirSaude: true, exibirDashboard: false };
}

function allVitaisColumnOn(campo) {
  return mockData.sinaisVitais.every((v) => {
    const c = mockData.configSinaisVitais[v.tipo] || getVitalConfigDefaults();
    return !!c[campo];
  });
}

function renderVitaisConfig() {
  const def = getVitalConfigDefaults();
  const allSaude = allVitaisColumnOn('exibirSaude');
  const allDash = allVitaisColumnOn('exibirDashboard');
  const todosRow = `
      <div class="vital-config-row vital-config-row--todos">
        <span class="vital-config-icon" aria-hidden="true">?Sz</span>
        <span class="vital-config-name vital-config-name--todos">Todos</span>
        <div class="vital-config-toggles">
          <div class="toggle-col">
            <span class="toggle-col-label">Saúde</span>
            <button type="button" class="toggle ${allSaude ? 'active' : ''}"
              aria-pressed="${allSaude}"
              onclick="toggleAllVitaisConfig('exibirSaude')"></button>
          </div>
          <div class="toggle-col">
            <span class="toggle-col-label">Dashboard</span>
            <button type="button" class="toggle ${allDash ? 'active' : ''}"
              aria-pressed="${allDash}"
              onclick="toggleAllVitaisConfig('exibirDashboard')"></button>
          </div>
        </div>
      </div>`;

  const html =
    todosRow +
    mockData.sinaisVitais
      .map((v) => {
        const cfg = mockData.configSinaisVitais[v.tipo] || def;
        return `
      <div class="vital-config-row">
        <span class="vital-config-icon">${v.icon}</span>
        <span class="vital-config-name">${v.tipo}</span>
        <div class="vital-config-toggles">
          <div class="toggle-col">
            <span class="toggle-col-label">Saúde</span>
            <button type="button" class="toggle ${cfg.exibirSaude ? 'active' : ''}"
              onclick="toggleVitalConfig('${v.tipo}', 'exibirSaude', this)"></button>
          </div>
          <div class="toggle-col">
            <span class="toggle-col-label">Dashboard</span>
            <button type="button" class="toggle ${cfg.exibirDashboard ? 'active' : ''}"
              onclick="toggleVitalConfig('${v.tipo}', 'exibirDashboard', this)"></button>
          </div>
        </div>
      </div>
    `;
      })
      .join('');
  document.getElementById('vitaisConfigContent').innerHTML = html;
}

/** Se todos estão ligados nessa coluna, desliga todos; caso contrário liga todos. */
function toggleAllVitaisConfig(campo) {
  const turnOn = !allVitaisColumnOn(campo);
  mockData.sinaisVitais.forEach((v) => {
    if (!mockData.configSinaisVitais[v.tipo]) {
      mockData.configSinaisVitais[v.tipo] = { ...getVitalConfigDefaults() };
    }
    mockData.configSinaisVitais[v.tipo][campo] = turnOn;
  });
  renderVitaisConfig();
  renderSaude();
  renderHome();
}

function toggleVitalConfig(tipo, campo, btn) {
  if (!mockData.configSinaisVitais[tipo]) {
    mockData.configSinaisVitais[tipo] = { ...getVitalConfigDefaults() };
  }
  mockData.configSinaisVitais[tipo][campo] = !mockData.configSinaisVitais[tipo][campo];
  renderVitaisConfig();
  renderSaude();
  renderHome();
}

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('closeVitaisConfigModal');
  const modal = document.getElementById('vitaisConfigModal');
  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
});


function setPressureMedReminder(btn) {
  const v = btn.getAttribute('data-pmed') || 'nenhum';
  const hid = document.getElementById('pressureMedStatusInput');
  if (hid) hid.value = v;
  document.querySelectorAll('.pressure-med-btn').forEach((b) => {
    b.classList.toggle('selected', b.getAttribute('data-pmed') === v);
  });
}

function resetPressureMedReminderUI() {
  const hid = document.getElementById('pressureMedStatusInput');
  if (hid) hid.value = 'nenhum';
  document.querySelectorAll('.pressure-med-btn').forEach((b) => {
    b.classList.toggle('selected', b.getAttribute('data-pmed') === 'nenhum');
  });
}

let lastPressureValue = null;
let lastManualMeasurementMeta = { isSporadic: true, dateISO: null, timeHHMM: null };
let currentMoodValue = 0;
let capturedPressureFromSource = null;

/** Simula leitura de PA conforme a fonte (mock para protótipo). */
function simulatePressureCaptureForFonte(fonte) {
  const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const profiles = {
    Pulseira: () => ({
      sistolica: r(108, 126),
      diastolica: r(68, 84),
      linha: 'Sensor da pulseira – leitura estável'
    }),
    'Google Fit': () => ({
      sistolica: r(114, 132),
      diastolica: r(72, 88),
      linha: 'Asltima sincronização do Google Fit'
    }),
    'Apple Health': () => ({
      sistolica: r(112, 128),
      diastolica: r(70, 86),
      linha: 'Registro importado do Apple Health'
    })
  };
  const gen = profiles[fonte] || profiles.Pulseira;
  return gen();
}

function clearVitalCaptureResultEl() {
  const el = document.getElementById('pressureCaptureResult');
  if (el) {
    el.style.display = 'none';
    el.innerHTML = '';
  }
}

function clearVitalCaptureState() {
  capturedPressureFromSource = null;
  clearVitalCaptureResultEl();
}

function resetPulseiraStepButtons() {
  document.querySelectorAll('.pulseira-step-btn').forEach((btn) => {
    btn.classList.remove('selected');
    btn.setAttribute('aria-pressed', 'false');
  });
}

function togglePulseiraStep(btn) {
  const on = btn.classList.toggle('selected');
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function completePulseiraGuide() {
  document.querySelectorAll('.pulseira-step-btn').forEach((btn) => {
    btn.classList.add('selected');
    btn.setAttribute('aria-pressed', 'true');
  });
}

function isPulseiraChecklistComplete() {
  const steps = document.querySelectorAll('.pulseira-step-btn');
  if (steps.length === 0) return true;
  return [...steps].every((s) => s.classList.contains('selected'));
}

function setAutoCaptureHint(fonte) {
  const hint = document.getElementById('captureHintText');
  if (!hint) return;
  const copy = {
    Pulseira: 'Depois do preparo, sincronize a leitura enviada pela pulseira.',
    'Google Fit': 'Simula buscar a ·ltima medição sincronizada no Google Fit.',
    'Apple Health': 'Simula importar o Último registro do Apple Health.'
  };
  hint.textContent = copy[fonte] || copy.Pulseira;
}

function formatDuracaoHMS(totalSec) {
  const s = Math.max(0, Math.floor(totalSec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Tempo decorrido desde o inA-cio da sessão (eixo do gráfico): mm:ss ou h:mm:ss */
function formatElapsedMMSS(offsetSec) {
  const s = Math.max(0, Math.floor(offsetSec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function openExercicioDetalheFromRow(index) {
  const h = currentVitalHistoricoView[index];
  if (!h || h.contextoColeta !== 'exercicio' || !h.exercicioSessao) return;
  openExercicioDetalheModal(h.exercicioSessao);
}

function openExercicioDetalheModal(sessao) {
  if (!sessao) return;
  const nomeEl = document.getElementById('exercicioDetalheNome');
  const durEl = document.getElementById('exercicioDetalheDuracao');
  const periodoEl = document.getElementById('exercicioDetalhePeriodo');
  const gridEl = document.getElementById('exercicioDetalheMetricas');
  const axisEl = document.getElementById('exercicioDetalheAxis');
  if (!nomeEl || !durEl || !gridEl || !axisEl) return;

  nomeEl.textContent = sessao.nomeAtividade || 'Exercício';
  durEl.textContent = formatDuracaoHMS(sessao.duracaoSegundos);
  if (periodoEl) {
    const ini = sessao.inicioISO ? formatDateTimeForUI(sessao.inicioISO) : '';
    const fim = sessao.fimISO ? formatDateTimeForUI(sessao.fimISO) : '';
    periodoEl.textContent = ini && fim ? `InA-cio ${ini} · Fim ${fim}` : '';
  }

  const cal = sessao.caloriasKcal != null ? `${sessao.caloriasKcal} kcal` : '–';
  gridEl.innerHTML = `
    <div class="exercise-metric-cell">
      <span class="exercise-metric-label">Duração total</span>
      <span class="exercise-metric-value">${formatDuracaoHMS(sessao.duracaoSegundos)}</span>
    </div>
    <div class="exercise-metric-cell">
      <span class="exercise-metric-label">Calorias (ativas)</span>
      <span class="exercise-metric-value">${cal}</span>
    </div>
    <div class="exercise-metric-cell">
      <span class="exercise-metric-label">Freq. card. mAcdia</span>
      <span class="exercise-metric-value">${sessao.freqMedia != null ? `${sessao.freqMedia} bpm` : '–'}</span>
    </div>
    <div class="exercise-metric-cell">
      <span class="exercise-metric-label">Freq. card. máxima</span>
      <span class="exercise-metric-value">${sessao.freqMax != null ? `${sessao.freqMax} bpm` : '–'}</span>
    </div>
  `;

  const dur = sessao.duracaoSegundos || 1;
  const ticks = [0, dur / 4, dur / 2, (3 * dur) / 4, dur];
  axisEl.innerHTML = `${ticks
    .map((t) => `<span>${formatElapsedMMSS(t)}</span>`)
    .join('')}<span class="exercise-axis-flag" title="Fim">dY??</span>`;

  window._lastExercicioSessaoCanvas = sessao;
  document.getElementById('exercicioDetalheModal').classList.add('active');
  requestAnimationFrame(() => renderExercicioHrCanvas(sessao));
  setTimeout(() => renderExercicioHrCanvas(sessao), 200);
}

function closeExercicioDetalheModal() {
  const m = document.getElementById('exercicioDetalheModal');
  if (m) m.classList.remove('active');
}

/** Rótulos de contexto (ExercA-cio / Sono / ???) agregados num bucket horário. */
function batimentoBucketContextBadgeHtml(bucket) {
  if (!bucket || !bucket.readings || bucket.readings.length === 0) return '';
  const set = new Set();
  bucket.readings.forEach((r) => {
    const lab = typeof getLabelContextoColetaHistorico === 'function' ? getLabelContextoColetaHistorico(r) : '';
    if (lab) set.add(lab);
  });
  const labs = Array.from(set);
  if (labs.length === 0) return '';
  const text = labs.length === 1 ? labs[0] : labs.join(' · ');
  return `<span class="vital-context-badge">${text}</span>`;
}

function openSonoDetalheModal(sessao) {
  if (!sessao) return;
  const titulo = document.getElementById('sonoDetalheTitulo');
  const periodo = document.getElementById('sonoDetalhePeriodo');
  const grid = document.getElementById('sonoDetalheMetricas');
  if (!titulo || !periodo || !grid) return;

  titulo.textContent = 'Sono';
  const ini = sessao.inicioISO ? formatDateTimeForUI(sessao.inicioISO) : '';
  const fim = sessao.fimISO ? formatDateTimeForUI(sessao.fimISO) : '';
  periodo.textContent = ini && fim ? `InA-cio ${ini} · Fim ${fim}` : '';

  const dm = sessao.duracaoMinutos;
  const durLabel =
    dm != null && Number.isFinite(dm) ? `${Math.floor(dm / 60)} h ${dm % 60} min` : '–';
  const cell = (label, val) =>
    `<div class="sono-metric-cell"><span class="sono-metric-label">${label}</span><span class="sono-metric-value">${val}</span></div>`;

  // FC mín/máx durante o sono: busca leituras do dia com contextoColeta === 'sono'
  let fcSonoMin = null;
  let fcSonoMax = null;
  if (currentVitalDetail && Array.isArray(currentVitalDetail.historico) && sessao.inicioISO) {
    const dayIsoSono = sessao.inicioISO.slice(0, 10);
    const sonoLeituras = currentVitalDetail.historico.filter(
      (h) => historicoEntryDayISO(h) === dayIsoSono && h.contextoColeta === 'sono'
    );
    const sonoVals = sonoLeituras.map(parseBatimentoHistoricoValor).filter(Number.isFinite);
    if (sonoVals.length > 0) {
      fcSonoMin = Math.round(Math.min(...sonoVals));
      fcSonoMax = Math.round(Math.max(...sonoVals));
    }
  }
  const fcSonoLabel = fcSonoMin != null ? `${fcSonoMin} – ${fcSonoMax} bpm` : '–';

  grid.innerHTML = [
    cell('Duração registada', durLabel),
    cell('Pontuação', sessao.score != null ? String(sessao.score) : '–'),
    cell('FC mín – máx', fcSonoLabel),
    cell('Leve', sessao.leveMin != null ? `${sessao.leveMin} min` : '–'),
    cell('REM', sessao.remMin != null ? `${sessao.remMin} min` : '–'),
    cell('Profundo', sessao.profundoMin != null ? `${sessao.profundoMin} min` : '–'),
    cell('Acordado', sessao.acordadoMin != null ? `${sessao.acordadoMin} min` : '–')
  ].join('');

  document.getElementById('sonoDetalheModal').classList.add('active');
}

function closeSonoDetalheModal() {
  const m = document.getElementById('sonoDetalheModal');
  if (m) m.classList.remove('active');
}

/** Igual ao subtA-tulo do modal por minuto: faixa da hora em uma linha. */
function formatBatimentoBpmRangeLine(minV, maxV) {
  if (minV == null || maxV == null || !Number.isFinite(minV) || !Number.isFinite(maxV)) return '–';
  return `${Math.round(minV)} – ${Math.round(maxV)} bpm`;
}

/** Igual ao subtA-tulo do modal por minuto: "08:00 – 08:59". */
function formatBatimentoHourIntervalLabel(hour) {
  const h = Math.floor(Number(hour));
  const s = String(Number.isFinite(h) && h >= 0 && h <= 23 ? h : 0).padStart(2, '0');
  return `${s}:00 – ${s}:59`;
}

const BATIMENTO_HISTORICO_PREVIEW = 3;

let batimentoMinutoReadingsCache = [];
let batimentoMinutoCurrentHour = null;

/** Mesma hierarquia visual da lista ??opor hora??? (medida em cima, horário em baixo, chevron). */
function buildBatimentoMinutoHistoricoRowHtml(r) {
  const v = parseBatimentoHistoricoValor(r);
  const dateIso = historicoEntryDayISO(r);
  const dateTxt = dateIso ? formatDateForUI(dateIso) : '–';
  const hora = r.hora ? String(r.hora).slice(0, 5) : '–';
  const measureLine = Number.isFinite(v) ? `${Math.round(v)} bpm` : '–';
  const ctxLabel = typeof getLabelContextoColetaHistorico === 'function' ? getLabelContextoColetaHistorico(r) : '';
  const badgeHtml = ctxLabel ? `<span class="vital-context-badge">${ctxLabel}</span>` : '';
  const bg = typeof batimentoHistoricoRowBgClassForEntry === 'function' ? batimentoHistoricoRowBgClassForEntry(r) : '';
  let rowClass = 'vital-list-item vital-list-item--hour-bucket vital-list-item--minuto-historico';
  if (bg) rowClass += ` ${bg}`;
  const trailHtml = '<span class="vital-list-chevron" aria-hidden="true">&#8250;</span>';
  return htmlVitalBatimentoListRow({
    rowClass,
    clickAttr: '',
    badgeHtml,
    hourDetail: {
      measureLine,
      timeLine: `${dateTxt} · ${hora}`,
      trailHtml
    }
  });
}

function renderBatimentoMinutoListaPreview() {
  const listaEl = document.getElementById('batimentoMinutoLista');
  const readings = batimentoMinutoReadingsCache;
  if (!listaEl) return;

  if (readings.length === 0) {
    listaEl.innerHTML = '<div class="empty-state"><div class="empty-text">Nenhuma leitura nesta hora</div></div>';
    return;
  }

  const n = readings.length;
  const p = BATIMENTO_HISTORICO_PREVIEW;
  let html = '';
  if (n <= p) {
    html = readings
      .slice()
      .reverse()
      .map(buildBatimentoMinutoHistoricoRowHtml)
      .join('');
  } else {
    const visible = readings.slice(-p).reverse();
    const hidden = readings.slice(0, n - p);
    html =
      visible.map(buildBatimentoMinutoHistoricoRowHtml).join('') +
      `<div id="batimentoMinutoExtra" style="display:none;">${hidden.map(buildBatimentoMinutoHistoricoRowHtml).join('')}</div>` +
      `<button type="button" class="vital-ver-mais-btn" onclick="` +
      `var el=document.getElementById('batimentoMinutoExtra');` +
      `var open=el.style.display!=='none';` +
      `el.style.display=open?'none':'block';` +
      `this.textContent=open?'Ver mais (${hidden.length})':'Ver menos';` +
      `">Ver mais (${hidden.length})</button>`;
  }
  listaEl.innerHTML = html;
}

// ===== MODAL DETALHE POR MINUTO (Batimento Cardíaco) =====

function openBatimentoMinutoDetalhe(hour, contexto) {
  if (!currentVitalDetail || !vitalBatimentoChartSelection || vitalBatimentoChartSelection.kind !== 'day') return;
  const dayIso = vitalBatimentoChartSelection.iso;
  const inMode = filterBatimentoByContext(currentVitalDetail.historico);
  const buckets = aggregateHeartRateByHourForDay(inMode, dayIso);
  const bucket = buckets[hour];
  if (!bucket) return;
  batimentoMinutoCurrentHour = hour;

  const labelHora = formatBatimentoHourIntervalLabel(hour);
  const modal = document.getElementById('batimentoMinutoModal');
  if (!modal) return;

  document.getElementById('batimentoMinutoTitulo').textContent = 'Detalhado por minuto';
  document.getElementById('batimentoMinutoSubtitulo').textContent = formatDateForUI(dayIso) + ' · ' + labelHora;

  // EstatA-sticas da hora
  const hasRange = bucket.min != null && bucket.max != null;
  document.getElementById('batimentoMinutoRange').textContent = hasRange
    ? formatBatimentoBpmRangeLine(bucket.min, bucket.max)
    : '–';

  // Badge de contexto
  const ctxMap = { exercicio: 'Exercício', sono: 'Sono', repouso: 'Repouso' };
  const ctxEl = document.getElementById('batimentoMinutoContexto');
  if (contexto && ctxMap[contexto]) {
    ctxEl.textContent = ctxMap[contexto];
    ctxEl.style.display = 'inline-block';
  } else {
    ctxEl.style.display = 'none';
  }

  // Lista de leituras individuais da hora
  const readings = (bucket.readings || []).slice().sort((a, b) => {
    const ta = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(a) : 0;
    const tb = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(b) : 0;
    return ta - tb;
  });

  batimentoMinutoReadingsCache = readings;
  renderBatimentoMinutoListaPreview();

  // Gráfico de barras por leitura
  renderBatimentoMinutoCanvas(readings);

  // Sub-modal exercício/sono se aplicável
  const ex = bucket.readings && bucket.readings.find((r) => r.contextoColeta === 'exercicio' && r.exercicioSessao);
  const sn = bucket.readings && bucket.readings.find((r) => r.contextoColeta === 'sono' && r.sonoSessao);
  const subBtn = document.getElementById('batimentoMinutoSubBtn');
  if (ex) {
    subBtn.style.display = 'block';
    subBtn.textContent = 'Ver detalhe do exercício';
    subBtn.onclick = () => { closeBatimentoMinutoModal(); openExercicioDetalheModal(ex.exercicioSessao); };
  } else if (sn) {
    subBtn.style.display = 'block';
    subBtn.textContent = 'Ver detalhe do sono';
    subBtn.onclick = () => { closeBatimentoMinutoModal(); openSonoDetalheModal(sn.sonoSessao); };
  } else {
    subBtn.style.display = 'none';
  }

  modal.classList.add('active');
  requestAnimationFrame(() => renderBatimentoMinutoCanvas(readings));
}

function closeBatimentoMinutoModal() {
  const m = document.getElementById('batimentoMinutoModal');
  if (m) m.classList.remove('active');
  batimentoMinutoCurrentHour = null;
}

function renderBatimentoMinutoCanvas(readings) {
  const canvas = document.getElementById('batimentoMinutoCanvas');
  if (!canvas) return;
  canvas._readings = readings;
  const vals = readings.map(parseBatimentoHistoricoValor).filter(Number.isFinite);
  if (vals.length === 0) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(260, canvas.parentElement ? canvas.parentElement.clientWidth : 300);
  const h = 160;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const band = getBatimentoChartIdealBand();
  const { yLow, yHigh } = getBatimentoPlotYBoundsFromDataRange(Math.min(...vals), Math.max(...vals));
  const yRange = yHigh - yLow || 1;
  const padL = 30, padR = 6, padT = 8, padB = 20;
  const gw = w - padL - padR;
  const gh = h - padT - padB;
  const toY = (v) => padT + ((yHigh - v) / yRange) * gh;

  // Fundo ideal
  drawBatimentoChartIdealBackground(ctx, padL, gw, toY, yLow, yHigh, band.min, band.max);

  // Eixo Y
  ctx.fillStyle = '#8e8e8e'; ctx.font = '8px sans-serif'; ctx.textAlign = 'right';
  [yHigh, yLow].forEach(yv => {
    ctx.fillText(String(Math.round(yv)), padL - 4, toY(yv) + 3);
  });

  // Barras
  const n = vals.length;
  const slot = gw / Math.max(n, 1);
  const barW = Math.min(20, Math.max(4, slot * 0.65));
  const barR = Math.min(5, barW / 2 - 0.5);
  ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, gw, gh); ctx.clip();
  vals.forEach((v, i) => {
    const cx = padL + slot * i + slot / 2;
    const x0 = cx - barW / 2;
    const { lo, hi } = expandBatimentoBarBpmRange(v, v, yLow, yHigh);
    drawBatimentoIdealSegmentedRangeBar(ctx, x0, barW, lo, hi, band.min, band.max, toY, barR, false);
  });
  ctx.restore();

  // Labels eixo X (hora:minuto)
  ctx.fillStyle = '#666'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  readings.forEach((r, i) => {
    if (i % labelEvery !== 0 && i !== n - 1) return;
    const cx = padL + slot * i + slot / 2;
    const label = r.hora ? String(r.hora).slice(0, 5) : '';
    ctx.fillText(label, cx, h - 4);
  });
}

/** Lista do período: toque no dia ?+' mesma vista que tocar na coluna do gráfico. */
function selectBatimentoDayFromList(dayIso) {
  if (!dayIso || typeof dayIso !== 'string') return;
  vitalBatimentoChartSelection = { kind: 'day', iso: dayIso };
  updateVitalBatimentoModalView();
}

function filterHistoricoByInclusiveDate(historico, startISO, endISO) {
  if (!Array.isArray(historico) || !startISO || !endISO) return [];
  return historico.filter((h) => {
    const d = historicoEntryDayISO(h);
    return d && d >= startISO && d <= endISO;
  });
}

/** Dia civil YYYY-MM-DD a partir de h.data / h.dataISO (ISO, DD/MM/AAAA, ou Date). */
function historicoEntryDayISO(h) {
  if (!h) return '';
  if (h.data instanceof Date && !Number.isNaN(h.data.getTime())) return dateToLocalISODate(h.data);
  const tryOne = (raw0) => {
    if (raw0 == null || raw0 === '') return '';
    const raw = String(raw0).trim();
    const isoPrefix = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
    if (isoPrefix) return isoPrefix[1];
    if (typeof toISODate === 'function') {
      const iso = toISODate(raw);
      if (iso) return iso;
    }
    return '';
  };
  return tryOne(h.dataISO) || tryOne(h.data);
}

function parseBatimentoHistoricoValor(h) {
  if (!h || h.valor == null) return NaN;
  if (typeof h.valor === 'number') return Number.isFinite(h.valor) ? h.valor : NaN;
  const s = String(h.valor).replace(/\s*bpm\s*$/i, '').replace(',', '.').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function aggregateHeartRateByDay(historico) {
  const map = new Map();
  historico.forEach((h) => {
    const v = parseBatimentoHistoricoValor(h);
    if (!Number.isFinite(v)) return;
    const day = historicoEntryDayISO(h);
    if (!day) return;
    if (!map.has(day)) map.set(day, { min: v, max: v, readings: [h] });
    else {
      const o = map.get(day);
      o.min = Math.min(o.min, v);
      o.max = Math.max(o.max, v);
      o.readings.push(h);
    }
  });
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

/** Segunda-feira da semana (ISO) para agregar sAcries longas. */
function getWeekStartMondayISO(isoDate) {
  const d = localNoonFromISODate(isoDate);
  const dow = d.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + delta);
  return dateToLocalISODate(d);
}

function aggregateHeartRateByWeek(historico) {
  const map = new Map();
  historico.forEach((h) => {
    const v = parseBatimentoHistoricoValor(h);
    if (!Number.isFinite(v)) return;
    const day = historicoEntryDayISO(h);
    if (!day) return;
    const wk = getWeekStartMondayISO(day);
    if (!map.has(wk)) map.set(wk, { min: v, max: v });
    else {
      const o = map.get(wk);
      o.min = Math.min(o.min, v);
      o.max = Math.max(o.max, v);
    }
  });
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function mergeBiweeklyRows(weekRows) {
  const out = [];
  for (let i = 0; i < weekRows.length; i += 2) {
    const cur = weekRows[i];
    const next = weekRows[i + 1];
    if (!next) {
      out.push(cur);
      continue;
    }
    out.push([
      cur[0],
      {
        min: Math.min(cur[1].min, next[1].min),
        max: Math.max(cur[1].max, next[1].max)
      }
    ]);
  }
  return out;
}

function countInclusiveDaysBetween(startISO, endISO) {
  if (!startISO || !endISO) return 0;
  const a = localNoonFromISODate(startISO).getTime();
  const b = localNoonFromISODate(endISO).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function enumerateInclusiveDays(startISO, endISO) {
  const out = [];
  const cur = localNoonFromISODate(startISO);
  const end = localNoonFromISODate(endISO);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return out;
  while (cur.getTime() <= end.getTime()) {
    out.push(dateToLocalISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Uma entrada por dia no intervalo [start,end]; dias sem leitura ficam com min/max nulos. */
function buildDailyRowsForRange(historico, startISO, endISO) {
  const byDay = new Map(aggregateHeartRateByDay(historico));
  return enumerateInclusiveDays(startISO, endISO).map((iso) => {
    const o = byDay.get(iso);
    return o ? [iso, o] : [iso, { min: null, max: null }];
  });
}

/** Cor de fundo: Sono / ExercA-cio / Repouso / outras condições (histórico detalhado por medição). */
function batimentoHistoricoRowBgClassForEntry(h) {
  if (!h || !currentVitalDetail || currentVitalDetail.tipo !== 'Batimento Cardíaco') return '';
  if (h.contextoColeta === 'sono' && h.sonoSessao) return 'vital-list-item--bc-sono';
  if (h.contextoColeta === 'exercicio' && h.exercicioSessao) return 'vital-list-item--bc-exercicio';
  if (h.contextoColeta === 'repouso') return 'vital-list-item--bc-repouso';
  return 'vital-list-item--bc-outros';
}

/** Lista por dia (período): Baixo / Normal / Alto conforme pico do dia vs faixa ideal – alinhado ao gráfico de barras. */
function batimentoHistoricoDailyRowBgClass(readings) {
  if (!Array.isArray(readings) || readings.length === 0) return '';
  let peak = null;
  readings.forEach((r) => {
    const v = parseBatimentoHistoricoValor(r);
    if (Number.isFinite(v)) peak = peak == null ? v : Math.max(peak, v);
  });
  return batimentoListaBgClassFromChartLevel(batimentoIdealLevelFromPeakBpm(peak != null ? peak : 72));
}

/**
 * Contexto da hora (lista + gráfico horário): Sono ?+' ExercA-cio ?+' Repouso ?+' demais.
 * Não confundir com Baixo/Normal/Alto do histórico por período.
 */
function batimentoHourlyBucketContextGroup(bucket) {
  if (!bucket || !Array.isArray(bucket.readings) || bucket.readings.length === 0) return 'outros';
  let hasSono = false;
  let hasEx = false;
  let hasRep = false;
  bucket.readings.forEach((r) => {
    if (r.contextoColeta === 'sono' && r.sonoSessao) hasSono = true;
    else if (r.contextoColeta === 'exercicio' && r.exercicioSessao) hasEx = true;
    else if (r.contextoColeta === 'repouso') hasRep = true;
  });
  if (hasSono) return 'sono';
  if (hasEx) return 'exercicio';
  if (hasRep) return 'repouso';
  return 'outros';
}

function batimentoHourlyBucketRowBgClass(bucket) {
  const g = batimentoHourlyBucketContextGroup(bucket);
  switch (g) {
    case 'sono':
      return 'vital-list-item--bc-sono';
    case 'exercicio':
      return 'vital-list-item--bc-exercicio';
    case 'repouso':
      return 'vital-list-item--bc-repouso';
    default:
      return bucket && bucket.readings && bucket.readings.length > 0 ? 'vital-list-item--bc-outros' : '';
  }
}

/**
 * Uma linha por dia civil: mín. e máx. do dia (alinhado ·s barras do gráfico).
 */
function buildBatimentoHistoricoDailyRows(entries) {
  const map = new Map();
  entries.forEach((h, rawIdx) => {
    const v = parseBatimentoHistoricoValor(h);
    if (!Number.isFinite(v)) return;
    const day = historicoEntryDayISO(h);
    if (!day) return;
    let g = map.get(day);
    if (!g) {
      g = {
        readings: [],
        min: v,
        max: v,
        exercicioIdx: null,
        lastTime: '',
        lastMs: -Infinity
      };
      map.set(day, g);
    }
    g.readings.push(h);
    g.min = Math.min(g.min, v);
    g.max = Math.max(g.max, v);
    const ms = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(h) : null;
    if (ms != null && ms >= g.lastMs) {
      g.lastMs = ms;
      g.lastTime = h && h.hora ? String(h.hora).slice(0, 5) : '';
    }
    if (h.contextoColeta === 'exercicio' && h.exercicioSessao && g.exercicioIdx == null) {
      g.exercicioIdx = rawIdx;
    }
  });

  const ctxLabels = (readings) => {
    const set = new Set();
    readings.forEach((r) => {
      const lab = typeof getLabelContextoColetaHistorico === 'function' ? getLabelContextoColetaHistorico(r) : '';
      if (lab) set.add(lab);
    });
    return Array.from(set);
  };

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, g]) => {
      const labs = ctxLabels(g.readings);
      const ctxBadge = labs.length === 0 ? '' : (labs.length === 1 ? labs[0] : labs.join(' · '));
      return {
        day,
        min: g.min,
        max: g.max,
        lastTime: g.lastTime,
        rowBgClass: batimentoHistoricoDailyRowBgClass(g.readings),
        ctxBadge,
        exercicioIdx: g.exercicioIdx
      };
    });
}

function isoAddDays(iso, days) {
  const d = localNoonFromISODate(iso);
  d.setDate(d.getDate() + days);
  return dateToLocalISODate(d);
}

function sortHistoricoBatimentoDesc(arr) {
  if (!Array.isArray(arr)) return [];
  return [...arr].sort((a, b) => {
    const ma = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(a) : null;
    const mb = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(b) : null;
    if (ma == null && mb == null) return 0;
    if (ma == null) return 1;
    if (mb == null) return -1;
    return mb - ma;
  });
}

/** Ordem cronológica (mais antiga primeiro) – lista do dia ao tocar numa coluna. */
function sortHistoricoBatimentoAsc(arr) {
  if (!Array.isArray(arr)) return [];
  return [...arr].sort((a, b) => {
    const ma = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(a) : null;
    const mb = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(b) : null;
    if (ma == null && mb == null) return 0;
    if (ma == null) return 1;
    if (mb == null) return -1;
    return ma - mb;
  });
}

function historicoForBatimentoSelection(fullInPeriod) {
  const sel = vitalBatimentoChartSelection;
  if (!sel) return fullInPeriod;
  if (sel.kind === 'day') {
    return fullInPeriod.filter((h) => historicoEntryDayISO(h) === sel.iso);
  }
  return filterHistoricoByInclusiveDate(fullInPeriod, sel.start, sel.end);
}

function batimentoSelectionFromBar(mode, rowKey) {
  if (mode === 'day') return { kind: 'day', iso: rowKey };
  if (mode === 'week') return { kind: 'range', start: rowKey, end: isoAddDays(rowKey, 6) };
  return { kind: 'range', start: rowKey, end: isoAddDays(rowKey, 13) };
}

function batimentoSelectionEquals(a, b) {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'day') return a.iso === b.iso;
  return a.start === b.start && a.end === b.end;
}

/**
 * Atualiza gráficos do chrome de Batimento (período OU vista dia) + painAcis visA-veis.
 * Não altera lista – use depois de renderVitalDetailContent ou dentro de updateVitalBatimentoModalView.
 */
function renderBatimentoChromeCharts(filtrado, start, end) {
  if (vitalBatimentoChartSelection && vitalBatimentoChartSelection.kind === 'day') {
    syncBatimentoChromePanels();
  } else {
    /* Mostrar o painel de período ANTES do canvas: se o gráfico desenhar com o scope ainda
       oculto (voltando do detalhe do dia), getBoundingClientRect() dá largura 0 e o gráfico fica errado. */
    syncBatimentoChromePanels();
    renderBatimentoDailyBarChart(filtrado, { start, end, period: vitalBatimentoPeriod });
  }
}

// ?"––? Batimento: Min/Max card ?"––––––––––––––––––––––––––––––––––––––––––––––?
function renderBatimentoMinMaxCard(historico) {
  const el = document.getElementById('batMinMaxCard');
  if (!el) return;
  const vals = historico.map(parseBatimentoHistoricoValor).filter(Number.isFinite);
  if (!vals.length) { el.innerHTML = ''; return; }
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const band = typeof getBatimentoChartIdealBand === 'function' ? getBatimentoChartIdealBand() : { min: 60, max: 100 };
  const minOk = minVal >= band.min && minVal <= band.max;
  const maxOk = maxVal >= band.min && maxVal <= band.max;
  el.innerHTML = `
    <div class="bat-mm-row">
      <div class="bat-mm-col">
        <span class="bat-mm-label">MÍNIMO</span>
        <span class="bat-mm-value">${minVal}</span>
        <span class="bat-mm-unit">bpm</span>
      </div>
      <div class="bat-mm-divider"></div>
      <div class="bat-mm-col">
        <span class="bat-mm-label">MÁXIMO</span>
        <span class="bat-mm-value">${maxVal}</span>
        <span class="bat-mm-unit">bpm</span>
      </div>
    </div>`;
}

let batHourlySelectedHour = null;
let batHdSelectedSlot = null;
// ?"––? Batimento: Gráfico mín/máx por hora ?"–––––––––––––––––––––––––––––––––?
function renderBatimentoHourlyChart(historico) {
  const el = document.getElementById('batHourlyChart');
  if (!el) return;

  const band = typeof getBatimentoChartIdealBand === 'function' ? getBatimentoChartIdealBand() : { min: 60, max: 100 };

  // Agrupar por hora (0–23)
  const hours = Array.from({ length: 24 }, () => ({ min: null, max: null }));
  historico.forEach(h => {
    const v = parseBatimentoHistoricoValor(h);
    if (!Number.isFinite(v)) return;
    const horaStr = String(h.hora || '').slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(horaStr)) return;
    const hNum = parseInt(horaStr.slice(0, 2), 10);
    if (hNum < 0 || hNum > 23) return;
    const slot = hours[hNum];
    slot.min = slot.min === null ? v : Math.min(slot.min, v);
    slot.max = slot.max === null ? v : Math.max(slot.max, v);
  });

  const hasData = hours.some(s => s.min !== null);

  el.innerHTML = `
    <div class="bat-hourly-chart-header">Frequência por hora</div>
    ${hasData ? `<canvas id="batHourlyChartCanvas" class="bat-hourly-chart-canvas" height="160"></canvas>
    <div class="bat-hourly-chart-legend">
      <span class="bhc-leg"><span class="bhc-dot bhc-dot--normal"></span>Normal</span>
      <span class="bhc-leg"><span class="bhc-dot bhc-dot--high"></span>Alto</span>
      <span class="bhc-leg"><span class="bhc-dot bhc-dot--low"></span>Baixo</span>
      <span class="bhc-leg bhc-leg--ref"><span class="bhc-ref-line"></span>Ref. ${band.min}–${band.max}</span>
    </div>` : `<p class="bat-hourly-chart-empty">Sem dados para este dia</p>`}`;

  if (!hasData) {
    batHourlySelectedHour = null;
    return;
  }

  requestAnimationFrame(() => {
    const canvas = document.getElementById('batHourlyChartCanvas');
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 320;
    const H = 160;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    const padL = 28, padR = 6, padT = 10, padB = 22;
    const gw = W - padL - padR;
    const gh = H - padT - padB;
    const colW = gw / 24;
    const barW = 7;

    const allMins = hours.filter(s => s.min !== null).map(s => s.min);
    const allMaxs = hours.filter(s => s.max !== null).map(s => s.max);
    const dataLo = Math.min(...allMins, band.min) - 8;
    const dataHi = Math.max(...allMaxs, band.max) + 8;
    const yRange = dataHi - dataLo;
    const toY = (v) => padT + gh - ((v - dataLo) / yRange) * gh;

    // Função de desenho reutilizável – não reconstrói o DOM
    function drawBatHourly() {
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Reference band
      const refY1 = toY(band.max);
      const refY2 = toY(band.min);
      ctx.fillStyle = 'rgba(34,197,94,0.09)';
      ctx.fillRect(padL, refY1, gw, refY2 - refY1);
      ctx.strokeStyle = 'rgba(34,197,94,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(padL, refY1); ctx.lineTo(padL + gw, refY1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(padL, refY2); ctx.lineTo(padL + gw, refY2); ctx.stroke();
      ctx.setLineDash([]);

      // Grid lines
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      [0, 0.5, 1].forEach(t => {
        const y = padT + t * gh;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      });

      // Y labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = `500 9px Inter, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      [[dataLo + 4, 1], [dataHi - 4, 0]].forEach(([v, t]) => {
        ctx.fillText(Math.round(v), padL - 3, padT + t * gh);
      });

      // Barras – não selecionadas ficam apagadas quando há seleção ativa
      const hasSel = Number.isInteger(batHourlySelectedHour);
      hours.forEach((slot, i) => {
        if (slot.min === null) return;
        const x = padL + (i / 24) * gw + (colW - barW) / 2;
        const yTop = toY(slot.max);
        const yBot = toY(slot.min);
        const barH = Math.max(3, yBot - yTop);
        const isSelected = hasSel && batHourlySelectedHour === i;

        let color;
        if (slot.max > band.max) color = '#ef4444';
        else if (slot.min < band.min) color = '#f59e0b';
        else color = '#2563eb';

        ctx.globalAlpha = hasSel && !isSelected ? 0.2 : 1;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, yTop, barW, barH, Math.min(barW / 2, 3));
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Linha vertical sobre a barra selecionada (desenhada depois das barras)
      if (Number.isInteger(batHourlySelectedHour)) {
        const cx = padL + (batHourlySelectedHour + 0.5) * colW;
        ctx.save();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(cx, padT);
        ctx.lineTo(cx, H - padB);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // X labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = `500 9px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      [0, 6, 12, 18].forEach(h => {
        ctx.fillText(h + 'h', padL + (h / 24) * gw, H - padB + 5);
      });
      ctx.fillText('24h', padL + gw, H - padB + 5);
    }

    drawBatHourly();

    canvas.style.cursor = 'pointer';
    canvas.onclick = function(ev) {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      let hitIdx = -1;
      for (let i = 0; i < 24; i++) {
        if (hours[i].min === null) continue;
        const zoneX = padL + (i / 24) * gw;
        if (mx >= zoneX && mx < zoneX + colW && my >= padT && my <= H - padB) {
          hitIdx = i;
        }
      }

      // Atualiza seleção e redesenha o canvas diretamente (sem reconstruir o DOM)
      batHourlySelectedHour = batHourlySelectedHour === hitIdx ? null : hitIdx;
      drawBatHourly();

      // Remove tooltip existente
      const old = document.getElementById('batHourlyTooltip');
      if (old) old.remove();
      if (hitIdx === -1 || batHourlySelectedHour === null) return;

      const slot = hours[hitIdx];
      const hEnd = (hitIdx + 1) % 24;
      const label = String(hitIdx).padStart(2,'0') + ':00 – ' + String(hEnd).padStart(2,'0') + ':00';
      const tip = document.createElement('div');
      tip.id = 'batHourlyTooltip';
      tip.style.cssText = 'position:absolute;background:#1e293b;color:#fff;border-radius:8px;padding:7px 12px;font-size:12px;line-height:1.5;pointer-events:none;z-index:9999;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
      tip.innerHTML = label + '&nbsp;&nbsp;<strong style="color:#fbbf24;"><span style="font-size:1.2em;">' + slot.min + '</span> até <span style="font-size:1.2em;">' + slot.max + '</span> bpm</strong>';

      const parent = canvas.parentElement;
      parent.style.position = 'relative';
      const canvasRect = canvas.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      const cx = padL + (hitIdx + 0.5) * colW;
      let left = (canvasRect.left - parentRect.left) + cx - 60;
      let top = (canvasRect.top - parentRect.top) - 44;
      if (left < 0) left = 4;
      if (left + 200 > parentRect.width) left = parentRect.width - 204;
      if (top < 0) top = (canvasRect.top - parentRect.top) + 4;
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
      parent.appendChild(tip);

      const dismiss = () => { tip.remove(); document.removeEventListener('click', dismiss); };
      setTimeout(() => document.addEventListener('click', dismiss), 10);
    };
  });
}

// ?"––? Batimento: Tabela horária ?"––––––––––––––––––––––––––––––––––––––––––––?
function renderBatimentoHourlyTable(historico, isoDate) {
  const el = document.getElementById('batHourlyTable');
  if (!el) return;

  // Atualiza label de data acima do card
  const _labelEl = document.getElementById('batHourlyDateLabel');
  if (_labelEl) {
    if (isoDate) {
      const _p = isoDate.split('-').map(Number);
      const _dt = new Date(_p[0], _p[1] - 1, _p[2]);
      const _dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'S\u00e1b'];
      const _meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      _labelEl.textContent = _dias[_dt.getDay()] + ', ' + String(_p[2]).padStart(2, '0') + ' ' + _meses[_p[1] - 1];
    } else {
      _labelEl.textContent = '';
    }
  }

  // Guardar referência global para uso no onclick das linhas
  window.__batHourlyHistorico = historico;

  // Agrupar por slot de hora (hh:00–hh+1:00), ordenado do mais recente
  const slotMap = new Map();
  historico.forEach(h => {
    const v = parseBatimentoHistoricoValor(h);
    if (!Number.isFinite(v)) return;
    const horaStr = String(h.hora || '').slice(0, 5); // "HH:MM"
    if (!/^\d{2}:\d{2}$/.test(horaStr)) return;
    const hNum = parseInt(horaStr.slice(0, 2), 10);
    const slotKey = `${String(hNum).padStart(2,'0')}:00 – ${String((hNum+1)%24).padStart(2,'0')}:00`;
    const ms = typeof historicoEntryToMs === 'function' ? (historicoEntryToMs(h) || 0) : 0;
    if (!slotMap.has(slotKey)) slotMap.set(slotKey, { min: v, max: v, ms });
    else {
      const o = slotMap.get(slotKey);
      o.min = Math.min(o.min, v);
      o.max = Math.max(o.max, v);
      if (ms > o.ms) o.ms = ms;
    }
  });

  const rows = Array.from(slotMap.entries())
    .sort((a, b) => b[1].ms - a[1].ms); // mais recente primeiro

  if (!rows.length) { el.innerHTML = ''; return; }

  const INITIAL = 3;
  let showAll = false;

  const BAT_CLS = {
    sleep:    { color: '#94a3b8', p: '<path fill="#94a3b8" stroke="none" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' },
    run:      { color: '#94a3b8', p: '<path fill="#94a3b8" stroke="none" d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>' },
    exercise: { color: '#94a3b8', p: '<line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="8" x2="6" y2="16"/><line x1="18" y1="8" x2="18" y2="16"/><line x1="3" y1="9" x2="3" y2="15"/><line x1="21" y1="9" x2="21" y2="15"/>' }
  };
  // Horas fixas com Ícone de exercício (treino) e corrida – mock decorativo
  const EXERCISE_HOURS = new Set([8, 9, 17]);
  const RUN_HOURS      = new Set([7, 10, 16, 18]);
  const getBatCls = (slot) => {
    const h = parseInt(slot.split(':')[0]);
    if (h >= 23 || h < 7) return BAT_CLS.sleep;
    if (EXERCISE_HOURS.has(h)) return BAT_CLS.exercise;
    if (RUN_HOURS.has(h)) return BAT_CLS.run;
    return null;
  };

  const _chevron = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  const renderRows = (all) => rows.slice(0, all ? rows.length : INITIAL).map(([slot, d]) => {
    const cls = getBatCls(slot);
    const icoHtml = cls ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${cls.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cls.p}</svg>` : '';
    const safeSlot = slot.replace(/'/g, "\\'");
    return `
    <div class="bat-hourly-row" onclick="openBatHourlyDetail('${safeSlot}', ${d.min}, ${d.max}, window.__batHourlyHistorico)">
      <div class="bat-hourly-left">
        <span class="bat-hourly-range">${d.min} <span class="bat-hourly-sep">–</span> ${d.max} <span class="bat-hourly-unit">bpm</span></span>
        <span class="bat-hourly-slot">${slot}</span>
      </div>
      <div class="bat-hourly-right">${icoHtml}${_chevron}</div>
    </div>`;
  }).join('');

  const rebuild = (all) => {
    el.innerHTML = `
      <div class="bat-hourly-header">As últimas medições por hora</div>
      <div class="bat-hourly-rows" id="batHourlyRows">${renderRows(all)}</div>
      ${rows.length > INITIAL ? `<button class="bat-hourly-more" id="batHourlyMoreBtn">${all ? 'Ver menos' : 'Ver mais'}</button>` : ''}`;
    const btn = document.getElementById('batHourlyMoreBtn');
    if (btn) btn.onclick = () => rebuild(!all);
  };

  rebuild(showAll);
}

// ?"––? Batimento: Detalhe de uma hora especA-fica ?"–––––––––––––––––––––––––––?
let _batHdCurrentHistorico = null;

function openBatHourlyDetail(slotKey, dMin, dMax, historico) {
  _batHdCurrentHistorico = historico;
  window._batHdActive = true;

  // Oculta os cards normais
  ['batDayPickerCard','batMinMaxCard','batHourlyChart','batHourlyTable','batRestingTrend'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const view = document.getElementById('batHourlyDetailView');
  if (!view) return;
  view.style.display = 'block';

  // Label com horário + data e dia da semana
  const _selISO = batimentoSelectedDayISO || getTodayISODate();
  const [_y, _m, _d] = _selISO.split('-').map(Number);
  const _dateObj = new Date(_y, _m - 1, _d);
  const _diasSem = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const _meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const _dateLabel = `${_diasSem[_dateObj.getDay()]}, ${String(_d).padStart(2,'0')} ${_meses[_m - 1]}`;
  document.getElementById('batHdSlotLabel').innerHTML =
    `${slotKey} <span style="font-size:13px;font-weight:400;color:#94a3b8;">· ${_dateLabel}</span>`;

  // Atualiza tA-tulo e subtA-tulo do navbar principal
  const _titleEl = document.getElementById('vitalDetailTitle');
  if (_titleEl) _titleEl.textContent = 'Medição horária';
  const _subtitleEl = document.getElementById('vitalDetailSubtitle');
  if (_subtitleEl) _subtitleEl.textContent = slotKey;

  // Min/Max card
  const mmEl = document.getElementById('batHdMinMax');
  if (mmEl) {
    mmEl.innerHTML = `
      <div class="bat-hd-mm-item">
        <span class="bat-hd-mm-label">MÍNIMO</span>
        <span class="bat-hd-mm-value">${dMin}</span>
        <span class="bat-hd-mm-unit">bpm</span>
      </div>
      <div class="bat-hd-mm-divider"></div>
      <div class="bat-hd-mm-item">
        <span class="bat-hd-mm-label">MÁXIMO</span>
        <span class="bat-hd-mm-value">${dMax}</span>
        <span class="bat-hd-mm-unit">bpm</span>
      </div>`;
  }

  // Gerar pontos de 5 em 5 minutos para a hora
  const hNum = parseInt(slotKey.split(':')[0], 10);
  const points = _buildHourlyFiveMinPoints(hNum, dMin, dMax, historico);

  // Desenhar gráfico
  requestAnimationFrame(() => renderBatHdChart(points, dMin, dMax, hNum));
}

function closeBatHourlyDetail() {
  window._batHdActive = false;

  const view = document.getElementById('batHourlyDetailView');
  if (view) view.style.display = 'none';

  // Restaura tA-tulo do navbar e limpa subtA-tulo
  const _titleEl = document.getElementById('vitalDetailTitle');
  if (_titleEl && currentVitalDetail && currentVitalDetail.tipo) {
    _titleEl.textContent = 'Histórico de ' + currentVitalDetail.tipo;
  }
  const _subtitleEl = document.getElementById('vitalDetailSubtitle');
  if (_subtitleEl) _subtitleEl.textContent = '';

  ['batDayPickerCard','batMinMaxCard','batHourlyChart','batHourlyTable','batRestingTrend'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
}

function _buildHourlyFiveMinPoints(hNum, dMin, dMax, historico) {
  // Coleta leituras reais nessa hora agrupadas por slot de 5 minutos
  const real = {};
  if (Array.isArray(historico)) {
    historico.forEach(h => {
      const horaStr = String(h.hora || '').slice(0, 5);
      if (!/^\d{2}:\d{2}$/.test(horaStr)) return;
      const hh = parseInt(horaStr.slice(0, 2), 10);
      if (hh !== hNum) return;
      const mm = parseInt(horaStr.slice(3, 5), 10);
      const slotMin = Math.floor(mm / 5) * 5;
      const v = typeof parseBatimentoHistoricoValor === 'function'
        ? parseBatimentoHistoricoValor(h) : Number(h.valor);
      if (!Number.isFinite(v)) return;
      if (!real[slotMin]) real[slotMin] = [];
      real[slotMin].push(v);
    });
  }

  // Gera os 12 slots (0,5,10,...,55) com min/max por slot
  // Quando há apenas um valor real no slot, aplica pequena faixa para manter a leitura visual da barra.
  const mid = Math.round((dMin + dMax) / 2);
  const amp = Math.max(Math.round((dMax - dMin) / 2), 2);
  const pts = [];
  let prev = Array.isArray(real[0]) && real[0].length ? real[0][real[0].length - 1] : mid;
  const spreadPad = Math.max(5, Math.min(9, Math.round((dMax - dMin) * 0.35)));
  for (let m = 0; m < 60; m += 5) {
    if (Array.isArray(real[m]) && real[m].length) {
      const vals = real[m];
      let slotMin = Math.min(...vals);
      let slotMax = Math.max(...vals);
      const anchor = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      const localPad = Math.max(4, Math.min(11, spreadPad + Math.round(Math.abs(anchor - prev) * 0.35)));
      if (slotMax <= slotMin) {
        slotMin = Math.max(dMin, slotMin - localPad);
        slotMax = Math.min(dMax, slotMax + localPad);
      }
      const center = Math.round((slotMin + slotMax) / 2);
      pts.push({ min: m, bpm: center, minBpm: slotMin, maxBpm: slotMax });
      prev = center;
    } else {
      // variação sintActica suave
      const drift = Math.round((Math.random() - 0.5) * amp * 0.6);
      const v = Math.min(dMax, Math.max(dMin, prev + drift));
      const localPad = Math.max(4, Math.min(11, spreadPad + Math.round(Math.abs(v - prev) * 0.45)));
      const sMin = Math.max(dMin, v - localPad);
      const sMax = Math.min(dMax, v + localPad);
      pts.push({ min: m, bpm: v, minBpm: sMin, maxBpm: sMax });
      prev = v;
    }
  }
  return pts;
}

function renderBatHdChart(points, dMin, dMax, hNum) {
  const canvas = document.getElementById('batHdChartCanvas');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth - 28; // padding
  const H = 160;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const PAD_L = 30, PAD_R = 6, PAD_T = 6, PAD_B = 22;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const idealHr = getBatimentoChartIdealBand();
  const bounds = getBatimentoPlotYBoundsFromDataRange(dMin, dMax);
  const yLo = bounds.yLow;
  const yHi = bounds.yHigh;
  const ySpan = yHi - yLo || 1;

  const slot = chartW / points.length;
  const toX = (i) => PAD_L + (i + 0.5) * slot;
  const toY = (v) => PAD_T + ((yHi - v) / ySpan) * chartH;

  // Fundo
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  drawBatimentoChartIdealBackground(ctx, PAD_L, chartW, toY, yLo, yHi, idealHr.min, idealHr.max);

  // Linhas e labels do eixo Y
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  [yHi, yLo].forEach(v => {
    const y = toY(v);
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
    ctx.fillStyle = '#8e8e8e';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.round(v)), PAD_L - 2, y + 3);
  });

  // Barras min/max por slot de 5 minutos
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD_L, PAD_T, chartW, chartH);
  ctx.clip();

  // Usa min/max já preparados por slot; fallback mantém compatibilidade com formato antigo ({min,bpm})
  const slotData = points.map(p => ({
    min: p.min,
    minBpm: p.minBpm !== undefined ? p.minBpm : (p.bpm !== undefined ? p.bpm : dMin),
    maxBpm: p.maxBpm !== undefined ? p.maxBpm : (p.bpm !== undefined ? p.bpm : dMax)
  }));

  // Barras finas, arredondadas, espaçamento igual ao gráfico de frequência por hora
  const barW = 7; // igual ao gráfico de frequência por hora
  const barR = 3; // igual ao gráfico de frequência por hora
  const n = slotData.length;
  const barSlot = chartW / n;

  // Função de desenho reutilizável (não reconstrói o DOM)
  function drawBatHd() {
    const hasSel = Number.isInteger(batHdSelectedSlot);
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD_L, PAD_T, chartW, chartH);
    ctx.clip();

    // Fundo + ideal band (redraw limpo)
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    drawBatimentoChartIdealBackground(ctx, PAD_L, chartW, toY, yLo, yHi, idealHr.min, idealHr.max);

    ctx.restore();

    // Linhas e labels eixo Y
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    [yHi, yLo].forEach(v => {
      const y = toY(v);
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
      ctx.fillStyle = '#8e8e8e';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.round(v)), PAD_L - 2, y + 3);
    });

    // Barras
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD_L, PAD_T, chartW, chartH);
    ctx.clip();
    slotData.forEach((p, i) => {
      const x = PAD_L + i * barSlot + (barSlot - barW) / 2;
      const lo = Math.min(p.minBpm, p.maxBpm);
      const hi = Math.max(p.minBpm, p.maxBpm);
      const isSelected = hasSel && batHdSelectedSlot === i;
      let color;
      if (hi > idealHr.max) color = '#ef4444';
      else if (lo < idealHr.min) color = '#f59e0b';
      else color = '#2563eb';
      ctx.globalAlpha = hasSel && !isSelected ? 0.2 : 1;
      ctx.fillStyle = color;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, toY(hi), barW, Math.max(3, toY(lo) - toY(hi)), barR);
        ctx.fill();
      } else {
        ctx.fillRect(x, toY(hi), barW, Math.max(3, toY(lo) - toY(hi)));
      }
      ctx.globalAlpha = 1;
    });

    // Linha vertical sobre a barra selecionada
    if (Number.isInteger(batHdSelectedSlot)) {
      const cx = toX(batHdSelectedSlot);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(cx, PAD_T);
      ctx.lineTo(cx, H - PAD_B);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Eixo X
    ctx.fillStyle = '#666666';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    [[0,'00min'],[3,'15min'],[6,'30min'],[9,'45min'],[11,'55min']].forEach(([i, label]) => {
      if (points[i]) ctx.fillText(label, toX(i), H - 6);
    });
  }

  batHdSelectedSlot = null;
  drawBatHd();

  // Tooltip ao clicar numa barra
  const tooltip = document.getElementById('batHdTooltip');
  function showBatHdTip(i) {
    if (!tooltip) return;
    const p = slotData[i];
    const h = (hNum != null ? hNum : 0);
    const startMin = String(p.min).padStart(2,'0');
    const endMin = String(Math.min(p.min + 4, 59)).padStart(2, '0');
    tooltip.innerHTML = `${String(h).padStart(2,'0')}:${startMin} – ${String(h).padStart(2,'0')}:${endMin}&nbsp;&nbsp;<strong><span style="font-size:1.2em;">${p.minBpm}</span> até <span style="font-size:1.2em;">${p.maxBpm}</span> bpm</strong>`;
    tooltip.style.display = 'block';
    const cardRect = canvas.parentElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const tw = tooltip.offsetWidth || 150;
    const th = tooltip.offsetHeight || 44;
    let left = (canvasRect.left - cardRect.left) + toX(i) - tw / 2;
    left = Math.max(4, Math.min(left, cardRect.width - tw - 4));
    let top = (canvasRect.top - cardRect.top) - th - 8;
    if (top < 4) top = 4;
    tooltip.style.left = `${left}px`;
    tooltip.style.top  = `${top}px`;
  }
  if (canvas._batHdClick) canvas.removeEventListener('click', canvas._batHdClick);
  canvas._batHdClick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    // Encontra o slot mais próximo no eixo X
    let best = -1;
    let bestDist = Infinity;
    slotData.forEach((p, i) => {
      const dist = Math.abs(toX(i) - cx);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    batHdSelectedSlot = batHdSelectedSlot === best ? null : best;
    drawBatHd();
    if (tooltip) tooltip.style.display = 'none';
    if (batHdSelectedSlot !== null) showBatHdTip(batHdSelectedSlot);
    e.stopPropagation();
  };
  canvas.addEventListener('click', canvas._batHdClick);
  if (document._batHdOutsideClick) document.removeEventListener('click', document._batHdOutsideClick);
  document._batHdOutsideClick = function(e) {
    if (e.target !== canvas) {
      if (tooltip) tooltip.style.display = 'none';
      if (batHdSelectedSlot !== null) { batHdSelectedSlot = null; drawBatHd(); }
    }
  };
  document.addEventListener('click', document._batHdOutsideClick);
}

// ?"––? Batimento: Tendáncia de repouso 7 dias ?"–––––––––––––––––––––––––––––––?
function renderBatimentoRestingTrend(historico) {
  const el = document.getElementById('batRestingTrend');
  if (!el) return;
  window.__batRestingHistorico = historico;

  const band = typeof getBatimentoChartIdealBand === 'function' ? getBatimentoChartIdealBand() : { min: 60, max: 100 };

  // Asltimos 7 dias: filtrar repouso/sono por dia, calcular mAcdia
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','');
    days.push({ iso, label, vals: [] });
  }

  historico.forEach(h => {
    const v = parseBatimentoHistoricoValor(h);
    if (!Number.isFinite(v)) return;
    const ctx = h.contextoColeta;
    if (ctx && ctx !== 'repouso' && ctx !== 'sono') return; // só repouso e sono
    const dayISO = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data||'').slice(0,10);
    const slot = days.find(d => d.iso === dayISO);
    if (slot) slot.vals.push(v);
  });

  // Se não há dados de repouso, usa todos
  const hasResting = days.some(d => d.vals.length > 0);
  if (!hasResting) {
    historico.forEach(h => {
      const v = parseBatimentoHistoricoValor(h);
      if (!Number.isFinite(v)) return;
      const dayISO = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data||'').slice(0,10);
      const slot = days.find(d => d.iso === dayISO);
      if (slot) slot.vals.push(v);
    });
  }

  const points = days.map(d => ({
    label: d.label,
    val: d.vals.length ? Math.round(d.vals.reduce((a,b)=>a+b,0)/d.vals.length) : null
  }));

  // Calcular mAcdia geral para destaque
  const allVals = points.filter(p => p.val != null).map(p => p.val);
  const avgVal = allVals.length ? Math.round(allVals.reduce((a,b)=>a+b,0)/allVals.length) : null;

  // Se todos os pontos têm o mesmo valor (dados de demo muito uniformes), injeta variação
  const uniqueVals = new Set(allVals);
  let displayPoints = points;
  if (uniqueVals.size <= 2 && allVals.length >= 4) {
    const base = avgVal || 73;
    const offsets = [-4, 2, -2, 5, -1, 3, -3];
    displayPoints = points.map((p, i) => ({
      label: p.label,
      val: p.val != null ? Math.max(40, base + offsets[i % offsets.length]) : null
    }));
  }

  el.innerHTML = `
    <div class="bat-resting-header">Tendáncia em repouso <span class="bat-resting-sub">7 dias</span></div>
    ${avgVal != null ? `<div class="bat-resting-avg"><span class="bat-resting-avg-value">${avgVal}</span><span class="bat-resting-avg-unit">bpm mAcdia</span></div>` : ''}
    <canvas id="batRestingCanvas" class="bat-resting-canvas" height="100"></canvas>
    <div class="bat-resting-labels" id="batRestingLabels"></div>`;

  // Renderizar labels
  const labelsEl = document.getElementById('batRestingLabels');
  if (labelsEl) labelsEl.innerHTML = displayPoints.map(p => `<span class="bat-resting-day-label">${p.label}</span>`).join('');

  requestAnimationFrame(() => {
    const canvas = document.getElementById('batRestingCanvas');
    if (!canvas) return;
    const W = canvas.offsetWidth || 300;
    canvas.width = W * (window.devicePixelRatio || 1);
    canvas.height = 100 * (window.devicePixelRatio || 1);
    canvas.style.height = '100px';
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    const w = W, h = 100;
    ctx.clearRect(0, 0, w, h);

    const filled = displayPoints.filter(p => p.val != null);
    if (filled.length < 2) return;

    const minV = Math.min(...filled.map(p => p.val)) - 5;
    const maxV = Math.max(...filled.map(p => p.val)) + 5;
    const padL = 28, padR = 8, padT = 12, padB = 8;
    const gw = w - padL - padR;
    const gh = h - padT - padB;
    const n = displayPoints.length;
    const slotW = gw / (n - 1);

    const toX = (i) => padL + i * slotW;
    const toY = (v) => padT + gh - ((v - minV) / (maxV - minV)) * gh;

    // Faixa de referência normal (60–100 bpm)
    const refLo = band.min, refHi = band.max;
    const refYTop = Math.max(padT, toY(Math.min(refHi, maxV + 5)));
    const refYBot = Math.min(padT + gh, toY(Math.max(refLo, minV - 5)));
    if (refYBot > refYTop) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
      ctx.fillRect(padL, refYTop, gw, refYBot - refYTop);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(padL, refYTop); ctx.lineTo(padL + gw, refYTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(padL, refYBot); ctx.lineTo(padL + gw, refYBot); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Grid lines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    [0, 0.5, 1].forEach(t => {
      const y = padT + t * gh;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    });

    // Y labels – só mín e máx reais para não poluir
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 10px Inter, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    [[minV + 5, 1], [maxV - 5, 0]].forEach(([v, t]) => {
      const y = padT + t * gh;
      ctx.fillText(String(Math.round(v)), padL - 4, y);
    });

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let first = true;
    displayPoints.forEach((p, i) => {
      if (p.val == null) { first = true; return; }
      const x = toX(i), y = toY(p.val);
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots + value labels
    displayPoints.forEach((p, i) => {
      if (p.val == null) return;
      const x = toX(i), y = toY(p.val);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // value above dot
      ctx.fillStyle = '#0f172a';
      ctx.font = `600 10px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(p.val), x, y - 5);
    });
  });
}

// ?"––? Batimento: Detalhe Tendáncia em Repouso ?"–––––––––––––––––––––––––––––?
let __batRestingPeriod = '7d';

function openBatRestingDetail() {
  ['batDayPickerCard','batMinMaxCard','batHourlyChart','batHourlyTable','batRestingTrend'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var hd = document.getElementById('batHourlyDetailView');
  if (hd) hd.style.display = 'none';
  var view = document.getElementById('batRestingDetailView');
  if (view) view.style.display = '';
  __batRestingPeriod = '7d';
  _brdUpdateChips('7d');
  _brdRenderContent('7d');
}

function closeBatRestingDetail() {
  var view = document.getElementById('batRestingDetailView');
  if (view) view.style.display = 'none';
  ['batDayPickerCard','batMinMaxCard','batHourlyChart','batHourlyTable','batRestingTrend'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = '';
  });
}

function switchBatRestingPeriod(period) {
  __batRestingPeriod = period;
  _brdUpdateChips(period);
  _brdRenderContent(period);
}

function _brdUpdateChips(active) {
  document.querySelectorAll('.brd-chip').forEach(function(btn) {
    btn.classList.toggle('brd-chip-active', btn.dataset.period === active);
  });
}

function _brdGetStatus(avg) {
  if (avg < 50) return { cls: 'brd-status-red',    label: 'Bradicardia', text: 'Frequência cardíaca em repouso muito abaixo do normal. Recomenda-se consultar um médico.', tip: 'Procure seu cardiologista para uma avaliação completa.' };
  if (avg <= 60) return { cls: 'brd-status-blue',   label: 'Atlético',   text: 'Frequência típica de pessoas com alta aptidão cardiovascular.',                             tip: 'Mantenha a rotina de exercícios – seu coração agradece.' };
  if (avg <= 72) return { cls: 'brd-status-green',  label: 'Excelente',  text: 'Frequência cardíaca em repouso em nível excelente.',                                         tip: 'Continue dormindo bem e mantendo a atividade física regular.' };
  if (avg <= 80) return { cls: 'brd-status-green',  label: 'Normal',     text: 'Frequência cardíaca em repouso dentro da faixa saudável para adultos.',                     tip: 'Sono de qualidade e caminhadas diárias ajudam a manter esse resultado.' };
  if (avg <= 90) return { cls: 'brd-status-yellow', label: 'Atenção',    text: 'Frequência cardíaca em repouso levemente acima do ideal.',                                   tip: 'Tente reduzir o estresse e priorize pelo menos 7h de sono por noite.' };
  return              { cls: 'brd-status-red',      label: 'Elevado',    text: 'Frequência cardíaca em repouso elevada.',                                                  tip: 'Considere consultar um profissional de saúde e evite cafeína · noite.' };
}

function _brdBuildPoints(period) {
  var today = new Date();
  var historico = window.__batRestingHistorico || [];
  var n = period === '7d' ? 7 : (period === '30d' ? 30 : (period === '3m' ? 13 : 12));
  var isWeekly = period === '3m' || period === '1y';
  var points = [];
  var fmtDayMonth = function(date) {
    return String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0');
  };

  for (var i = n - 1; i >= 0; i--) {
    var d = new Date(today);
    if (period === '1y') d.setMonth(d.getMonth() - i);
    else if (isWeekly) d.setDate(d.getDate() - i * 7);
    else d.setDate(d.getDate() - i);
    var iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    var pos = n - 1 - i;
    var label = '';
    if (period === '7d') {
      label = fmtDayMonth(d);
    } else if (period === '30d') {
      label = (pos % 5 === 0 || pos === n - 1) ? fmtDayMonth(d) : '';
    } else if (period === '1y') {
      label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.','');
    } else {
      // 3m: show day/month every 4 weeks
      label = (pos % 4 === 0) ? fmtDayMonth(d) : '';
    }
    points.push({ iso: iso, label: label, vals: [] });
  }

  // Fill from historico
  historico.forEach(function(h) {
    var v = typeof parseBatimentoHistoricoValor === 'function' ? parseBatimentoHistoricoValor(h) : parseInt(h.valor);
    if (!Number.isFinite(v)) return;
    var dayISO = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data||'').slice(0,10);
    if (period === '1y') {
      // match by year-month
      var ym = dayISO.slice(0, 7);
      for (var j = 0; j < points.length; j++) {
        if (points[j].iso.slice(0, 7) === ym) { points[j].vals.push(v); break; }
      }
    } else if (isWeekly) {
      // find which weekly bucket this day belongs to
      for (var j = 0; j < points.length; j++) {
        var slotD = new Date(points[j].iso);
        var diff = (new Date(dayISO) - slotD) / 86400000;
        if (diff >= -3 && diff <= 3) { points[j].vals.push(v); break; }
      }
    } else {
      var slot = null;
      for (var k = 0; k < points.length; k++) { if (points[k].iso === dayISO) { slot = points[k]; break; } }
      if (slot) slot.vals.push(v);
    }
  });

  var result = points.map(function(p) {
    return { label: p.label, iso: p.iso, val: p.vals.length ? Math.round(p.vals.reduce(function(a,b){return a+b;},0)/p.vals.length) : null };
  });

  // Mock variation if data too uniform or sparse
  var allVals = result.filter(function(p){return p.val!=null;}).map(function(p){return p.val;});
  var baseAvg = allVals.length ? Math.round(allVals.reduce(function(a,b){return a+b;},0)/allVals.length) : 73;
  var unique = {};
  allVals.forEach(function(v){unique[v]=1;});
  if (Object.keys(unique).length <= 3 || allVals.length < Math.floor(n * 0.5)) {
    var seed = baseAvg * 31 + 7;
    return result.map(function(p) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      var offset = (seed % 13) - 6;
      return { label: p.label, iso: p.iso, val: Math.max(48, baseAvg + offset) };
    });
  }
  return result;
}

function _brdRenderContent(period) {
  var points = _brdBuildPoints(period);
  var allVals = points.filter(function(p){return p.val!=null;}).map(function(p){return p.val;});
  if (!allVals.length) return;

  var avg = Math.round(allVals.reduce(function(a,b){return a+b;},0)/allVals.length);
  var minV = Math.min.apply(null, allVals);
  var maxV = Math.max.apply(null, allVals);
  var status = _brdGetStatus(avg);

  // Summary
  var avgEl = document.getElementById('brdAvgValue');
  if (avgEl) avgEl.textContent = avg;
  var badge = document.getElementById('brdStatusBadge');
  if (badge) { badge.className = 'brd-status-badge ' + status.cls; badge.textContent = status.label; }
  var txt = document.getElementById('brdStatusText');
  if (txt) txt.innerHTML = status.text + (status.tip ? ' <span class="brd-tip">' + status.tip + '</span>' : '');

  // Stats
  var statMin = document.getElementById('brdStatMin');
  var statMax = document.getElementById('brdStatMax');
  var statVar = document.getElementById('brdStatVar');
  if (statMin) statMin.textContent = minV;
  if (statMax) statMax.textContent = maxV;
  if (statVar) statVar.textContent = 'à' + Math.round((maxV - minV) / 2);

  // Range label
  var rangeEl = document.getElementById('brdChartRange');
  var rangeMap = { '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', '3m': 'Últimos 3 meses', '1y': 'Último ano' };
  if (rangeEl) rangeEl.textContent = rangeMap[period] || '';

  // X-axis labels
  var labelsEl = document.getElementById('brdChartLabels');
  if (labelsEl) {
    labelsEl.innerHTML = points.map(function(p) {
      return '<span class="brd-chart-label">' + (p.label || '') + '</span>';
    }).join('');
  }

  // Chart
  requestAnimationFrame(function() {
    var canvas = document.getElementById('brdChartCanvas');
    if (!canvas) return;
    var parent = canvas.parentElement;
    var W = parent ? parent.clientWidth - 28 : 300;
    var H = 180;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    var filled = points.filter(function(p){return p.val!=null;});
    if (filled.length < 2) return;

    var PAD_L = 36, PAD_R = 10, PAD_T = 20, PAD_B = 8;
    var chartW = W - PAD_L - PAD_R;
    var chartH = H - PAD_T - PAD_B;
    var rawMin = Math.min.apply(null, filled.map(function(p){return p.val;}));
    var rawMax = Math.max.apply(null, filled.map(function(p){return p.val;}));
    var rangeMin = Math.max(0, rawMin - 12);
    var rangeMax = rawMax + 12;
    var n = points.length;

    var toX = function(i) { return PAD_L + (i / (n - 1)) * chartW; };
    var toY = function(v) { return PAD_T + chartH - ((v - rangeMin) / (rangeMax - rangeMin)) * chartH; };

    // Green reference band (60–80 bpm)
    var refYTop = Math.max(PAD_T, toY(80));
    var refYBot = Math.min(PAD_T + chartH, toY(60));
    if (refYBot > refYTop) {
      ctx.fillStyle = 'rgba(34,197,94,0.07)';
      ctx.fillRect(PAD_L, refYTop, chartW, refYBot - refYTop);
      ctx.strokeStyle = 'rgba(34,197,94,0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(PAD_L, refYTop); ctx.lineTo(PAD_L+chartW, refYTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD_L, refYBot); ctx.lineTo(PAD_L+chartW, refYBot); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Grid lines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    [0, 0.25, 0.5, 0.75, 1].forEach(function(t) {
      var y = PAD_T + t * chartH;
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
    });

    // Y labels (3 levels)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    [[rangeMax, 0], [Math.round((rangeMin+rangeMax)/2), 0.5], [rangeMin, 1]].forEach(function(pair) {
      var y = PAD_T + pair[1] * chartH;
      ctx.fillText(String(Math.round(pair[0])), PAD_L - 4, y);
    });

    // Gradient fill under line
    var grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + chartH);
    grad.addColorStop(0, 'rgba(37,99,235,0.18)');
    grad.addColorStop(1, 'rgba(37,99,235,0)');
    var firstIdx = -1, lastIdx = -1;
    points.forEach(function(p, i) { if (p.val != null) { if (firstIdx === -1) firstIdx = i; lastIdx = i; } });
    if (firstIdx !== -1) {
      ctx.beginPath();
      var fp = true;
      points.forEach(function(p, i) {
        if (p.val == null) { fp = true; return; }
        if (fp) { ctx.moveTo(toX(i), toY(p.val)); fp = false; } else ctx.lineTo(toX(i), toY(p.val));
      });
      ctx.lineTo(toX(lastIdx), PAD_T + chartH);
      ctx.lineTo(toX(firstIdx), PAD_T + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    var first = true;
    points.forEach(function(p, i) {
      if (p.val == null) { first = true; return; }
      if (first) { ctx.moveTo(toX(i), toY(p.val)); first = false; } else ctx.lineTo(toX(i), toY(p.val));
    });
    ctx.stroke();

    // Dots
    var showAllDots = n <= 30;
    points.forEach(function(p, i) {
      if (p.val == null) return;
      if (!showAllDots && i % 4 !== 0) return;
      ctx.beginPath();
      ctx.arc(toX(i), toY(p.val), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Value labels for 7d only
    if (period === '7d') {
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      points.forEach(function(p, i) {
        if (p.val == null) return;
        ctx.fillText(String(p.val), toX(i), toY(p.val) - 5);
      });
    }

    var tooltip = document.getElementById('brdChartTooltip');
    var card = canvas.parentElement;
    var activeIndex = null;
    var pinnedIndex = null;

    function getNearestIndex(clientX) {
      var rect = canvas.getBoundingClientRect();
      var localX = clientX - rect.left;
      var bestIdx = -1;
      var bestDist = Infinity;
      points.forEach(function(p, i) {
        if (p.val == null) return;
        var dist = Math.abs(toX(i) - localX);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      return bestIdx;
    }

    function showTooltip(i) {
      if (!tooltip || !card || i == null || i < 0 || !points[i] || points[i].val == null) return;
      activeIndex = i;
      var point = points[i];
      var canvasRect = canvas.getBoundingClientRect();
      var cardRect = card.getBoundingClientRect();
      var pointDate = new Date(point.iso + 'T12:00:00');
      var dateLabel = '';
      if (period === '1y') {
        dateLabel = pointDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      } else {
        var weekday = pointDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        var dayMonth = String(pointDate.getDate()).padStart(2, '0') + '/' + String(pointDate.getMonth() + 1).padStart(2, '0');
        dateLabel = weekday + ' ' + dayMonth;
      }
      tooltip.innerHTML = '<span class="brd-chart-tooltip-date">' + dateLabel + '</span>' +
        '<span class="brd-chart-tooltip-value">' + point.val + ' bpm</span>';
      tooltip.style.left = (canvasRect.left - cardRect.left + toX(i)) + 'px';
      tooltip.style.top = (canvasRect.top - cardRect.top + toY(point.val)) + 'px';
      tooltip.style.display = '';
    }

    function hideTooltip() {
      activeIndex = null;
      pinnedIndex = null;
      if (tooltip) tooltip.style.display = 'none';
    }

    if (canvas._brdMoveHandler) canvas.removeEventListener('mousemove', canvas._brdMoveHandler);
    if (canvas._brdLeaveHandler) canvas.removeEventListener('mouseleave', canvas._brdLeaveHandler);
    if (canvas._brdClickHandler) canvas.removeEventListener('click', canvas._brdClickHandler);

    canvas._brdMoveHandler = function(e) {
      if (pinnedIndex != null) return;
      showTooltip(getNearestIndex(e.clientX));
    };
    canvas._brdLeaveHandler = function() {
      if (pinnedIndex == null) hideTooltip();
    };
    canvas._brdClickHandler = function(e) {
      e.stopPropagation();
      var nextIndex = getNearestIndex(e.clientX);
      if (pinnedIndex === nextIndex) {
        hideTooltip();
        return;
      }
      pinnedIndex = nextIndex;
      showTooltip(nextIndex);
    };

    canvas.addEventListener('mousemove', canvas._brdMoveHandler);
    canvas.addEventListener('mouseleave', canvas._brdLeaveHandler);
    canvas.addEventListener('click', canvas._brdClickHandler);

    if (document._brdChartOutsideClick) {
      document.removeEventListener('click', document._brdChartOutsideClick);
    }
    document._brdChartOutsideClick = function(e) {
      if (e.target !== canvas) hideTooltip();
    };
    document.addEventListener('click', document._brdChartOutsideClick);
  });
}

// ?"––? Batimento: Compartilhar card ?"––––––––––––––––––––––––––––––––––––––––?
async function shareBatimentoCard() {
  if (!currentVitalDetail) return;

  const btn = document.getElementById('batShareBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

  const selISO = batimentoSelectedDayISO || getTodayISODate();
  const nome = (typeof getUsuarioPrimeiroNome === 'function') ? getUsuarioPrimeiroNome() : '';
  const parts = selISO.split('-');
  const dateLabel = `${parts[2]}/${parts[1]}/${parts[0]}`;

  const chrome = document.getElementById('vitalDetailBatimentoChrome');
  if (!chrome) {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    return;
  }

  try {
    // Clonar o conteúdo fora do container com scroll para que html2canvas
    // consiga ver a altura completa sem cortes.
    const clone = chrome.cloneNode(true);
    clone.style.cssText = [
      'position:absolute',
      'left:-9999px',
      'top:0',
      'width:' + chrome.offsetWidth + 'px',
      'z-index:-1',
      'display:block',
      'background:#f3f3f3',
    ].join(';');
    document.body.appendChild(clone);

    // cloneNode não copia pixels de <canvas> – copiar manualmente
    const origCanvases = chrome.querySelectorAll('canvas');
    const cloneCanvases = clone.querySelectorAll('canvas');
    origCanvases.forEach((orig, i) => {
      if (!cloneCanvases[i] || !orig.width) return;
      cloneCanvases[i].width = orig.width;
      cloneCanvases[i].height = orig.height;
      const cc = cloneCanvases[i].getContext('2d');
      if (cc) cc.drawImage(orig, 0, 0);
    });

    const chromeCanvas = await html2canvas(clone, {
      backgroundColor: '#f3f3f3',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
    });

    document.body.removeChild(clone);

    // Compositar: header de branding + conteúdo completo + rodapAc
    const dpr = 2;
    const headerH = 76;
    const footerH = 36;
    const W = chromeCanvas.width;
    const H = chromeCanvas.height + (headerH + footerH) * dpr;

    const final = document.createElement('canvas');
    final.width = W;
    final.height = H;
    const ctx = final.getContext('2d');

    // --- Header branco ---
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, headerH * dpr);

    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, W, 5 * dpr); // barra azul topo

    ctx.fillStyle = '#2563eb';
    ctx.font = `700 ${13 * dpr}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Teep Saúde', 20 * dpr, 14 * dpr);

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 ${17 * dpr}px Inter, system-ui, sans-serif`;
    ctx.fillText('Batimento Cardíaco', 20 * dpr, 32 * dpr);

    ctx.fillStyle = '#64748b';
    ctx.font = `400 ${12 * dpr}px Inter, system-ui, sans-serif`;
    ctx.fillText(nome ? `${dateLabel} · ${nome}` : dateLabel, 20 * dpr, 55 * dpr);

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, (headerH - 1) * dpr, W, dpr); // divisor

    // --- Conteúdo capturado ---
    ctx.drawImage(chromeCanvas, 0, headerH * dpr);

    // --- RodapAc ---
    const footerY = headerH * dpr + chromeCanvas.height;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, footerY, W, footerH * dpr);

    ctx.fillStyle = '#94a3b8';
    ctx.font = `400 ${11 * dpr}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Gerado por Teep Saúde · teepsaude.com.br', W / 2, footerY + (footerH / 2) * dpr);

    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }

    // Exportar
    final.toBlob(async (blob) => {
      const file = new File([blob], `batimento-${selISO}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Batimento Cardíaco', text: `${dateLabel}${nome ? ' · ' + nome : ''}` });
          return;
        } catch (e) { /* cancelado pelo usuário */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batimento-${selISO}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');

  } catch (err) {
    console.error('Erro ao gerar imagem:', err);
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

// ?"––? Batimento: Day Picker ?"––––––––––––––––––––––––––––––––––––––––––––––––?
function renderBatimentoDayPicker(historico) {
  const el = document.getElementById('batDayPickerCard');
  if (!el) return;

  const todayISO = getTodayISODate();
  const selectedISO = batimentoSelectedDayISO || todayISO;

  // Agrupar por dia ISO ?+' { iso, min, max }
  const dayMap = new Map();
  historico.forEach(h => {
    const v = parseBatimentoHistoricoValor(h);
    if (!Number.isFinite(v)) return;
    const iso = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
    if (!iso) return;
    if (!dayMap.has(iso)) dayMap.set(iso, { min: v, max: v });
    else {
      const o = dayMap.get(iso);
      o.min = Math.min(o.min, v);
      o.max = Math.max(o.max, v);
    }
  });

  // Construir lista de dias: Últimos 90 dias, do mais antigo ao mais recente
  const days = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = dateToLocalISODate(d);
    const dow = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const dayNum = d.getDate();
    const monthNum = d.getMonth() + 1;
    const data = dayMap.get(iso) || null;
    days.push({ iso, dow, dayNum, monthNum, data });
  }

  // Escala global para altura das barras
  const allVals = Array.from(dayMap.values());
  const globalMin = allVals.length ? Math.min(...allVals.map(d => d.min)) : 50;
  const globalMax = allVals.length ? Math.max(...allVals.map(d => d.max)) : 110;
  const range = Math.max(globalMax - globalMin, 10);
  const BAR_HEIGHT = 44; // altura disponível em px

  const cols = days.map(day => {
    const isSelected = day.iso === selectedISO;
    const isToday = day.iso === todayISO;
    let classes = 'bat-picker-col';
    if (isSelected) classes += ' bat-picker-col--selected';
    if (isToday) classes += ' bat-picker-col--today';
    if (!day.data) classes += ' bat-picker-col--no-data';

    let barHtml;
    if (day.data) {
      const loFrac = (day.data.min - globalMin) / range;
      const hiFrac = (day.data.max - globalMin) / range;
      const barH = Math.max(4, Math.round((hiFrac - loFrac) * BAR_HEIGHT) + 4);
      const barBot = Math.round(loFrac * BAR_HEIGHT);
      barHtml = `<div class="bat-picker-bar" style="height:${barH}px;bottom:${barBot}px;"></div>`;
    } else {
      barHtml = `<div class="bat-picker-bar-empty"></div>`;
    }

    return `<div class="${classes}" data-day-iso="${day.iso}" onclick="selectBatimentoDay('${day.iso}')">
      <div class="bat-picker-bar-wrap">${barHtml}</div>
      <span class="bat-picker-dow">${day.dow}</span>
      <span class="bat-picker-day">${isSelected ? day.dayNum + '/' + day.monthNum : day.dayNum}</span>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="bat-picker-scroll" id="batPickerScroll">${cols}</div>`;

  // Scroll para mostrar o dia selecionado visA-vel · direita
  requestAnimationFrame(() => {
    const scroll = document.getElementById('batPickerScroll');
    if (!scroll) return;
    const selCol = scroll.querySelector('.bat-picker-col--selected');
    if (selCol) {
      const scrollW = scroll.offsetWidth;
      const colLeft = selCol.offsetLeft;
      const colW = selCol.offsetWidth;
      scroll.scrollLeft = colLeft - scrollW + colW + 16;
    }
  });
}

function selectBatimentoDay(iso) {
  if (!currentVitalDetail) return;
  batimentoSelectedDayISO = iso;

  // Atualizar visual do picker sem re-renderizar tudo
  const scroll = document.getElementById('batPickerScroll');
  if (scroll) {
    scroll.querySelectorAll('.bat-picker-col').forEach(col => {
      const colIso = col.getAttribute('data-day-iso');
      const isNowSelected = colIso === iso;
      col.classList.toggle('bat-picker-col--selected', isNowSelected);
      const daySpan = col.querySelector('.bat-picker-day');
      if (daySpan) {
        if (isNowSelected) {
          const p = colIso.split('-');
          daySpan.textContent = parseInt(p[2], 10) + '/' + parseInt(p[1], 10);
        } else {
          const p = colIso.split('-');
          daySpan.textContent = parseInt(p[2], 10);
        }
      }
    });
  }

  // Filtrar dados do dia selecionado
  const dayData = currentVitalDetail.historico.filter(h => {
    const d = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
    return d === iso;
  });

  renderBatimentoMinMaxCard(dayData);
  renderBatimentoHourlyChart(dayData);
  renderBatimentoHourlyTable(dayData, iso);
}

/**
 * Asnico ponto de atualização do modal de Batimento: lista + resumo do período + gráficos.
 */
function updateVitalBatimentoModalView() {
  syncCurrentBatimentoVitalFromMockData();
  const { start, end } = getBatimentoPeriodRange();
  const inPeriod = filterHistoricoByInclusiveDate(currentVitalDetail.historico, start, end);
  const filtrado = filterBatimentoByContext(inPeriod);
  const forList = historicoForBatimentoSelection(filtrado);
  currentVitalHistoricoView = sortHistoricoBatimentoDesc(forList);
  renderVitalDetailContent(currentVitalHistoricoView);
  renderBatimentoChromeCharts(filtrado, start, end);
  updateBatimentoPeriodSummary(filtrado, start, end);

  // Day picker – usa todo o histórico sem filtro de contexto para incluir todos os dias
  const allHist = currentVitalDetail.historico;
  renderBatimentoDayPicker(allHist);

  // Cards Min/Max e Tabela Horária filtram pelo dia selecionado
  const selISO = batimentoSelectedDayISO || getTodayISODate();
  const dayData = allHist.filter(h => {
    const d = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
    return d === selISO;
  });
  renderBatimentoMinMaxCard(dayData);
  renderBatimentoHourlyChart(dayData);
  renderBatimentoHourlyTable(dayData, selISO);
  renderBatimentoRestingTrend(allHist);
}

function onVitalBatimentoCanvasClick(ev) {
  const canvas = document.getElementById('vitalBatimentoDailyCanvas');
  const hit = window.__batimentoChartHit;
  if (!canvas || !hit || !hit.rows || hit.rows.length === 0) return;
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const { padL, padT, gw, gh, n, slot, w, h, padR } = hit;
  if (x < padL || x > w - padR || y < padT || y > h - hit.padB) return;
  const rel = x - padL;
  const idx = Math.floor(rel / slot);
  if (idx < 0 || idx >= n) return;
  const rowKey = hit.rows[idx][0];
  const nextSel = batimentoSelectionFromBar(hit.mode, rowKey);
  if (batimentoSelectionEquals(vitalBatimentoChartSelection, nextSel)) {
    vitalBatimentoChartSelection = null;
  } else {
    vitalBatimentoChartSelection = nextSel;
  }
  updateVitalBatimentoModalView();
}

/**
 * Ano: agrega por semana/quinzena. Demais chips e livre: uma barra por dia no intervalo (7 ?+' 7 colunas, etc.).
 */
function pickBatimentoChartRows(historico, startISO, endISO, periodKey) {
  if (periodKey === 'year') {
    const daily = aggregateHeartRateByDay(historico);
    const spanDays = countInclusiveDaysBetween(startISO, endISO);
    const crowdedDays = daily.length > 42;
    const longSpan = spanDays > 70;
    const forceYear = true;
    if (!forceYear && !longSpan && !crowdedDays) {
      return { rows: daily, mode: 'day' };
    }
    let rows = aggregateHeartRateByWeek(historico);
    let mode = 'week';
    if (rows.length > 32) {
      rows = mergeBiweeklyRows(rows);
      mode = 'biweek';
    }
    return { rows, mode };
  }
  return { rows: buildDailyRowsForRange(historico, startISO, endISO), mode: 'day' };
}

function getBatimentoPeriodRange() {
  const endToday = getTodayISODate();
  const endDate = localNoonFromISODate(endToday);
  if (Number.isNaN(endDate.getTime())) {
    return { start: endToday, end: endToday };
  }
  if (vitalBatimentoPeriod === 'livre') {
    const di = document.getElementById('filterBatimentoLivreInicio');
    const df = document.getElementById('filterBatimentoLivreFim');
    const vi = di && di.value;
    const vf = df && df.value;
    if (vi && vf) return vi <= vf ? { start: vi, end: vf } : { start: vf, end: vi };
    if (vi && !vf) return { start: vi, end: endToday };
    if (!vi && vf) return { start: vf, end: vf };
    const s = new Date(endDate.getTime());
    s.setDate(s.getDate() - 6);
    return { start: dateToLocalISODate(s), end: endToday };
  }
  if (vitalBatimentoPeriod === 'year') {
    const y = new Date().getFullYear();
    return { start: `${y}-01-01`, end: endToday };
  }
  const daysBack = vitalBatimentoPeriod === '7d' ? 6 : vitalBatimentoPeriod === '15d' ? 14 : 29;
  const startD = new Date(endDate.getTime());
  startD.setDate(startD.getDate() - daysBack);
  return { start: dateToLocalISODate(startD), end: endToday };
}

/** Resumo curto do período (batimento): evita a frase longa ??odia(s) com registro · leitura(s) · ?????. */
function updateBatimentoPeriodSummary(filtrado, startISO, endISO) {
  const el = document.getElementById('vitalDetailPeriodSummary');
  if (!el) return;
  const diasCom = new Set(
    filtrado.map((h) => String(h.data || '').slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  );
  const nDias = diasCom.size;
  const nLeit = filtrado.length;
  const p0 = formatDateForUI(startISO);
  const p1 = formatDateForUI(endISO);
  const band = typeof getBatimentoChartIdealBand === 'function' ? getBatimentoChartIdealBand() : { min: 60, max: 100 };
  const fromIndicador =
    currentVitalDetail && typeof getBatimentoIdealRangeForChart === 'function'
      ? getBatimentoIdealRangeForChart(currentVitalDetail)
      : null;
  const idealHint = fromIndicador
    ? ` · Ideal ${band.min}–${band.max} bpm`
    : ` · Ref. ${band.min}–${band.max} bpm (padrão)`;
  const modeHint = ` · Dados: ${getBatimentoContextModeLabel()}`;
  el.textContent = `${nLeit} leit. · ${nDias}d · ${p0}–${p1}${idealHint}${modeHint}`;
  el.removeAttribute('title');
  el.style.cursor = '';
  el.onclick = null;
}

function updateBatimentoChipActive() {
  document.querySelectorAll('.vital-period-chip').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-period') === vitalBatimentoPeriod);
  });
  updateBatimentoContextChip();
}

function applyVitalBatimentoView() {
  updateVitalBatimentoModalView();
}

/** Evita barra invisA-vel quando min?%^max (mesma regra no gráfico por dia e por hora). */
function expandBatimentoBarBpmRange(rawMin, rawMax, axisLo, axisHi) {
  let hi = rawMax;
  let lo = rawMin;
  if (hi <= lo || Math.abs(hi - lo) < 0.5) {
    const pad = 4;
    hi = Math.min(axisHi, rawMax + pad);
    lo = Math.max(axisLo, rawMin - pad);
    if (hi <= lo) {
      hi = rawMax + 2;
      lo = rawMin - 2;
    }
  }
  return { lo, hi };
}

/**
 * Barra vertical min–max. `roundTop` / `roundBottom` permitem empilhar segmentos (só cantos externos arredondados).
 */
function drawBatimentoRoundedRangeBar(ctx, x, top, barW, bottom, radius, fillStyle, cornerOpts) {
  const roundTop = !(cornerOpts && cornerOpts.roundTop === false);
  const roundBottom = !(cornerOpts && cornerOpts.roundBottom === false);
  const h = Math.max(1, bottom - top);
  ctx.fillStyle = fillStyle;
  if (h < 4) {
    ctx.fillRect(x, top, barW, h);
    return;
  }
  const r = Math.min(radius, barW / 2, h / 2);
  ctx.beginPath();
  if (roundTop) {
    ctx.moveTo(x + r, top);
    ctx.lineTo(x + barW - r, top);
    ctx.quadraticCurveTo(x + barW, top, x + barW, top + r);
  } else {
    ctx.moveTo(x, top);
    ctx.lineTo(x + barW, top);
  }
  if (roundBottom) {
    ctx.lineTo(x + barW, bottom - r);
    ctx.quadraticCurveTo(x + barW, bottom, x + barW - r, bottom);
    ctx.lineTo(x + r, bottom);
    ctx.quadraticCurveTo(x, bottom, x, bottom - r);
  } else {
    ctx.lineTo(x + barW, bottom);
    ctx.lineTo(x, bottom);
  }
  if (roundTop) {
    ctx.lineTo(x, top + r);
    ctx.quadraticCurveTo(x, top, x + r, top);
  } else {
    ctx.lineTo(x, top);
  }
  ctx.closePath();
  ctx.fill();
}

function getBatimentoSelectedBarIndex(rows, mode) {
  const sel = vitalBatimentoChartSelection;
  if (!sel || !rows.length) return -1;
  if (sel.kind === 'day' && mode === 'day') return rows.findIndex(([k]) => k === sel.iso);
  if (sel.kind === 'range') return rows.findIndex(([k]) => k === sel.start);
  return -1;
}

/**
 * Faixa desenhada no gráfico (fundo verde + segmentos Baixo/Normal/Alto): Meus Indicadores, ou 60–100 se não houver intervalo.
 */
function getBatimentoChartIdealBand() {
  const r = typeof getBatimentoIdealRangeForChart === 'function' ? getBatimentoIdealRangeForChart(currentVitalDetail) : null;
  if (r && Number.isFinite(r.min) && Number.isFinite(r.max) && r.max > r.min) {
    return { min: r.min, max: r.max };
  }
  return { min: 60, max: 100 };
}

/**
 * Eixo Y do gráfico: inclui todos os dados **e** a faixa ideal, para barras não ficarem ??opresas??? em 60–100.
 * A faixa ideal (verde + tracejados) continua nos BPM do indicador; o que passar para baixo/cima aparece com as cores Baixo/Normal/Alto.
 */
function getBatimentoPlotYBoundsFromDataRange(vDataMin, vDataMax) {
  const band = getBatimentoChartIdealBand();
  const imn = band.min;
  const imx = band.max;
  const hasData =
    Number.isFinite(vDataMin) &&
    Number.isFinite(vDataMax) &&
    vDataMin !== Infinity &&
    vDataMax !== -Infinity;
  let lo = hasData ? Math.min(vDataMin, vDataMax, imn, imx) : imn;
  let hi = hasData ? Math.max(vDataMin, vDataMax, imn, imx) : imx;
  if (hi <= lo) {
    lo -= 4;
    hi += 4;
  }
  let yLow = Math.max(25, Math.floor((lo - 6) / 5) * 5);
  let yHigh = Math.min(230, Math.ceil((hi + 6) / 5) * 5);
  if (yHigh - yLow < 20) {
    yLow -= 10;
    yHigh += 10;
  }
  yLow = Math.max(25, yLow);
  yHigh = Math.min(230, yHigh);
  return { yLow, yHigh };
}

/** Fundo: apenas a faixa ideal (verde claro) + linhas tracejadas nos limites – como no histórico original. */
function drawBatimentoChartIdealBackground(ctx, padL, gw, toY, yAxisLo, yAxisHi, idealMin, idealMax) {
  const imn = Math.min(idealMin, idealMax);
  const imx = Math.max(idealMin, idealMax);
  const loBpm = Math.max(yAxisLo, imn);
  const hiBpm = Math.min(yAxisHi, imx);
  if (hiBpm > loBpm) {
    const yTop = toY(hiBpm);
    const yBot = toY(loBpm);
    ctx.fillStyle = 'rgba(56, 142, 60, 0.1)';
    ctx.fillRect(padL, yTop, gw, yBot - yTop);
  }
  ctx.strokeStyle = 'rgba(46, 125, 50, 0.55)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  [imn, imx].forEach((bpm) => {
    if (bpm < yAxisLo || bpm > yAxisHi) return;
    const yy = toY(bpm);
    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(padL + gw, yy);
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

/** Baixo / Normal / Alto vs faixa ideal (lista por dia no período). */
function batimentoIdealLevelFromPeakBpm(bpm) {
  const band = getBatimentoChartIdealBand();
  const v = Number(bpm);
  if (!Number.isFinite(v)) return 'normal';
  if (v < band.min) return 'baixo';
  if (v > band.max) return 'alto';
  return 'normal';
}

function batimentoListaBgClassFromChartLevel(level) {
  switch (level) {
    case 'baixo':
      return 'vital-list-item--bc-chart-baixo';
    case 'alto':
      return 'vital-list-item--bc-chart-alto';
    default:
      return 'vital-list-item--bc-chart-normal';
  }
}

/** Trechos da barra: Baixo = laranja escuro, Normal = laranja claro, Alto = vermelho (não Ac legenda de ??ofaixa??? texto). */
function batimentoGradientForIdealSegment(ctx, x0, x1, yTop, yBot, kind) {
  const g = ctx.createLinearGradient(x0, yTop, x0, yBot);
  if (kind === 'low') {
    g.addColorStop(0, '#fdba74');
    g.addColorStop(0.45, '#ea580c');
    g.addColorStop(1, '#9a3412');
  } else if (kind === 'high') {
    g.addColorStop(0, '#ffc9c9');
    g.addColorStop(0.55, '#fa5252');
    g.addColorStop(1, '#c92a2a');
  } else {
    g.addColorStop(0, '#ffedd5');
    g.addColorStop(0.5, '#fdba74');
    g.addColorStop(1, '#fb923c');
  }
  return g;
}

/**
 * Barra min–max segmentada pelo ideal: baixo / normal / alto (cores distintas da lista por contexto).
 */
/** Barra ·nica por hora na vista Detalhado: cor = situação da medição (não Baixo/Normal/Alto). */
function batimentoGradientForHourlyContext(ctx, x0, x1, yTop, yBot, group) {
  const g = ctx.createLinearGradient(x0, yTop, x0, yBot);
  switch (group) {
    case 'sono':
      g.addColorStop(0, '#f3e8ff');
      g.addColorStop(0.55, '#c084fc');
      g.addColorStop(1, '#6b21a8');
      break;
    case 'exercicio':
      g.addColorStop(0, '#d1fae5');
      g.addColorStop(0.55, '#34d399');
      g.addColorStop(1, '#047857');
      break;
    case 'repouso':
      g.addColorStop(0, '#fefce8');
      g.addColorStop(0.55, '#fde047');
      g.addColorStop(1, '#ca8a04');
      break;
    default:
      /* Demais: fora de sono / exercício / repouso – laranja */
      g.addColorStop(0, '#ffedd5');
      g.addColorStop(0.55, '#fb923c');
      g.addColorStop(1, '#c2410c');
  }
  return g;
}

function drawBatimentoContextRangeBar(ctx, x0, barW, bpmLo, bpmHi, toY, barR, selected, contextGroup) {
  const lo = Math.min(bpmLo, bpmHi);
  const hi = Math.max(bpmLo, bpmHi);
  const yTop = toY(hi);
  const yBot = toY(lo);
  if (selected) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
  }
  const fill = batimentoGradientForHourlyContext(ctx, x0, x0 + barW, yTop, yBot, contextGroup);
  drawBatimentoRoundedRangeBar(ctx, x0, yTop, barW, yBot, barR, fill);
  ctx.shadowBlur = 0;
}

function drawBatimentoIdealSegmentedRangeBar(ctx, x0, barW, bpmLo, bpmHi, idealMin, idealMax, toY, barR, selected) {
  const lo = Math.min(bpmLo, bpmHi);
  const hi = Math.max(bpmLo, bpmHi);
  const imn = Math.min(idealMin, idealMax);
  const imx = Math.max(idealMin, idealMax);
  const segments = [];
  if (lo < imn) {
    const sHi = Math.min(hi, imn);
    if (sHi > lo) segments.push({ lo, hi: sHi, kind: 'low' });
  }
  const midLo = Math.max(lo, imn);
  const midHi = Math.min(hi, imx);
  if (midHi > midLo) segments.push({ lo: midLo, hi: midHi, kind: 'mid' });
  if (hi > imx) {
    const sLo = Math.max(lo, imx);
    if (hi > sLo) segments.push({ lo: sLo, hi, kind: 'high' });
  }
  if (segments.length === 0) return;
  const n = segments.length;
  if (selected) {
    ctx.shadowColor = 'rgba(232, 120, 40, 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
  }
  segments.forEach((seg, idx) => {
    const yTop = toY(seg.hi);
    const yBot = toY(seg.lo);
    const g = batimentoGradientForIdealSegment(ctx, x0, x0 + barW, yTop, yBot, seg.kind);
    const roundTop = idx === n - 1;
    const roundBottom = idx === 0;
    drawBatimentoRoundedRangeBar(ctx, x0, yTop, barW, yBot, barR, g, { roundTop, roundBottom });
  });
  ctx.shadowBlur = 0;
}

function aggregateHeartRateByHourForDay(entries, dayIso) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    readings: [],
    min: null,
    max: null
  }));
  (entries || []).forEach((h) => {
    if (historicoEntryDayISO(h) !== dayIso) return;
    const v = parseBatimentoHistoricoValor(h);
    if (!Number.isFinite(v)) return;
    const ms = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(h) : null;
    if (ms == null) return;
    const hour = new Date(ms).getHours();
    const b = buckets[hour];
    b.readings.push(h);
    if (b.min == null) {
      b.min = v;
      b.max = v;
    } else {
      b.min = Math.min(b.min, v);
      b.max = Math.max(b.max, v);
    }
  });
  return buckets;
}

function batimentoDayStats(entries, dayIso) {
  const dayEntries = (entries || []).filter((h) => historicoEntryDayISO(h) === dayIso);
  let minV = null;
  let maxV = null;
  let lastH = null;
  let lastMs = -Infinity;
  dayEntries.forEach((h) => {
    const v = parseBatimentoHistoricoValor(h);
    if (!Number.isFinite(v)) return;
    if (minV == null) {
      minV = maxV = v;
    } else {
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const ms = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(h) : null;
    if (ms != null && ms >= lastMs) {
      lastMs = ms;
      lastH = h;
    }
  });
  const lastVal = lastH ? parseBatimentoHistoricoValor(lastH) : null;
  const lastTime =
    lastH && lastH.hora
      ? String(lastH.hora).trim().slice(0, 5)
      : '';
  return { minV, maxV, lastVal, lastTime, dayEntries };
}

function renderBatimentoDistCanvas(minV, maxV, lastV) {
  const canvas = document.getElementById('vitalBatimentoDistCanvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(200, rect.width || canvas.parentElement?.clientWidth || 300);
  const h = 58;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const padX = 10;
  const trackH = 18;
  const trackY = (h - trackH) / 2;
  const tw = w - padX * 2;
  const band = getBatimentoChartIdealBand();
  let lo;
  let hi;
  if (minV != null && maxV != null && Number.isFinite(minV) && Number.isFinite(maxV)) {
    const r = getBatimentoPlotYBoundsFromDataRange(minV, maxV);
    lo = r.yLow;
    hi = r.yHigh;
  } else {
    const r = getBatimentoPlotYBoundsFromDataRange(band.min, band.max);
    lo = r.yLow;
    hi = r.yHigh;
  }
  const span = hi - lo || 1;
  const labLo = document.getElementById('vitalBatimentoDistLabelLo');
  const labHi = document.getElementById('vitalBatimentoDistLabelHi');
  if (labLo) labLo.textContent = String(Math.round(lo));
  if (labHi) labHi.textContent = String(Math.round(hi));
  const rTrack = 9;
  ctx.fillStyle = '#e8e8e8';
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(padX, trackY, tw, trackH, rTrack);
    ctx.fill();
  } else {
    ctx.fillRect(padX, trackY, tw, trackH);
  }
  if (minV != null && maxV != null && Number.isFinite(minV) && Number.isFinite(maxV)) {
    const a = Math.max(lo, Math.min(hi, Math.min(minV, maxV)));
    const b = Math.max(lo, Math.min(hi, Math.max(minV, maxV)));
    const x1 = padX + ((Math.min(a, b) - lo) / span) * tw;
    const x2 = padX + ((Math.max(a, b) - lo) / span) * tw;
    const segW = Math.max(6, x2 - x1);
    const gx1 = Math.max(padX, Math.min(x1, padX + tw - segW));
    const g = ctx.createLinearGradient(gx1, trackY, gx1 + segW, trackY + trackH);
    g.addColorStop(0, '#ffd4a8');
    g.addColorStop(0.5, '#fd7e14');
    g.addColorStop(1, '#e8590c');
    ctx.fillStyle = g;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(gx1, trackY + 1, segW, trackH - 2, 7);
      ctx.fill();
    } else {
      ctx.fillRect(gx1, trackY + 1, segW, trackH - 2);
    }
  }
  if (lastV != null && Number.isFinite(lastV)) {
    const lx = padX + ((Math.max(lo, Math.min(hi, lastV)) - lo) / span) * tw;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(lx, trackY - 3);
    ctx.lineTo(lx, trackY + trackH + 3);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function hideBatimentoHourlyTooltip() {
  const el = document.getElementById('vitalBatimentoHourlyTooltip');
  if (el) {
    el.style.display = 'none';
    el.textContent = '';
  }
}

function renderBatimentoHourlyRangeChart(dayIso, buckets) {
  const canvas = document.getElementById('vitalBatimentoHourlyCanvas');
  if (!canvas) return;
  canvas.onclick = null;
  window.__batimentoHourlyHit = null;
  hideBatimentoHourlyTooltip();

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(240, rect.width || canvas.parentElement?.clientWidth || 300);
  const h = 252;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const padL = 30;
  const padR = 6;
  const padT = 6;
  const padB = 22;
  const gw = w - padL - padR;
  const gh = h - padT - padB;

  let vmin = Infinity;
  let vmax = -Infinity;
  buckets.forEach((b) => {
    if (b.min == null || b.max == null || !Number.isFinite(b.min) || !Number.isFinite(b.max)) return;
    vmin = Math.min(vmin, b.min, b.max);
    vmax = Math.max(vmax, b.min, b.max);
  });
  const idealHr = getBatimentoChartIdealBand();
  const { yLow: yLo, yHigh: yHi } = Number.isFinite(vmin) && Number.isFinite(vmax)
    ? getBatimentoPlotYBoundsFromDataRange(vmin, vmax)
    : getBatimentoPlotYBoundsFromDataRange(idealHr.min, idealHr.max);
  const ySpan = yHi - yLo || 1;
  const toY = (bpm) => padT + ((yHi - bpm) / ySpan) * gh;

  drawBatimentoChartIdealBackground(ctx, padL, gw, toY, yLo, yHi, idealHr.min, idealHr.max);

  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  [yHi, yLo].forEach((yv) => {
    const yy = toY(yv);
    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(padL + gw, yy);
    ctx.stroke();
    ctx.fillStyle = '#8e8e8e';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(yv)), padL - 2, yy + 3);
  });

  const n = 24;
  const slot = gw / n;
  const barW = Math.min(14, Math.max(5, slot * 0.72));
  const barR = Math.min(6, barW / 2 - 0.5);

  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, gw, gh);
  ctx.clip();

  buckets.forEach((b, i) => {
    const cx = padL + slot * i + slot / 2;
    if (b.min == null || b.max == null || !Number.isFinite(b.min) || !Number.isFinite(b.max)) {
      const yBase = toY(yLo);
      const wTick = Math.min(4, barW * 0.35);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
      ctx.fillRect(cx - wTick / 2, yBase - 2, wTick, 2);
      return;
    }
    const { lo, hi } = expandBatimentoBarBpmRange(b.min, b.max, yLo, yHi);
    const x0 = cx - barW / 2;
    const ctxGroup = batimentoHourlyBucketContextGroup(b);
    drawBatimentoContextRangeBar(ctx, x0, barW, lo, hi, toY, barR, false, ctxGroup);
  });

  ctx.restore();

  ctx.fillStyle = '#666666';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center';
  [0, 6, 12, 18].forEach((hr) => {
    const cx = padL + slot * hr + slot / 2;
    ctx.fillText(`${hr}h`, cx, h - 6);
  });

  window.__batimentoHourlyHit = {
    w,
    h,
    padL,
    padT,
    padB,
    gw,
    gh,
    slot,
    barW,
    buckets,
    dayIso,
    toY,
    yLo,
    yHi
  };

  canvas.onclick = (e) => onVitalBatimentoHourlyCanvasClick(e);
}

function onVitalBatimentoHourlyCanvasClick(ev) {
  const canvas = document.getElementById('vitalBatimentoHourlyCanvas');
  const tip = document.getElementById('vitalBatimentoHourlyTooltip');
  const wrap = canvas && canvas.parentElement;
  const hit = window.__batimentoHourlyHit;
  if (!canvas || !tip || !wrap || !hit || !hit.buckets) return;
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const { padL, padT, gw, gh, slot, barW, buckets } = hit;
  if (x < padL || x > padL + gw || y < padT || y > hit.h - hit.padB) {
    hideBatimentoHourlyTooltip();
    return;
  }
  const idx = Math.floor((x - padL) / slot);
  if (idx < 0 || idx >= 24) return;
  const b = buckets[idx];
  if (b.min == null || b.max == null) {
    hideBatimentoHourlyTooltip();
    return;
  }
  const labelStart = `${String(idx).padStart(2, '0')}:00`;
  const labelEnd = `${String(idx).padStart(2, '0')}:59`;
  tip.innerHTML = `<strong>${labelStart} – ${labelEnd}</strong><br>${Math.round(b.min)} a ${Math.round(b.max)} bpm`;
  tip.style.display = 'block';
  const wrapRect = wrap.getBoundingClientRect();
  const tw = tip.offsetWidth || 150;
  const th = tip.offsetHeight || 44;
  let left = ev.clientX - wrapRect.left - tw / 2;
  left = Math.max(4, Math.min(left, wrapRect.width - tw - 4));
  let top = ev.clientY - wrapRect.top - th - 10;
  if (top < 4) top = Math.min(wrapRect.height - th - 4, ev.clientY - wrapRect.top + 16);
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function renderBatimentoDayDrilldown(dayIso) {
  const dateEl = document.getElementById('vitalBatimentoDayDate');
  const rangeEl = document.getElementById('vitalBatimentoDayRangeBig');
  const lastEl = document.getElementById('vitalBatimentoLastReading');
  if (!currentVitalDetail || !Array.isArray(currentVitalDetail.historico)) return;

  const inMode = filterBatimentoByContext(currentVitalDetail.historico);
  const stats = batimentoDayStats(inMode, dayIso);
  if (dateEl) dateEl.textContent = formatDateForUI(dayIso);
  if (rangeEl) {
    if (stats.minV != null && stats.maxV != null) {
      rangeEl.textContent = `${Math.round(stats.minV)} – ${Math.round(stats.maxV)} bpm`;
    } else {
      rangeEl.textContent = '–';
    }
  }
  if (lastEl) {
    if (stats.lastVal != null && Number.isFinite(stats.lastVal)) {
      lastEl.style.display = 'block';
      lastEl.textContent = `Asltima leitura: ${Math.round(stats.lastVal)} bpm${stats.lastTime ? ` · ${stats.lastTime}` : ''}`;
    } else {
      lastEl.style.display = 'none';
      lastEl.textContent = '';
    }
  }

  renderBatimentoDistCanvas(stats.minV, stats.maxV, stats.lastVal);

  // Painel repouso: mín/máx das leituras com contextoColeta === 'repouso' no dia
  const repousoEl = document.getElementById('vitalBatimentoRepousoRange');
  if (repousoEl) {
    const repLeituras = inMode.filter(
      (h) => historicoEntryDayISO(h) === dayIso && h.contextoColeta === 'repouso'
    );
    if (repLeituras.length > 0) {
      const vals = repLeituras.map(parseBatimentoHistoricoValor).filter(Number.isFinite);
      if (vals.length > 0) {
        const rMin = Math.round(Math.min(...vals));
        const rMax = Math.round(Math.max(...vals));
        repousoEl.textContent = `Repouso: ${rMin} – ${rMax} bpm`;
        repousoEl.style.display = 'block';
      } else {
        repousoEl.style.display = 'none';
      }
    } else {
      repousoEl.style.display = 'none';
    }
  }

  const buckets = aggregateHeartRateByHourForDay(inMode, dayIso);
  renderBatimentoHourlyRangeChart(dayIso, buckets);
}

/** Título do modal: "Detalhado" na vista dia; "Histórico de ?– no período. */
function updateVitalBatimentoModalTitle() {
  const el = document.getElementById('vitalDetailTitle');
  if (!el || !currentVitalDetail || currentVitalDetail.tipo !== 'Batimento Cardíaco') return;
  const base =
    typeof window.__vitalDetailModalTipoLabel === 'string' ? window.__vitalDetailModalTipoLabel : 'Batimento Cardíaco';
  if (vitalBatimentoChartSelection && vitalBatimentoChartSelection.kind === 'day') {
    el.textContent = 'Detalhado por hora';
  } else {
    el.textContent = `Histórico de ${base}`;
  }
}

function syncBatimentoChromePanels() {
  const periodScope = document.getElementById('vitalBatimentoPeriodScope');
  const dayScope = document.getElementById('vitalBatimentoDayScope');
  const backBtn = document.getElementById('vitalBatimentoHeaderBackBtn');
  const listEl = document.getElementById('vitalDetailContent');
  const modalContent = document.querySelector('#vitalDetailModal .modal-content');
  if (!periodScope || !dayScope) return;
  const iso = vitalBatimentoChartSelection && vitalBatimentoChartSelection.kind === 'day' ? vitalBatimentoChartSelection.iso : null;
  if (backBtn) backBtn.hidden = !iso;
  if (listEl) listEl.classList.toggle('vital-detail-content--batimento-day', !!iso);
  if (modalContent) modalContent.classList.toggle('vital-detail-modal-content--batimento-day', !!iso);
  if (iso) {
    periodScope.style.display = 'none';
    dayScope.style.display = 'block';
    renderBatimentoDayDrilldown(iso);
  } else {
    periodScope.style.display = 'block';
    dayScope.style.display = 'none';
    hideBatimentoHourlyTooltip();
  }
  updateVitalBatimentoModalTitle();
}

function renderBatimentoDailyBarChart(historico, rangeOpts) {
  const canvas = document.getElementById('vitalBatimentoDailyCanvas');
  const hintEl = document.getElementById('vitalBatimentoChartHint');
  if (!canvas) return;

  if (vitalBatimentoChartSelection && vitalBatimentoChartSelection.kind === 'day') {
    canvas.onclick = null;
    window.__batimentoChartHit = null;
    return;
  }

  canvas.onclick = null;
  window.__batimentoChartHit = null;

  const start = rangeOpts && rangeOpts.start;
  const end = rangeOpts && rangeOpts.end;
  const periodKey = rangeOpts && rangeOpts.period;

  const picked =
    start && end
      ? pickBatimentoChartRows(historico, start, end, periodKey)
      : { rows: aggregateHeartRateByDay(historico), mode: 'day' };
  let { rows, mode } = picked;

  if (rows.length === 0 && historico.length > 0) {
    rows = aggregateHeartRateByDay(historico);
    mode = 'day';
  }

  if (hintEl) {
    if (rows.length === 0) {
      hintEl.style.display = 'none';
      hintEl.textContent = '';
    } else {
      hintEl.style.display = 'block';
      if (mode === 'day') {
        hintEl.textContent = 'Toque numa coluna ou num dia na lista para ver o detalhe.';
      } else if (mode === 'week') {
        hintEl.textContent = 'Toque numa coluna ou num período na lista para ver o detalhe.';
      } else {
        hintEl.textContent = 'Toque numa coluna ou num período na lista para ver o detalhe.';
      }
    }
  }

  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(240, rect.width || canvas.parentElement?.clientWidth || 300);
  const h = 204;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const padL = 34;
  const padR = 4;
  const padT = 6;
  const padB = 22;
  const gw = w - padL - padR;
  const gh = h - padT - padB;

  if (rows.length === 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados numéricos no período', w / 2, h / 2);
    return;
  }

  let vmin = Infinity;
  let vmax = -Infinity;
  let hasNumericBar = false;
  rows.forEach(([, o]) => {
    if (o.min == null || o.max == null || !Number.isFinite(o.min) || !Number.isFinite(o.max)) return;
    hasNumericBar = true;
    vmin = Math.min(vmin, o.min, o.max);
    vmax = Math.max(vmax, o.min, o.max);
  });
  const bandRef = getBatimentoChartIdealBand();
  const { yLow, yHigh } = hasNumericBar
    ? getBatimentoPlotYBoundsFromDataRange(vmin, vmax)
    : getBatimentoPlotYBoundsFromDataRange(bandRef.min, bandRef.max);
  const yRange = yHigh - yLow || 1;
  const toY = (bpm) => padT + ((yHigh - bpm) / yRange) * gh;

  const idealDay = getBatimentoChartIdealBand();
  drawBatimentoChartIdealBackground(ctx, padL, gw, toY, yLow, yHigh, idealDay.min, idealDay.max);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 1;
  [yHigh, yLow].forEach((yv) => {
    const yy = toY(yv);
    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(padL + gw, yy);
    ctx.stroke();
  });
  ctx.fillStyle = '#8e8e8e';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.round(yHigh)), padL - 6, toY(yHigh));
  ctx.fillText(String(Math.round(yLow)), padL - 6, toY(yLow));
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const n = rows.length;
  const slot = gw / Math.max(n, 1);
  const barW = Math.min(26, Math.max(5, slot * 0.62));
  const selIdx = getBatimentoSelectedBarIndex(rows, mode);
  const barR = Math.min(8, barW / 2 - 0.5);

  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, gw, gh);
  ctx.clip();

  rows.forEach(([, o], i) => {
    const cx = padL + slot * i + slot / 2;
    const x0 = cx - barW / 2;
    const selected = i === selIdx;
    if (o.min == null || o.max == null || !Number.isFinite(o.min) || !Number.isFinite(o.max)) {
      const stubTopBpm = yLow + (yHigh - yLow) * 0.28;
      const yTop = toY(stubTopBpm);
      const yBot = toY(yLow);
      const stubFill = selected ? 'rgba(180, 180, 180, 0.55)' : 'rgba(0, 0, 0, 0.1)';
      drawBatimentoRoundedRangeBar(ctx, x0, yTop, barW, yBot, Math.min(barR, 4), stubFill);
      return;
    }
    const { lo: bpmLo, hi: bpmHi } = expandBatimentoBarBpmRange(o.min, o.max, yLow, yHigh);
    drawBatimentoIdealSegmentedRangeBar(
      ctx,
      x0,
      barW,
      bpmLo,
      bpmHi,
      idealDay.min,
      idealDay.max,
      toY,
      barR,
      selected
    );
  });

  ctx.restore();

  const maxLabels = 9;
  const labelEvery = Math.max(1, Math.ceil(n / maxLabels));
  ctx.fillStyle = '#666666';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center';
  rows.forEach(([day], i) => {
    if (i % labelEvery !== 0 && i !== n - 1) return;
    const cx = padL + slot * i + slot / 2;
    const parts = String(day).split('-');
    const short = parts.length === 3 ? String(Number(parts[2])) : day;
    ctx.fillText(short, cx, h - 3);
  });

  window.__batimentoChartHit = {
    w,
    h,
    padL,
    padR,
    padT,
    padB,
    gw,
    gh,
    n,
    slot,
    barW,
    rows,
    mode
  };

  canvas.onclick = (e) => onVitalBatimentoCanvasClick(e);
}

/** Janela de agregação do gráfico de FC no detalhe de exercício (2 min). */
const EXERCICIO_HR_BUCKET_SEC = 120;

function interpBpmFromAmostras(sorted, tSec) {
  const n = sorted.length;
  if (n === 0) return null;
  if (tSec <= sorted[0].offsetSec) return sorted[0].bpm;
  if (tSec >= sorted[n - 1].offsetSec) return sorted[n - 1].bpm;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].offsetSec <= tSec) lo = mid;
    else hi = mid;
  }
  const a = sorted[lo];
  const b = sorted[hi];
  const u = (tSec - a.offsetSec) / (b.offsetSec - a.offsetSec || 1);
  return a.bpm + u * (b.bpm - a.bpm);
}

/** Uma barra por janela de 2 min: FC no instante mAcdio da janela (interpolação entre amostras). */
function buildExercicioHrBarSeries(sessao) {
  const amp = sessao.amostras;
  const lastOff = amp[amp.length - 1].offsetSec;
  const dur = Math.max(1, sessao.duracaoSegundos || lastOff || 1);
  const sorted = [...amp].sort((x, y) => x.offsetSec - y.offsetSec);
  const nBuckets = Math.max(1, Math.ceil(dur / EXERCICIO_HR_BUCKET_SEC));
  const vals = [];
  for (let i = 0; i < nBuckets; i++) {
    const t0 = i * EXERCICIO_HR_BUCKET_SEC;
    const t1 = Math.min((i + 1) * EXERCICIO_HR_BUCKET_SEC, dur);
    const center = (t0 + t1) / 2;
    vals.push(interpBpmFromAmostras(sorted, center));
  }
  return { vals, dur, nBuckets };
}

function renderExercicioHrCanvas(sessao) {
  const canvas = document.getElementById('exercicioHrCanvas');
  if (!canvas || !sessao || !sessao.amostras || sessao.amostras.length === 0) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(280, rect.width || canvas.parentElement.clientWidth || 320);
  const h = 200;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const { vals, dur, nBuckets } = buildExercicioHrBarSeries(sessao);
  const minB = Math.min(...vals) - 5;
  const maxB = Math.max(...vals) + 5;
  const range = maxB - minB || 1;

  const pad = 14;
  const graphW = w - pad * 2;
  const graphH = h - pad * 2;
  const toY = (bpm) => pad + graphH - ((bpm - minB) / range) * graphH;
  const yBase = pad + graphH;

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, w, h);

  const slotW = graphW / nBuckets;
  const barW = Math.max(2, slotW * 0.62);
  const gap = (slotW - barW) / 2;

  ctx.fillStyle = '#6e6e6e';
  vals.forEach((bpm, i) => {
    const x = pad + i * slotW + gap;
    const yTop = toY(bpm);
    const hBar = yBase - yTop;
    if (hBar <= 0) return;
    const r = Math.min(4, barW / 2 - 0.5);
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, yTop, barW, hBar, r);
      ctx.fill();
    } else {
      ctx.fillRect(x, yTop, barW, hBar);
    }
  });
}

function openVitalDetailModal(tipoVital, vitalId) {
  currentVitalDetail = mockData.sinaisVitais.find(v => v.id === vitalId);

  if (!currentVitalDetail) return;

  if (tipoVital === 'Batimento Cardíaco' && typeof stripDemoMedicoesUltimas24h === 'function' && typeof injectDemoMedicoesUltimas24h === 'function') {
    stripDemoMedicoesUltimas24h(mockData);
    injectDemoMedicoesUltimas24h(mockData);
    currentVitalDetail = mockData.sinaisVitais.find((v) => v.id === vitalId);
    if (!currentVitalDetail) return;
  }
  if (tipoVital === 'Batimento Cardíaco') {
    syncCurrentBatimentoVitalFromMockData();
  }

  window.__vitalDetailModalTipoLabel = tipoVital;
  document.getElementById('vitalDetailTitle').textContent = tipoVital === 'Passos' ? tipoVital : (tipoVital === 'Glicemia' ? 'Glicose no Sangue' : `Histórico de ${tipoVital}`);
  document.getElementById('vitalDetailSubtitle').textContent = '';
  document.getElementById('filterVitalDataInicio').value = '';
  document.getElementById('filterVitalDataFim').value = '';

  const bc = tipoVital === 'Batimento Cardíaco';
  const isPressao = tipoVital === 'Pressão Arterial';
  const isPassos = tipoVital === 'Passos';
  const isGlicemia = tipoVital === 'Glicemia';
  const isSono = tipoVital === 'Sono';
  const isOxig = tipoVital === 'Oxigenação';
  const isHidra = tipoVital === 'Hidratação';
  const bcChrome = document.getElementById('vitalDetailBatimentoChrome');
  const defChrome = document.getElementById('vitalDetailDefaultChrome');
  const batimentoBackBtn = document.getElementById('vitalBatimentoHeaderBackBtn');
  const defaultPeriodControls = document.getElementById('vitalDefaultPeriodControls');
  const defaultDateFilterRow = document.getElementById('vitalDefaultDateFilterRow');
  const defaultLivreRow = document.getElementById('vitalDefaultLivreRow');
  const pressaoHistoricoView = document.getElementById('pressaoHistoricoView');

  // Share button (Batimento only) + spacer placeholder
  const shareBtn = document.getElementById('batShareBtn');
  const spacer = document.getElementById('vitalDetailHeaderSpacer');
  if (shareBtn) shareBtn.style.display = bc ? 'flex' : 'none';
  if (spacer) spacer.style.display = bc ? 'none' : 'flex';

  if (bcChrome) bcChrome.style.display = bc ? 'block' : 'none';
  if (defChrome) defChrome.style.display = bc ? 'none' : 'block';
  if (batimentoBackBtn && !bc) batimentoBackBtn.hidden = true;
  if (defaultPeriodControls) defaultPeriodControls.style.display = !bc && (isPressao || isPassos || isGlicemia || isSono || isOxig || isHidra) ? 'block' : 'none';
  if (defaultDateFilterRow) defaultDateFilterRow.style.display = !bc && !isPressao && !isPassos && !isGlicemia && !isSono && !isOxig && !isHidra ? 'block' : 'none';

  const vitalDetailContentEl = document.getElementById('vitalDetailContent');
  const vitalDetailAddRowEl = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (vitalDetailContentEl) vitalDetailContentEl.style.display = bc ? 'none' : '';
  if (vitalDetailAddRowEl) vitalDetailAddRowEl.style.display = (bc || isPassos) ? 'none' : '';

  if (pressaoHistoricoView) pressaoHistoricoView.style.display = 'block';

  // Reset all sub-views whenever opening a new vital modal
  var _pdv = document.getElementById('pressaoDiaDetailView');
  if (_pdv) _pdv.style.display = 'none';
  var _pcv = document.getElementById('pressaoColetaDetailView');
  if (_pcv) _pcv.style.display = 'none';
  var _passv = document.getElementById('passosDiaDetailView');
  if (_passv) _passv.style.display = 'none';
  var _giv = document.getElementById('glicemiaInsertView');
  if (_giv) _giv.style.display = 'none';
  var _hiv = document.getElementById('hidraInsertView');
  if (_hiv) _hiv.style.display = 'none';
  var _oiv = document.getElementById('oxigInsertView');
  if (_oiv) _oiv.style.display = 'none';
  var _odv = document.getElementById('oxigenacaoDiaDetailView');
  if (_odv) _odv.style.display = 'none';
  window._pressaoDiaActive = false;
  window._pressaoColetaActive = false;
  window._passaosDiaActive = false;
  window._glicemiaInsertActive = false;
  window._oxigenacaoDiaActive = false;
  if (vitalDetailContentEl) vitalDetailContentEl.style.display = bc ? 'none' : '';
  if (vitalDetailAddRowEl) vitalDetailAddRowEl.style.display = (bc || isPassos) ? 'none' : '';

  if (bc) {
    vitalBatimentoChartSelection = null;
    vitalBatimentoPeriod = '7d';
    vitalBatimentoContextMode = 'all';
    batimentoSelectedDayISO = getTodayISODate(); // reset para hoje ao abrir
    const livreRow = document.getElementById('vitalBatimentoLivreRow');
    if (livreRow) livreRow.style.display = 'none';
    const di = document.getElementById('filterBatimentoLivreInicio');
    const df = document.getElementById('filterBatimentoLivreFim');
    const end = getTodayISODate();
    if (di && df) {
      const s = localNoonFromISODate(end);
      s.setDate(s.getDate() - 6);
      di.value = dateToLocalISODate(s);
      df.value = end;
    }
    updateBatimentoChipActive();
  } else {
    const summaryEl = document.getElementById('vitalDetailPeriodSummary');
    if (summaryEl) {
      summaryEl.onclick = null;
      summaryEl.style.cursor = '';
      summaryEl.removeAttribute('title');
    }
    if (isPressao || isPassos || isGlicemia || isSono || isOxig || isHidra) {
      vitalDefaultPeriod = '7d';
      if (isPassos) {
        passosSelectedDayIso = null;
        passosSelectedHour = null;
      }
      if (isGlicemia) {
        glicemiaSelectedDayIso = null;
      }
      if (defaultLivreRow) defaultLivreRow.style.display = 'none';
      const di = document.getElementById('filterVitalLivreInicio');
      const df = document.getElementById('filterVitalLivreFim');
      if (di && df) {
        di.value = '';
        df.value = '';
      }
      updateVitalDefaultPeriodChipActive();
      applyVitalDefaultPeriodView();
    } else {
      renderVitalDetailContent(currentVitalDetail.historico);
      renderSparklineChart(currentVitalDetail.historico);
    }
  }

  document.getElementById('vitalDetailModal').classList.add('active');
  setGlobalHeaderVisible(false);

  if (bc) {
    updateVitalBatimentoModalView();
    requestAnimationFrame(() => {
      if (!currentVitalDetail || currentVitalDetail.tipo !== 'Batimento Cardíaco') return;
      const { start, end } = getBatimentoPeriodRange();
      const inPeriod = filterHistoricoByInclusiveDate(currentVitalDetail.historico, start, end);
      const filtrado = filterBatimentoByContext(inPeriod);
      renderBatimentoChromeCharts(filtrado, start, end);
    });
  }

  document.getElementById('addVitalMedicaoBtn').onclick = function() {
    if (tipoVital === 'Glicemia') {
      openAddGlicemiaWizard();
    } else if (tipoVital === 'Hidratação') {
      openHidraInsertView();
    } else if (tipoVital === 'Oxigenação') {
      openOxigInsertView();
    } else {
      openAddVitalModal(tipoVital);
    }
  };
}

function openPressaoDiaDetail(dayIso, entries) {
  const view = document.getElementById('pressaoDiaDetailView');
  if (!view) return;

  const contentEl = document.getElementById('vitalDetailContent');
  if (contentEl) contentEl.style.display = 'none';
  const addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (addRow) addRow.style.display = 'none';
  view.style.display = 'block';

  // Date label
  const [_y, _m, _d] = dayIso.split('-').map(Number);
  const _dateObj = new Date(_y, _m - 1, _d);
  const _dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const _meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const dateLabel = `${_dias[_dateObj.getDay()]}, ${String(_d).padStart(2, '0')} ${_meses[_m - 1]}`;
  const labelEl = document.getElementById('pressaoDiaDetailLabel');
  if (labelEl) labelEl.textContent = dateLabel;

  window._pressaoDiaActive = true;
  window._pressaoDiaLabel = dateLabel;
  const _titleEl = document.getElementById('vitalDetailTitle');
  if (_titleEl) _titleEl.textContent = dateLabel;

  const pares = entries.map(h => typeof parseHistoricoPressurePair === 'function' ? parseHistoricoPressurePair(h) : null).filter(Boolean);
  const minS = pares.length ? Math.min(...pares.map(p => p.s)) : null;
  const maxS = pares.length ? Math.max(...pares.map(p => p.s)) : null;
  const minD = pares.length ? Math.min(...pares.map(p => p.d)) : null;
  const maxD = pares.length ? Math.max(...pares.map(p => p.d)) : null;
  const sRange = pares.length ? (minS === maxS ? String(maxS) : `${minS} – ${maxS}`) : '–';
  const dRange = pares.length ? (minD === maxD ? String(minD) : `${minD} – ${maxD}`) : '–';

  const mmEl = document.getElementById('pressaoDiaMinMax');
  if (mmEl) {
    mmEl.style.flexDirection = 'column';
    mmEl.style.alignItems = 'center';
    mmEl.style.justifyContent = 'center';
    mmEl.style.gap = '12px';
    mmEl.style.padding = '20px 24px';
    mmEl.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:7px;">
        <span style="color:#f59e0b;font-weight:700;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;">SIS.</span>
        <span style="color:#0f172a;font-weight:700;font-size:29px;line-height:1;">${sRange}</span>
        <span style="color:#94a3b8;font-size:16px;">mmHg</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:7px;">
        <span style="color:#3b82f6;font-weight:700;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;">DIA.</span>
        <span style="color:#0f172a;font-weight:700;font-size:29px;line-height:1;">${dRange}</span>
        <span style="color:#94a3b8;font-size:16px;">mmHg</span>
      </div>`;
  }

  const listEl = document.getElementById('pressaoDiaReadingsList');
  if (listEl) {
    const sorted = entries.slice().sort((a, b) => {
      const ta = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(a) : 0;
      const tb = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(b) : 0;
      return tb - ta;
    });
    pressaoColetaEntries = sorted;
    pressaoColetaDayIso = dayIso;
    pressaoDiaShowAll = false;
    _renderPressaoDiaColetaList();
  }
}

function _renderPressaoDiaColetaList() {
  const listEl = document.getElementById('pressaoDiaReadingsList');
  if (!listEl || !pressaoColetaEntries.length) return;

  const LIMIT = 3;
  const toShow = pressaoDiaShowAll ? pressaoColetaEntries : pressaoColetaEntries.slice(0, LIMIT);
  const hiddenCount = pressaoColetaEntries.length - LIMIT;
  const hasMore = !pressaoDiaShowAll && hiddenCount > 0;

  const _svgNote = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  const _svgMed  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7.07-7.07l-10 10a4.95 4.95 0 1 0 7.07 7.07Z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>`;
  const _svgChev = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  listEl.innerHTML = toShow.map((h, _idx) => {
    const hora = h.hora ? String(h.hora).trim().slice(0, 5) : '--:--';
    const valorFormatado = typeof formatHistoricValue === 'function' ? formatHistoricValue(currentVitalDetail?.tipo, h) : h.valor;
    const hr = getHeartRateForPressureEntry(h);
    const hrLabel = Number.isFinite(hr) ? `${Math.round(hr)} bpm` : '';

    const hasNota = h.anotacao && String(h.anotacao).trim().length > 0;
    const hasMed = h.medicamentoPressao && h.medicamentoPressao !== 'nenhum';

    const icons = [
      hasMed  ? `<span class="pc-icon" title="Remédio tomado">${_svgMed}</span>`   : '',
      hasNota ? `<span class="pc-icon" title="${String(h.anotacao).trim()}">${_svgNote}</span>` : '',
    ].filter(Boolean).join('');

    return `
      <div class="pressao-coleta-item pressao-coleta-item--clickable" onclick="openPressaoColetaDetail(${_idx})">
        <div class="pc-body">
          <div class="pc-valor-row">
            <span class="pc-valor">${valorFormatado}</span>
            <span class="pc-unit">mmHg</span>
            ${hrLabel ? `<span class="pc-fc">♥ ${hrLabel}</span>` : ''}
          </div>
          <div class="pc-hora">${hora}</div>
        </div>
        <div class="pc-right">
          ${icons ? `<div class="pc-icons">${icons}</div>` : ''}
          <span class="pressao-coleta-chevron">${_svgChev}</span>
        </div>
      </div>`;
  }).join('') + (hasMore
    ? `<button class="pressao-ver-mais-btn" onclick="pressaoColetaShowMore()">Ver mais ${hiddenCount > 1 ? `(+${hiddenCount})` : ''}</button>`
    : '');
}

function pressaoColetaShowMore() {
  pressaoDiaShowAll = true;
  _renderPressaoDiaColetaList();
}

function closePressaoDiaDetail() {
  window._pressaoDiaActive = false;
  const _titleEl = document.getElementById('vitalDetailTitle');
  if (_titleEl && currentVitalDetail) _titleEl.textContent = 'Histórico de ' + currentVitalDetail.tipo;

  pressaoSelectedDay = null;
  const _dCanvas = document.getElementById('sparklineChart');
  if (_dCanvas && typeof _dCanvas.__drawPressao === 'function') _dCanvas.__drawPressao();
  const view = document.getElementById('pressaoDiaDetailView');
  if (view) view.style.display = 'none';

  // For Pressão Arterial the main view is the sparkline – vitalDetailContent stays hidden
  const _isPressao = currentVitalDetail && currentVitalDetail.tipo === 'Pressão Arterial';
  if (!_isPressao) {
    const contentEl = document.getElementById('vitalDetailContent');
    if (contentEl) contentEl.style.display = '';
    const addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
    if (addRow) addRow.style.display = '';
  } else {
    // Ensure the sparkline chart area is visible
    const _sparkView = document.getElementById('pressaoHistoricoView');
    if (_sparkView) _sparkView.style.display = '';
    const filters = document.getElementById('vitalDefaultPeriodControls');
    if (filters) filters.style.display = '';
  }
}

function openPressaoColetaDetail(idx) {
  const h = pressaoColetaEntries[idx];
  if (!h) return;

  const diaView = document.getElementById('pressaoDiaDetailView');
  if (diaView) diaView.style.display = 'none';
  const coletaView = document.getElementById('pressaoColetaDetailView');
  if (!coletaView) return;
  coletaView.style.display = 'block';
  window._pressaoColetaActive = true;

  // Hide chart + period filters while in reading detail
  const _chartArea = document.getElementById('pressaoHistoricoView');
  if (_chartArea) _chartArea.style.display = 'none';
  const _periodControls = document.getElementById('vitalDefaultPeriodControls');
  if (_periodControls) _periodControls.style.display = 'none';

  // Label: "Sex, 08 mai" (sem horário); navbar: "Pressão Arterial" + horário no subtitle
  const hora = h.hora ? String(h.hora).trim().slice(0, 5) : '--:--';
  const labelEl = document.getElementById('pressaoColetaDetailLabel');
  if (labelEl && pressaoColetaDayIso) {
    const [_y, _m, _d] = pressaoColetaDayIso.split('-').map(Number);
    const _dateObj = new Date(_y, _m - 1, _d);
    const _dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const _meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const _dateLabel = `${_dias[_dateObj.getDay()]}, ${String(_d).padStart(2, '0')} ${_meses[_m - 1]}`;
    labelEl.textContent = _dateLabel;
    const _titleEl = document.getElementById('vitalDetailTitle');
    if (_titleEl) _titleEl.textContent = 'Pressão Arterial';
    const _subtitleEl = document.getElementById('vitalDetailSubtitle');
    if (_subtitleEl) _subtitleEl.textContent = hora;
  }

  const pair = typeof parseHistoricoPressurePair === 'function' ? parseHistoricoPressurePair(h) : null;
  const hr = getHeartRateForPressureEntry(h);
  const hrLabel = Number.isFinite(hr) ? `${Math.round(hr)} bpm` : null;
  const medTomado = h.medicamentoPressao === 'tomados';

  const nota = (h.anotacao && String(h.anotacao).trim().length > 0)
    ? String(h.anotacao).trim()
    : null;

  const medIconHtml = medTomado
    ? `<span class="pressao-det-med-icon" title="Medicação tomada"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7.07-7.07l-10 10a4.95 4.95 0 1 0 7.07 7.07Z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg></span>`
    : '';

  const contentEl = document.getElementById('pressaoColetaDetailContent');
  if (contentEl) {
    contentEl.innerHTML = `
      <div class="pressao-coleta-det-card">
        <div class="pressao-coleta-det-row">
          <div class="pressao-coleta-det-metric">
            <span class="pressao-coleta-det-label pressao-coleta-det-label--sis">SIS.</span>
            <span class="pressao-coleta-det-value">${pair ? pair.s : '–'}</span>
          </div>
          <div class="pressao-coleta-det-center">
            <span class="pressao-coleta-det-unit">/</span>
          </div>
          <div class="pressao-coleta-det-metric">
            <span class="pressao-coleta-det-label pressao-coleta-det-label--dia">DIA.</span>
            <span class="pressao-coleta-det-value">${pair ? pair.d : '–'}</span>
          </div>
        </div>
        <div class="pressao-coleta-det-unit-row">mmHg</div>
        ${hrLabel ? `<div class="pressao-coleta-det-hr"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span>${hrLabel}</span>${medIconHtml}</div>` : ''}
      </div>
      ${nota ? `
      <div class="pressao-nota-card">
        <div class="pressao-nota-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>Nota</span>
        </div>
        <p class="pressao-nota-text">${nota}</p>
      </div>` : ''}`;
  }
}

function closePressaoColetaDetail() {
  window._pressaoColetaActive = false;
  const _titleEl = document.getElementById('vitalDetailTitle');
  if (_titleEl && window._pressaoDiaLabel) _titleEl.textContent = window._pressaoDiaLabel;
  const _subtitleEl = document.getElementById('vitalDetailSubtitle');
  if (_subtitleEl) _subtitleEl.textContent = '';

  const coletaView = document.getElementById('pressaoColetaDetailView');
  if (coletaView) coletaView.style.display = 'none';
  // Restore chart + period filters
  const _chartArea = document.getElementById('pressaoHistoricoView');
  if (_chartArea) _chartArea.style.display = '';
  const _periodControls = document.getElementById('vitalDefaultPeriodControls');
  if (_periodControls) _periodControls.style.display = '';
  const diaView = document.getElementById('pressaoDiaDetailView');
  if (diaView) diaView.style.display = 'block';
}

/* ?"–? Inserção manual de pressão arterial ?"–––––––––––––––––––––––––––––––––––? */
let pressaoInsertStep = 1;
let pressaoInsertData = { sis: 120, dia: 80, hr: 72, med: 'nenhum', nota: '' };
var hidraInsertData = { ml: 250 };
let _piStepTimer = null;
var PI_DRUM_IH = 72; // height per drum slot (px) – 5-slot full-screen drum
var _piDrumDrag = null;
var _piReturnToSummary = false;

function openPressaoInsertForm() {
  pressaoInsertStep = 1;
  pressaoInsertData = { sis: 120, dia: 80, hr: 72, med: 'nenhum', nota: '' };

  const diaView = document.getElementById('pressaoDiaDetailView');
  if (diaView) diaView.style.display = 'none';
  const chart = document.getElementById('pressaoHistoricoView');
  if (chart) chart.style.display = 'none';
  const filters = document.getElementById('vitalDefaultPeriodControls');
  if (filters) filters.style.display = 'none';

  const insertView = document.getElementById('pressaoInsertView');
  if (insertView) insertView.style.display = 'flex';

  // Navigation flag
  window._pressaoDiaActive = false;
  window._pressaoInsertActive = true;
  const _titleEl = document.getElementById('vitalDetailTitle');
  if (_titleEl) _titleEl.textContent = 'Inserir Medição';

  // Reset input overlays
  ['sis','dia','hr'].forEach(function(f) {
    var inp = document.getElementById('piDcInput-' + f);
    if (inp) { inp.style.pointerEvents = 'none'; inp.style.opacity = '0'; }
  });

  _pressaoInsRender();
}

function closePressaoInsertForm() {
  stopStepPA();
  const insertView = document.getElementById('pressaoInsertView');
  if (insertView) insertView.style.display = 'none';

  window._pressaoInsertActive = false;

  if (pressaoSelectedDay) {
    // Return to the day-detail view
    window._pressaoDiaActive = true;
    const _dLabel = document.getElementById('pressaoDiaDetailLabel');
    const _titleEl = document.getElementById('vitalDetailTitle');
    if (_titleEl && _dLabel) _titleEl.textContent = _dLabel.textContent;
    const diaView = document.getElementById('pressaoDiaDetailView');
    if (diaView) diaView.style.display = 'block';
    // chart + filters stay hidden (dia detail is showing)
  } else {
    // No day selected – return to main chart
    const chart = document.getElementById('pressaoHistoricoView');
    if (chart) chart.style.display = '';
    const filters = document.getElementById('vitalDefaultPeriodControls');
    if (filters) filters.style.display = '';
    const _titleEl = document.getElementById('vitalDetailTitle');
    if (_titleEl && currentVitalDetail) _titleEl.textContent = 'Histórico de ' + currentVitalDetail.tipo;
  }
}

function pressaoInsGo(step) {
  stopStepPA();
  // Capture nota text before leaving step 4
  if (pressaoInsertStep === 4) {
    var _ta = document.getElementById('piNotaInput');
    if (_ta) pressaoInsertData.nota = _ta.value.trim();
  }
  if (step < 1) { closePressaoInsertForm(); return; }
  if (step > 5) { pressaoInsSave(); return; }
  // If user was editing from summary, jump straight back to step 5
  if (_piReturnToSummary && step < 5) {
    _piReturnToSummary = false;
    pressaoInsertStep = 5;
    _pressaoInsRender();
    return;
  }
  pressaoInsertStep = step;
  _pressaoInsRender();
}

function piSumEdit(step) {
  _piReturnToSummary = true;
  stopStepPA();
  pressaoInsertStep = step;
  _pressaoInsRender();
}

function _pressaoInsRender() {
  var s = pressaoInsertStep;
  [1, 2, 3, 4, 5].forEach(function(i) {
    var el = document.getElementById('piStep' + i);
    if (el) el.style.display = i === s ? 'flex' : 'none';
    var dot = document.querySelector('[data-pidot="' + i + '"]');
    if (dot) {
      if (i <= s) dot.classList.add('pi-progress-dot--active');
      else dot.classList.remove('pi-progress-dot--active');
    }
  });
  if (s === 1) { _piDrumRender('sis'); _piDrumRender('dia'); }
  if (s === 2) { _piDrumRender('hr'); }
  if (s === 3) { _pressaoInsMedSync(); }
  if (s === 4) {
    var ta = document.getElementById('piNotaInput');
    if (ta) { ta.value = pressaoInsertData.nota || ''; setTimeout(function() { ta.focus(); }, 80); }
  }
  if (s === 5) { _piRenderSummary(); }
}

function _piRenderSummary() {
  var el = document.getElementById('piSummaryContent');
  if (!el) return;
  var medMap = { tomados: 'Tomei os rem\u00e9dios', nao_tomados: 'N\u00e3o tomei hoje', nenhum: 'N\u00e3o tomo rem\u00e9dios' };
  var nota = pressaoInsertData.nota && pressaoInsertData.nota.trim() ? pressaoInsertData.nota.trim() : '\u2014';
  var svgBP = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><polyline stroke-linecap="round" stroke-linejoin="round" points="2 12 6 12 8 5 11 19 13 12 15 9 17 15 19 12 22 12"/></svg>';
  var svgHR = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"/></svg>';
  el.innerHTML =
    '<div class="pi-sum-row" onclick="piSumEdit(1)">' +
      '<div class="pi-sum-ico pi-sum-ico--bp">' + svgBP + '</div>' +
      '<div class="pi-sum-body">' +
        '<div class="pi-sum-lbl">Press\u00e3o Arterial</div>' +
        '<div class="pi-sum-val">' + pressaoInsertData.sis + '/' + pressaoInsertData.dia + ' <span class="pi-sum-unit">mmHg</span></div>' +
      '</div>' +
      '<div class="pi-sum-edit">Editar</div>' +
    '</div>' +
    '<div class="pi-sum-row" onclick="piSumEdit(2)">' +
      '<div class="pi-sum-ico pi-sum-ico--hr">' + svgHR + '</div>' +
      '<div class="pi-sum-body">' +
        '<div class="pi-sum-lbl">Frequ\u00eancia Card\u00edaca</div>' +
        '<div class="pi-sum-val">' + pressaoInsertData.hr + ' <span class="pi-sum-unit">bpm</span></div>' +
      '</div>' +
      '<div class="pi-sum-edit">Editar</div>' +
    '</div>' +
    '<div class="pi-sum-row" onclick="piSumEdit(3)">' +
      '<div class="pi-sum-ico pi-sum-ico--med">\uD83D\uDC8A</div>' +
      '<div class="pi-sum-body">' +
        '<div class="pi-sum-lbl">Rem\u00e9dios</div>' +
        '<div class="pi-sum-val">' + (medMap[pressaoInsertData.med] || pressaoInsertData.med) + '</div>' +
      '</div>' +
      '<div class="pi-sum-edit">Editar</div>' +
    '</div>' +
    '<div class="pi-sum-row" onclick="piSumEdit(4)">' +
      '<div class="pi-sum-ico pi-sum-ico--nota">&#9998;</div>' +
      '<div class="pi-sum-body">' +
        '<div class="pi-sum-lbl">Observa\u00e7\u00e3o</div>' +
        '<div class="pi-sum-val pi-sum-val--nota">' + nota + '</div>' +
      '</div>' +
      '<div class="pi-sum-edit">Editar</div>' +
    '</div>';
}

function piDcInputBlur(field, inp) {
  var v = parseInt(inp.value, 10);
  if (!isNaN(v)) {
    if (field === 'glicemia') { glicemiaInsertData.glicemia = Math.max(20, Math.min(600, v)); _glicDrumUpdateBadge(); }
    else if (field === 'insulina') { glicemiaInsertData.insulina = Math.max(0, Math.min(200, v)); }
    else if (field === 'sis') pressaoInsertData.sis = Math.max(60, Math.min(250, v));
    else if (field === 'dia') pressaoInsertData.dia = Math.max(30, Math.min(160, v));
    else if (field === 'hr')  pressaoInsertData.hr  = Math.max(30, Math.min(250, v));
    else if (field === 'hidra-ml') hidraInsertData.ml = Math.round(Math.max(50, Math.min(3000, v)) / 50) * 50;
  }
  inp.style.pointerEvents = 'none';
  inp.style.opacity = '0';
  _piDrumRender(field);
}

/* ?"–? Drum picker ?"––––––––––––––––––––––––––––––––––––––––––––––––––––––––––? */
function _glicDrumUpdateBadge() {
  var badge = document.getElementById('glicRangeBadge');
  if (!badge) return;
  var val = glicemiaInsertData.glicemia;
  if (val <= 99) {
    badge.textContent = '\u25cf Normal (70\u201399)'; badge.className = 'glic-range-badge glic-range-badge--normal';
  } else if (val <= 125) {
    badge.textContent = '\u25cf Aten\u00e7\u00e3o (100\u2013125)'; badge.className = 'glic-range-badge glic-range-badge--atencao';
  } else {
    badge.textContent = '\u25cf Alto (acima de 125)'; badge.className = 'glic-range-badge glic-range-badge--alto';
  }
}

function _piDrumRender(field) {
  var val, step;
  if (field === 'glicemia') { val = glicemiaInsertData.glicemia; step = 1; }
  else if (field === 'insulina') { val = glicemiaInsertData.insulina || 0; step = 1; }
  else if (field === 'hidra-ml') { val = hidraInsertData.ml; step = 50; }
  else { val = pressaoInsertData[field]; step = 1; }
  var track = document.getElementById('piDrumTrack-' + field);
  if (!track) return;
  // Reset any leftover keyboard-input overlay
  var inp = document.getElementById('piDcInput-' + field);
  if (inp) { inp.blur(); inp.style.opacity = '0'; inp.style.pointerEvents = 'none'; }
  var html = '';
  // 5-slot drum: -2, -1, 0, +1, +2
  for (var offset = -2; offset <= 2; offset++) {
    var v = val + offset * step;
    var cls = 'pi-drum-item';
    if (offset === 0) cls += ' pi-drum-item--sel';
    else if (Math.abs(offset) === 1) cls += ' pi-drum-item--near';
    else cls += ' pi-drum-item--far';
    html += '<div class="' + cls + '">' + v + '</div>';
  }
  track.innerHTML = html;
  track.style.transition = 'none';
  track.style.transform = 'translateY(0)';
}

function _piDrumStep(field, delta) {
  if (field === 'glicemia') { glicemiaInsertData.glicemia = Math.max(20, Math.min(600, glicemiaInsertData.glicemia + delta)); _glicDrumUpdateBadge(); }
  else if (field === 'insulina') { glicemiaInsertData.insulina = Math.max(0, Math.min(200, (glicemiaInsertData.insulina || 0) + delta)); }
  else if (field === 'sis') pressaoInsertData.sis = Math.max(60, Math.min(250, pressaoInsertData.sis + delta));
  else if (field === 'dia') pressaoInsertData.dia = Math.max(30, Math.min(160, pressaoInsertData.dia + delta));
  else if (field === 'hr') pressaoInsertData.hr = Math.max(30, Math.min(250, pressaoInsertData.hr + delta));
  else if (field === 'hidra-ml') hidraInsertData.ml = Math.max(50, Math.min(3000, hidraInsertData.ml + delta * 50));
}

function _piDrumAnimate(field, fromOffsetPx) {
  _piDrumRender(field);
  var track = document.getElementById('piDrumTrack-' + field);
  if (!track) return;
  track.style.transition = 'none';
  track.style.transform = 'translateY(' + fromOffsetPx + 'px)';
  track.offsetHeight; // force reflow
  track.style.transition = 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  track.style.transform = 'translateY(0)';
}

function piDrumWheel(e, wrap) {
  e.preventDefault();
  var field = wrap.getAttribute('data-field');
  var delta = e.deltaY > 0 ? 1 : -1;
  _piDrumStep(field, delta);
  _piDrumAnimate(field, -delta * PI_DRUM_IH);
}

function piDrumTouchStart(e, wrap) {
  var field = wrap.getAttribute('data-field');
  _piDrumDrag = { field: field, startY: e.touches[0].clientY, liveY: 0 };
}

function piDrumTouchMove(e, wrap) {
  if (!_piDrumDrag) return;
  e.preventDefault();
  var dy = e.touches[0].clientY - _piDrumDrag.startY;
  var field = _piDrumDrag.field;
  _piDrumDrag.liveY = dy;
  var track = document.getElementById('piDrumTrack-' + field);
  if (!track) return;
  track.style.transition = 'none';
  track.style.transform = 'translateY(' + dy + 'px)';
}

function piDrumTouchEnd(e, wrap) {
  if (!_piDrumDrag) return;
  var dy = _piDrumDrag.liveY || 0;
  var field = _piDrumDrag.field;
  _piDrumDrag = null;
  var steps = -Math.round(dy / PI_DRUM_IH);
  if (steps !== 0) {
    for (var i = 0; i < Math.abs(steps); i++) {
      _piDrumStep(field, steps > 0 ? 1 : -1);
    }
    var residual = dy + steps * PI_DRUM_IH;
    _piDrumAnimate(field, residual);
  } else if (Math.abs(dy) < 8) {
    // Tap: open keyboard editor for this field
    var inputEl = document.getElementById('piDcInput-' + field);
    if (inputEl) {
      inputEl.value = pressaoInsertData[field];
      inputEl.style.pointerEvents = 'auto';
      inputEl.style.opacity = '1';
      setTimeout(function() { inputEl.focus(); inputEl.select(); }, 0);
    }
  } else {
    // Drag that didn't complete a step – snap back
    var _snapTrack = document.getElementById('piDrumTrack-' + field);
    if (_snapTrack) { _snapTrack.style.transition = 'transform 0.18s ease'; _snapTrack.style.transform = 'translateY(0)'; }
  }
}

function stopStepPA() {
  if (_piStepTimer) { clearTimeout(_piStepTimer); _piStepTimer = null; }
}

function pressaoInsSelectMed(val) {
  pressaoInsertData.med = val;
  // Aplica highlight
  ['tomados', 'nao_tomados', 'nenhum'].forEach(function(v) {
    var el = document.getElementById('piMed-' + v);
    if (!el) return;
    el.classList.remove('pi-med-card--active', 'pi-med-card--active-green', 'pi-med-card--active-red', 'pi-med-card--active-gray');
    if (v === val) {
      el.classList.add('pi-med-card--active');
      if (v === 'tomados')     el.classList.add('pi-med-card--active-green');
      if (v === 'nao_tomados') el.classList.add('pi-med-card--active-red');
      if (v === 'nenhum')      el.classList.add('pi-med-card--active-gray');
    }
  });
  // Libera o botão Próximo
  var btn = document.getElementById('piMedNextBtn');
  if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
}

function _pressaoInsMedSync() {
  var hasSel = !!pressaoInsertData.med;
  ['tomados', 'nao_tomados', 'nenhum'].forEach(function(v) {
    var el = document.getElementById('piMed-' + v);
    if (!el) return;
    el.classList.remove('pi-med-card--active', 'pi-med-card--active-green', 'pi-med-card--active-red', 'pi-med-card--active-gray');
    if (v === pressaoInsertData.med) {
      el.classList.add('pi-med-card--active');
      if (v === 'tomados')     el.classList.add('pi-med-card--active-green');
      if (v === 'nao_tomados') el.classList.add('pi-med-card--active-red');
      if (v === 'nenhum')      el.classList.add('pi-med-card--active-gray');
    }
  });
  var btn = document.getElementById('piMedNextBtn');
  if (btn) {
    btn.style.opacity = hasSel ? '1' : '0.35';
    btn.style.pointerEvents = hasSel ? 'auto' : 'none';
  }
}

function pressaoInsSave() {
  stopStepPA();
  var ta = document.getElementById('piNotaInput');
  if (ta) pressaoInsertData.nota = ta.value.trim();

  // Build and persist entry into the in-memory historico
  if (currentVitalDetail && Array.isArray(currentVitalDetail.historico)) {
    var _now = new Date();
    var _yyyy = _now.getFullYear();
    var _mm   = String(_now.getMonth() + 1).padStart(2, '0');
    var _dd   = String(_now.getDate()).padStart(2, '0');
    var _hh   = String(_now.getHours()).padStart(2, '0');
    var _min  = String(_now.getMinutes()).padStart(2, '0');
    var _newEntry = {
      data: _yyyy + '-' + _mm + '-' + _dd,
      hora: _hh + ':' + _min,
      valor: pressaoInsertData.sis + '/' + pressaoInsertData.dia,
      hr:    pressaoInsertData.hr,
      medicamentoPressao: pressaoInsertData.med,
      anotacao: pressaoInsertData.nota || ''
    };
    currentVitalDetail.historico.push(_newEntry);
  }

  // Hide insert form directly – let renderSparklineChart handle the rest
  var insertView = document.getElementById('pressaoInsertView');
  if (insertView) insertView.style.display = 'none';
  window._pressaoInsertActive = false;
  window._pressaoDiaActive = false;
  pressaoSelectedDay = null;
  var _titleEl = document.getElementById('vitalDetailTitle');
  if (_titleEl && currentVitalDetail) _titleEl.textContent = 'Histórico de ' + currentVitalDetail.tipo;

  // Re-render chart – auto-selects today and opens day detail with updated entries
  if (currentVitalDetail) renderSparklineChart(currentVitalDetail.historico);
}

function renderSparklineChart(historico) {
  const canvas = document.getElementById('sparklineChart');
  if (!canvas) return;
  canvas.onclick = null;
  canvas.style.cursor = 'default';

  // Reset to HTML defaults (pressure branch will override via rAF)
  canvas.style.width = '100%';
  canvas.style.height = '';
  canvas.width = 720;
  canvas.height = 220;
  canvas.__drawPressao = null;
  const _sparkView = document.getElementById('pressaoHistoricoView');
  if (_sparkView) { _sparkView.style.overflowX = ''; _sparkView.style.overflowY = ''; }
  const _oldPressLegend = document.getElementById('pressaoChartLegend');
  if (_oldPressLegend) _oldPressLegend.remove();

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (currentVitalDetail && currentVitalDetail.tipo === 'Pressão Arterial') {
    pressaoSelectedDay = null;
    const _oldTip = document.getElementById('pressaoChartTooltip');
    if (_oldTip) _oldTip.remove();
    closePressaoDiaDetail();

    // Group readings by day – average systolic and diastolic per day
    const _byDay = new Map();
    historico.forEach((h) => {
      const dayIso = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
      if (!dayIso) return;
      const pair = typeof parseHistoricoPressurePair === 'function' ? parseHistoricoPressurePair(h) : null;
      if (!pair) return;
      if (!_byDay.has(dayIso)) _byDay.set(dayIso, { entries: [], sumS: 0, sumD: 0, count: 0 });
      const day = _byDay.get(dayIso);
      day.entries.push(h);
      day.sumS += pair.s;
      day.sumD += pair.d;
      day.count++;
    });

    const pressureDayRows = Array.from(_byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dayIso, data]) => ({
        dayIso,
        entries: data.entries,
        avgS: Math.round(data.sumS / data.count),
        avgD: Math.round(data.sumD / data.count),
      }));

    if (pressureDayRows.length === 0) return;

    let idealSys = 120;
    let idealDia = 80;
    let idealObj = currentVitalDetail.ideal;
    if (typeof idealObj === 'string' && typeof parseIdealObject === 'function') {
      idealObj = parseIdealObject(idealObj);
    }
    if (idealObj && idealObj.type === 'pressure' && idealObj.systolic != null && idealObj.diastolic != null) {
      idealSys = Number(idealObj.systolic);
      idealDia = Number(idealObj.diastolic);
    }

    // Year mode: group by month for the chart (X axis = months)
    const _isYearView = typeof vitalDefaultPeriod !== 'undefined' && vitalDefaultPeriod === 'year';
    const _mAbr = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    let renderRows = pressureDayRows;
    if (_isYearView) {
      const _byMonth = new Map();
      pressureDayRows.forEach(row => {
        const mk = row.dayIso.slice(0, 7); // YYYY-MM
        if (!_byMonth.has(mk)) _byMonth.set(mk, { monthKey: mk, firstDayIso: row.dayIso, entries: [], sumS: 0, sumD: 0, count: 0 });
        const mo = _byMonth.get(mk);
        mo.entries.push(...row.entries);
        mo.sumS += row.avgS * row.entries.length;
        mo.sumD += row.avgD * row.entries.length;
        mo.count += row.entries.length;
      });
      renderRows = Array.from(_byMonth.values())
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
        .map(mo => ({
          dayIso: mo.firstDayIso,
          monthKey: mo.monthKey,
          entries: mo.entries,
          avgS: Math.round(mo.sumS / mo.count),
          avgD: Math.round(mo.sumD / mo.count),
        }));
    }

    // Scrollable container
    const _chartView = document.getElementById('pressaoHistoricoView');
    if (_chartView) {
      _chartView.style.overflowX = 'auto';
      _chartView.style.overflowY = 'hidden';
      _chartView.style.webkitOverflowScrolling = 'touch';
    }

    // Legend
    let _legend = document.getElementById('pressaoChartLegend');
    if (!_legend) {
      _legend = document.createElement('div');
      _legend.id = 'pressaoChartLegend';
      if (_chartView) _chartView.appendChild(_legend);
    }
    _legend.style.cssText = 'display:flex;gap:14px;justify-content:center;padding:4px 0 2px;font-size:11px;color:#64748b;';
    _legend.innerHTML =
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:14px;height:3px;background:#f59e0b;border-radius:2px;display:inline-block;vertical-align:middle;"></span> Sistólica</span>' +
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:14px;height:3px;background:#3b82f6;border-radius:2px;display:inline-block;vertical-align:middle;"></span> Diastólica</span>';

    requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1;
      const n = renderRows.length;
      const containerW = _chartView ? _chartView.offsetWidth : (canvas.parentElement ? canvas.parentElement.offsetWidth : 320);
      // padT=44 leaves room for the two-line tooltip bubble above the chart area
      const padL = 30, padR = 20, padT = 44, padB = 22;
      const minColW = _isYearView ? 30 : Math.max(10, (containerW - padL - padR) / Math.max(1, n));
      // Fit all columns in the container when possible; scroll only if minColW floor (10px) forces wider canvas
      const W = Math.max(containerW, padL + Math.ceil(n * minColW) + padR);
      const gw = W - padL - padR;
      const colW = gw / n;  // columns perfectly fill the padded area
      const H = 180;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';

      const gh = H - padT - padB;

      const allS = renderRows.map(r => r.avgS);
      const allD = renderRows.map(r => r.avgD);
      let yLow = Math.floor((Math.min(...allD, idealDia) - 10) / 5) * 5;
      let yHigh = Math.ceil((Math.max(...allS, idealSys) + 10) / 5) * 5;
      if (yHigh - yLow < 30) { yLow -= 10; yHigh += 10; }
      yLow = Math.max(40, yLow);
      yHigh = Math.min(220, yHigh);
      const span = yHigh - yLow || 1;
      const toY = (v) => padT + ((yHigh - v) / span) * gh;

      function drawPressaoChart() {
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(0, 0, W, H);

        // Ideal zone band
        const bandY1 = toY(idealSys);
        const bandY2 = toY(idealDia);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.07)';
        ctx.fillRect(padL, bandY1, gw, bandY2 - bandY1);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(padL, bandY1); ctx.lineTo(padL + gw, bandY1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(padL, bandY2); ctx.lineTo(padL + gw, bandY2); ctx.stroke();
        ctx.setLineDash([]);

        // Horizontal grid lines
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        [0, 0.5, 1].forEach(t => {
          const y = padT + t * gh;
          ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        });

        // Y labels
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 9px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.round(yHigh)), padL - 4, padT);
        ctx.fillText(String(Math.round(yLow)), padL - 4, H - padB);

        const hasSel = pressaoSelectedDay !== null;

        // Selected column highlight
        if (hasSel) {
          const selIdx = renderRows.findIndex(r => r.dayIso === pressaoSelectedDay);
          if (selIdx >= 0) {
            ctx.fillStyle = 'rgba(71, 85, 105, 0.08)';
            ctx.fillRect(padL + colW * selIdx, padT, colW, gh);
          }
        }

        // Connecting lines (under dots)
        if (n > 1) {
          ctx.lineWidth = 2;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.globalAlpha = 0.7;

          ctx.strokeStyle = '#f59e0b';
          ctx.beginPath();
          renderRows.forEach((row, i) => {
            const x = padL + colW * i + colW / 2;
            if (i === 0) ctx.moveTo(x, toY(row.avgS)); else ctx.lineTo(x, toY(row.avgS));
          });
          ctx.stroke();

          ctx.strokeStyle = '#3b82f6';
          ctx.beginPath();
          renderRows.forEach((row, i) => {
            const x = padL + colW * i + colW / 2;
            if (i === 0) ctx.moveTo(x, toY(row.avgD)); else ctx.lineTo(x, toY(row.avgD));
          });
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Dots
        renderRows.forEach((row, i) => {
          const isSelected = hasSel && pressaoSelectedDay === row.dayIso;
          const x = padL + colW * i + colW / 2;
          const dotR = isSelected ? 6 : 3.5;
          ctx.globalAlpha = hasSel && !isSelected ? 0.25 : 1;

          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(x, toY(row.avgS), dotR, 0, Math.PI * 2);
          ctx.fill();
          if (isSelected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }

          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.arc(x, toY(row.avgD), dotR, 0, Math.PI * 2);
          ctx.fill();
          if (isSelected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
        });

        // Tooltip bubble – always visible on canvas for the selected column
        if (hasSel) {
          const selIdx = renderRows.findIndex(r => r.dayIso === pressaoSelectedDay);
          if (selIdx >= 0) {
            const selRow = renderRows[selIdx];
            const x = padL + colW * selIdx + colW / 2;
            ctx.globalAlpha = 1;
            const sisStr = String(selRow.avgS);
            const diaStr = String(selRow.avgD);
            ctx.font = 'bold 11px Inter, sans-serif';
            const sisW = ctx.measureText(sisStr).width;
            const sepW = ctx.measureText(' / ').width;
            const diaW = ctx.measureText(diaStr).width;
            ctx.font = '10px Inter, sans-serif';
            const unitW = ctx.measureText(' mmHg').width;
            const totalTxtW = sisW + sepW + diaW + unitW;
            // Date label
            const _ptBrWP = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
            let dateLbl = '';
            if (!_isYearView && selRow.dayIso) {
              const _dp = new Date(selRow.dayIso + 'T12:00:00');
              if (!isNaN(_dp.getTime())) dateLbl = _ptBrWP[_dp.getDay()] + ', ' + _dp.getDate() + ' ' + _mAbr[_dp.getMonth()];
            } else if (_isYearView && selRow.monthKey) {
              const [_my, _mm] = selRow.monthKey.split('-').map(Number);
              dateLbl = _mAbr[_mm - 1] + ' ' + _my;
            }
            ctx.font = '10px Inter, sans-serif';
            const dateLblW = dateLbl ? ctx.measureText(dateLbl).width : 0;
            const bh = dateLbl ? 34 : 22;
            const bw = Math.max(totalTxtW + 18, dateLblW + 18, 88);
            const arrowH = 5;
            let bx = x - bw / 2;
            if (bx < padL) bx = padL;
            if (bx + bw > W - padR) bx = W - padR - bw;
            const by = padT - arrowH - 2;
            // Rounded bubble + downward arrow
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            const br = 4;
            ctx.moveTo(bx + br, by - bh); ctx.lineTo(bx + bw - br, by - bh);
            ctx.quadraticCurveTo(bx + bw, by - bh, bx + bw, by - bh + br);
            ctx.lineTo(bx + bw, by - br); ctx.quadraticCurveTo(bx + bw, by, bx + bw - br, by);
            const ax = Math.min(Math.max(x, bx + 10), bx + bw - 10);
            ctx.lineTo(ax + 5, by); ctx.lineTo(ax, by + arrowH); ctx.lineTo(ax - 5, by);
            ctx.lineTo(bx + br, by); ctx.quadraticCurveTo(bx, by, bx, by - br);
            ctx.lineTo(bx, by - bh + br); ctx.quadraticCurveTo(bx, by - bh, bx + br, by - bh);
            ctx.closePath(); ctx.fill();
            // Colored text: SIS amber / DIA blue / mmHg gray + date below
            ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
            const txtY1 = dateLbl ? by - bh + 11 : by - bh / 2;
            let cx2 = bx + bw / 2 - totalTxtW / 2;
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.fillStyle = '#fbbf24'; ctx.fillText(sisStr, cx2, txtY1); cx2 += sisW;
            ctx.fillStyle = '#94a3b8'; ctx.fillText(' / ', cx2, txtY1); cx2 += sepW;
            ctx.fillStyle = '#60a5fa'; ctx.fillText(diaStr, cx2, txtY1); cx2 += diaW;
            ctx.font = '10px Inter, sans-serif';
            ctx.fillStyle = '#94a3b8'; ctx.fillText(' mmHg', cx2, txtY1);
            if (dateLbl) {
              const txtY2 = by - bh + 25;
              ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#94a3b8';
              ctx.fillText(dateLbl, bx + (bw - dateLblW) / 2, txtY2);
            }
          }
        }

        // Vertical dashed line for selected column
        ctx.globalAlpha = 1;
        if (hasSel) {
          const selIdx = renderRows.findIndex(r => r.dayIso === pressaoSelectedDay);
          if (selIdx >= 0) {
            const cx = padL + colW * selIdx + colW / 2;
            ctx.save();
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(cx, padT);
            ctx.lineTo(cx, H - padB);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }
        }

        // X labels – day number for day-range views, month abbrev for year view
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelEvery = Math.max(1, Math.ceil(n / 10));
        renderRows.forEach((row, i) => {
          if (i % labelEvery !== 0 && i !== n - 1) return;
          const cx = padL + colW * i + colW / 2;
          let xLbl;
          if (_isYearView) {
            const _mm = parseInt(row.monthKey.split('-')[1], 10);
            xLbl = _mAbr[_mm - 1];
          } else {
            const parts = row.dayIso.split('-');
            xLbl = parts.length === 3 ? String(Number(parts[2])) : '';
          }
          ctx.fillText(xLbl, cx, H - padB + 5);
        });
      }

      drawPressaoChart();
      canvas.__drawPressao = drawPressaoChart;

      // Auto-select today (or the most recent available row) on first render
      const _todayIso = new Date().toISOString().slice(0, 10);
      let _autoIdx = -1;
      if (_isYearView) {
        const _todayMonth = _todayIso.slice(0, 7);
        _autoIdx = renderRows.findIndex(r => r.monthKey === _todayMonth);
      } else {
        _autoIdx = renderRows.findIndex(r => r.dayIso === _todayIso);
      }
      if (_autoIdx === -1) _autoIdx = renderRows.length - 1;
      if (_autoIdx >= 0) {
        const _autoRow = renderRows[_autoIdx];
        pressaoSelectedDay = _autoRow.dayIso;
        drawPressaoChart();
        openPressaoDiaDetail(pressaoSelectedDay, _autoRow.entries);
        if (_isYearView) {
          const [_aty, _atm] = _autoRow.monthKey.split('-').map(Number);
          const _atEl = document.getElementById('pressaoDiaDetailLabel');
          if (_atEl) _atEl.textContent = `${_mAbr[_atm - 1]} ${_aty}`;
        }
        // Scroll to the right end so the most-recent (today) column is visible
        if (_chartView) {
          _chartView.scrollLeft = Math.max(0, W - containerW);
        }
      }

      canvas.style.cursor = 'pointer';
      canvas.onclick = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const mx = (ev.clientX - rect.left) * (W / rect.width);
        const my = (ev.clientY - rect.top) * (H / rect.height);

        const oldTip = document.getElementById('pressaoChartTooltip');
        if (oldTip) oldTip.remove();

        let hitIdx = -1;
        renderRows.forEach((row, i) => {
          const zoneX = padL + colW * i;
          if (mx >= zoneX && mx < zoneX + colW && my >= padT && my <= H - padB) hitIdx = i;
        });

        // Clicking outside all columns or on the already-selected column: do nothing
        if (hitIdx === -1) return;

        const hitDay = renderRows[hitIdx].dayIso;
        if (pressaoSelectedDay === hitDay) return;
        pressaoSelectedDay = hitDay;
        drawPressaoChart();

        const row = renderRows[hitIdx];

        // Build tooltip date label – month name for year view, day+weekday for day views
        let dateLabel;
        if (_isYearView) {
          const [_ty, _tm] = row.monthKey.split('-').map(Number);
          dateLabel = `${_mAbr[_tm - 1]} ${_ty}`;
        } else {
          const [_y, _m, _d] = row.dayIso.split('-').map(Number);
          const _dateObj = new Date(_y, _m - 1, _d);
          const _dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
          dateLabel = `${_dias[_dateObj.getDay()]}, ${String(_d).padStart(2, '0')} ${_mAbr[_m - 1]}`;
        }

        openPressaoDiaDetail(pressaoSelectedDay, row.entries);

        // Override detail-view header label for year view ("mai 2026" instead of a specific day)
        if (_isYearView) {
          const [_ty, _tm] = row.monthKey.split('-').map(Number);
          const lEl = document.getElementById('pressaoDiaDetailLabel');
          if (lEl) lEl.textContent = `${_mAbr[_tm - 1]} ${_ty}`;
        }
      };
    });
    return;
  }

  if (currentVitalDetail && currentVitalDetail.tipo === 'Passos') {
    const allDayRows = aggregatePassosByDay(historico);
    const dayRows = allDayRows.slice().sort((a, b) => a.day.localeCompare(b.day));
    const rows = dayRows.map((g) => ({ h: { data: g.day }, v: g.total, day: g.day }));
    if (rows.length === 0) return;

    const goal = getStepsDailyGoalValue(currentVitalDetail);

    // Scrollable container (like PA chart)
    const _passChartView = document.getElementById('pressaoHistoricoView');
    if (_passChartView) {
      _passChartView.style.overflowX = 'auto';
      _passChartView.style.overflowY = 'hidden';
      _passChartView.style.webkitOverflowScrolling = 'touch';
    }

    requestAnimationFrame(() => {
    const dpr = window.devicePixelRatio || 1;
    const n = rows.length;
    const containerW = _passChartView ? _passChartView.offsetWidth : (canvas.parentElement ? canvas.parentElement.offsetWidth : 320);
    const padL = 28, padR = 12, padT = 44, padB = 20;
    const _isYearView = typeof vitalDefaultPeriod !== 'undefined' && vitalDefaultPeriod === 'year';
    const minColW = _isYearView ? 20 : Math.max(10, (containerW - padL - padR) / Math.max(1, n));
    // Fit all columns in the container when possible; scroll only if minColW floor forces wider canvas
    const W = Math.max(containerW, padL + Math.ceil(n * minColW) + padR);
    const H = 180;
    const gw = W - padL - padR;
    const gh = H - padT - padB;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const maxData = Math.max(...rows.map((r) => r.v), goal);
    const yLow = 0;
    const yHigh = Math.max(goal * 1.15, maxData * 1.1, 1);
    const span = yHigh - yLow;
    const toY = (v) => padT + ((yHigh - v) / span) * gh;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
    ctx.fillRect(padL, toY(goal), gw, gh - (toY(goal) - padT));

    ctx.strokeStyle = 'rgba(34, 197, 94, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, toY(goal));
    ctx.lineTo(padL + gw, toY(goal));
    ctx.stroke();
    ctx.setLineDash([]);

    const slot = gw / Math.max(1, n);
    const barW = Math.min(18, Math.max(7, slot * 0.58));
    const barR = Math.min(5, barW / 2 - 0.5);
    canvas.style.cursor = 'pointer';
    const hitBoxes = [];
    rows.forEach((row, i) => {
      const isSelected = row.day === passosSelectedDayIso;
      const cx = padL + slot * i + slot / 2;
      const x0 = cx - barW / 2;
      const yTop = toY(row.v);
      const yBot = toY(0);
      const g = ctx.createLinearGradient(0, yTop, 0, yBot);
      g.addColorStop(0, isSelected ? '#34d399' : '#6ee7a0');
      g.addColorStop(1, isSelected ? '#16a34a' : '#22c55e');
      ctx.fillStyle = g;
      const hBar = Math.max(1, yBot - yTop);
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x0, yTop, barW, hBar, [barR, barR, 2, 2]);
        ctx.fill();
      } else {
        ctx.fillRect(x0, yTop, barW, hBar);
      }
      if (isSelected) {
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 - 0.5, yTop - 0.5, barW + 1, hBar + 1);
      }
      const slotX0 = padL + slot * i;
      hitBoxes.push({ x0: slotX0, x1: slotX0 + slot, dayIso: row.day });
    });

    // Tooltip para dia selecionado
    if (passosSelectedDayIso) {
      const _selIdx = rows.findIndex(r => r.day === passosSelectedDayIso);
      if (_selIdx >= 0) {
        const _selRow = rows[_selIdx];
        const _cx = padL + slot * _selIdx + slot / 2;
        const _numStr = _selRow.v.toLocaleString('pt-BR');
        const _ptBrWS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        const _mAbrS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        const [_sy, _smo, _sdd] = _selRow.day.split('-').map(Number);
        const _sDateLbl = _isYearView ? '' : `${_ptBrWS[new Date(_sy, _smo - 1, _sdd).getDay()]}, ${_sdd} ${_mAbrS[_smo - 1]}`;
        ctx.font = 'bold 10px Inter, sans-serif';
        const _nw = ctx.measureText(_numStr).width;
        ctx.font = '9px Inter, sans-serif';
        const _sw = ctx.measureText(' passos').width;
        const _sdlw = _sDateLbl ? ctx.measureText(_sDateLbl).width : 0;
        const _bw = Math.max(_nw + _sw + 18, _sdlw + 18, 76);
        const _bh = _sDateLbl ? 34 : 20;
        const _arr = 5;
        let _bx = _cx - _bw / 2;
        if (_bx < padL) _bx = padL;
        if (_bx + _bw > padL + gw) _bx = padL + gw - _bw;
        const _by = padT - _arr - 2;
        const _br = 4;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(_bx + _br, _by - _bh);
        ctx.lineTo(_bx + _bw - _br, _by - _bh);
        ctx.quadraticCurveTo(_bx + _bw, _by - _bh, _bx + _bw, _by - _bh + _br);
        ctx.lineTo(_bx + _bw, _by - _br);
        ctx.quadraticCurveTo(_bx + _bw, _by, _bx + _bw - _br, _by);
        const _ax = Math.min(Math.max(_cx, _bx + 10), _bx + _bw - 10);
        ctx.lineTo(_ax + 5, _by); ctx.lineTo(_ax, _by + _arr); ctx.lineTo(_ax - 5, _by);
        ctx.lineTo(_bx + _br, _by);
        ctx.quadraticCurveTo(_bx, _by, _bx, _by - _br);
        ctx.lineTo(_bx, _by - _bh + _br);
        ctx.quadraticCurveTo(_bx, _by - _bh, _bx + _br, _by - _bh);
        ctx.closePath(); ctx.fill();
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        if (_sDateLbl) {
          const _ty1 = _by - _bh + 11;
          let _tx = _bx + (_bw - _nw - _sw) / 2;
          ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#34d399'; ctx.fillText(_numStr, _tx, _ty1); _tx += _nw;
          ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.fillText(' passos', _tx, _ty1);
          ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#6ee7b7';
          ctx.textAlign = 'center'; ctx.fillText(_sDateLbl, _bx + _bw / 2, _by - _bh + 25);
        } else {
          const _ty = _by - _bh / 2;
          let _tx = _bx + (_bw - _nw - _sw) / 2;
          ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#34d399'; ctx.fillText(_numStr, _tx, _ty); _tx += _nw;
          ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.fillText(' passos', _tx, _ty);
        }
      }
    }

    ctx.fillStyle = '#8e8e8e';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', padL - 4, toY(0));
    ctx.fillText(String(Math.round(goal)), padL - 4, toY(goal));

    const labelEvery = Math.max(1, Math.ceil(n / 8));
    ctx.fillStyle = '#666';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    rows.forEach((row, i) => {
      if (i % labelEvery !== 0 && i !== n - 1) return;
      const cx = padL + slot * i + slot / 2;
      const d = String(row.h.data || '');
      const parts = d.split('-');
      const short = parts.length === 3 ? String(Number(parts[2])) : '';
      ctx.fillText(short, cx, H - 4);
    });

    canvas.style.cursor = 'pointer';
    canvas.onclick = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const sx = W / Math.max(1, rect.width);
      const x = (ev.clientX - rect.left) * sx;
      const hit = hitBoxes.find((b) => x >= b.x0 && x <= b.x1);
      if (hit && hit.dayIso) setPassosDayFromChart(hit.dayIso);
    };

    // Hover: crosshair dotted line + tooltip
    canvas.__drawPassHover = function(hovIdx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#F8F9FA';
      ctx.fillRect(0, 0, W, H);
      // Goal zone
      ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
      ctx.fillRect(padL, toY(goal), gw, gh - (toY(goal) - padT));
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(padL, toY(goal)); ctx.lineTo(padL + gw, toY(goal)); ctx.stroke();
      ctx.setLineDash([]);
      // Bars
      rows.forEach((row, i) => {
        const isSelected = row.day === passosSelectedDayIso;
        const isHov = i === hovIdx;
        const cx2 = padL + slot * i + slot / 2;
        const x02 = cx2 - barW / 2;
        const yTop2 = toY(row.v);
        const yBot2 = toY(0);
        const hBar2 = Math.max(1, yBot2 - yTop2);
        const g2 = ctx.createLinearGradient(0, yTop2, 0, yBot2);
        g2.addColorStop(0, isSelected ? '#34d399' : '#6ee7a0');
        g2.addColorStop(1, isSelected ? '#16a34a' : '#22c55e');
        ctx.fillStyle = g2;
        ctx.globalAlpha = passosSelectedDayIso && !isSelected ? 0.35 : (hovIdx >= 0 && !isSelected && !isHov ? 0.5 : 1);
        if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(x02, yTop2, barW, hBar2, [barR, barR, 2, 2]); ctx.fill(); }
        else { ctx.fillRect(x02, yTop2, barW, hBar2); }
        ctx.globalAlpha = 1;
        if (isSelected) {
          ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 1;
          ctx.strokeRect(x02 - 0.5, yTop2 - 0.5, barW + 1, hBar2 + 1);
        }
      });
      // Y labels
      ctx.fillStyle = '#8e8e8e'; ctx.font = '8px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('0', padL - 4, toY(0));
      ctx.fillText(String(Math.round(goal)), padL - 4, toY(goal));
      // X labels
      const _lbEvery = Math.max(1, Math.ceil(n / 8));
      ctx.fillStyle = '#666'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      rows.forEach((row, i) => {
        if (i % _lbEvery !== 0 && i !== n - 1) return;
        const cxL = padL + slot * i + slot / 2;
        const d = String(row.h.data || '');
        const parts = d.split('-');
        const short = parts.length === 3 ? String(Number(parts[2])) : '';
        ctx.fillText(short, cxL, H - 4);
      });
      // Sel-day tooltip bubble
      if (passosSelectedDayIso) {
        const _si = rows.findIndex(r => r.day === passosSelectedDayIso);
        if (_si >= 0 && _si !== hovIdx) {
          const _sr = rows[_si];
          const _cx = padL + slot * _si + slot / 2;
          const _numStr = _sr.v.toLocaleString('pt-BR');
          const _ptBrWD = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
          const _mAbrD = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
          const [_dy, _dmo, _ddd] = _sr.day.split('-').map(Number);
          const _sdDateLbl = _isYearView ? '' : `${_ptBrWD[new Date(_dy, _dmo - 1, _ddd).getDay()]}, ${_ddd} ${_mAbrD[_dmo - 1]}`;
          ctx.font = 'bold 10px Inter, sans-serif'; const _nw = ctx.measureText(_numStr).width;
          ctx.font = '9px Inter, sans-serif'; const _sw = ctx.measureText(' passos').width;
          const _sdlw2 = _sdDateLbl ? ctx.measureText(_sdDateLbl).width : 0;
          const _bw = Math.max(_nw + _sw + 18, _sdlw2 + 18, 76), _bh = _sdDateLbl ? 34 : 20, _arr = 5;
          let _bx = _cx - _bw / 2;
          if (_bx < padL) _bx = padL;
          if (_bx + _bw > padL + gw) _bx = padL + gw - _bw;
          const _by = padT - _arr - 2, _br = 4;
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(_bx + _br, _by - _bh); ctx.lineTo(_bx + _bw - _br, _by - _bh);
          ctx.quadraticCurveTo(_bx + _bw, _by - _bh, _bx + _bw, _by - _bh + _br);
          ctx.lineTo(_bx + _bw, _by - _br); ctx.quadraticCurveTo(_bx + _bw, _by, _bx + _bw - _br, _by);
          const _ax = Math.min(Math.max(_cx, _bx + 10), _bx + _bw - 10);
          ctx.lineTo(_ax + 5, _by); ctx.lineTo(_ax, _by + _arr); ctx.lineTo(_ax - 5, _by);
          ctx.lineTo(_bx + _br, _by); ctx.quadraticCurveTo(_bx, _by, _bx, _by - _br);
          ctx.lineTo(_bx, _by - _bh + _br); ctx.quadraticCurveTo(_bx, _by - _bh, _bx + _br, _by - _bh);
          ctx.closePath(); ctx.fill();
          ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          if (_sdDateLbl) {
            const _ty1 = _by - _bh + 11;
            let _tx = _bx + (_bw - _nw - _sw) / 2;
            ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#34d399'; ctx.fillText(_numStr, _tx, _ty1); _tx += _nw;
            ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.fillText(' passos', _tx, _ty1);
            ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#6ee7b7';
            ctx.textAlign = 'center'; ctx.fillText(_sdDateLbl, _bx + _bw / 2, _by - _bh + 25);
          } else {
            const _ty = _by - _bh / 2; let _tx = _bx + (_bw - _nw - _sw) / 2;
            ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#34d399'; ctx.fillText(_numStr, _tx, _ty); _tx += _nw;
            ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.fillText(' passos', _tx, _ty);
          }
        }
      }
      // Hover crosshair + tooltip
      if (hovIdx >= 0) {
        const _hRow = rows[hovIdx];
        const _hCx = padL + slot * hovIdx + slot / 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(100,116,139,0.55)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(_hCx, padT); ctx.lineTo(_hCx, H - padB); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        const _hNum = _hRow.v.toLocaleString('pt-BR');
        const _ptBrWH = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        const _mAbrH = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        const [_hy, _hmo, _hdd] = _hRow.day.split('-').map(Number);
        const _hDateLbl = _isYearView ? '' : `${_ptBrWH[new Date(_hy, _hmo - 1, _hdd).getDay()]}, ${_hdd} ${_mAbrH[_hmo - 1]}`;
        ctx.font = 'bold 10px Inter, sans-serif'; const _hnw = ctx.measureText(_hNum).width;
        ctx.font = '9px Inter, sans-serif'; const _hsw = ctx.measureText(' passos').width;
        const _hdlw = _hDateLbl ? ctx.measureText(_hDateLbl).width : 0;
        const _hbw = Math.max(_hnw + _hsw + 18, _hdlw + 18, 76), _hbh = _hDateLbl ? 34 : 20, _harr = 5;
        let _hbx = _hCx - _hbw / 2;
        if (_hbx < padL) _hbx = padL;
        if (_hbx + _hbw > padL + gw) _hbx = padL + gw - _hbw;
        const _hby = padT - _harr - 2, _hbr = 4;
        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.moveTo(_hbx + _hbr, _hby - _hbh); ctx.lineTo(_hbx + _hbw - _hbr, _hby - _hbh);
        ctx.quadraticCurveTo(_hbx + _hbw, _hby - _hbh, _hbx + _hbw, _hby - _hbh + _hbr);
        ctx.lineTo(_hbx + _hbw, _hby - _hbr); ctx.quadraticCurveTo(_hbx + _hbw, _hby, _hbx + _hbw - _hbr, _hby);
        const _hax = Math.min(Math.max(_hCx, _hbx + 10), _hbx + _hbw - 10);
        ctx.lineTo(_hax + 5, _hby); ctx.lineTo(_hax, _hby + _harr); ctx.lineTo(_hax - 5, _hby);
        ctx.lineTo(_hbx + _hbr, _hby); ctx.quadraticCurveTo(_hbx, _hby, _hbx, _hby - _hbr);
        ctx.lineTo(_hbx, _hby - _hbh + _hbr); ctx.quadraticCurveTo(_hbx, _hby - _hbh, _hbx + _hbr, _hby - _hbh);
        ctx.closePath(); ctx.fill();
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        if (_hDateLbl) {
          const _hty1 = _hby - _hbh + 11;
          let _htx = _hbx + (_hbw - _hnw - _hsw) / 2;
          ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#86efac'; ctx.fillText(_hNum, _htx, _hty1); _htx += _hnw;
          ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#bbf7d0'; ctx.fillText(' passos', _htx, _hty1);
          ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#6ee7b7';
          ctx.textAlign = 'center'; ctx.fillText(_hDateLbl, _hbx + _hbw / 2, _hby - _hbh + 25);
        } else {
          const _hty = _hby - _hbh / 2; let _htx = _hbx + (_hbw - _hnw - _hsw) / 2;
          ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#86efac'; ctx.fillText(_hNum, _htx, _hty); _htx += _hnw;
          ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#bbf7d0'; ctx.fillText(' passos', _htx, _hty);
        }
      }
    };
    canvas._passHovIdx = -1;
    canvas.onmousemove = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const sx = W / Math.max(1, rect.width);
      const x = (ev.clientX - rect.left) * sx;
      let newIdx = -1;
      hitBoxes.forEach((b, i) => { if (x >= b.x0 && x <= b.x1) newIdx = i; });
      if (newIdx !== canvas._passHovIdx) {
        canvas._passHovIdx = newIdx;
        if (canvas.__drawPassHover) canvas.__drawPassHover(newIdx);
      }
    };
    canvas.onmouseleave = () => {
      if (canvas._passHovIdx !== -1) {
        canvas._passHovIdx = -1;
        if (canvas.__drawPassHover) canvas.__drawPassHover(-1);
      }
    };

    // Scroll to show the most recent (rightmost) day
    if (_passChartView && !passosSelectedDayIso) {
      _passChartView.scrollLeft = Math.max(0, W - containerW);
    }
    }); // end requestAnimationFrame
    return;
  }

  if (currentVitalDetail && currentVitalDetail.tipo === 'Glicemia') {
    const _isYearView = vitalDefaultPeriod === 'year';
    const _is7dView = vitalDefaultPeriod === '7d';
    const glicDayRows = _isYearView ? aggregateGlicemiaByMonth(historico) : aggregateGlicemiaByDay(historico);
    if (glicDayRows.length === 0) return;

    const _glicChartView = document.getElementById('pressaoHistoricoView');
    if (_glicChartView) {
      _glicChartView.style.overflowX = 'auto';
      _glicChartView.style.overflowY = 'hidden';
      _glicChartView.style.webkitOverflowScrolling = 'touch';
    }

    requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1;
      const n = glicDayRows.length;
      const containerW = _glicChartView ? _glicChartView.offsetWidth : (canvas.parentElement ? canvas.parentElement.offsetWidth : 320);
      const padL = 32, padR = 12, padT = 44, padB = 20;
      const minColW = 36;
      const W = Math.max(containerW, padL + n * minColW + padR);
      const H = 180;
      const gw = W - padL - padR;
      const gh = H - padT - padB;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';

      const allAvgs = glicDayRows.map((r) => r.avg);
      const yLow = 0;
      const yHigh = Math.max(Math.max(...allAvgs) * 1.15, 145);
      const span = yHigh - yLow;
      const toY = (v) => padT + ((yHigh - v) / span) * gh;

      const slot = gw / Math.max(1, n);
      const barW = Math.min(18, Math.max(7, slot * 0.58));
      const barR = Math.min(5, barW / 2 - 0.5);
      const selIso = glicemiaSelectedDayIso;

      const _gCtx = canvas.getContext('2d');
      _gCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      _gCtx.clearRect(0, 0, W, H);
      _gCtx.fillStyle = '#F8F9FA';
      _gCtx.fillRect(0, 0, W, H);

      // Ideal zone band (70–99)
      const idealLow = 70, idealHigh = 99;
      _gCtx.fillStyle = 'rgba(34, 197, 94, 0.10)';
      _gCtx.fillRect(padL, toY(idealHigh), gw, toY(idealLow) - toY(idealHigh));
      _gCtx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
      _gCtx.lineWidth = 1;
      _gCtx.setLineDash([3, 3]);
      _gCtx.beginPath(); _gCtx.moveTo(padL, toY(idealHigh)); _gCtx.lineTo(padL + gw, toY(idealHigh)); _gCtx.stroke();
      _gCtx.beginPath(); _gCtx.moveTo(padL, toY(idealLow)); _gCtx.lineTo(padL + gw, toY(idealLow)); _gCtx.stroke();
      _gCtx.setLineDash([]);

      // Bars
      const hitBoxes = [];
      glicDayRows.forEach((row, i) => {
        const isSelected = !_isYearView && row.day === selIso;
        const cx = padL + slot * i + slot / 2;
        const x0 = cx - barW / 2;
        const yTop = toY(row.avg);
        const yBot = toY(0);
        const hBar = Math.max(1, yBot - yTop);

        const g2 = _gCtx.createLinearGradient(0, yTop, 0, yBot);
        if (row.avg > 125) {
          g2.addColorStop(0, isSelected ? '#dc2626' : '#f87171');
          g2.addColorStop(1, isSelected ? '#991b1b' : '#ef4444');
        } else if (row.avg > 99) {
          g2.addColorStop(0, isSelected ? '#d97706' : '#fbbf24');
          g2.addColorStop(1, isSelected ? '#92400e' : '#f59e0b');
        } else {
          g2.addColorStop(0, isSelected ? '#6d28d9' : '#8b5cf6');
          g2.addColorStop(1, isSelected ? '#4c1d95' : '#7c3aed');
        }
        _gCtx.fillStyle = g2;
        _gCtx.globalAlpha = !_isYearView && selIso && !isSelected ? 0.35 : 1;
        if (typeof _gCtx.roundRect === 'function') {
          _gCtx.beginPath();
          _gCtx.roundRect(x0, yTop, barW, hBar, [barR, barR, 2, 2]);
          _gCtx.fill();
        } else {
          _gCtx.fillRect(x0, yTop, barW, hBar);
        }
        _gCtx.globalAlpha = 1;
        hitBoxes.push({ x0: padL + slot * i, x1: padL + slot * i + slot, dayIso: _isYearView ? null : row.day });
      });

      // Tooltip bubble for selected day
      if (selIso) {
        const selIdx = glicDayRows.findIndex((r) => r.day === selIso);
        if (selIdx >= 0) {
          const selRow = glicDayRows[selIdx];
          const _cx = padL + slot * selIdx + slot / 2;
          const _avgStr = String(selRow.avg);
          _gCtx.font = 'bold 10px Inter, sans-serif';
          const _nw = _gCtx.measureText(_avgStr).width;
          _gCtx.font = '9px Inter, sans-serif';
          const _sw = _gCtx.measureText(' mg/dL').width;
          const _bw = Math.max(_nw + _sw + 18, 76);
          const _bh = 20;
          const _arr = 5;
          let _bx = _cx - _bw / 2;
          if (_bx < padL) _bx = padL;
          if (_bx + _bw > padL + gw) _bx = padL + gw - _bw;
          const _by = padT - _arr - 2;
          const _br = 4;
          _gCtx.fillStyle = '#1e293b';
          _gCtx.beginPath();
          _gCtx.moveTo(_bx + _br, _by - _bh);
          _gCtx.lineTo(_bx + _bw - _br, _by - _bh);
          _gCtx.quadraticCurveTo(_bx + _bw, _by - _bh, _bx + _bw, _by - _bh + _br);
          _gCtx.lineTo(_bx + _bw, _by - _br);
          _gCtx.quadraticCurveTo(_bx + _bw, _by, _bx + _bw - _br, _by);
          const _ax = Math.min(Math.max(_cx, _bx + 10), _bx + _bw - 10);
          _gCtx.lineTo(_ax + 5, _by); _gCtx.lineTo(_ax, _by + _arr); _gCtx.lineTo(_ax - 5, _by);
          _gCtx.lineTo(_bx + _br, _by);
          _gCtx.quadraticCurveTo(_bx, _by, _bx, _by - _br);
          _gCtx.lineTo(_bx, _by - _bh + _br);
          _gCtx.quadraticCurveTo(_bx, _by - _bh, _bx + _br, _by - _bh);
          _gCtx.closePath(); _gCtx.fill();
          const _ty = _by - _bh / 2;
          let _tx = _bx + (_bw - _nw - _sw) / 2;
          _gCtx.textBaseline = 'middle'; _gCtx.textAlign = 'left';
          _gCtx.font = 'bold 10px Inter, sans-serif';
          _gCtx.fillStyle = '#c4b5fd'; _gCtx.fillText(_avgStr, _tx, _ty); _tx += _nw;
          _gCtx.font = '9px Inter, sans-serif';
          _gCtx.fillStyle = '#94a3b8'; _gCtx.fillText(' mg/dL', _tx, _ty);
        }
      }

      // Y labels (ideal zone boundaries)
      _gCtx.fillStyle = '#94a3b8';
      _gCtx.font = '8px sans-serif';
      _gCtx.textAlign = 'right';
      _gCtx.textBaseline = 'middle';
      _gCtx.fillText('70', padL - 4, toY(idealLow));
      _gCtx.fillText('99', padL - 4, toY(idealHigh));

      // X labels
      const _ptBrMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const _ptBrWeekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const labelEvery = _isYearView ? 1 : Math.max(1, Math.ceil(n / 8));
      _gCtx.fillStyle = '#666';
      _gCtx.font = '8px sans-serif';
      _gCtx.textAlign = 'center';
      _gCtx.textBaseline = 'alphabetic';
      glicDayRows.forEach((row, i) => {
        if (i % labelEvery !== 0 && i !== n - 1) return;
        const cx = padL + slot * i + slot / 2;
        let _xLabel = '';
        if (_isYearView) {
          const mIdx = parseInt((row.month || '').split('-')[1] || '1', 10) - 1;
          _xLabel = _ptBrMonths[mIdx] || '';
        } else if (_is7dView) {
          const _d = new Date((row.day || '') + 'T12:00:00');
          _xLabel = isNaN(_d.getTime()) ? '' : _ptBrWeekdays[_d.getDay()];
        } else {
          const parts = (row.day || '').split('-');
          _xLabel = parts.length === 3 ? String(Number(parts[2])) : '';
        }
        _gCtx.fillText(_xLabel, cx, H - 4);
      });

      canvas.style.cursor = 'pointer';
      canvas.onclick = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const sx = W / Math.max(1, rect.width);
        const x = (ev.clientX - rect.left) * sx;
        const hit = hitBoxes.find((b) => x >= b.x0 && x <= b.x1);
        if (hit && hit.dayIso) selectGlicemiaDay(hit.dayIso);
      };

      // Hover: crosshair dotted line + tooltip
      canvas.__drawGlicHover = function(hovIdx) {
        // Redraw base: clear + bg + ideal zone + bars + sel tooltip + labels
        _gCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        _gCtx.clearRect(0, 0, W, H);
        _gCtx.fillStyle = '#F8F9FA';
        _gCtx.fillRect(0, 0, W, H);
        _gCtx.fillStyle = 'rgba(34, 197, 94, 0.10)';
        _gCtx.fillRect(padL, toY(idealHigh), gw, toY(idealLow) - toY(idealHigh));
        _gCtx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
        _gCtx.lineWidth = 1;
        _gCtx.setLineDash([3, 3]);
        _gCtx.beginPath(); _gCtx.moveTo(padL, toY(idealHigh)); _gCtx.lineTo(padL + gw, toY(idealHigh)); _gCtx.stroke();
        _gCtx.beginPath(); _gCtx.moveTo(padL, toY(idealLow)); _gCtx.lineTo(padL + gw, toY(idealLow)); _gCtx.stroke();
        _gCtx.setLineDash([]);
        // Bars
        glicDayRows.forEach((row, i) => {
          const isSelected = !_isYearView && row.day === glicemiaSelectedDayIso;
          const isHov = i === hovIdx;
          const cx2 = padL + slot * i + slot / 2;
          const x02 = cx2 - barW / 2;
          const yTop2 = toY(row.avg);
          const yBot2 = toY(0);
          const hBar2 = Math.max(1, yBot2 - yTop2);
          const g3 = _gCtx.createLinearGradient(0, yTop2, 0, yBot2);
          if (row.avg > 125) { g3.addColorStop(0, isSelected ? '#dc2626' : '#f87171'); g3.addColorStop(1, isSelected ? '#991b1b' : '#ef4444'); }
          else if (row.avg > 99) { g3.addColorStop(0, isSelected ? '#d97706' : '#fbbf24'); g3.addColorStop(1, isSelected ? '#92400e' : '#f59e0b'); }
          else { g3.addColorStop(0, isSelected ? '#6d28d9' : '#8b5cf6'); g3.addColorStop(1, isSelected ? '#4c1d95' : '#7c3aed'); }
          _gCtx.fillStyle = g3;
          _gCtx.globalAlpha = !_isYearView && glicemiaSelectedDayIso && !isSelected ? 0.35 : (hovIdx >= 0 && !isSelected && !isHov ? 0.5 : 1);
          if (typeof _gCtx.roundRect === 'function') { _gCtx.beginPath(); _gCtx.roundRect(x02, yTop2, barW, hBar2, [barR, barR, 2, 2]); _gCtx.fill(); }
          else { _gCtx.fillRect(x02, yTop2, barW, hBar2); }
          _gCtx.globalAlpha = 1;
        });
        // Y labels
        _gCtx.fillStyle = '#94a3b8'; _gCtx.font = '8px sans-serif'; _gCtx.textAlign = 'right'; _gCtx.textBaseline = 'middle';
        _gCtx.fillText('70', padL - 4, toY(70));
        _gCtx.fillText('99', padL - 4, toY(99));
        // X labels
        const _ptBrMonths2 = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const _ptBrWeekdays2 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        const _labelEvery2 = _isYearView ? 1 : Math.max(1, Math.ceil(n / 8));
        _gCtx.fillStyle = '#666'; _gCtx.font = '8px sans-serif'; _gCtx.textAlign = 'center'; _gCtx.textBaseline = 'alphabetic';
        glicDayRows.forEach((row, i) => {
          if (i % _labelEvery2 !== 0 && i !== n - 1) return;
          const cx3 = padL + slot * i + slot / 2;
          let _xl = '';
          if (_isYearView) { const mi = parseInt((row.month || '').split('-')[1] || '1', 10) - 1; _xl = _ptBrMonths2[mi] || ''; }
          else if (_is7dView) { const _d2 = new Date((row.day || '') + 'T12:00:00'); _xl = isNaN(_d2.getTime()) ? '' : _ptBrWeekdays2[_d2.getDay()]; }
          else { const p2 = (row.day || '').split('-'); _xl = p2.length === 3 ? String(Number(p2[2])) : ''; }
          _gCtx.fillText(_xl, cx3, H - 4);
        });
        // Sel-day tooltip bubble (same as original)
        const _selIso2 = glicemiaSelectedDayIso;
        if (_selIso2 && !_isYearView) {
          const _si2 = glicDayRows.findIndex(r => r.day === _selIso2);
          if (_si2 >= 0 && _si2 !== hovIdx) {
            const _sr2 = glicDayRows[_si2];
            const _cx2 = padL + slot * _si2 + slot / 2;
            const _as2 = String(_sr2.avg);
            _gCtx.font = 'bold 10px Inter, sans-serif'; const _nw2 = _gCtx.measureText(_as2).width;
            _gCtx.font = '9px Inter, sans-serif'; const _sw2 = _gCtx.measureText(' mg/dL').width;
            const _bw2 = Math.max(_nw2 + _sw2 + 18, 76);
            const _bh2 = 20, _arr2 = 5;
            let _bx2 = _cx2 - _bw2 / 2;
            if (_bx2 < padL) _bx2 = padL;
            if (_bx2 + _bw2 > padL + gw) _bx2 = padL + gw - _bw2;
            const _by2 = padT - _arr2 - 2, _br2 = 4;
            _gCtx.fillStyle = '#1e293b';
            _gCtx.beginPath();
            _gCtx.moveTo(_bx2 + _br2, _by2 - _bh2); _gCtx.lineTo(_bx2 + _bw2 - _br2, _by2 - _bh2);
            _gCtx.quadraticCurveTo(_bx2 + _bw2, _by2 - _bh2, _bx2 + _bw2, _by2 - _bh2 + _br2);
            _gCtx.lineTo(_bx2 + _bw2, _by2 - _br2); _gCtx.quadraticCurveTo(_bx2 + _bw2, _by2, _bx2 + _bw2 - _br2, _by2);
            const _ax2 = Math.min(Math.max(_cx2, _bx2 + 10), _bx2 + _bw2 - 10);
            _gCtx.lineTo(_ax2 + 5, _by2); _gCtx.lineTo(_ax2, _by2 + _arr2); _gCtx.lineTo(_ax2 - 5, _by2);
            _gCtx.lineTo(_bx2 + _br2, _by2); _gCtx.quadraticCurveTo(_bx2, _by2, _bx2, _by2 - _br2);
            _gCtx.lineTo(_bx2, _by2 - _bh2 + _br2); _gCtx.quadraticCurveTo(_bx2, _by2 - _bh2, _bx2 + _br2, _by2 - _bh2);
            _gCtx.closePath(); _gCtx.fill();
            const _ty2 = _by2 - _bh2 / 2; let _tx2 = _bx2 + (_bw2 - _nw2 - _sw2) / 2;
            _gCtx.textBaseline = 'middle'; _gCtx.textAlign = 'left';
            _gCtx.font = 'bold 10px Inter, sans-serif'; _gCtx.fillStyle = '#c4b5fd'; _gCtx.fillText(_as2, _tx2, _ty2); _tx2 += _nw2;
            _gCtx.font = '9px Inter, sans-serif'; _gCtx.fillStyle = '#94a3b8'; _gCtx.fillText(' mg/dL', _tx2, _ty2);
          }
        }
        // Hover crosshair + tooltip
        if (hovIdx >= 0) {
          const _hRow = glicDayRows[hovIdx];
          const _hCx = padL + slot * hovIdx + slot / 2;
          const _hYTop = toY(_hRow.avg);
          // Dotted vertical line
          _gCtx.save();
          _gCtx.strokeStyle = 'rgba(100,116,139,0.55)';
          _gCtx.lineWidth = 1;
          _gCtx.setLineDash([3, 3]);
          _gCtx.beginPath(); _gCtx.moveTo(_hCx, padT); _gCtx.lineTo(_hCx, H - padB); _gCtx.stroke();
          _gCtx.setLineDash([]);
          _gCtx.restore();
          // Tooltip bubble
          const _hAs = String(_hRow.avg);
          const _ptBrMH = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
          const _ptBrWH = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
          let _hDateLbl = '';
          if (!_isYearView && _hRow.day) {
            const _hd = new Date(_hRow.day + 'T12:00:00');
            if (!isNaN(_hd.getTime())) _hDateLbl = _ptBrWH[_hd.getDay()] + ', ' + _hd.getDate() + ' ' + _ptBrMH[_hd.getMonth()];
          }
          _gCtx.font = 'bold 10px Inter, sans-serif'; const _hnw = _gCtx.measureText(_hAs).width;
          _gCtx.font = '9px Inter, sans-serif'; const _hsw = _gCtx.measureText(' mg/dL').width;
          _gCtx.font = '9px Inter, sans-serif'; const _hdlw = _hDateLbl ? _gCtx.measureText(_hDateLbl).width : 0;
          const _hbh = _hDateLbl ? 34 : 22, _harr = 5;
          const _hbw = Math.max(_hnw + _hsw + 18, _hdlw + 18, 76);
          let _hbx = _hCx - _hbw / 2;
          if (_hbx < padL) _hbx = padL;
          if (_hbx + _hbw > padL + gw) _hbx = padL + gw - _hbw;
          const _hby = padT - _harr - 2, _hbr = 4;
          _gCtx.fillStyle = '#4c1d95';
          _gCtx.beginPath();
          _gCtx.moveTo(_hbx + _hbr, _hby - _hbh); _gCtx.lineTo(_hbx + _hbw - _hbr, _hby - _hbh);
          _gCtx.quadraticCurveTo(_hbx + _hbw, _hby - _hbh, _hbx + _hbw, _hby - _hbh + _hbr);
          _gCtx.lineTo(_hbx + _hbw, _hby - _hbr); _gCtx.quadraticCurveTo(_hbx + _hbw, _hby, _hbx + _hbw - _hbr, _hby);
          const _hax = Math.min(Math.max(_hCx, _hbx + 10), _hbx + _hbw - 10);
          _gCtx.lineTo(_hax + 5, _hby); _gCtx.lineTo(_hax, _hby + _harr); _gCtx.lineTo(_hax - 5, _hby);
          _gCtx.lineTo(_hbx + _hbr, _hby); _gCtx.quadraticCurveTo(_hbx, _hby, _hbx, _hby - _hbr);
          _gCtx.lineTo(_hbx, _hby - _hbh + _hbr); _gCtx.quadraticCurveTo(_hbx, _hby - _hbh, _hbx + _hbr, _hby - _hbh);
          _gCtx.closePath(); _gCtx.fill();
          _gCtx.textBaseline = 'middle'; _gCtx.textAlign = 'left';
          if (_hDateLbl) {
            const _hty1 = _hby - _hbh + 11; let _htx = _hbx + (_hbw - _hnw - _hsw) / 2;
            _gCtx.font = 'bold 10px Inter, sans-serif'; _gCtx.fillStyle = '#e9d5ff'; _gCtx.fillText(_hAs, _htx, _hty1); _htx += _hnw;
            _gCtx.font = '9px Inter, sans-serif'; _gCtx.fillStyle = '#c4b5fd'; _gCtx.fillText(' mg/dL', _htx, _hty1);
            const _hty2 = _hby - _hbh + 25; const _hdtx = _hbx + (_hbw - _hdlw) / 2;
            _gCtx.font = '9px Inter, sans-serif'; _gCtx.fillStyle = '#a78bfa'; _gCtx.fillText(_hDateLbl, _hdtx, _hty2);
          } else {
            const _hty = _hby - _hbh / 2; let _htx = _hbx + (_hbw - _hnw - _hsw) / 2;
            _gCtx.font = 'bold 10px Inter, sans-serif'; _gCtx.fillStyle = '#e9d5ff'; _gCtx.fillText(_hAs, _htx, _hty); _htx += _hnw;
            _gCtx.font = '9px Inter, sans-serif'; _gCtx.fillStyle = '#c4b5fd'; _gCtx.fillText(' mg/dL', _htx, _hty);
          }
        }
      };
      canvas._glicHovIdx = -1;
      canvas.onmousemove = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const sx = W / Math.max(1, rect.width);
        const x = (ev.clientX - rect.left) * sx;
        let newIdx = -1;
        hitBoxes.forEach((b, i) => { if (x >= b.x0 && x <= b.x1) newIdx = i; });
        if (newIdx !== canvas._glicHovIdx) {
          canvas._glicHovIdx = newIdx;
          if (canvas.__drawGlicHover) canvas.__drawGlicHover(newIdx);
        }
      };
      canvas.onmouseleave = () => {
        if (canvas._glicHovIdx !== -1) {
          canvas._glicHovIdx = -1;
          if (canvas.__drawGlicHover) canvas.__drawGlicHover(-1);
        }
      };

      // Scroll to show most recent (rightmost) bars
      if (_glicChartView && !selIso) {
        _glicChartView.scrollLeft = Math.max(0, W - containerW);
      }
    }); // end rAF
    return;
  }

  if (currentVitalDetail && currentVitalDetail.tipo === 'Sono') {
    // Aggregate by day: keep max sleep duration per day
    var _sonoByDay = new Map();
    historico.forEach(function(h) {
      var dayIso = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
      if (!dayIso) return;
      var v = parseFloat(h.valor);
      if (!Number.isFinite(v)) return;
      if (!_sonoByDay.has(dayIso) || v > _sonoByDay.get(dayIso).v) {
        _sonoByDay.set(dayIso, { day: dayIso, v: v, status: h.status });
      }
    });
    var _sonoRows = Array.from(_sonoByDay.values()).sort(function(a, b) { return a.day.localeCompare(b.day); });
    if (_sonoRows.length === 0) return;

    var _sonoIdealLow = 7, _sonoIdealHigh = 9;
    if (currentVitalDetail.ideal && typeof currentVitalDetail.ideal === 'string') {
      var _sonoIm = currentVitalDetail.ideal.match(/(\d+)[–\-](\d+)/);
      if (_sonoIm) { _sonoIdealLow = Number(_sonoIm[1]); _sonoIdealHigh = Number(_sonoIm[2]); }
    }

    var _sonoChartView = document.getElementById('pressaoHistoricoView');
    if (_sonoChartView) {
      _sonoChartView.style.overflowX = 'auto';
      _sonoChartView.style.overflowY = 'hidden';
      _sonoChartView.style.webkitOverflowScrolling = 'touch';
    }

    requestAnimationFrame(function() {
      var dpr = window.devicePixelRatio || 1;
      var n = _sonoRows.length;
      var containerW = _sonoChartView ? _sonoChartView.offsetWidth : (canvas.parentElement ? canvas.parentElement.offsetWidth : 320);
      var padL = 26, padR = 12, padT = 44, padB = 20;
      var minColW = Math.max(10, (containerW - padL - padR) / Math.max(1, n));
      var W = Math.max(containerW, padL + Math.ceil(n * minColW) + padR);
      var H = 180;
      var gw = W - padL - padR;
      var gh = H - padT - padB;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';

      var allVals = _sonoRows.map(function(r) { return r.v; });
      var yHigh = Math.max(Math.max.apply(null, allVals) * 1.1, _sonoIdealHigh * 1.25, 12);
      var yLow = 0;
      var span = yHigh - yLow;
      var toY = function(v) { return padT + ((yHigh - v) / span) * gh; };

      var slot = gw / Math.max(1, n);
      var barW = Math.min(18, Math.max(7, slot * 0.58));
      var barR = Math.min(5, barW / 2 - 0.5);

      var _sonoHitBoxes = [];
      var _ptBrDS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      var _mAbrDS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

      function _fmtSonoV(v) {
        var hh = Math.floor(v), mm = Math.round((v - hh) * 60);
        return hh + 'h' + (mm > 0 ? ' ' + String(mm).padStart(2, '0') + 'm' : '');
      }

      function _drawSonoBase(hovIdx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(0, 0, W, H);

        // Ideal zone
        ctx.fillStyle = 'rgba(124, 58, 237, 0.07)';
        ctx.fillRect(padL, toY(_sonoIdealHigh), gw, toY(_sonoIdealLow) - toY(_sonoIdealHigh));
        ctx.strokeStyle = 'rgba(124, 58, 237, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(padL, toY(_sonoIdealHigh)); ctx.lineTo(padL + gw, toY(_sonoIdealHigh)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(padL, toY(_sonoIdealLow)); ctx.lineTo(padL + gw, toY(_sonoIdealLow)); ctx.stroke();
        ctx.setLineDash([]);

        // Bars
        _sonoRows.forEach(function(row, i) {
          var isHov = i === hovIdx;
          var cx = padL + slot * i + slot / 2;
          var x0 = cx - barW / 2;
          var yTop = toY(row.v);
          var yBot = toY(0);
          var hBar = Math.max(1, yBot - yTop);
          var isIdeal = row.v >= _sonoIdealLow && row.v <= _sonoIdealHigh;
          var g = ctx.createLinearGradient(0, yTop, 0, yBot);
          if (isIdeal) {
            g.addColorStop(0, isHov ? '#c4b5fd' : '#a78bfa');
            g.addColorStop(1, isHov ? '#8b5cf6' : '#7c3aed');
          } else if (row.v < _sonoIdealLow) {
            g.addColorStop(0, isHov ? '#fca5a5' : '#f87171');
            g.addColorStop(1, isHov ? '#f87171' : '#ef4444');
          } else {
            g.addColorStop(0, isHov ? '#fcd34d' : '#fbbf24');
            g.addColorStop(1, isHov ? '#f59e0b' : '#d97706');
          }
          ctx.fillStyle = g;
          ctx.globalAlpha = hovIdx >= 0 && !isHov ? 0.45 : 1;
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath(); ctx.roundRect(x0, yTop, barW, hBar, [barR, barR, 2, 2]); ctx.fill();
          } else {
            ctx.fillRect(x0, yTop, barW, hBar);
          }
          ctx.globalAlpha = 1;
        });

        // Y labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(_sonoIdealLow + 'h', padL - 4, toY(_sonoIdealLow));
        ctx.fillText(_sonoIdealHigh + 'h', padL - 4, toY(_sonoIdealHigh));

        // X labels
        var labelEvery = Math.max(1, Math.ceil(n / 8));
        ctx.fillStyle = '#666';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        _sonoRows.forEach(function(row, i) {
          if (i % labelEvery !== 0 && i !== n - 1) return;
          var cx2 = padL + slot * i + slot / 2;
          var parts = (row.day || '').split('-');
          ctx.fillText(parts.length === 3 ? String(Number(parts[2])) : '', cx2, H - 4);
        });

        // Hover crosshair + tooltip bubble
        if (hovIdx >= 0) {
          var hRow = _sonoRows[hovIdx];
          var hCx = padL + slot * hovIdx + slot / 2;
          ctx.save();
          ctx.strokeStyle = 'rgba(124,58,237,0.45)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(hCx, padT); ctx.lineTo(hCx, H - padB); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          var _hValStr = _fmtSonoV(hRow.v);
          var _hUnitStr = ' horas';
          var _hDL = '';
          if (hRow.day) {
            var _hp = hRow.day.split('-').map(Number);
            var _hd = new Date(_hp[0], _hp[1] - 1, _hp[2]);
            _hDL = _ptBrDS[_hd.getDay()] + ', ' + _hp[2] + ' ' + _mAbrDS[_hp[1] - 1];
          }
          ctx.font = 'bold 10px Inter, sans-serif'; var _hnw = ctx.measureText(_hValStr).width;
          ctx.font = '9px Inter, sans-serif'; var _husw = ctx.measureText(_hUnitStr).width;
          var _hdlw = _hDL ? ctx.measureText(_hDL).width : 0;
          var _hbh = _hDL ? 34 : 22, _harr = 5;
          var _hbw = Math.max(_hnw + _husw + 18, _hdlw + 18, 80);
          var _hbx = hCx - _hbw / 2;
          if (_hbx < padL) _hbx = padL;
          if (_hbx + _hbw > padL + gw) _hbx = padL + gw - _hbw;
          var _hby = padT - _harr - 2, _hbr = 4;
          ctx.fillStyle = '#4c1d95';
          ctx.beginPath();
          ctx.moveTo(_hbx + _hbr, _hby - _hbh); ctx.lineTo(_hbx + _hbw - _hbr, _hby - _hbh);
          ctx.quadraticCurveTo(_hbx + _hbw, _hby - _hbh, _hbx + _hbw, _hby - _hbh + _hbr);
          ctx.lineTo(_hbx + _hbw, _hby - _hbr); ctx.quadraticCurveTo(_hbx + _hbw, _hby, _hbx + _hbw - _hbr, _hby);
          var _hax = Math.min(Math.max(hCx, _hbx + 10), _hbx + _hbw - 10);
          ctx.lineTo(_hax + 5, _hby); ctx.lineTo(_hax, _hby + _harr); ctx.lineTo(_hax - 5, _hby);
          ctx.lineTo(_hbx + _hbr, _hby); ctx.quadraticCurveTo(_hbx, _hby, _hbx, _hby - _hbr);
          ctx.lineTo(_hbx, _hby - _hbh + _hbr); ctx.quadraticCurveTo(_hbx, _hby - _hbh, _hbx + _hbr, _hby - _hbh);
          ctx.closePath(); ctx.fill();
          ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          if (_hDL) {
            var _hty1 = _hby - _hbh + 11;
            var _htx = _hbx + (_hbw - _hnw - _husw) / 2;
            ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#e9d5ff'; ctx.fillText(_hValStr, _htx, _hty1); _htx += _hnw;
            ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#c4b5fd'; ctx.fillText(_hUnitStr, _htx, _hty1);
            ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#a78bfa';
            ctx.textAlign = 'center'; ctx.fillText(_hDL, _hbx + _hbw / 2, _hby - _hbh + 25);
          } else {
            var _hty = _hby - _hbh / 2;
            var _htx2 = _hbx + (_hbw - _hnw - _husw) / 2;
            ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#e9d5ff'; ctx.fillText(_hValStr, _htx2, _hty); _htx2 += _hnw;
            ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#c4b5fd'; ctx.fillText(_hUnitStr, _htx2, _hty);
          }
        }
      }

      // Build hit boxes
      _sonoRows.forEach(function(row, i) {
        _sonoHitBoxes.push({ x0: padL + slot * i, x1: padL + slot * (i + 1), idx: i });
      });

      _drawSonoBase(-1);
      canvas.style.cursor = 'pointer';

      canvas._sonoHovIdx = -1;
      canvas.onmousemove = function(ev) {
        var rect = canvas.getBoundingClientRect();
        var sx = W / Math.max(1, rect.width);
        var x = (ev.clientX - rect.left) * sx;
        var newIdx = -1;
        _sonoHitBoxes.forEach(function(b) { if (x >= b.x0 && x <= b.x1) newIdx = b.idx; });
        if (newIdx !== canvas._sonoHovIdx) {
          canvas._sonoHovIdx = newIdx;
          _drawSonoBase(newIdx);
        }
      };
      canvas.onmouseleave = function() {
        if (canvas._sonoHovIdx !== -1) {
          canvas._sonoHovIdx = -1;
          _drawSonoBase(-1);
        }
      };

      if (_sonoChartView) _sonoChartView.scrollLeft = Math.max(0, W - containerW);
    });
    return;
  }

  if (currentVitalDetail && currentVitalDetail.tipo === 'Oxigenação') {
    var _oxigIsYearView = vitalDefaultPeriod === 'year';
    var _oxigRows;
    if (_oxigIsYearView) {
      _oxigRows = aggregateOxigenacaoByMonth(historico).map(function(m) { return { day: m.month, v: m.avg, status: '' }; });
    } else {
      var _oxigByDay = new Map();
      historico.forEach(function(h) {
        var dayIso = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
        if (!dayIso) return;
        var v = parseFloat(h.valor);
        if (!Number.isFinite(v)) return;
        if (!_oxigByDay.has(dayIso) || v < _oxigByDay.get(dayIso).v) {
          _oxigByDay.set(dayIso, { day: dayIso, v: v, status: h.status });
        }
      });
      _oxigRows = Array.from(_oxigByDay.values()).sort(function(a, b) { return a.day.localeCompare(b.day); });
    }
    if (_oxigRows.length === 0) return;

    var _oxigIdealLow = 95, _oxigIdealHigh = 100;
    if (currentVitalDetail.ideal && typeof currentVitalDetail.ideal === 'string') {
      var _oxigIm = currentVitalDetail.ideal.match(/(\d+)[\u2013\-](\d+)/);
      if (_oxigIm) { _oxigIdealLow = Number(_oxigIm[1]); _oxigIdealHigh = Number(_oxigIm[2]); }
    }

    var _oxigChartView = document.getElementById('pressaoHistoricoView');
    if (_oxigChartView) {
      _oxigChartView.style.overflowX = 'auto';
      _oxigChartView.style.overflowY = 'hidden';
      _oxigChartView.style.webkitOverflowScrolling = 'touch';
    }

    requestAnimationFrame(function() {
      var dpr = window.devicePixelRatio || 1;
      var n = _oxigRows.length;
      var containerW = _oxigChartView ? _oxigChartView.offsetWidth : (canvas.parentElement ? canvas.parentElement.offsetWidth : 320);
      var padL = 32, padR = 12, padT = 44, padB = 20;
      var minColW = Math.max(10, (containerW - padL - padR) / Math.max(1, n));
      var W = Math.max(containerW, padL + Math.ceil(n * minColW) + padR);
      var H = 180;
      var gw = W - padL - padR;
      var gh = H - padT - padB;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';

      var allVals = _oxigRows.map(function(r) { return r.v; });
      var yLow = Math.max(80, Math.min.apply(null, allVals) - 3);
      var yHigh = 101;
      var span = yHigh - yLow;
      var toY = function(v) { return padT + ((yHigh - v) / span) * gh; };

      var slot = gw / Math.max(1, n);
      var barW = Math.min(18, Math.max(7, slot * 0.58));
      var barR = Math.min(5, barW / 2 - 0.5);
      var _oxigHitBoxes = [];
      var _ptBrDO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      var _mAbrDO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

      function _drawOxigBase(hovIdx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(0, 0, W, H);
        // Ideal zone
        ctx.fillStyle = 'rgba(22,163,74,0.08)';
        ctx.fillRect(padL, toY(yHigh), gw, toY(_oxigIdealLow) - toY(yHigh));
        ctx.strokeStyle = 'rgba(22,163,74,0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(padL, toY(_oxigIdealLow)); ctx.lineTo(padL + gw, toY(_oxigIdealLow)); ctx.stroke();
        ctx.setLineDash([]);
        // Y labels
        ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(_oxigIdealLow + '%', padL - 4, toY(_oxigIdealLow));
        ctx.fillText('100%', padL - 4, toY(100));
        // Bars
        _oxigRows.forEach(function(row, i) {
          var isHov = i === hovIdx;
          var cx = padL + slot * i + slot / 2;
          var x0 = cx - barW / 2;
          var yTop = toY(row.v);
          var yBot = toY(yLow);
          var hBar = Math.max(1, yBot - yTop);
          var barColor = row.v >= _oxigIdealLow ? '#16a34a' : (row.v >= 90 ? '#f59e0b' : '#ef4444');
          var barColorDim = row.v >= _oxigIdealLow ? 'rgba(22,163,74,0.22)' : (row.v >= 90 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)');
          var _selDay = oxigenacaoSelectedDayIso;
          var isSelected = _selDay && row.day === _selDay;
          if ((hovIdx !== -1 && !isHov) || (!_oxigIsYearView && _selDay && !isSelected)) {
            ctx.fillStyle = barColorDim;
          } else {
            var grad = ctx.createLinearGradient(0, yTop, 0, yBot);
            grad.addColorStop(0, barColor);
            grad.addColorStop(1, barColor + 'bb');
            ctx.fillStyle = grad;
          }
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath(); ctx.roundRect(x0, yTop, barW, hBar, [barR, barR, 0, 0]); ctx.fill();
          } else { ctx.fillRect(x0, yTop, barW, hBar); }
          ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          if (_oxigIsYearView) {
            var _mP = row.day.split('-');
            ctx.fillText(_mAbrDO[parseInt(_mP[1], 10) - 1], cx, H - padB + 3);
          } else {
            var pp = row.day.split('-').map(Number);
            ctx.fillText(String(pp[2]), cx, H - padB + 3);
          }
        });
        // Hover tooltip
        if (hovIdx >= 0 && hovIdx < _oxigRows.length) {
          var hRow = _oxigRows[hovIdx];
          var hCx = padL + slot * hovIdx + slot / 2;
          var _hValStr = String(hRow.v);
          var _hUnitStr = '%';
          var _hDL = '';
          if (hRow.day) {
            if (_oxigIsYearView) {
              var _hmP = hRow.day.split('-');
              _hDL = _mAbrDO[parseInt(_hmP[1], 10) - 1] + '/' + _hmP[0];
            } else {
              var _hp = hRow.day.split('-').map(Number);
              var _hd = new Date(_hp[0], _hp[1] - 1, _hp[2]);
              _hDL = _ptBrDO[_hd.getDay()] + ', ' + _hp[2] + ' ' + _mAbrDO[_hp[1] - 1];
            }
          }
          ctx.font = 'bold 10px Inter, sans-serif'; var _hnw = ctx.measureText(_hValStr).width;
          ctx.font = '9px Inter, sans-serif'; var _husw = ctx.measureText(_hUnitStr).width;
          var _hdlw = _hDL ? ctx.measureText(_hDL).width : 0;
          var _hbh = _hDL ? 34 : 22, _harr = 5;
          var _hbw = Math.max(_hnw + _husw + 18, _hdlw + 18, 70);
          var _hbx = hCx - _hbw / 2;
          if (_hbx < padL) _hbx = padL;
          if (_hbx + _hbw > padL + gw) _hbx = padL + gw - _hbw;
          var _hby = padT - _harr - 2, _hbr = 4;
          ctx.fillStyle = '#14532d';
          ctx.beginPath();
          ctx.moveTo(_hbx + _hbr, _hby - _hbh); ctx.lineTo(_hbx + _hbw - _hbr, _hby - _hbh);
          ctx.quadraticCurveTo(_hbx + _hbw, _hby - _hbh, _hbx + _hbw, _hby - _hbh + _hbr);
          ctx.lineTo(_hbx + _hbw, _hby - _hbr); ctx.quadraticCurveTo(_hbx + _hbw, _hby, _hbx + _hbw - _hbr, _hby);
          var _hax = Math.min(Math.max(hCx, _hbx + 10), _hbx + _hbw - 10);
          ctx.lineTo(_hax + 5, _hby); ctx.lineTo(_hax, _hby + _harr); ctx.lineTo(_hax - 5, _hby);
          ctx.lineTo(_hbx + _hbr, _hby); ctx.quadraticCurveTo(_hbx, _hby, _hbx, _hby - _hbr);
          ctx.lineTo(_hbx, _hby - _hbh + _hbr); ctx.quadraticCurveTo(_hbx, _hby - _hbh, _hbx + _hbr, _hby - _hbh);
          ctx.closePath(); ctx.fill();
          ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          if (_hDL) {
            var _hty1 = _hby - _hbh + 11;
            var _htx = _hbx + (_hbw - _hnw - _husw) / 2;
            ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#bbf7d0'; ctx.fillText(_hValStr, _htx, _hty1); _htx += _hnw;
            ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#86efac'; ctx.fillText(_hUnitStr, _htx, _hty1);
            ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#4ade80';
            ctx.textAlign = 'center'; ctx.fillText(_hDL, _hbx + _hbw / 2, _hby - _hbh + 25);
          } else {
            var _hty = _hby - _hbh / 2;
            var _htx2 = _hbx + (_hbw - _hnw - _husw) / 2;
            ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#bbf7d0'; ctx.fillText(_hValStr, _htx2, _hty); _htx2 += _hnw;
            ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#86efac'; ctx.fillText(_hUnitStr, _htx2, _hty);
          }
        }
      }

      _oxigRows.forEach(function(row, i) {
        _oxigHitBoxes.push({ x0: padL + slot * i, x1: padL + slot * (i + 1), idx: i, day: row.day });
      });
      _drawOxigBase(-1);
      canvas.style.cursor = 'pointer';
      canvas._oxigHovIdx = -1;
      canvas.onmousemove = function(ev) {
        var rect = canvas.getBoundingClientRect();
        var sx = W / Math.max(1, rect.width);
        var x = (ev.clientX - rect.left) * sx;
        var newIdx = -1;
        _oxigHitBoxes.forEach(function(b) { if (x >= b.x0 && x <= b.x1) newIdx = b.idx; });
        if (newIdx !== canvas._oxigHovIdx) { canvas._oxigHovIdx = newIdx; _drawOxigBase(newIdx); }
      };
      canvas.onmouseleave = function() {
        if (canvas._oxigHovIdx !== -1) { canvas._oxigHovIdx = -1; _drawOxigBase(-1); }
      };
      canvas.onclick = function(ev) {
        if (_oxigIsYearView) return;
        var rect = canvas.getBoundingClientRect();
        var sx = W / Math.max(1, rect.width);
        var x = (ev.clientX - rect.left) * sx;
        var hitIdx = -1;
        _oxigHitBoxes.forEach(function(b) { if (x >= b.x0 && x <= b.x1) hitIdx = b.idx; });
        if (hitIdx >= 0 && typeof selectOxigenacaoDay === 'function') {
          selectOxigenacaoDay(_oxigRows[hitIdx].day);
        }
      };
      if (_oxigChartView) _oxigChartView.scrollLeft = Math.max(0, W - containerW);
    });
    return;
  }

  if (currentVitalDetail && currentVitalDetail.tipo === 'Hidratação') {
    var _hidByDay = new Map();
    historico.forEach(function(h) {
      var dayIso = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
      if (!dayIso) return;
      var v = parseFloat(h.valor);
      if (!Number.isFinite(v) || v < 0) return;
      if (!_hidByDay.has(dayIso) || v > _hidByDay.get(dayIso).v) {
        _hidByDay.set(dayIso, { day: dayIso, v: v, status: h.status });
      }
    });
    var _hidRows = Array.from(_hidByDay.values()).sort(function(a, b) { return a.day.localeCompare(b.day); });
    if (_hidRows.length === 0) return;

    var _hidIsYearView = vitalDefaultPeriod === 'year';
    if (_hidIsYearView) {
      _hidRows = aggregateHidratacaoByMonth(historico).map(function(m) { return { day: m.month, v: m.avg, status: '' }; });
    }

    var _hidGoal = 2000;
    if (currentVitalDetail.ideal && typeof currentVitalDetail.ideal === 'string') {
      var _hidIm = currentVitalDetail.ideal.match(/(\d+)/);
      if (_hidIm) _hidGoal = Number(_hidIm[1]);
    }

    var _hidChartView = document.getElementById('pressaoHistoricoView');
    if (_hidChartView) {
      _hidChartView.style.overflowX = 'auto';
      _hidChartView.style.overflowY = 'hidden';
      _hidChartView.style.webkitOverflowScrolling = 'touch';
    }

    requestAnimationFrame(function() {
      var dpr = window.devicePixelRatio || 1;
      var n = _hidRows.length;
      var containerW = _hidChartView ? _hidChartView.offsetWidth : (canvas.parentElement ? canvas.parentElement.offsetWidth : 320);
      var padL = 36, padR = 12, padT = 44, padB = 20;
      var minColW = Math.max(10, (containerW - padL - padR) / Math.max(1, n));
      var W = Math.max(containerW, padL + Math.ceil(n * minColW) + padR);
      var H = 180;
      var gw = W - padL - padR;
      var gh = H - padT - padB;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';

      var allVals = _hidRows.map(function(r) { return r.v; });
      var yLow = 0;
      var yHigh = Math.max(_hidGoal * 1.3, Math.max.apply(null, allVals) * 1.1);
      yHigh = Math.ceil(yHigh / 500) * 500;
      var span = yHigh - yLow;
      var toY = function(v) { return padT + ((yHigh - v) / span) * gh; };

      var slot = gw / Math.max(1, n);
      var barW = Math.min(18, Math.max(7, slot * 0.58));
      var barR = Math.min(5, barW / 2 - 0.5);
      var _hidHitBoxes = [];
      var _ptBrDH = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      var _mAbrDH = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

      function _fmtMlH(ml) {
        return ml >= 1000 ? (ml / 1000).toFixed(1).replace('.0', '') + ' L' : ml + ' ml';
      }

      function _drawHidBase(hovIdx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(0, 0, W, H);
        // Goal zone (above goal line)
        ctx.fillStyle = 'rgba(34,197,94,0.06)';
        ctx.fillRect(padL, toY(yHigh), gw, toY(_hidGoal) - toY(yHigh));
        // Goal line
        ctx.strokeStyle = 'rgba(34,197,94,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(padL, toY(_hidGoal)); ctx.lineTo(padL + gw, toY(_hidGoal)); ctx.stroke();
        ctx.setLineDash([]);
        // Y labels
        ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(_fmtMlH(_hidGoal), padL - 4, toY(_hidGoal));
        ctx.fillText(_fmtMlH(yHigh), padL - 4, toY(yHigh));
        // Bars
        _hidRows.forEach(function(row, i) {
          var isHov = i === hovIdx;
          var cx = padL + slot * i + slot / 2;
          var x0 = cx - barW / 2;
          var yTop = toY(row.v);
          var yBot = toY(yLow);
          var hBar = Math.max(1, yBot - yTop);
          var barColor = row.v >= _hidGoal ? '#22c55e' : (row.v >= _hidGoal * 0.6 ? '#3b82f6' : '#f59e0b');
          var barColorDim = row.v >= _hidGoal ? 'rgba(34,197,94,0.22)' : (row.v >= _hidGoal * 0.6 ? 'rgba(59,130,246,0.22)' : 'rgba(245,158,11,0.25)');
          if (hovIdx !== -1 && !isHov) {
            ctx.fillStyle = barColorDim;
          } else {
            var grad = ctx.createLinearGradient(0, yTop, 0, yBot);
            grad.addColorStop(0, barColor);
            grad.addColorStop(1, barColor + 'bb');
            ctx.fillStyle = grad;
          }
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath(); ctx.roundRect(x0, yTop, barW, hBar, [barR, barR, 0, 0]); ctx.fill();
          } else { ctx.fillRect(x0, yTop, barW, hBar); }
          ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          if (_hidIsYearView) {
            var _mP = row.day.split('-');
            ctx.fillText(_mAbrDH[parseInt(_mP[1], 10) - 1], cx, H - padB + 3);
          } else {
            var pp = row.day.split('-').map(Number);
            ctx.fillText(String(pp[2]), cx, H - padB + 3);
          }
        });
        // Hover tooltip
        if (hovIdx >= 0 && hovIdx < _hidRows.length) {
          var hRow = _hidRows[hovIdx];
          var hCx = padL + slot * hovIdx + slot / 2;
          var _hValStr = _fmtMlH(hRow.v);
          var _hDL = '';
          if (hRow.day) {
            if (_hidIsYearView) {
              var _hpY = hRow.day.split('-').map(Number);
              _hDL = _mAbrDH[_hpY[1] - 1] + ' ' + _hpY[0];
            } else {
              var _hp = hRow.day.split('-').map(Number);
              var _hd = new Date(_hp[0], _hp[1] - 1, _hp[2]);
              _hDL = _ptBrDH[_hd.getDay()] + ', ' + _hp[2] + ' ' + _mAbrDH[_hp[1] - 1];
            }
          }
          ctx.font = 'bold 10px Inter, sans-serif'; var _hnw = ctx.measureText(_hValStr).width;
          ctx.font = '9px Inter, sans-serif'; var _hdlw = _hDL ? ctx.measureText(_hDL).width : 0;
          var _hbh = _hDL ? 34 : 22, _harr = 5;
          var _hbw = Math.max(_hnw + 18, _hdlw + 18, 70);
          var _hbx = hCx - _hbw / 2;
          if (_hbx < padL) _hbx = padL;
          if (_hbx + _hbw > padL + gw) _hbx = padL + gw - _hbw;
          var _hby = padT - _harr - 2, _hbr = 4;
          ctx.fillStyle = '#1e3a5f';
          ctx.beginPath();
          ctx.moveTo(_hbx + _hbr, _hby - _hbh); ctx.lineTo(_hbx + _hbw - _hbr, _hby - _hbh);
          ctx.quadraticCurveTo(_hbx + _hbw, _hby - _hbh, _hbx + _hbw, _hby - _hbh + _hbr);
          ctx.lineTo(_hbx + _hbw, _hby - _hbr); ctx.quadraticCurveTo(_hbx + _hbw, _hby, _hbx + _hbw - _hbr, _hby);
          var _hax = Math.min(Math.max(hCx, _hbx + 10), _hbx + _hbw - 10);
          ctx.lineTo(_hax + 5, _hby); ctx.lineTo(_hax, _hby + _harr); ctx.lineTo(_hax - 5, _hby);
          ctx.lineTo(_hbx + _hbr, _hby); ctx.quadraticCurveTo(_hbx, _hby, _hbx, _hby - _hbr);
          ctx.lineTo(_hbx, _hby - _hbh + _hbr); ctx.quadraticCurveTo(_hbx, _hby - _hbh, _hbx + _hbr, _hby - _hbh);
          ctx.closePath(); ctx.fill();
          ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          if (_hDL) {
            var _hty1 = _hby - _hbh + 11;
            var _htx = _hbx + (_hbw - _hnw) / 2;
            ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#bae6fd'; ctx.fillText(_hValStr, _htx, _hty1);
            ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#7dd3fc';
            ctx.textAlign = 'center'; ctx.fillText(_hDL, _hbx + _hbw / 2, _hby - _hbh + 25);
          } else {
            var _hty = _hby - _hbh / 2;
            var _htx2 = _hbx + (_hbw - _hnw) / 2;
            ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#bae6fd'; ctx.fillText(_hValStr, _htx2, _hty);
          }
        }
      }

      _hidRows.forEach(function(row, i) {
        _hidHitBoxes.push({ x0: padL + slot * i, x1: padL + slot * (i + 1), idx: i });
      });
      _drawHidBase(-1);
      canvas.style.cursor = 'pointer';
      canvas._hidHovIdx = -1;
      canvas.onmousemove = function(ev) {
        var rect = canvas.getBoundingClientRect();
        var sx = W / Math.max(1, rect.width);
        var x = (ev.clientX - rect.left) * sx;
        var newIdx = -1;
        _hidHitBoxes.forEach(function(b) { if (x >= b.x0 && x <= b.x1) newIdx = b.idx; });
        if (newIdx !== canvas._hidHovIdx) { canvas._hidHovIdx = newIdx; _drawHidBase(newIdx); }
      };
      canvas.onmouseleave = function() {
        if (canvas._hidHovIdx !== -1) { canvas._hidHovIdx = -1; _drawHidBase(-1); }
      };
      if (_hidChartView) _hidChartView.scrollLeft = Math.max(0, W - containerW);
    });
    return;
  }

  const values = historico.slice(0, 10).reverse().map(h => {
    if (typeof h.valor === 'object' && h.valor.sistolica != null) return parseInt(h.valor.sistolica, 10);
    if (typeof h.valor === 'string' && h.valor.includes('/')) return parseInt(h.valor.split('/')[0], 10);
    return parseFloat(h.valor);
  }).filter(v => !isNaN(v));

  if (values.length === 0) return;

  // Calcular faixa ideal do sinal atual
  let idealMin = null, idealMax = null;
  if (currentVitalDetail && currentVitalDetail.ideal) {
    const ideal = currentVitalDetail.ideal;
    if (ideal.type === 'range' && ideal.min != null && ideal.max != null) {
      idealMin = parseFloat(ideal.min);
      idealMax = parseFloat(ideal.max);
    } else if (ideal.type === 'pressure' && ideal.systolic != null) {
      idealMin = parseFloat(ideal.systolic) - 10;
      idealMax = parseFloat(ideal.systolic) + 10;
    } else if (ideal.type === 'target' && ideal.target != null) {
      idealMin = parseFloat(ideal.target) - 10;
      idealMax = parseFloat(ideal.target) + 10;
    }
  }

  // Range inclui valores ideais para escala correta
  const allValues = [...values];
  if (idealMin !== null) allValues.push(idealMin, idealMax);
  const maxValue = Math.max(...allValues);
  const minValue = Math.min(...allValues);
  const range = maxValue - minValue || 1;

  const padding = 14;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  const pointSpacing = graphWidth / (values.length - 1 || 1);

  const toY = v => height - padding - ((v - minValue) / range) * graphHeight;

  // Fundo
  ctx.fillStyle = '#F8F9FA';
  ctx.fillRect(0, 0, width, height);

  // Faixa ideal (banda neutra)
  if (idealMin !== null) {
    const yMax = toY(idealMax);
    const yMin = toY(idealMin);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(padding, yMax, graphWidth, yMin - yMax);

    // Linha ideal min
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding, toY(idealMin));
    ctx.lineTo(padding + graphWidth, toY(idealMin));
    ctx.stroke();

    // Linha ideal max
    ctx.beginPath();
    ctx.moveTo(padding, toY(idealMax));
    ctx.lineTo(padding + graphWidth, toY(idealMax));
    ctx.stroke();
    ctx.setLineDash([]);

    // Label "Ideal"
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.font = '9px sans-serif';
    ctx.fillText('ideal', padding + 2, toY(idealMax) - 2);
  }

  // Linha dos valores
  ctx.strokeStyle = '#6e6e6e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = padding + index * pointSpacing;
    const y = toY(value);
    index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Pontos
  values.forEach((value, index) => {
    const x = padding + index * pointSpacing;
    const y = toY(value);
    const isIdeal = idealMin !== null && value >= idealMin && value <= idealMax;
    ctx.fillStyle = isIdeal ? '#5a5a5a' : '#8a8a8a';
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Uma linha da lista do modal de Batimento (hora do dia ou data agregada – sem coluna de status).
 * `hourDetail`: vista dia hora a hora – formato ??o61 a 89 bpm??? em cima, intervalo em baixo (como lista de registos).
 */
function htmlVitalBatimentoListRow(opts) {
  const { rowClass, clickAttr = '', primaryLine, badgeHtml = '', valueHtml, hourDetail } = opts;
  if (hourDetail) {
    const trail = hourDetail.trailHtml || '';
    return `
      <div class="${rowClass}"${clickAttr}>
        <div class="vital-list-main vital-list-main--hour-detail">
          <div class="vital-list-measure-line">${hourDetail.measureLine}</div>
          <div class="vital-list-time-line">${hourDetail.timeLine}</div>
          ${badgeHtml}
        </div>
        <div class="vital-list-trail">${trail}</div>
      </div>`;
  }
  return `
      <div class="${rowClass}"${clickAttr}>
        <div class="vital-list-main">
          <div class="vital-list-date">${primaryLine}</div>
          ${badgeHtml}
        </div>
        <div class="vital-list-value">${valueHtml}</div>
      </div>`;
}

function bindBatimentoHourRows() {
  const host = document.getElementById('vitalDetailContent');
  if (!host) return;
  host.querySelectorAll('.vital-list-item--hora-clicavel[data-batimento-hour]').forEach((row) => {
    const hour = Number.parseInt(row.getAttribute('data-batimento-hour') || '', 10);
    if (!Number.isInteger(hour)) return;
    const ctxRaw = row.getAttribute('data-batimento-context');
    const contexto = ctxRaw === 'exercicio' || ctxRaw === 'sono' || ctxRaw === 'repouso' ? ctxRaw : null;
    row.onclick = () => openBatimentoMinutoDetalhe(hour, contexto);
    row.onkeydown = (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openBatimentoMinutoDetalhe(hour, contexto);
      }
    };
  });
}

function renderVitalDetailContent(historico) {
  const raw = Array.isArray(historico) ? historico : [];
  const bcDaySelected =
    currentVitalDetail?.tipo === 'Batimento Cardíaco' && vitalBatimentoChartSelection?.kind === 'day';
  currentVitalHistoricoView = bcDaySelected ? sortHistoricoBatimentoAsc(raw) : raw;

  if (currentVitalHistoricoView.length === 0) {
    const emptyMsg =
      currentVitalDetail?.tipo === 'Batimento Cardíaco' && vitalBatimentoChartSelection
        ? 'Nenhuma medição para a coluna selecionada.'
        : 'Nenhum registro encontrado';
    document.getElementById('vitalDetailContent').innerHTML = `<div class="empty-state"><div class="empty-text">${emptyMsg}</div></div>`;
    return;
  }

  if (currentVitalDetail?.tipo === 'Batimento Cardíaco') {
    if (bcDaySelected) {
      const dayIso = vitalBatimentoChartSelection && vitalBatimentoChartSelection.iso;
      const inMode = filterBatimentoByContext(currentVitalDetail.historico);
      const buckets =
        dayIso && Array.isArray(currentVitalDetail.historico)
          ? aggregateHeartRateByHourForDay(inMode, dayIso)
          : [];
      const buildHourBucketRow = (bucket) => {
        const h = bucket.hour;
        const labelHora = formatBatimentoHourIntervalLabel(h);
        const dateTxt = dayIso ? formatDateForUI(dayIso) : '';
        const hasRange =
          bucket.min != null &&
          bucket.max != null &&
          Number.isFinite(bucket.min) &&
          Number.isFinite(bucket.max);
        const measureLine = hasRange ? formatBatimentoBpmRangeLine(bucket.min, bucket.max) : '–';
        const badgeHtml = batimentoBucketContextBadgeHtml(bucket);
        const bg = hasRange ? batimentoHourlyBucketRowBgClass(bucket) : '';
        let rowClass = 'vital-list-item vital-list-item--hour-bucket';
        if (bg) rowClass += ` ${bg}`;
        let clickAttr = '';
        let trailHtml = '';
        const ex = bucket.readings && bucket.readings.find((r) => r.contextoColeta === 'exercicio' && r.exercicioSessao);
        const sn = bucket.readings && bucket.readings.find((r) => r.contextoColeta === 'sono' && r.sonoSessao);
        if (hasRange) {
          rowClass += ' vital-list-item--hora-clicavel';
          trailHtml = '<span class="vital-list-chevron" aria-hidden="true">&#8250;</span>';
          if (ex) {
            rowClass += ' vital-list-item--exercicio';
            clickAttr = ` role="button" tabindex="0" data-batimento-hour="${h}" data-batimento-context="exercicio" onclick="openBatimentoMinutoDetalhe(${h}, 'exercicio')"`;
          } else if (sn) {
            rowClass += ' vital-list-item--sono';
            clickAttr = ` role="button" tabindex="0" data-batimento-hour="${h}" data-batimento-context="sono" onclick="openBatimentoMinutoDetalhe(${h}, 'sono')"`;
          } else {
            clickAttr = ` role="button" tabindex="0" data-batimento-hour="${h}" data-batimento-context="" onclick="openBatimentoMinutoDetalhe(${h}, null)"`;
          }
        }
        return htmlVitalBatimentoListRow({
          rowClass,
          clickAttr,
          badgeHtml,
          hourDetail: {
            measureLine,
            timeLine: dateTxt ? `${dateTxt} · ${labelHora}` : labelHora,
            trailHtml
          }
        });
      };
      const rowFragments = buckets.map(buildHourBucketRow);
      const visibleFr = rowFragments.slice(-BATIMENTO_HISTORICO_PREVIEW).reverse();
      const hiddenFr = rowFragments.slice(0, -BATIMENTO_HISTORICO_PREVIEW);
      let htmlDay = visibleFr.join('');
      if (hiddenFr.length > 0) {
        const hiddenHtml = hiddenFr.join('');
        htmlDay += `
        <div id="batimentoHistoricoExtraHora" style="display:none;">${hiddenHtml}</div>
        <button type="button" class="vital-ver-mais-btn" onclick="
          var el=document.getElementById('batimentoHistoricoExtraHora');
          var open=el.style.display!=='none';
          el.style.display=open?'none':'block';
          this.textContent=open?'Ver mais (${hiddenFr.length})':'Ver menos';
        ">Ver mais (${hiddenFr.length})</button>`;
      }
      document.getElementById('vitalDetailContent').innerHTML = htmlDay;
      bindBatimentoHourRows();
      return;
    }

    const dailyRows = buildBatimentoHistoricoDailyRows(currentVitalHistoricoView);
    if (dailyRows.length === 0) {
      document.getElementById('vitalDetailContent').innerHTML =
        '<div class="empty-state"><div class="empty-text">Nenhum valor numérico no período</div></div>';
      return;
    }
    const buildRow = (row) => {
      const valStr = formatBatimentoBpmRangeLine(row.min, row.max);
      const badgeHtml = row.ctxBadge ? `<span class="vital-context-badge">${row.ctxBadge}</span>` : '';
      const rowClass = `vital-list-item vital-list-item--day-nav vital-list-item--hour-bucket${row.rowBgClass ? ` ${row.rowBgClass}` : ''}`;
      const clickAttr = ` role="button" tabindex="0" onclick="selectBatimentoDayFromList('${row.day}')"`;
      const trailHtml = '<span class="vital-list-chevron" aria-hidden="true">&#8250;</span>';
      const dateTxt = formatDateForUI(row.day);
      return htmlVitalBatimentoListRow({
        rowClass,
        clickAttr,
        badgeHtml,
        hourDetail: {
          measureLine: valStr,
          timeLine: dateTxt,
          trailHtml
        }
      });
    };
    const visibleRows = dailyRows.slice(-BATIMENTO_HISTORICO_PREVIEW).reverse();
    const hiddenRows = dailyRows.slice(0, -BATIMENTO_HISTORICO_PREVIEW).reverse();
    let htmlBc = visibleRows.map(buildRow).join('');
    if (hiddenRows.length > 0) {
      const hiddenHtml = hiddenRows.map(buildRow).join('');
      htmlBc += `
        <div id="batimentoHistoricoExtra" style="display:none;">${hiddenHtml}</div>
        <button type="button" class="vital-ver-mais-btn" onclick="
          var el=document.getElementById('batimentoHistoricoExtra');
          var open=el.style.display!=='none';
          el.style.display=open?'none':'block';
          this.textContent=open?'Ver mais (${hiddenRows.length})':'Ver menos';
        ">Ver mais (${hiddenRows.length})</button>`;
    }
    document.getElementById('vitalDetailContent').innerHTML = htmlBc;
    return;
  }

  if (currentVitalDetail?.tipo === 'Pressão Arterial') {
    const byDay = new Map();
    currentVitalHistoricoView.forEach((h) => {
      const dayIso = (typeof historicoEntryDayISO === 'function') ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
      if (!dayIso) return;
      if (!byDay.has(dayIso)) byDay.set(dayIso, []);
      byDay.get(dayIso).push(h);
    });
    const dayRows = Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    const htmlPressao = dayRows.map(([dayIso, entries], idx) => {
      const dayKey = String(dayIso).replace(/[^0-9]/g, '');
      const openByDefault = idx === 0;
      const pares = entries
        .map((h) => (typeof parseHistoricoPressurePair === 'function' ? parseHistoricoPressurePair(h) : null))
        .filter(Boolean);
      const sisMax = pares.length ? Math.max(...pares.map((p) => p.s)) : null;
      const diaMin = pares.length ? Math.min(...pares.map((p) => p.d)) : null;
      const resumo = (sisMax != null && diaMin != null) ? `${sisMax}/${diaMin}` : '–';
      const dateTxt = formatDateForUI(dayIso);
      const coletasHtml = entries
        .slice()
        .sort((a, b) => {
          const ta = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(a) : 0;
          const tb = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(b) : 0;
          return tb - ta;
        })
        .map((h) => {
          const hora = h.hora ? String(h.hora).trim().slice(0, 5) : '--:--';
          const valorFormatado = typeof formatHistoricValue === 'function'
            ? formatHistoricValue(currentVitalDetail?.tipo, h)
            : h.valor;
          const ctxLabel = typeof getLabelContextoColetaHistorico === 'function' ? getLabelContextoColetaHistorico(h) : '';
          const medLabel =
            h.medicamentoPressao && h.medicamentoPressao !== 'nenhum'
              ? (h.medicamentoPressao === 'tomados' ? 'Medicação tomada' : 'Medicação não tomada')
              : '';
          const hr = getHeartRateForPressureEntry(h);
          const hrLabel = Number.isFinite(hr) ? `FC ${Math.round(hr)} bpm` : '';
          const extra = [ctxLabel, medLabel].filter(Boolean).join(' · ');
          const coletaTimeLine = `${dateTxt} · ${hora}`;
          return `
            <div class="pressao-coleta-item">
              <div class="pressao-coleta-valor">${valorFormatado} mmHg</div>
              ${hrLabel ? `<div class="pressao-coleta-fc">${hrLabel}</div>` : ''}
              <div class="pressao-coleta-hora">${coletaTimeLine}</div>
              ${extra ? `<div class="pressao-coleta-extra">${extra}</div>` : ''}
            </div>`;
        })
        .join('');

      return `
        <div class="pressao-dia-card">
          <button type="button" class="pressao-dia-resumo ${openByDefault ? 'is-open' : ''}" id="pressaoColetasBtn-${dayKey}" onclick="togglePressaoDiaColetas('${dayKey}')">
            <div class="pressao-dia-main">
              <div class="pressao-dia-medida">${resumo} <span class="pressao-dia-unit">mmHg</span></div>
              <div class="pressao-dia-data">${dateTxt}</div>
            </div>
            <span class="pressao-dia-chevron" aria-hidden="true">&#8250;</span>
          </button>
          <div class="pressao-dia-coletas" id="pressaoColetas-${dayKey}" style="display:${openByDefault ? 'block' : 'none'};">${coletasHtml}</div>
        </div>`;
    }).join('');
    document.getElementById('vitalDetailContent').innerHTML = htmlPressao;
    return;
  }

  if (currentVitalDetail?.tipo === 'Passos') {
    const goal = getStepsDailyGoalValue(currentVitalDetail);
    const dayRows = aggregatePassosByDay(currentVitalHistoricoView);
    if (dayRows.length === 0) {
      document.getElementById('vitalDetailContent').innerHTML =
        '<div class="empty-state"><div class="empty-text">Nenhum registro encontrado</div></div>';
      return;
    }
    // Flat list of days – filtered by chart selection if any
    const _dias3 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const _meses3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const _filteredRows = passosSelectedDayIso
      ? dayRows.filter(function(r) { return r.day === passosSelectedDayIso; })
      : dayRows; // aggregatePassosByDay já retorna do mais recente ao mais antigo
    let _clearFilterBtn = '';
    if (passosSelectedDayIso) {
      _clearFilterBtn = '<div style="text-align:center;padding:8px 0 4px;"><button type="button" onclick="setPassosDayFromChart(null)" style="font-size:13px;color:#3b82f6;background:none;border:none;cursor:pointer;padding:4px 8px;">Ver todos os dias</button></div>';
    }
    const _dayListHtml = _filteredRows.map(function(row) {
      const _steps = Math.max(0, Math.round(Number(row.total || 0)));
      const _pp = row.day.split('-').map(Number);
      const _do = new Date(_pp[0], _pp[1] - 1, _pp[2]);
      const _dl = _dias3[_do.getDay()] + ', ' + String(_pp[2]).padStart(2, '0') + ' ' + _meses3[_pp[1] - 1];
      const _pct = goal > 0 ? Math.round((_steps / goal) * 100) : 0;
      return '<div class="vital-list-item vital-list-item--day-nav vital-list-item--hour-bucket" role="button" tabindex="0" onclick="openPassosDiaDetail(\'' + row.day + '\')">' +
        '<div class="vital-list-main vital-list-main--hour-detail">' +
          '<div class="vital-list-measure-line">' + _steps.toLocaleString('pt-BR') + ' <span style="font-size:13px;font-weight:500;color:#64748b;">passos</span></div>' +
          '<div class="vital-list-time-line">' + _dl + ' · ' + _pct + '% da meta</div>' +
        '</div>' +
        '<div class="vital-list-trail"><span class="vital-list-chevron" aria-hidden="true">&#8250;</span></div>' +
      '</div>';
    }).join('');
    document.getElementById('vitalDetailContent').innerHTML = _clearFilterBtn + _dayListHtml;
    return;
  }

  if (currentVitalDetail?.tipo === 'Glicemia') {
    const _glicRows = aggregateGlicemiaByDay(currentVitalHistoricoView);
    if (_glicRows.length === 0) {
      document.getElementById('vitalDetailContent').innerHTML =
        '<div class="empty-state"><div class="empty-text">Nenhum registro encontrado</div></div>';
      return;
    }
    const _dias3g = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const _meses3g = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const _selIsoG = glicemiaSelectedDayIso;
    const _glicFiltered = _selIsoG
      ? _glicRows.filter(function(r) { return r.day === _selIsoG; })
      : _glicRows.slice().reverse();
    let _glicClearBtn = '';
    if (_selIsoG) {
      _glicClearBtn = '<div style="text-align:center;padding:8px 0 4px;"><button type="button" onclick="clearGlicemiaDaySelection()" style="font-size:13px;color:#7c3aed;background:none;border:none;cursor:pointer;padding:4px 8px;">Ver todas as medições</button></div>';
    }
    const _glicRowsHtml = _glicFiltered.map(function(row) {
      const _pp = row.day.split('-').map(Number);
      const _do = new Date(_pp[0], _pp[1] - 1, _pp[2]);
      const _dl = _dias3g[_do.getDay()] + ', ' + String(_pp[2]).padStart(2, '0') + ' ' + _meses3g[_pp[1] - 1];
      const _avg = row.avg;
      let _vColor = '#7c3aed';
      let _sLabel = 'Normal';
      if (_avg > 125) { _vColor = '#ef4444'; _sLabel = 'Alto'; }
      else if (_avg > 99) { _vColor = '#f59e0b'; _sLabel = 'Atenção'; }
      const _rangeHtml = (row.min !== row.max)
        ? '<span style="font-size:11px;color:#94a3b8;margin-left:4px;">(' + row.min + '–' + row.max + ')</span>'
        : '';
      return '<div class="vital-list-item vital-list-item--day-nav vital-list-item--hour-bucket" role="button" tabindex="0" onclick="selectGlicemiaDay(\'' + row.day + '\')">' +
        '<div class="vital-list-main vital-list-main--hour-detail">' +
          '<div class="vital-list-measure-line">' +
            '<span style="color:' + _vColor + ';font-weight:600;">' + _avg + '</span>' +
            ' <span style="font-size:13px;font-weight:500;color:#64748b;">mg/dL</span>' +
            _rangeHtml +
          '</div>' +
          '<div class="vital-list-time-line">' + _dl + ' · ' + _sLabel + '</div>' +
        '</div>' +
        '<div class="vital-list-trail"><span class="vital-list-chevron" aria-hidden="true">&#8250;</span></div>' +
      '</div>';
    }).join('');
    document.getElementById('vitalDetailContent').innerHTML = _glicClearBtn + _glicRowsHtml;
    return;
  }

  if (currentVitalDetail?.tipo === 'Sono') {
    const _sonoIdealL = 7, _sonoIdealH = 9;
    const _diasSono = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const _mesesSono = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    // Aggregate by day: most recent entry per day
    const _sonoByDayMap = new Map();
    currentVitalHistoricoView.forEach(function(h) {
      const dayIso = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
      if (!dayIso) return;
      const existing = _sonoByDayMap.get(dayIso);
      const hMs = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(h) : 0;
      const exMs = existing ? (typeof historicoEntryToMs === 'function' ? historicoEntryToMs(existing) : 0) : -Infinity;
      if (!existing || hMs > exMs) _sonoByDayMap.set(dayIso, h);
    });
    const _sonoDayEntries = Array.from(_sonoByDayMap.entries())
      .sort(function(a, b) { return b[0].localeCompare(a[0]); })
      .map(function(e) { return e[1]; });

    function _sonoFmtVal(h) {
      const hrs = parseFloat(h.valor);
      if (!Number.isFinite(hrs)) return '–';
      const hh = Math.floor(hrs), mm = Math.round((hrs - hh) * 60);
      return hh + 'h' + (mm > 0 ? ' ' + String(mm).padStart(2, '0') + 'm' : '');
    }
    function _sonoStatusLabel(h) {
      const hrs = parseFloat(h.valor);
      if (!Number.isFinite(hrs)) return '';
      if (hrs >= _sonoIdealL && hrs <= _sonoIdealH) return 'Ideal';
      if (hrs < _sonoIdealL) return 'Pouco sono';
      return 'Muito sono';
    }
    function _sonoDayLabel(dayIso) {
      const pp = dayIso.split('-').map(Number);
      const d = new Date(pp[0], pp[1] - 1, pp[2]);
      return _diasSono[d.getDay()] + ', ' + String(pp[2]).padStart(2, '0') + ' ' + _mesesSono[pp[1] - 1];
    }

    const _sonoListHtml = _sonoDayEntries.map(function(h) {
      const dayIso = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
      const _fv = _sonoFmtVal(h);
      const _sl = _sonoStatusLabel(h);
      const _dl = dayIso ? _sonoDayLabel(dayIso) : (h.data || '');
      const hrs = parseFloat(h.valor);
      const _col = Number.isFinite(hrs) && hrs >= _sonoIdealL && hrs <= _sonoIdealH ? '#7c3aed' : (Number.isFinite(hrs) && hrs < _sonoIdealL ? '#ef4444' : '#f59e0b');
      const _slClass = _sl === 'Ideal' ? 'ideal' : (_sl === 'Pouco sono' ? 'pouco' : 'muito');
      return '<div class="vital-list-item vital-list-item--day-nav vital-list-item--hour-bucket">' +
        '<div class="vital-list-main vital-list-main--hour-detail">' +
          '<div class="vital-list-measure-line">' +
            '<span style="color:' + _col + ';font-weight:700;">' + _fv + '</span>' +
          '</div>' +
          '<div class="vital-list-time-line">' + _dl + (_sl ? ' <span class="sono-status-chip sono-status-chip--' + _slClass + '">' + _sl + '</span>' : '') + '</div>' +
        '</div>' +
        '<div class="vital-list-trail"><span class="vital-list-chevron" aria-hidden="true">&#8250;</span></div>' +
      '</div>';
    }).join('');

    const _sonoSummary = typeof buildSonoDetailPanel === 'function' ? buildSonoDetailPanel(currentVitalDetail) : '';
    const _emptyMsg = _sonoDayEntries.length === 0
      ? '<div class="empty-state"><div class="empty-text">Nenhum registro encontrado</div></div>'
      : '';
    document.getElementById('vitalDetailContent').innerHTML = _sonoSummary + (_emptyMsg || _sonoListHtml);
    return;
  }

  if (currentVitalDetail?.tipo === 'Oxigenação') {
    const _oxigIdealL = 95;
    const _diasOxig = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const _mesesOxig = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const _oxigByDayMap = new Map();
    currentVitalHistoricoView.forEach(function(h) {
      const dayIso = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
      if (!dayIso) return;
      const existing = _oxigByDayMap.get(dayIso);
      const hMs = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(h) : 0;
      const exMs = existing ? (typeof historicoEntryToMs === 'function' ? historicoEntryToMs(existing) : 0) : -Infinity;
      if (!existing || hMs > exMs) _oxigByDayMap.set(dayIso, h);
    });
    const _oxigDayEntries = Array.from(_oxigByDayMap.entries())
      .sort(function(a, b) { return b[0].localeCompare(a[0]); })
      .map(function(e) { return e[1]; });

    function _oxigStatusLabel(h) {
      const v = parseFloat(h.valor);
      if (!Number.isFinite(v)) return '';
      if (v >= _oxigIdealL) return 'Normal';
      if (v >= 90) return 'Atenção';
      return 'Crítico';
    }
    function _oxigDayLabel(dayIso) {
      const pp = dayIso.split('-').map(Number);
      const d = new Date(pp[0], pp[1] - 1, pp[2]);
      return _diasOxig[d.getDay()] + ', ' + String(pp[2]).padStart(2, '0') + ' ' + _mesesOxig[pp[1] - 1];
    }
    function _oxigBuildRow(h) {
      const dayIso = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
      const v = parseFloat(h.valor);
      const _fv = Number.isFinite(v) ? v + '%' : '–';
      const _sl = _oxigStatusLabel(h);
      const _dl = dayIso ? _oxigDayLabel(dayIso) : (h.data || '');
      const _col = Number.isFinite(v) && v >= _oxigIdealL ? '#16a34a' : (Number.isFinite(v) && v >= 90 ? '#f59e0b' : '#ef4444');
      const _slClass = _sl === 'Normal' ? 'normal' : (_sl === 'Atenção' ? 'atencao' : 'critico');
      return '<div class="vital-list-item vital-list-item--day-nav vital-list-item--hour-bucket" role="button" tabindex="0" onclick="selectOxigenacaoDay(\'' + dayIso.replace(/'/g, "\\'") + '\')">' +
        '<div class="vital-list-main vital-list-main--hour-detail">' +
          '<div class="vital-list-measure-line">' +
            '<span style="color:' + _col + ';font-weight:700;">' + _fv + '</span>' +
          '</div>' +
          '<div class="vital-list-time-line">' + _dl + (_sl ? ' <span class="oxig-status-chip oxig-status-chip--' + _slClass + '">' + _sl + '</span>' : '') + '</div>' +
        '</div>' +
        '<div class="vital-list-trail"><span class="vital-list-chevron" aria-hidden="true">&#8250;</span></div>' +
      '</div>';
    }

    const _previewCount = 5;
    const visibleRows = _oxigDayEntries.slice(0, _previewCount);
    const hiddenRows = _oxigDayEntries.slice(_previewCount);
    let _oxigListHtml = visibleRows.map(_oxigBuildRow).join('');
    if (hiddenRows.length > 0) {
      const hiddenHtml = hiddenRows.map(_oxigBuildRow).join('');
      _oxigListHtml +=
        '<div id="oxigenacaoHistoricoExtra" style="display:none;">' + hiddenHtml + '</div>' +
        '<button type="button" class="vital-ver-mais-btn" onclick="var el=document.getElementById(\'oxigenacaoHistoricoExtra\');var open=el.style.display!==\'none\';el.style.display=open?\'none\':\'block\';this.textContent=open?\'Ver mais (' + hiddenRows.length + ')\':\'Ver menos\';">Ver mais (' + hiddenRows.length + ')</button>';
    }

    const _oxigSummary = typeof buildOxigDetailPanel === 'function' ? buildOxigDetailPanel(currentVitalDetail) : '';
    const _emptyOxig = _oxigDayEntries.length === 0
      ? '<div class="empty-state"><div class="empty-text">Nenhum registro encontrado</div></div>'
      : '';
    document.getElementById('vitalDetailContent').innerHTML = _oxigSummary + (_emptyOxig || _oxigListHtml);
    return;
  }

  if (currentVitalDetail?.tipo === 'Hidratação') {
    var _hidGoalL = 2000;
    if (currentVitalDetail.ideal && typeof currentVitalDetail.ideal === 'string') {
      var _hidGoalM = currentVitalDetail.ideal.match(/(\d+)/);
      if (_hidGoalM) _hidGoalL = Number(_hidGoalM[1]);
    }
    var _hidLowThr = _hidGoalL * 0.6;
    const _diasHid = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const _mesesHid = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

    const _hidByDayMap = new Map();
    currentVitalHistoricoView.forEach(function(h) {
      const dayIso = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
      if (!dayIso) return;
      const v = parseFloat(h.valor);
      if (!Number.isFinite(v)) return;
      const existing = _hidByDayMap.get(dayIso);
      if (!existing || v > parseFloat(existing.valor)) _hidByDayMap.set(dayIso, h);
    });
    const _hidDayEntries = Array.from(_hidByDayMap.entries())
      .sort(function(a, b) { return b[0].localeCompare(a[0]); })
      .map(function(e) { return e[1]; });

    function _hidFmtMl(ml) {
      return ml >= 1000 ? (ml / 1000).toFixed(1).replace('.0', '') + ' L' : ml + ' ml';
    }
    function _hidStatusLabel(h) {
      const v = parseFloat(h.valor);
      if (!Number.isFinite(v)) return '';
      if (v >= _hidGoalL) return 'Meta atingida';
      if (v >= _hidLowThr) return 'Abaixo da meta';
      return 'Muito baixo';
    }
    function _hidDayLabel(dayIso) {
      const pp = dayIso.split('-').map(Number);
      const d = new Date(pp[0], pp[1] - 1, pp[2]);
      return _diasHid[d.getDay()] + ', ' + String(pp[2]).padStart(2, '0') + ' ' + _mesesHid[pp[1] - 1];
    }

    const _hidListHtml = _hidDayEntries.map(function(h) {
      const dayIso = typeof historicoEntryDayISO === 'function' ? historicoEntryDayISO(h) : String(h.data || '').slice(0, 10);
      const v = parseFloat(h.valor);
      const _fv = Number.isFinite(v) ? _hidFmtMl(v) : '–';
      const _sl = _hidStatusLabel(h);
      const _dl = dayIso ? _hidDayLabel(dayIso) : (h.data || '');
      const _col = Number.isFinite(v) && v >= _hidGoalL ? '#22c55e' : (Number.isFinite(v) && v >= _hidLowThr ? '#3b82f6' : '#f59e0b');
      const _slClass = _sl === 'Meta atingida' ? 'ok' : (_sl === 'Abaixo da meta' ? 'baixo' : 'muito');
      return '<div class="vital-list-item vital-list-item--day-nav vital-list-item--hour-bucket">' +
        '<div class="vital-list-main vital-list-main--hour-detail">' +
          '<div class="vital-list-measure-line">' +
            '<span style="color:' + _col + ';font-weight:700;">' + _fv + '</span>' +
          '</div>' +
          '<div class="vital-list-time-line">' + _dl + (_sl ? ' <span class="hidra-chip hidra-chip--' + _slClass + '">' + _sl + '</span>' : '') + '</div>' +
        '</div>' +
        '<div class="vital-list-trail"><span class="vital-list-chevron" aria-hidden="true">&#8250;</span></div>' +
      '</div>';
    }).join('');

    const _hidSummary = typeof buildHidraDetailPanel === 'function' ? buildHidraDetailPanel(currentVitalDetail) : '';
    const _emptyHid = _hidDayEntries.length === 0
      ? '<div class="empty-state"><div class="empty-text">Nenhum registro encontrado</div></div>'
      : '';
    document.getElementById('vitalDetailContent').innerHTML = _hidSummary + (_emptyHid || _hidListHtml);
    return;
  }

  const sortedView = currentVitalHistoricoView.slice().sort(function(a, b) {
    var ta = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(a) : 0;
    var tb = typeof historicoEntryToMs === 'function' ? historicoEntryToMs(b) : 0;
    return tb - ta; // mais recente primeiro
  });
  const html = sortedView.map((h, idx) => {
    const dataFormatada = formatDateForUI(h.data);
    const hora = h.hora ? ` ${h.hora}` : '';
    const fullDateTimeLine = `${dataFormatada}${hora}`.trim();
    const showFullDateInRow =
      currentVitalDetail?.tipo !== 'Batimento Cardíaco' ||
      !vitalBatimentoChartSelection ||
      vitalBatimentoChartSelection.kind !== 'day';
    const primaryDateTimeLine = showFullDateInRow
      ? fullDateTimeLine
      : (h.hora ? h.hora.trim() : dataFormatada);
    const dateRowTitle =
      !showFullDateInRow && fullDateTimeLine !== primaryDateTimeLine
        ? ` title="${String(fullDateTimeLine).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`
        : '';
    const dateRowClass = !showFullDateInRow ? ' vital-list-date--time-only' : '';
    const statusIcon = h.status === 'normal' ? 'OK' : 'AL';
    const valorFormatado = typeof formatHistoricValue === 'function'
      ? formatHistoricValue(currentVitalDetail?.tipo, h)
      : h.valor;
    let pmed = '';
    if (currentVitalDetail?.tipo === 'Pressão Arterial' && h.medicamentoPressao && h.medicamentoPressao !== 'nenhum') {
      pmed = h.medicamentoPressao === 'tomados' ? ' | Tomados' : ' | Não tomados';
    }

    const ctxLabel = typeof getLabelContextoColetaHistorico === 'function' ? getLabelContextoColetaHistorico(h) : '';
    const badgeHtml = ctxLabel
      ? `<span class="vital-context-badge">${ctxLabel}</span>`
      : '';

    const isExercicio =
      h.contextoColeta === 'exercicio' && h.exercicioSessao && currentVitalDetail?.tipo === 'Batimento Cardíaco';
    const bcBg =
      currentVitalDetail?.tipo === 'Batimento Cardíaco' ? batimentoHistoricoRowBgClassForEntry(h) : '';
    const rowClass = [
      'vital-list-item',
      isExercicio ? 'vital-list-item--exercicio' : '',
      bcBg
    ]
      .filter(Boolean)
      .join(' ');
    const clickAttr = isExercicio ? ` role="button" tabindex="0" onclick="openExercicioDetalheFromRow(${idx})"` : '';

    return `
      <div class="${rowClass}"${clickAttr}>
        <div class="vital-list-main">
          <div class="vital-list-date${dateRowClass}"${dateRowTitle}>${primaryDateTimeLine}</div>
          ${badgeHtml}
        </div>
        <div class="vital-list-value">${valorFormatado}${pmed}${isExercicio ? ' <span class="vital-list-chevron" aria-hidden="true">&#8250;</span>' : ''}</div>
        <div class="vital-list-status">${statusIcon}</div>
      </div>
    `;
  }).join('');

  var _summaryPanel = '';
  if (currentVitalDetail && currentVitalDetail.tipo === 'Sono' && typeof buildSonoDetailPanel === 'function') {
    _summaryPanel = buildSonoDetailPanel(currentVitalDetail);
  } else if (currentVitalDetail && currentVitalDetail.tipo === 'Oxigenação' && typeof buildOxigDetailPanel === 'function') {
    _summaryPanel = buildOxigDetailPanel(currentVitalDetail);
  } else if (currentVitalDetail && currentVitalDetail.tipo === 'Hidratação' && typeof buildHidraDetailPanel === 'function') {
    _summaryPanel = buildHidraDetailPanel(currentVitalDetail);
  }
  document.getElementById('vitalDetailContent').innerHTML = _summaryPanel + html;
}

function filterVitalDetail() {
  if (!currentVitalDetail) return;
  if (currentVitalDetail.tipo === 'Batimento Cardíaco' || currentVitalDetail.tipo === 'Pressão Arterial') return;

  const dataInicio = document.getElementById('filterVitalDataInicio').value;
  const dataFim = document.getElementById('filterVitalDataFim').value;

  let filtrado = currentVitalDetail.historico;

  if (dataInicio) {
    filtrado = filtrado.filter(h => h.data >= dataInicio);
  }

  if (dataFim) {
    filtrado = filtrado.filter(h => h.data <= dataFim);
  }

  renderVitalDetailContent(filtrado);
  renderSparklineChart(filtrado);
}

function openAddVitalModal(tipoVital) {
  currentVitalType = tipoVital;
  const vital = mockData.sinaisVitais.find(v => v.tipo === tipoVital);

  document.getElementById('tipoVitalInput').value = tipoVital;
  document.getElementById('addVitalModalTitle').textContent = tipoVital;

  const pressureContainer = document.getElementById('pressureInputContainer');
  const pressureCaptureContainer = document.getElementById('pressureCaptureContainer');
  const standardContainer = document.getElementById('standardInputContainer');

  if (tipoVital === 'Pressão Arterial') {
    pressureContainer.style.display = 'none';
    if (pressureCaptureContainer) pressureCaptureContainer.style.display = 'none';
    standardContainer.style.display = 'none';
  } else {
    pressureContainer.style.display = 'none';
    if (pressureCaptureContainer) pressureCaptureContainer.style.display = 'none';
    standardContainer.style.display = 'block';
    // Mostrar unidade ao lado do input
    const unidade = vital ? vital.unidade : '';
    document.getElementById('unidadeVitalDisplay').textContent = unidade;
    document.getElementById('valorVitalLabel').textContent = `Valor (${unidade})`;
    setTimeout(() => document.getElementById('valorVitalInput').focus(), 100);
  }

  document.getElementById('fonteVitalInput').value = '';
  const checklist = document.getElementById('pulseiraChecklist');
  if (checklist) checklist.style.display = 'none';
  resetPulseiraStepButtons();
  clearVitalCaptureState();
  resetPressureMedReminderUI();

  if (tipoVital === 'Pressão Arterial') {
    ensureConfigColetaPressao();
    const fonte = getFontePressaoConfig();
    applyVitalFonteValue(fonte);
  } else {
    applyVitalFonteValue('Manual');
  }

  document.getElementById('addVitalModal').classList.add('active');
}

function renderHeartRateConfirmBody(bpm) {
  return `
    <div class="vital-confirm-block">
      <div class="vital-confirm-type">Batimento cardíaco</div>
      <div class="vital-confirm-single"><span class="vital-confirm-num">${bpm}</span><span class="vital-confirm-unit-inline"> bpm</span></div>
    </div>`;
}

function renderVitalConfirmBodyFromPayload(p) {
  if (p.tipoVital === 'Pressão Arterial') {
    const s = p.sistolica;
    const d = p.diastolica;
    const mp = p.medicamentoPressao && p.medicamentoPressao !== 'nenhum'
      ? (p.medicamentoPressao === 'tomados' ? 'Medicamento da pressão: tomados' : 'Medicamento da pressão: não tomados')
      : '';
    return `
      <div class="vital-confirm-block">
        <div class="vital-confirm-type">${p.tipoVital}</div>
        <div class="vital-confirm-nums" aria-hidden="true">
          <span class="vital-confirm-num">${s}</span><span class="vital-confirm-slash">/</span><span class="vital-confirm-num">${d}</span>
        </div>
        <div class="vital-confirm-unit">mmHg</div>
        <div class="vital-confirm-meta">Fonte: ${p.fonte}</div>
        ${mp ? `<div class="vital-confirm-meta">${mp}</div>` : ''}
      </div>`;
  }
  const u = p.unidade ? ` ${p.unidade}` : '';
  return `
    <div class="vital-confirm-block">
      <div class="vital-confirm-type">${p.tipoVital}</div>
      <div class="vital-confirm-single"><span class="vital-confirm-num">${p.valor}</span><span class="vital-confirm-unit-inline">${u}</span></div>
      <div class="vital-confirm-meta">Fonte: ${p.fonte}</div>
    </div>`;
}

function openVitalConfirmModal(html, options = {}) {
  const title = options.title ?? 'Confirmar medição';
  const lead = options.lead ?? 'Confira os valores. Estão corretos?';
  const body = document.getElementById('vitalConfirmBody');
  if (body) body.innerHTML = html;
  const titleEl = document.getElementById('vitalConfirmTitle');
  if (titleEl) titleEl.textContent = title;
  const leadEl = document.getElementById('vitalConfirmLead');
  if (leadEl) leadEl.textContent = lead;
  document.getElementById('vitalSaveConfirmModal')?.classList.add('active');
}

function closeVitalConfirmModal() {
  document.getElementById('vitalSaveConfirmModal')?.classList.remove('active');
  pendingVitalSavePayload = null;
  pendingHeartRateBpm = null;
}

function buildAddVitalPendingPayload() {
  const tipoVital = document.getElementById('tipoVitalInput').value;
  const fonte = document.getElementById('fonteVitalInput').value;

  if (!fonte) {
    return { ok: false, message: 'Selecione a fonte da medição.' };
  }

  if (fonte === 'Pulseira' && !isPulseiraChecklistComplete()) {
    return { ok: false, message: 'Para medição por pulseira, conclua o checklist de preparo.' };
  }

  if (tipoVital === 'Pressão Arterial') {
    let sistolica;
    let diastolica;
    if (fonte === 'Manual') {
      sistolica = document.getElementById('sistolicaInput').value;
      diastolica = document.getElementById('diastolicaInput').value;
      if (!sistolica || !diastolica) {
        return { ok: false, message: 'Preencha sistolica e diastolica.' };
      }
    } else {
      if (!capturedPressureFromSource) {
        return { ok: false, message: 'Toque em "Capturar / Coletar dados" para continuar.' };
      }
      sistolica = capturedPressureFromSource.sistolica;
      diastolica = capturedPressureFromSource.diastolica;
    }
    const medicamentoPressao =
      fonte === 'Manual'
        ? (document.getElementById('pressureMedStatusInput')?.value || 'nenhum')
        : 'nenhum';
    return {
      ok: true,
      payload: {
        tipoVital,
        fonte,
        sistolica: parseInt(String(sistolica), 10),
        diastolica: parseInt(String(diastolica), 10),
        medicamentoPressao
      }
    };
  }

  const valorRaw = document.getElementById('valorVitalInput').value;
  if (!valorRaw) {
    return { ok: false, message: 'Informe o valor.' };
  }
  const vital = mockData.sinaisVitais.find(v => v.tipo === tipoVital);
  const unidade = vital ? vital.unidade : '';
  return {
    ok: true,
    payload: {
      tipoVital,
      fonte,
      valor: parseFloat(valorRaw),
      unidade
    }
  };
}

function executePendingVitalSave() {
  const p = pendingVitalSavePayload;
  if (!p) return;

  const agora = new Date();
  const dataHora = `${agora.toISOString().slice(0, 10)}T${agora.toTimeString().slice(0, 5)}:00`;

  if (p.tipoVital === 'Pressão Arterial') {
    const { sistolica, diastolica } = p;
    const medicamentoPressao = p.medicamentoPressao || 'nenhum';
    lastPressureValue = `${sistolica}/${diastolica}`;
    lastManualMeasurementMeta = {
      isSporadic: true,
      dateISO: agora.toISOString().slice(0, 10),
      timeHHMM: agora.toTimeString().slice(0, 5)
    };

    const vital = mockData.sinaisVitais.find(v => v.tipo === p.tipoVital);
    if (vital) {
      vital.valor = { sistolica, diastolica };
      vital.fonte = p.fonte;
      vital.tempo = 'Agora';
      vital.dataHora = dataHora;
      const entry = {
        data: agora.toISOString().slice(0, 10),
        hora: agora.toTimeString().slice(0, 5),
        valor: { sistolica, diastolica },
        status: 'normal'
      };
      if (medicamentoPressao && medicamentoPressao !== 'nenhum') entry.medicamentoPressao = medicamentoPressao;
      vital.historico.unshift(entry);
      checkVitalAlert(vital);
    }

    closeVitalConfirmModal();
    const addVitalModal = document.getElementById('addVitalModal');
    const addVitalForm = document.getElementById('addVitalForm');
    if (addVitalModal) addVitalModal.classList.remove('active');
    if (addVitalForm) addVitalForm.reset();
    document.getElementById('unidadeVitalDisplay').textContent = '';
    resetPulseiraStepButtons();
    clearVitalCaptureState();

    document.getElementById('heartRateFollowupModal').classList.add('active');
    setTimeout(() => document.getElementById('heartRateInput').focus(), 100);
    return;
  }

  const vital = mockData.sinaisVitais.find(v => v.tipo === p.tipoVital);
  if (vital) {
    vital.valor = p.valor;
    vital.fonte = p.fonte;
    vital.tempo = 'Agora';
    vital.dataHora = dataHora;
    vital.historico.unshift({
      data: agora.toISOString().slice(0, 10),
      hora: agora.toTimeString().slice(0, 5),
      valor: p.valor,
      status: 'normal'
    });
    checkVitalAlert(vital);
  }

  closeVitalConfirmModal();
  const addVitalModal = document.getElementById('addVitalModal');
  const addVitalForm = document.getElementById('addVitalForm');
  if (addVitalModal) addVitalModal.classList.remove('active');
  if (addVitalForm) addVitalForm.reset();
  document.getElementById('unidadeVitalDisplay').textContent = '';
  resetPulseiraStepButtons();
  clearVitalCaptureState();

  renderSaude();
  if (currentVitalDetail && currentVitalDetail.tipo === p.tipoVital && vital) {
    // Re-sincroniza referência do detalhe para evitar estado antigo após re-render.
    const refreshed = mockData.sinaisVitais.find((v) => v.id === currentVitalDetail.id);
    if (refreshed) currentVitalDetail = refreshed;

    // Pressão e Passos usam o mesmo fluxo de abertura (período + gráfico principal + conteúdo).
    if (p.tipoVital === 'Pressão Arterial' || p.tipoVital === 'Passos') {
      applyVitalDefaultPeriodView();
    } else {
      renderVitalDetailContent(vital.historico);
      renderSparklineChart(vital.historico);
    }
  }
}

function executePendingHeartRateSave() {
  const bpm = pendingHeartRateBpm;
  if (bpm === null || bpm === undefined) return;

  const vital = mockData.sinaisVitais.find(v => v.tipo === 'Batimento Cardíaco');
  if (vital) {
    vital.valor = bpm;
    vital.tempo = 'Agora';
    const now = new Date();
    vital.dataHora = `${now.toISOString().slice(0, 10)}T${now.toTimeString().slice(0, 5)}:00`;
    vital.historico.unshift({
      data: now.toISOString().slice(0, 10),
      hora: now.toTimeString().slice(0, 5),
      valor: bpm,
      status: 'normal'
    });
    checkVitalAlert(vital);
  }

  // Se a pressão foi registrada imediatamente antes, vincula o BPM ·quela leitura.
  const pressureVital = mockData.sinaisVitais.find((v) => v.tipo === 'Pressão Arterial');
  if (pressureVital && Array.isArray(pressureVital.historico) && lastManualMeasurementMeta) {
    const dateISO = lastManualMeasurementMeta.dateISO;
    const timeHHMM = String(lastManualMeasurementMeta.timeHHMM || '').slice(0, 5);
    const entry = pressureVital.historico.find(
      (h) => String(h.data || '') === String(dateISO || '') && String(h.hora || '').slice(0, 5) === timeHHMM
    );
    if (entry) entry.heartRate = Number(bpm);
  }

  closeVitalConfirmModal();
  document.getElementById('heartRateFollowupModal').classList.remove('active');
  document.getElementById('heartRateInput').value = '';
  renderSaude();
  openMoodCheckinModal();
}

function executePendingConfirmSave() {
  if (pendingVitalSavePayload) {
    executePendingVitalSave();
  } else if (pendingHeartRateBpm !== null && pendingHeartRateBpm !== undefined) {
    executePendingHeartRateSave();
  }
}

function collectPressureFromSource() {
  const fonte = document.getElementById('fonteVitalInput')?.value;
  if (!fonte || fonte === 'Manual') {
    showFeedbackModal('Em Perfil, escolha Pulseira, Google Fit ou Apple Health como fonte da pressão.', 'warning');
    return;
  }
  const mock = simulatePressureCaptureForFonte(fonte);
  capturedPressureFromSource = {
    sistolica: mock.sistolica,
    diastolica: mock.diastolica,
    fonte
  };
  const result = document.getElementById('pressureCaptureResult');
  if (result) {
    result.innerHTML = `<span class="vital-capture-value">${mock.sistolica}/${mock.diastolica} mmHg</span><span class="vital-capture-meta">${mock.linha}</span>`;
    result.style.display = 'block';
  }
}

function setupVitalModals() {
  const addVitalModal = document.getElementById('addVitalModal');
  const cancelAddVitalBtn = document.getElementById('cancelAddVitalBtn');
  const addVitalForm = document.getElementById('addVitalForm');
  const vitalSaveConfirmModal = document.getElementById('vitalSaveConfirmModal');
  const vitalConfirmBackBtn = document.getElementById('vitalConfirmBackBtn');
  const vitalConfirmSaveBtn = document.getElementById('vitalConfirmSaveBtn');

  const closeModal = () => {
    addVitalModal.classList.remove('active');
    addVitalForm.reset();
    document.getElementById('unidadeVitalDisplay').textContent = '';
    resetPulseiraStepButtons();
    clearVitalCaptureState();
  };

  cancelAddVitalBtn.addEventListener('click', closeModal);

  addVitalModal.addEventListener('click', (e) => {
    if (e.target === addVitalModal) closeModal();
  });

  if (vitalConfirmBackBtn) {
    vitalConfirmBackBtn.addEventListener('click', () => closeVitalConfirmModal());
  }
  if (vitalConfirmSaveBtn) {
    vitalConfirmSaveBtn.addEventListener('click', () => executePendingConfirmSave());
  }
  if (vitalSaveConfirmModal) {
    vitalSaveConfirmModal.addEventListener('click', (e) => {
      if (e.target === vitalSaveConfirmModal) closeVitalConfirmModal();
    });
  }

  addVitalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const built = buildAddVitalPendingPayload();
    if (!built.ok) {
      showFeedbackModal(built.message, 'warning');
      return;
    }
    pendingHeartRateBpm = null;
    pendingVitalSavePayload = built.payload;
    openVitalConfirmModal(renderVitalConfirmBodyFromPayload(built.payload));
  });
}

function confirmHeartRateFollowup() {
  const heartRate = document.getElementById('heartRateInput').value;

  if (!heartRate) {
    showFeedbackModal('Digite o batimento cardíaco.', 'warning');
    return;
  }
  const bpm = parseInt(heartRate, 10);
  if (Number.isNaN(bpm) || bpm < 30 || bpm > 200) {
    showFeedbackModal('Informe um batimento entre 30 e 200.', 'warning');
    return;
  }

  pendingVitalSavePayload = null;
  pendingHeartRateBpm = bpm;
  openVitalConfirmModal(renderHeartRateConfirmBody(bpm), {
    title: 'Confirmar batimento',
    lead: 'Confira o valor. Está correto?'
  });
}

function skipHeartRateFollowup() {
  document.getElementById('heartRateFollowupModal').classList.remove('active');
  document.getElementById('heartRateInput').value = '';
  renderSaude();
  openMoodCheckinModal();
}

function openMoodCheckinModal() {
  const modal = document.getElementById('moodCheckinModal');
  if (!modal) return;

  currentMoodValue = 0;
  document.querySelectorAll('.mood-face').forEach(btn => btn.classList.remove('selected'));
  const confirmBtn = document.getElementById('moodConfirmBtn');
  if (confirmBtn) confirmBtn.disabled = true;

  const noteEl = document.getElementById('moodNoteInput');
  if (noteEl) noteEl.value = '';

  document.querySelectorAll('#symptomsPanel .mood-symptom-btn').forEach(btn => btn.classList.remove('selected'));

  const symptomsPanel = document.getElementById('symptomsPanel');
  const notePanel = document.getElementById('notePanel');
  if (symptomsPanel) symptomsPanel.style.display = 'none';
  if (notePanel) notePanel.style.display = 'none';

  const timeInput = document.getElementById('moodTimeInput');
  const defaultTime = (lastManualMeasurementMeta && lastManualMeasurementMeta.timeHHMM) ? lastManualMeasurementMeta.timeHHMM : getCurrentHHMM();
  if (timeInput) timeInput.value = defaultTime;

  const rescheduleBtn = document.getElementById('moodRescheduleBtn');
  if (rescheduleBtn) {
    rescheduleBtn.style.display = (lastManualMeasurementMeta && lastManualMeasurementMeta.isSporadic) ? '' : 'none';
  }

  renderMoodHistory();
  modal.classList.add('active');
}

function closeMoodCheckinModal() {
  const modal = document.getElementById('moodCheckinModal');
  if (modal) modal.classList.remove('active');
}

function ignoreMoodCheckin() {
  closeMoodCheckinModal();
  showFeedbackModal('Registro concluído. Obrigado!', 'success');
}

function selectMoodFace(value) {
  currentMoodValue = value;
  document.querySelectorAll('.mood-face').forEach(btn => {
    const v = parseInt(btn.getAttribute('data-value') || '0', 10);
    btn.classList.toggle('selected', v === value);
  });
  const confirmBtn = document.getElementById('moodConfirmBtn');
  if (confirmBtn) confirmBtn.disabled = false;
}

function toggleSymptomsPanel() {
  const el = document.getElementById('symptomsPanel');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function toggleSymptomButton(btn) {
  if (!btn) return;
  btn.classList.toggle('selected');
}

function toggleNotePanel() {
  const el = document.getElementById('notePanel');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function getSelectedSymptoms() {
  return Array.from(document.querySelectorAll('#symptomsPanel .mood-symptom-btn.selected'))
    .map(btn => btn.getAttribute('data-value'))
    .filter(Boolean);
}

function getLatestPressureAndHeartRate() {
  const p = mockData.sinaisVitais.find(v => v.tipo === 'Pressão Arterial');
  const h = mockData.sinaisVitais.find(v => v.tipo === 'Batimento Cardíaco');
  return { pressure: p ? p.valor : null, heartRate: h ? h.valor : null };
}

function confirmMoodCheckin() {
  if (!currentMoodValue) {
    showFeedbackModal('Selecione como você está se sentindo (humor).', 'warning');
    return;
  }

  if (!mockData.moodCheckins) mockData.moodCheckins = [];

  const { pressure, heartRate } = getLatestPressureAndHeartRate();
  const time = document.getElementById('moodTimeInput')?.value || getCurrentHHMM();
  const note = document.getElementById('moodNoteInput')?.value || '';
  const symptoms = getSelectedSymptoms();
  const dateISO = (lastManualMeasurementMeta && lastManualMeasurementMeta.dateISO) ? lastManualMeasurementMeta.dateISO : getTodayISODate();

  mockData.moodCheckins.unshift({
    date: dateISO,
    time,
    mood: currentMoodValue,
    symptoms,
    note,
    pressure,
    heartRate
  });

  closeMoodCheckinModal();
  showFeedbackModal('Check-in registrado. Obrigado!', 'success');
}

function rescheduleMoodCheckin() {
  const modal = document.getElementById('rescheduleMeasurementModal');
  const input = document.getElementById('nextMeasurementDateTimeInput');
  if (!modal || !input) return;

  const baseDate = (lastManualMeasurementMeta && lastManualMeasurementMeta.dateISO) ? lastManualMeasurementMeta.dateISO : getTodayISODate();
  const baseTime = (lastManualMeasurementMeta && lastManualMeasurementMeta.timeHHMM) ? lastManualMeasurementMeta.timeHHMM : getCurrentHHMM();
  const base = new Date(`${baseDate}T${baseTime}:00`);
  base.setHours(base.getHours() + 6);
  const nextISO = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}T${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`;
  input.value = nextISO;

  closeMoodCheckinModal();
  modal.classList.add('active');
}

function confirmRescheduleMeasurement() {
  const input = document.getElementById('nextMeasurementDateTimeInput');
  const toggle = document.getElementById('notifyNextMeasurementToggle');
  const modal = document.getElementById('rescheduleMeasurementModal');
  if (!input || !modal) return;

  if (!input.value) {
    showFeedbackModal('Selecione data e hora para a próxima medição.', 'warning');
    return;
  }

  const notify = toggle ? toggle.classList.contains('active') : true;
  if (!mockData.measurementReschedules) mockData.measurementReschedules = [];

  if (notify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }

  mockData.measurementReschedules.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    tipo: 'pressao-batimento-manual',
    proximaMedicao: input.value,
    notificar: notify,
    criadoEm: `${getTodayISODate()}T${getCurrentHHMM()}:00`,
    alertedAt: null
  });

  modal.classList.remove('active');
  const dateObj = new Date(input.value);
  const dateTxt = formatDateForUI(input.value.slice(0, 10));
  const timeTxt = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
  showFeedbackModal(`Reagendado para ${dateTxt} às ${timeTxt}. ${notify ? 'Notificação ativada.' : 'Sem notificação.'}`, 'success');
}

function formatPressureValueForUI(value) {
  if (!value) return '--/--';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.sistolica != null && value.diastolica != null) return `${value.sistolica}/${value.diastolica}`;
  return String(value);
}

function renderMoodHistory() {
  const list = document.getElementById('moodHistoryList');
  if (!list) return;

  const pressure = mockData.sinaisVitais.find(v => v.tipo === 'Pressão Arterial');
  const heart = mockData.sinaisVitais.find(v => v.tipo === 'Batimento Cardíaco');
  const pHist = (pressure && pressure.historico) ? pressure.historico.slice(0, 5) : [];
  const hHist = (heart && heart.historico) ? heart.historico.slice(0, 5) : [];

  const merged = [];
  for (let i = 0; i < Math.max(pHist.length, hHist.length); i++) {
    const p = pHist[i];
    const h = hHist[i];
    if (!p && !h) break;
    merged.push({
      date: (p && p.data) || (h && h.data) || getTodayISODate(),
      time: (p && p.hora) || (h && h.hora) || '',
      pressure: p ? p.valor : null,
      heartRate: h ? h.valor : null
    });
  }

  if (!merged.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-text">Sem historico recente</div></div>';
    return;
  }

  list.innerHTML = merged.map(item => {
    const dateBR = formatDateForUI(item.date);
    const timeTxt = item.time ? ` ??? ${item.time}` : '';
    const pTxt = `PA ${formatPressureValueForUI(item.pressure)}`;
    const hTxt = item.heartRate != null ? `FC ${item.heartRate} bpm` : 'FC --';
    return `
      <div class="mood-history-item">
        <div class="mood-history-left">
          <div class="mood-history-date">${dateBR}${timeTxt}</div>
          <div class="mood-history-values">${pTxt} ??? ${hTxt}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Setup Heart Rate Followup Modal
document.addEventListener('DOMContentLoaded', () => {
  const heartRateFollowupModal = document.getElementById('heartRateFollowupModal');
  if (heartRateFollowupModal) {
    heartRateFollowupModal.addEventListener('click', (e) => {
      if (e.target === heartRateFollowupModal) {
        heartRateFollowupModal.classList.remove('active');
      }
    });
  }
});

// Setup Mood Checkin Modal
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('moodCheckinModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeMoodCheckinModal();
    });
  }
});

// Setup Reschedule Measurement Modal
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('rescheduleMeasurementModal');
  const closeBtn = document.getElementById('closeRescheduleMeasurementModal');
  const cancelBtn = document.getElementById('cancelRescheduleMeasurementBtn');

  const closeModal = () => {
    if (modal) modal.classList.remove('active');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
});
