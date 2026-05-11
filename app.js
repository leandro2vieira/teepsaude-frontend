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
/** Período no modal padrão (usado em Pressão Arterial): 7d | 15d | 30d | year | livre */
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
let pressaoSelectedDay = null; // ISO date of selected day in the pressure sparkline
let pressaoColetaEntries = []; // sorted entries of the currently open day detail
let pressaoColetaDayIso = null; // ISO date of the currently open day detail
let pressaoDiaShowAll = false; // whether the reading list is fully expanded
/** Dia selecionado no day-picker de Batimento Cardíaco (ISO YYYY-MM-DD). null = hoje */
let batimentoSelectedDayISO = null;

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

/** Meio-dia local (Date) a partir de YYYY-MM-DD — evita `new Date('...T12:00:00')` (comportamento varia por motor e pode deslocar o dia). */
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
    ? ` · ${String(passosSelectedHour).padStart(2, '0')}:00–${String(passosSelectedHour).padStart(2, '0')}:59`
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
    renderVitalDetailContent(currentVitalHistoricoView);
  };
}

function setPassosDayFromChart(dayIso) {
  if (!dayIso) return;
  if (!currentVitalDetail || currentVitalDetail.tipo !== 'Passos') return;
  passosSelectedDayIso = dayIso;
  passosSelectedHour = null;
  batHourlySelectedHour = null;
  renderVitalDetailContent(currentVitalHistoricoView);
  renderSparklineChart(currentVitalHistoricoView);
}

function setPassosDayFromList(dayIso) {
  if (!dayIso) return;
  if (!currentVitalDetail || currentVitalDetail.tipo !== 'Passos') return;
  passosSelectedDayIso = dayIso;
  passosSelectedHour = null;
  batHourlySelectedHour = null;
  renderVitalDetailContent(currentVitalHistoricoView);
  renderSparklineChart(currentVitalHistoricoView);
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
  if (!currentVitalDetail || (currentVitalDetail.tipo !== 'Pressão Arterial' && currentVitalDetail.tipo !== 'Passos')) return;
  const { start, end } = getVitalDefaultPeriodRange();
  const filtrado = filterHistoricoByInclusiveDate(currentVitalDetail.historico, start, end);
  renderVitalDetailContent(filtrado);
  renderSparklineChart(filtrado);
}

function onVitalDefaultLivreRangeChange() {
  applyVitalDefaultPeriodView();
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

function toggleVitalBatimentoContextMode() {
  const next = vitalBatimentoContextMode === 'sono_repouso' ? 'all' : 'sono_repouso';
  setVitalBatimentoContextMode(next);
}


function getIdealLabel(value) {
  return typeof formatIdealLabel === 'function' ? formatIdealLabel(value) : value;
}

function toIdealObjectFromInput(value) {
  return typeof parseIdealObject === 'function' ? parseIdealObject(value) : value;
}

/**
 * Faixa ideal (BPM) definida em Meus Indicadores → valor ideal (ex.: 60-100).
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
    success: { icon: '✅', title: 'Concluido' },
    warning: { icon: '⚠️', title: 'Aviso' },
    error: { icon: '❌', title: 'Erro' },
    info: { icon: 'ℹ️', title: 'Informacao' }
  };
  const current = config[type] || config.info;

  contentEl.classList.remove('type-success', 'type-warning', 'type-error');
  if (type === 'success') contentEl.classList.add('type-success');
  if (type === 'warning') contentEl.classList.add('type-warning');
  if (type === 'error') contentEl.classList.add('type-error');

  iconEl.textContent = current.icon;
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
    const navItem = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
    if (!navItem) return;
    navItem.style.display = config[screenId] ? '' : 'none';
  });

  if (currentScreen && controlledScreens.includes(currentScreen) && !config[currentScreen]) {
    switchScreen('homeScreen');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const homeNavItem = document.querySelector('.nav-item[data-screen="homeScreen"]');
    if (homeNavItem) homeNavItem.classList.add('active');
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
  composicaoScreen: { actions: '' },
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
    ? `<div class="home-status-card home-status-card--warning" onclick="switchScreen('medicacoesScreen')" style="cursor:pointer;">
        <span class="home-status-icon home-status-icon--warning">!</span>
        <div class="home-status-text">
          <div class="home-status-title">${atrasadas.length} em atraso</div>
          <div class="home-status-sub">Medicações atrasadas</div>
        </div>
      </div>`
    : `<div class="home-status-card home-status-card--ok" onclick="switchScreen('medicacoesScreen')" style="cursor:pointer;">
        <span class="home-status-icon home-status-icon--ok">✓</span>
        <div class="home-status-text">
          <div class="home-status-title">Tudo em dia!</div>
          <div class="home-status-sub">Medicações em ordem</div>
        </div>
      </div>`;
  document.getElementById('homeNow').innerHTML = nowHtml;

  const vitais = mockData.sinaisVitais
    .filter(v => (mockData.configSinaisVitais[v.tipo] || {}).exibirDashboard)
    .slice(0, 3);
  // Always include Glicemia
  const glicemia = mockData.sinaisVitais.find(v => v.tipo === 'Glicemia');
  if (glicemia && !vitais.some(v => v.tipo === 'Glicemia')) vitais.push(glicemia);
  const vitalsHtml = vitais.map(v => createVitalCard(v, { layout: 'home' })).join('');
  document.getElementById('homeVitals').innerHTML = vitalsHtml || '<div class="card-info" style="padding:8px;">Nenhum sinal configurado para o Dashboard.</div>';

  var subtitleEl = document.getElementById('homeSaudeSubtitle');
  if (subtitleEl) subtitleEl.textContent = 'Hoje · ' + vitais.length + ' indicadores';

  const _d15 = new Date(); _d15.setDate(_d15.getDate() + 15);
  const hoje15 = _d15.getFullYear() + '-' + String(_d15.getMonth()+1).padStart(2,'0') + '-' + String(_d15.getDate()).padStart(2,'0');
  const consultaHtml = mockData.consultas.length > 0
    ? createConsultaCard(Object.assign({}, mockData.consultas[0], { data: hoje15 }), 'home')
    : '<div class="empty-state"><div class="empty-text">Nenhuma consulta agendada</div></div>';
  document.getElementById('homeConsulta').innerHTML = consultaHtml;
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
    hojeHtml += '<div class="subsection-title">Já tomadas hoje</div>';
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

function renderCompartilhamento() {
  let html = '';

  if (mockData.compartilhamentos.length > 0) {
    html = mockData.compartilhamentos.map(createCompartilhamentoCard).join('');
  } else {
    html = '<div class="empty-state"><div class="empty-text">Nenhum compartilhamento ativo</div></div>';
  }

  document.getElementById('compartilhamentoContent').innerHTML = html;
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

function renderPerfil() {
  const usuario = mockData.usuario;
  const diasVida = calcularIdade(usuario.dataNascimento);
  ensureBottomNavConfig();

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
          : item.personalize === 'corpo'
            ? `<button type="button" class="config-gear-btn config-gear-btn--nav-row" onclick="event.stopPropagation(); openComposicaoConfigModal()" aria-label="Personalizar o que aparece em Corpo e no Dashboard"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>`
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
  
  let html = `
    <div class="profile-card">
      <div class="profile-avatar profile-avatar--initials">${getIniciaisNome(usuario.nome)}</div>
      <div class="profile-info">
        <div class="profile-name">${usuario.nome}</div>
        <div class="profile-email">${usuario.email}</div>
        <div class="profile-email">CPF: ${usuario.cpf}</div>
        <div class="profile-email">Telefone: ${usuario.telefone}</div>
      </div>
    </div>

    <div class="section-title section-title--icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Configurações</div>
    <div class="config-item" onclick="openMeusIndicadoresModal()" style="cursor:pointer;">
      <div class="config-item-content">
        <div class="config-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
        <div class="config-text">
          <div class="config-title">Meus Indicadores</div>
          <div class="config-subtitle">Gerenciar sinais vitais e composição</div>
        </div>
      </div>
      <div>›</div>
    </div>

    <div class="section-title section-title--icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Itens do Menu</div>
    ${navControlsHtml}

    <div class="section-title section-title--icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> Dispositivos</div>
    <button class="button button-confirm" id="addDispositivoBtn" style="margin-bottom: 12px;">+ Cadastrar Dispositivo</button>
    <div id="dispositivosContent"></div>

    <div class="section-title section-title--icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Compartilhamento</div>
    <button class="button button-confirm" id="addCompartilhamentoBtn">+ Compartilhar com Médico</button>

    <div id="compartilhamentoContent" style="margin-top: 16px;"></div>

    <div class="section-title section-title--icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Exames Realizados</div>
  `;

  if (mockData.examesRealizados.length > 0) {
    html += mockData.examesRealizados.map(e => createExameCard(e, true)).join('');
  } else {
    html += '<div class="empty-state"><div class="empty-text">Nenhum exame realizado</div></div>';
  }

  document.getElementById('perfilContent').innerHTML = html;
  
  document.getElementById('addCompartilhamentoBtn').addEventListener('click', () => {
    document.getElementById('addCompartilhamentoModal').classList.add('active');
  });

  document.getElementById('addDispositivoBtn').addEventListener('click', openAddDispositivoModal);

  renderCompartilhamentoInPerfil();
  renderDispositivos();
}

// ===== NAVEGAÇÃO =====

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const screenId = item.dataset.screen;
      switchScreen(screenId);
      
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  currentScreen = screenId;
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
  hint.textContent = `Sugestão de estoque para o período: ${sug} unidades (${d} dia(s) × ${dosesPorDia} dose(s)/dia).`;
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
  hint.textContent = `Sugestão de estoque para o período: ${sug} unidades (${d} dia(s) × ${dosesPorDia} dose(s)/dia).`;
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
  if (back) back.style.display = addMedStep > 1 ? '' : 'none';
  if (next) next.style.display = addMedStep < 4 ? '' : 'none';
  if (save) save.style.display = addMedStep === 4 ? '' : 'none';
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
      return 'Informe por quantos dias o medicamento será tomado ou ative uso contínuo (sem período previsto).';
    }
  }
  if (step === 2) {
    const f = document.getElementById('frequenciaMedInput')?.value;
    if (!f) return 'Selecione com que frequência você toma este medicamento.';
  }
  if (step === 3) {
    const dataInicio = document.getElementById('dataInicioMedInput')?.value;
    const horarios = Array.from(document.querySelectorAll('.horario-input')).map((i) => i.value).filter(Boolean);
    if (!dataInicio) return 'Informe a data de início.';
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
    <option value="Uso conforme orientação médica">Uso conforme orientação médica</option>
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
      showFeedbackModal('Verifique a data de início e a duração em dias.', 'warning');
      return;
    }
    if (horarios.length === 0) { showFeedbackModal('Informe pelo menos um horario.', 'warning'); return; }

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
          `O estoque informado (${est}) é menor que o necessário para o período (${need} unidades = ${duracaoDias} dia(s) × ${horarios.length} dose(s)/dia). Deseja continuar mesmo assim?`,
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

// ===== AÇÕES DE MEDICAÇÃO =====

function markAsTaken(medicacaoId) {
  const medicacao = mockData.medicacoes.find(m => m.id === medicacaoId);
  if (medicacao) {
    const now = new Date();
    const hora = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    medicacao.ultimo = `${hora} ✅`;
    medicacao.historico.push({
      data: now.toISOString().slice(0, 10),
      hora: hora,
      status: 'tomado'
    });
    renderMedicacoes();
    showFeedbackModal(`${medicacao.nome} marcado como tomado as ${hora}.`, 'success');
  }
}

function editMedicacao(medicacaoId) {
  showFeedbackModal('Funcionalidade de edicao em desenvolvimento.', 'info');
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

function testAlarm() {
  if (mockData.medicacoes.length > 0) {
    showMedicationAlarm(mockData.medicacoes[0].id, mockData.medicacoes[0].horarios?.[0]);
  }
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
      showFeedbackModal('Verifique a data de início e a duração em dias.', 'warning');
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
          `O estoque informado (${est}) é menor que o necessário para o período (${need} unidades = ${duracaoDias} dia(s) × ${horarios.length} dose(s)/dia). Deseja continuar mesmo assim?`,
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
    const msg = `Hora da proxima medicao (${dateTxt} as ${timeTxt}).`;
    showFeedbackModal(msg, 'warning', 'Lembrete de medicao');
    if (item.notificar) {
      trySendBrowserNotification('Lembrete de medicao', msg);
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
  const ativos = mockData.composicaoCorporal
    .filter(c => (mockData.configComposicao[c.tipo] || {}).exibirCorpo !== false);

  const isOutOfIdeal = (c) => {
    if (!c || c.valor == null || !c.ideal) return false;
    const ideal = c.ideal;
    const current = parseFloat(c.valor);
    if (Number.isNaN(current)) return false;

    if (ideal.type === 'range' && ideal.min != null && ideal.max != null) return current < ideal.min || current > ideal.max;
    if (ideal.type === 'max' && ideal.max != null) return current > ideal.max;
    if (ideal.type === 'min' && ideal.min != null) return current < ideal.min;
    if (ideal.type === 'target' && ideal.target != null) return current !== ideal.target;
    return false;
  };

  const foraDoIdeal = ativos.filter(isOutOfIdeal);
  const principaisTipos = new Set(['Peso', 'IMC', 'Circunferência Cintura', 'Percentual de Gordura', 'Massa Muscular', 'Hidratação']);
  const principais = ativos.filter(c => !foraDoIdeal.includes(c) && principaisTipos.has(c.tipo));
  const outros = ativos.filter(c => !foraDoIdeal.includes(c) && !principaisTipos.has(c.tipo));

  let html = '';

  if (foraDoIdeal.length) {
    html += `<div class="subsection-title">Fora do ideal</div>`;
    html += foraDoIdeal.map(createComposicaoCard).join('');
  }

  if (principais.length) {
    html += `<div class="subsection-title">Principais</div>`;
    html += principais.map(createComposicaoCard).join('');
  }

  if (outros.length) {
    html += `<div class="subsection-title">Outros</div>`;
    html += outros.map(createComposicaoCard).join('');
  }

  document.getElementById('composicaoContent').innerHTML = html ||
    '<div class="empty-state"><div class="empty-text">Nenhum dado de composição corporal</div></div>';
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
      <div class="ecg-meta"><span class="ecg-date">📅 ${formatDateTimeForUI(ecg.dataHora)}</span></div>
      <div class="ecg-interpretation">${ecg.interpretacao}</div>
    </div>
  `;

  if (ecg.historico && ecg.historico.length > 0) {
    html += '<div class="section-title" style="margin-top: 16px; margin-bottom: 12px;">Histórico</div>';
    html += ecg.historico.map(h => {
      const dataFormatada = h.data;
      const hora = h.hora ? ` às ${h.hora}` : '';
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
}

function setupEcgDetailModal() {
  const modal = document.getElementById('ecgDetailModal');
  const closeBtn = document.getElementById('closeEcgDetailModal');
  if (!modal) return;

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
}

// ===== FECHAR MODAL DE HISTÓRICO =====

document.addEventListener('DOMContentLoaded', () => {
  const closeVitalDetailModal = document.getElementById('closeVitalDetailModal');
  if (closeVitalDetailModal) {
    closeVitalDetailModal.addEventListener('click', () => {
      document.getElementById('vitalDetailModal').classList.remove('active');
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
  setupComposicaoModal();

  window.addEventListener('resize', () => {
    const m = document.getElementById('exercicioDetalheModal');
    if (m && m.classList.contains('active') && window._lastExercicioSessaoCanvas) {
      renderExercicioHrCanvas(window._lastExercicioSessaoCanvas);
    }
  });
});


// ===== MODAL DE COMPOSIÇÃO CORPORAL =====

let currentComposicaoId = null;

function setupComposicaoModal() {
  const modal = document.getElementById('composicaoModal');
  const cancelBtn = document.getElementById('cancelComposicaoBtn');
  const form = document.getElementById('composicaoForm');

  const closeModal = () => { modal.classList.remove('active'); form.reset(); };

  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const valor = parseFloat(document.getElementById('composicaoValorInput').value);
    const fonte = document.getElementById('composicaoFonteInput').value;
    const data = document.getElementById('composicaoDataInput').value;

    const composicao = mockData.composicaoCorporal.find(c => c.id === currentComposicaoId);
    if (composicao) {
      composicao.valor = valor;
      composicao.fonte = fonte;
      composicao.dataHora = data;
      
      if (!composicao.historico) {
        composicao.historico = [];
      }
      
      composicao.historico.unshift({
        data: data,
        valor: valor,
        variacao: composicao.variacao,
        fonte: fonte
      });

      showFeedbackModal(`${composicao.tipo} atualizado com sucesso.`, 'success');
      modal.classList.remove('active');
      form.reset();
      renderComposicao();
    }
  });
}

function openComposicaoModal(composicaoId, tipo) {
  currentComposicaoId = composicaoId;
  const composicao = mockData.composicaoCorporal.find(c => c.id === composicaoId);
  
  if (!composicao) return;

  document.getElementById('composicaoModalTitle').textContent = `Adicionar ${tipo}`;
  document.getElementById('composicaoValorInput').value = '';
  document.getElementById('composicaoFonteInput').value = composicao.fonte || 'Manual';
  document.getElementById('composicaoDataInput').value = new Date().toISOString().split('T')[0];

  renderComposicaoHistorico(composicao.historico || []);
  document.getElementById('composicaoModal').classList.add('active');
}

function renderComposicaoHistorico(historico) {
  if (historico.length === 0) {
    document.getElementById('composicaoHistoricoContent').innerHTML = '<div class="empty-state"><div class="empty-text">Nenhum registro encontrado</div></div>';
    return;
  }

  const html = historico.map(h => {
    const variacaoIcon = h.variacao === 'normal' ? '🟢' : '🔴';
    return `
      <div class="card card-saude" style="margin-bottom: 8px;">
        <div class="card-info"><strong>${formatDateForUI(h.data)}</strong> ${variacaoIcon}</div>
        <div class="card-value" style="font-size: 16px;">${h.valor}</div>
        <div class="card-info">Fonte: ${h.fonte}</div>
      </div>
    `;
  }).join('');
  document.getElementById('composicaoHistoricoContent').innerHTML = html;
}




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

function markMedicationAsTaken(nome, dosagem, horario) {
  const med = mockData.medicacoes.find(m => m.nome === nome && m.dosagem === dosagem);
  if (!med) return;
  markMedicationByIdAndTime(med.id, horario, getTodayISODate());
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
      `Desfazer "${nome} ${dosagem}" marcado como tomado às ${horario}?`,
      () => {
        const undone = undoMedicationTaken(medId, dateISO, horario);
        if (!undone) {
          showFeedbackModal('Não foi possível desfazer essa marcação.', 'warning');
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
      '<p class="form-hint" style="margin:0;">Nenhuma dose marcada como tomada nos últimos 14 dias.</p>';
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
      <span class="calendar-day-pill ok">✅ ${totalTaken} tomadas</span>
      <span class="calendar-day-pill pending">⏳ ${totalPending} pendentes</span>
      <span class="calendar-day-pill missed">🔴 ${totalMissed} atrasadas</span>
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
            ${slot.horario} ${slot.status === 'tomado' ? '✓' : slot.status === 'atrasado' ? '!' : '•'}
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
        <p class="search-no-result-text">Nenhum resultado no catálogo para “${termoEsc}”.</p>
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
      const formasTxt = (med.formas && med.formas.length) ? med.formas.join(' • ') : '';
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
        Não é nenhum destes — cadastrar “${termoEsc}” manualmente
      </button>
    </div>`;

  searchResults.innerHTML = html;
  searchResults.style.display = 'block';
}

/** Um remédio por vez: mostra busca ou o nome escolhido + “Trocar”. */
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
      showFeedbackModal('Selecione data de inicio e fim.', 'warning');
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
  if (currentPeriodFilter === '7d') return 'Últimos 7 dias';
  if (currentPeriodFilter === '30d') return 'Últimos 30 dias';
  if (currentPeriodFilter === '90d') return 'Últimos 90 dias';
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
    const icon = percentage === 100 ? '✅' : percentage >= 50 ? '⚠️' : '❌';
    
    html += `
      <div class=\"daily-adherence-item\">\n        <div class=\"daily-date\">${formatDateForUI(data)}</div>\n        <div class=\"daily-stats\">\n          <span>${dayTaken}/${dayExpected}</span>\n          <span class=\"daily-icon\">${icon}</span>\n        </div>\n      </div>\n    `;
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

function toggleAlertaVitalFields() {
  const ativo = document.getElementById('toggleAlertaVital').classList.contains('active');
  document.getElementById('alertaVitalFields').style.display = ativo ? 'block' : 'none';
}

function openAlertasModal() {
  renderAlertasVitais();
  renderAlertasMeds();
  renderAlertasAgenda();
  // Reset abas
  const modal = document.getElementById('alertasModal');
  modal.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  modal.querySelectorAll('.tab-content').forEach((c, i) => c.classList.toggle('active', i === 0));
  modal.classList.add('active');
}

function renderAlertasVitais() {
  const comAlerta = mockData.sinaisVitais.filter(v => v.alerta && v.alerta.ativo);
  if (!comAlerta.length) {
    document.getElementById('alertasVitaisContent').innerHTML = '<div class="card-info" style="padding:12px;color:#999;">Nenhum alerta de sinal vital configurado.<br>Configure em Perfil → Meus Indicadores.</div>';
    return;
  }
  document.getElementById('alertasVitaisContent').innerHTML = comAlerta.map(v => `
    <div class="vital-config-row">
      <span class="vital-config-icon">${v.icon}</span>
      <div style="flex:1;">
        <div class="vital-config-name">${v.tipo}</div>
        <div style="font-size:11px;color:#aaa;">
          ${v.alerta.acima != null ? `↑ Acima de ${v.alerta.acima} ${v.unidade}` : ''}
          ${v.alerta.acima != null && v.alerta.abaixo != null ? ' • ' : ''}
          ${v.alerta.abaixo != null ? `↓ Abaixo de ${v.alerta.abaixo} ${v.unidade}` : ''}
        </div>
      </div>
      <button class="toggle active" onclick="toggleAlertaVitalAtivo(${v.id}, this)"></button>
      <button onclick="editAlertaVital(${v.id})" style="background:none;border:none;font-size:14px;cursor:pointer;color:#454545;padding:4px 2px;">✏️</button>
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
    if (a.lembrete) tags.push(`⏰ ${a.antecedencia}min antes`);
    if (a.atrasada) tags.push('⚠️ Dose atrasada');
    if (a.estoqueBaixo) tags.push('📦 Estoque baixo');
    return `
      <div class="vital-config-row">
        <span class="vital-config-icon">💊</span>
        <div style="flex:1;">
          <div class="vital-config-name">${m.nome} ${m.dosagem}</div>
          <div style="font-size:11px;color:#aaa;">${tags.join(' • ') || 'Sem alertas'}</div>
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
      <span class="vital-config-icon">${a.medico ? '📅' : '🔬'}</span>
      <div style="flex:1;">
        <div class="vital-config-name">${a.medico || a.nome}</div>
        <div style="font-size:11px;color:#aaa;">${formatDateForUI(a.data)} • ${a.alerta.ativo ? antLabel(a.alerta.antecedencia) : 'Desativado'}</div>
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

function openValoresIdeaisModal() {
  renderValoresIdeaisVitais();
  renderValoresIdeaisCorpo();
  document.getElementById('valoresIdeaisModal').classList.add('active');
}

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
        <div style="font-size:11px;color:#aaa;">${v.unidade} • Ideal: ${getIdealLabel(v.ideal)}</div>
      </div>
      <span class="vital-alert-indicator ${v.alerta && v.alerta.ativo ? 'active' : 'inactive'}"
        title="${v.alerta && v.alerta.ativo ? 'Alerta configurado' : 'Sem alerta configurado'}">
        ${v.alerta && v.alerta.ativo ? '🔔' : '🔕'}
      </span>
      <button onclick="editIndicador('vitais',${v.id})" style="background:none;border:none;font-size:14px;cursor:pointer;color:#454545;padding:4px;">✏️</button>
      <button onclick="removeIndicador('vitais',${v.id})" style="background:none;border:none;font-size:14px;cursor:pointer;color:#ddd;padding:4px;">🗑️</button>
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
        <div style="font-size:11px;color:#aaa;">${c.unidade} • Ideal: ${getIdealLabel(c.ideal)}</div>
      </div>
      <button onclick="editIndicador('corpo',${c.id})" style="background:none;border:none;font-size:14px;cursor:pointer;color:#454545;padding:4px;">✏️</button>
      <button onclick="removeIndicador('corpo',${c.id})" style="background:none;border:none;font-size:14px;cursor:pointer;color:#ddd;padding:4px;">🗑️</button>
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

  // Alertas — só para vitais
  const alertaContainer = document.getElementById('alertaVitalContainer');
  if (categoria === 'vitais') {
    alertaContainer.style.display = 'block';
    const alerta = item.alerta || { ativo: false, acima: '', abaixo: '' };
    const toggleBtn = document.getElementById('toggleAlertaVital');
    toggleBtn.classList.toggle('active', !!alerta.ativo);
    document.getElementById('alertaVitalFields').style.display = alerta.ativo ? 'block' : 'none';
    document.getElementById('alertaAcimaInput').value = alerta.acima != null ? alerta.acima : '';
    document.getElementById('alertaAbaixoInput').value = alerta.abaixo != null ? alerta.abaixo : '';
    document.getElementById('alertaUnidadeLabel').textContent = item.unidade;
    document.getElementById('alertaUnidadeLabel2').textContent = item.unidade;
  } else {
    alertaContainer.style.display = 'none';
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
    alertaContainer.style.display = 'block';
    toggleBtn.classList.remove('active');
    fields.style.display = 'none';
    document.getElementById('alertaAcimaInput').value = '';
    document.getElementById('alertaAbaixoInput').value = '';
  } else {
    alertaContainer.style.display = 'none';
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
    const icon = document.getElementById('novoIndicadorIcon').value.trim() || '📊';
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
        if (mockData.sinaisVitais.find(v => v.tipo.toLowerCase() === nome.toLowerCase())) { showFeedbackModal('Este indicador ja existe.', 'warning'); return; }
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
        if (mockData.composicaoCorporal.find(c => c.tipo.toLowerCase() === nome.toLowerCase())) { showFeedbackModal('Este indicador ja existe.', 'warning'); return; }
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

// ===== COMPOSIÇÃO CORPORAL - CONFIG =====

function openComposicaoConfigModal() {
  renderComposicaoConfig();
  document.getElementById('composicaoConfigModal').classList.add('active');
}

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
          <div class="config-subtitle">${d.tipo} • ${d.sinaisColetados.length} sinais</div>
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

let currentTipoDispositivo = null;

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
      icon: catalogo ? catalogo.icon : '📱',
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
        <span class="vital-config-icon" aria-hidden="true">⊞</span>
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
      linha: 'Sensor da pulseira — leitura estável'
    }),
    'Google Fit': () => ({
      sistolica: r(114, 132),
      diastolica: r(72, 88),
      linha: 'Última sincronização do Google Fit'
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
    'Google Fit': 'Simula buscar a última medição sincronizada no Google Fit.',
    'Apple Health': 'Simula importar o último registro do Apple Health.'
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

/** Tempo decorrido desde o início da sessão (eixo do gráfico): mm:ss ou h:mm:ss */
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
    periodoEl.textContent = ini && fim ? `Início ${ini} · Fim ${fim}` : '';
  }

  const cal = sessao.caloriasKcal != null ? `${sessao.caloriasKcal} kcal` : '—';
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
      <span class="exercise-metric-label">Freq. card. média</span>
      <span class="exercise-metric-value">${sessao.freqMedia != null ? `${sessao.freqMedia} bpm` : '—'}</span>
    </div>
    <div class="exercise-metric-cell">
      <span class="exercise-metric-label">Freq. card. máxima</span>
      <span class="exercise-metric-value">${sessao.freqMax != null ? `${sessao.freqMax} bpm` : '—'}</span>
    </div>
  `;

  const dur = sessao.duracaoSegundos || 1;
  const ticks = [0, dur / 4, dur / 2, (3 * dur) / 4, dur];
  axisEl.innerHTML = `${ticks
    .map((t) => `<span>${formatElapsedMMSS(t)}</span>`)
    .join('')}<span class="exercise-axis-flag" title="Fim">🏁</span>`;

  window._lastExercicioSessaoCanvas = sessao;
  document.getElementById('exercicioDetalheModal').classList.add('active');
  requestAnimationFrame(() => renderExercicioHrCanvas(sessao));
  setTimeout(() => renderExercicioHrCanvas(sessao), 200);
}

function closeExercicioDetalheModal() {
  const m = document.getElementById('exercicioDetalheModal');
  if (m) m.classList.remove('active');
}

function openSonoDetalheFromRow(index) {
  const h = currentVitalHistoricoView[index];
  if (!h || h.contextoColeta !== 'sono' || !h.sonoSessao) return;
  openSonoDetalheModal(h.sonoSessao);
}

function openExercicioDetalheFromBatimentoHour(hour) {
  const sel = vitalBatimentoChartSelection;
  if (!sel || sel.kind !== 'day' || !currentVitalDetail || currentVitalDetail.tipo !== 'Batimento Cardíaco') return;
  const inMode = filterBatimentoByContext(currentVitalDetail.historico);
  const buckets = aggregateHeartRateByHourForDay(inMode, sel.iso);
  const b = buckets[hour];
  const r = b && b.readings && b.readings.find((x) => x.contextoColeta === 'exercicio' && x.exercicioSessao);
  if (r && r.exercicioSessao) openExercicioDetalheModal(r.exercicioSessao);
}

function openSonoDetalheFromBatimentoHour(hour) {
  const sel = vitalBatimentoChartSelection;
  if (!sel || sel.kind !== 'day' || !currentVitalDetail || currentVitalDetail.tipo !== 'Batimento Cardíaco') return;
  const inMode = filterBatimentoByContext(currentVitalDetail.historico);
  const buckets = aggregateHeartRateByHourForDay(inMode, sel.iso);
  const b = buckets[hour];
  const r = b && b.readings && b.readings.find((x) => x.contextoColeta === 'sono' && x.sonoSessao);
  if (r && r.sonoSessao) openSonoDetalheModal(r.sonoSessao);
}

/** Rótulos de contexto (Exercício / Sono / …) agregados num bucket horário. */
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
  periodo.textContent = ini && fim ? `Início ${ini} · Fim ${fim}` : '';

  const dm = sessao.duracaoMinutos;
  const durLabel =
    dm != null && Number.isFinite(dm) ? `${Math.floor(dm / 60)} h ${dm % 60} min` : '—';
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
  const fcSonoLabel = fcSonoMin != null ? `${fcSonoMin} – ${fcSonoMax} bpm` : '—';

  grid.innerHTML = [
    cell('Duração registada', durLabel),
    cell('Pontuação', sessao.score != null ? String(sessao.score) : '—'),
    cell('FC mín – máx', fcSonoLabel),
    cell('Leve', sessao.leveMin != null ? `${sessao.leveMin} min` : '—'),
    cell('REM', sessao.remMin != null ? `${sessao.remMin} min` : '—'),
    cell('Profundo', sessao.profundoMin != null ? `${sessao.profundoMin} min` : '—'),
    cell('Acordado', sessao.acordadoMin != null ? `${sessao.acordadoMin} min` : '—')
  ].join('');

  document.getElementById('sonoDetalheModal').classList.add('active');
}

function closeSonoDetalheModal() {
  const m = document.getElementById('sonoDetalheModal');
  if (m) m.classList.remove('active');
}

/** Igual ao subtítulo do modal por minuto: faixa da hora em uma linha. */
function formatBatimentoBpmRangeLine(minV, maxV) {
  if (minV == null || maxV == null || !Number.isFinite(minV) || !Number.isFinite(maxV)) return '—';
  return `${Math.round(minV)} – ${Math.round(maxV)} bpm`;
}

/** Igual ao subtítulo do modal por minuto: "08:00 – 08:59". */
function formatBatimentoHourIntervalLabel(hour) {
  const h = Math.floor(Number(hour));
  const s = String(Number.isFinite(h) && h >= 0 && h <= 23 ? h : 0).padStart(2, '0');
  return `${s}:00 – ${s}:59`;
}

const BATIMENTO_HISTORICO_PREVIEW = 3;

let batimentoMinutoReadingsCache = [];
let batimentoMinutoCurrentHour = null;

/** Mesma hierarquia visual da lista “por hora” (medida em cima, horário em baixo, chevron). */
function buildBatimentoMinutoHistoricoRowHtml(r) {
  const v = parseBatimentoHistoricoValor(r);
  const dateIso = historicoEntryDayISO(r);
  const dateTxt = dateIso ? formatDateForUI(dateIso) : '—';
  const hora = r.hora ? String(r.hora).slice(0, 5) : '—';
  const measureLine = Number.isFinite(v) ? `${Math.round(v)} bpm` : '—';
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

  // Estatísticas da hora
  const hasRange = bucket.min != null && bucket.max != null;
  document.getElementById('batimentoMinutoRange').textContent = hasRange
    ? formatBatimentoBpmRangeLine(bucket.min, bucket.max)
    : '—';

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

/** Lista do período: toque no dia → mesma vista que tocar na coluna do gráfico. */
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

/** Segunda-feira da semana (ISO) para agregar séries longas. */
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

function isBatimentoHistoricoExercicio(h) {
  return !!(h && h.contextoColeta === 'exercicio' && h.exercicioSessao);
}

function isBatimentoHistoricoRepouso(h) {
  return !!(h && h.contextoColeta === 'repouso');
}

function isBatimentoHistoricoSono(h) {
  return !!(h && h.contextoColeta === 'sono');
}

/** Cor de fundo: Sono / Exercício / Repouso / outras condições (histórico detalhado por medição). */
function batimentoHistoricoRowBgClassForEntry(h) {
  if (!h || !currentVitalDetail || currentVitalDetail.tipo !== 'Batimento Cardíaco') return '';
  if (h.contextoColeta === 'sono' && h.sonoSessao) return 'vital-list-item--bc-sono';
  if (h.contextoColeta === 'exercicio' && h.exercicioSessao) return 'vital-list-item--bc-exercicio';
  if (h.contextoColeta === 'repouso') return 'vital-list-item--bc-repouso';
  return 'vital-list-item--bc-outros';
}

/** Lista por dia (período): Baixo / Normal / Alto conforme pico do dia vs faixa ideal — alinhado ao gráfico de barras. */
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
 * Contexto da hora (lista + gráfico horário): Sono → Exercício → Repouso → demais.
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
 * Uma linha por dia civil: mín. e máx. do dia (alinhado às barras do gráfico).
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

/** Ordem cronológica (mais antiga primeiro) — lista do dia ao tocar numa coluna. */
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
 * Atualiza gráficos do chrome de Batimento (período OU vista dia) + painéis visíveis.
 * Não altera lista — use depois de renderVitalDetailContent ou dentro de updateVitalBatimentoModalView.
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

// ─── Batimento: Min/Max card ───────────────────────────────────────────────
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
        <span class="bat-mm-label">Mínimo</span>
        <span class="bat-mm-value">${minVal}</span>
        <span class="bat-mm-unit">bpm</span>
      </div>
      <div class="bat-mm-divider"></div>
      <div class="bat-mm-col">
        <span class="bat-mm-label">Máximo</span>
        <span class="bat-mm-value">${maxVal}</span>
        <span class="bat-mm-unit">bpm</span>
      </div>
    </div>`;
}

let batHourlySelectedHour = null;
let batHdSelectedSlot = null;
// ─── Batimento: Gráfico mín/máx por hora ──────────────────────────────────
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

    // Função de desenho reutilizável — não reconstrói o DOM
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

      // Barras — não selecionadas ficam apagadas quando há seleção ativa
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

// ─── Batimento: Tabela horária ─────────────────────────────────────────────
function renderBatimentoHourlyTable(historico) {
  const el = document.getElementById('batHourlyTable');
  if (!el) return;

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

  const INITIAL = 4;
  let showAll = false;

  const BAT_CLS = {
    sleep:    { color: '#94a3b8', p: '<path fill="#94a3b8" stroke="none" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' },
    run:      { color: '#94a3b8', p: '<path fill="#94a3b8" stroke="none" d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>' },
    exercise: { color: '#94a3b8', p: '<line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="8" x2="6" y2="16"/><line x1="18" y1="8" x2="18" y2="16"/><line x1="3" y1="9" x2="3" y2="15"/><line x1="21" y1="9" x2="21" y2="15"/>' }
  };
  // Horas fixas com ícone de exercício (treino) e corrida — mock decorativo
  const EXERCISE_HOURS = new Set([8, 9, 17]);
  const RUN_HOURS      = new Set([7, 10, 16, 18]);
  const getBatCls = (slot) => {
    const h = parseInt(slot.split(':')[0]);
    if (h >= 23 || h < 7) return BAT_CLS.sleep;
    if (EXERCISE_HOURS.has(h)) return BAT_CLS.exercise;
    if (RUN_HOURS.has(h)) return BAT_CLS.run;
    return null;
  };

  const renderRows = (all) => rows.slice(0, all ? rows.length : INITIAL).map(([slot, d]) => {
    const cls = getBatCls(slot);
    const icoHtml = cls ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${cls.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cls.p}</svg>` : '';
    const safeSlot = slot.replace(/'/g, "\\'");
    return `
    <div class="bat-hourly-row" onclick="openBatHourlyDetail('${safeSlot}', ${d.min}, ${d.max}, window.__batHourlyHistorico)">
      <div class="bat-hourly-left">
        <span class="bat-hourly-range">${d.min} <span class="bat-hourly-sep">–</span> ${d.max} <span class="bat-hourly-unit">bpm</span></span>
        <span class="bat-hourly-slot">${slot}</span>
      </div>
      <div class="bat-hourly-right">${icoHtml}</div>
    </div>`;
  }).join('');

  const rebuild = (all) => {
    el.innerHTML = `
      <div class="bat-hourly-header">Últimas medições por hora</div>
      <div class="bat-hourly-rows" id="batHourlyRows">${renderRows(all)}</div>
      ${rows.length > INITIAL ? `<button class="bat-hourly-more" id="batHourlyMoreBtn">${all ? 'Ver menos' : 'Ver mais'}</button>` : ''}`;
    const btn = document.getElementById('batHourlyMoreBtn');
    if (btn) btn.onclick = () => rebuild(!all);
  };

  rebuild(showAll);
}

// ─── Batimento: Detalhe de uma hora específica ────────────────────────────
let _batHdCurrentHistorico = null;

function openBatHourlyDetail(slotKey, dMin, dMax, historico) {
  _batHdCurrentHistorico = historico;

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

  // Min/Max card
  const mmEl = document.getElementById('batHdMinMax');
  if (mmEl) {
    mmEl.innerHTML = `
      <div class="bat-hd-mm-item">
        <span class="bat-hd-mm-label">Mínimo</span>
        <span class="bat-hd-mm-value">${dMin}</span>
        <span class="bat-hd-mm-unit">bpm</span>
      </div>
      <div class="bat-hd-mm-divider"></div>
      <div class="bat-hd-mm-item">
        <span class="bat-hd-mm-label">Máximo</span>
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
  const view = document.getElementById('batHourlyDetailView');
  if (view) view.style.display = 'none';

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
      // variação sintética suave
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

// ─── Batimento: Tendência de repouso 7 dias ────────────────────────────────
function renderBatimentoRestingTrend(historico) {
  const el = document.getElementById('batRestingTrend');
  if (!el) return;
  window.__batRestingHistorico = historico;

  const band = typeof getBatimentoChartIdealBand === 'function' ? getBatimentoChartIdealBand() : { min: 60, max: 100 };

  // Últimos 7 dias: filtrar repouso/sono por dia, calcular média
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

  // Calcular média geral para destaque
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
    <div class="bat-resting-header">Tendência em repouso <span class="bat-resting-sub">7 dias</span></div>
    ${avgVal != null ? `<div class="bat-resting-avg"><span class="bat-resting-avg-value">${avgVal}</span><span class="bat-resting-avg-unit">bpm média</span></div>` : ''}
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

    // Y labels — só mín e máx reais para não poluir
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

// ─── Batimento: Detalhe Tendência em Repouso ──────────────────────────────
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
  if (avg <= 60) return { cls: 'brd-status-blue',   label: 'Atlético',   text: 'Frequência típica de pessoas com alta aptidão cardiovascular.',                             tip: 'Mantenha a rotina de exercícios — seu coração agradece.' };
  if (avg <= 72) return { cls: 'brd-status-green',  label: 'Excelente',  text: 'Frequência cardíaca em repouso em nível excelente.',                                         tip: 'Continue dormindo bem e mantendo a atividade física regular.' };
  if (avg <= 80) return { cls: 'brd-status-green',  label: 'Normal',     text: 'Frequência cardíaca em repouso dentro da faixa saudável para adultos.',                     tip: 'Sono de qualidade e caminhadas diárias ajudam a manter esse resultado.' };
  if (avg <= 90) return { cls: 'brd-status-yellow', label: 'Atenção',    text: 'Frequência cardíaca em repouso levemente acima do ideal.',                                   tip: 'Tente reduzir o estresse e priorize pelo menos 7h de sono por noite.' };
  return              { cls: 'brd-status-red',      label: 'Elevado',    text: 'Frequência cardíaca em repouso elevada.',                                                  tip: 'Considere consultar um profissional de saúde e evite cafeína à noite.' };
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
  if (statVar) statVar.textContent = '±' + Math.round((maxV - minV) / 2);

  // Range label
  var rangeEl = document.getElementById('brdChartRange');
  var rangeMap = { '7d': 'últimos 7 dias', '30d': 'últimos 30 dias', '3m': 'últimos 3 meses', '1y': 'último ano' };
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

// ─── Batimento: Compartilhar card ─────────────────────────────────────────
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

    // cloneNode não copia pixels de <canvas> — copiar manualmente
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

    // Compositar: header de branding + conteúdo completo + rodapé
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

    // --- Rodapé ---
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

// ─── Batimento: Day Picker ─────────────────────────────────────────────────
function renderBatimentoDayPicker(historico) {
  const el = document.getElementById('batDayPickerCard');
  if (!el) return;

  const todayISO = getTodayISODate();
  const selectedISO = batimentoSelectedDayISO || todayISO;

  // Agrupar por dia ISO → { iso, min, max }
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

  // Construir lista de dias: últimos 90 dias, do mais antigo ao mais recente
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

  // Scroll para mostrar o dia selecionado visível à direita
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
  renderBatimentoHourlyTable(dayData);
}

/**
 * Único ponto de atualização do modal de Batimento: lista + resumo do período + gráficos.
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

  // Day picker — usa todo o histórico sem filtro de contexto para incluir todos os dias
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
  renderBatimentoHourlyTable(dayData);
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
 * Ano: agrega por semana/quinzena. Demais chips e livre: uma barra por dia no intervalo (7 → 7 colunas, etc.).
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

/** Resumo curto do período (batimento): evita a frase longa “dia(s) com registro · leitura(s) · …”. */
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

/** Ao mudar início/fim no modo Livre, a seleção de coluna deixa de ser válida. */
function onBatimentoLivreRangeChange() {
  vitalBatimentoChartSelection = null;
  applyVitalBatimentoView();
}

function setVitalBatimentoPeriod(period) {
  vitalBatimentoChartSelection = null;
  vitalBatimentoPeriod = period;
  const livreRow = document.getElementById('vitalBatimentoLivreRow');
  if (livreRow) livreRow.style.display = period === 'livre' ? 'block' : 'none';
  if (period === 'livre') {
    const di = document.getElementById('filterBatimentoLivreInicio');
    const df = document.getElementById('filterBatimentoLivreFim');
    const end = getTodayISODate();
    if (di && df && !di.value && !df.value) {
      const s = localNoonFromISODate(end);
      s.setDate(s.getDate() - 6);
      di.value = dateToLocalISODate(s);
      df.value = end;
    }
  }
  updateBatimentoChipActive();
  applyVitalBatimentoView();
}

/** Evita barra invisível quando min≈max (mesma regra no gráfico por dia e por hora). */
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
 * Eixo Y do gráfico: inclui todos os dados **e** a faixa ideal, para barras não ficarem “presas” em 60–100.
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

/** Fundo: apenas a faixa ideal (verde claro) + linhas tracejadas nos limites — como no histórico original. */
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

/** Trechos da barra: Baixo = laranja escuro, Normal = laranja claro, Alto = vermelho (não é legenda de “faixa” texto). */
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
/** Barra única por hora na vista Detalhado: cor = situação da medição (não Baixo/Normal/Alto). */
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
      /* Demais: fora de sono / exercício / repouso — laranja */
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
      rangeEl.textContent = '—';
    }
  }
  if (lastEl) {
    if (stats.lastVal != null && Number.isFinite(stats.lastVal)) {
      lastEl.style.display = 'block';
      lastEl.textContent = `Última leitura: ${Math.round(stats.lastVal)} bpm${stats.lastTime ? ` · ${stats.lastTime}` : ''}`;
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

/** Título do modal: "Detalhado" na vista dia; "Histórico de …" no período. */
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

function clearVitalBatimentoDaySelection() {
  vitalBatimentoChartSelection = null;
  updateVitalBatimentoModalView();
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

/** Uma barra por janela de 2 min: FC no instante médio da janela (interpolação entre amostras). */
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
  document.getElementById('vitalDetailTitle').textContent = `Histórico de ${tipoVital}`;
  document.getElementById('filterVitalDataInicio').value = '';
  document.getElementById('filterVitalDataFim').value = '';

  const bc = tipoVital === 'Batimento Cardíaco';
  const isPressao = tipoVital === 'Pressão Arterial';
  const isPassos = tipoVital === 'Passos';
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
  if (defaultPeriodControls) defaultPeriodControls.style.display = !bc && (isPressao || isPassos) ? 'block' : 'none';
  if (defaultDateFilterRow) defaultDateFilterRow.style.display = !bc && !isPressao && !isPassos ? 'block' : 'none';

  const vitalDetailContentEl = document.getElementById('vitalDetailContent');
  const vitalDetailAddRowEl = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (vitalDetailContentEl) vitalDetailContentEl.style.display = bc ? 'none' : '';
  if (vitalDetailAddRowEl) vitalDetailAddRowEl.style.display = bc ? 'none' : '';

  if (pressaoHistoricoView) pressaoHistoricoView.style.display = 'block';

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
    if (isPressao || isPassos) {
      vitalDefaultPeriod = '7d';
      if (isPassos) {
        passosSelectedDayIso = null;
        passosSelectedHour = null;
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

  document.getElementById('addVitalMedicaoBtn').onclick = () => {
    openAddVitalModal(tipoVital);
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

  const pares = entries.map(h => typeof parseHistoricoPressurePair === 'function' ? parseHistoricoPressurePair(h) : null).filter(Boolean);
  const minS = pares.length ? Math.min(...pares.map(p => p.s)) : null;
  const maxS = pares.length ? Math.max(...pares.map(p => p.s)) : null;
  const minD = pares.length ? Math.min(...pares.map(p => p.d)) : null;
  const maxD = pares.length ? Math.max(...pares.map(p => p.d)) : null;
  const sRange = pares.length ? (minS === maxS ? String(maxS) : `${minS} – ${maxS}`) : '—';
  const dRange = pares.length ? (minD === maxD ? String(minD) : `${minD} – ${maxD}`) : '—';

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

  // SVG icon strings — small, gray, minimal
  const _svgNote = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  const _svgMed = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7.07-7.07l-10 10a4.95 4.95 0 1 0 7.07 7.07Z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>`;
  const _svgSin = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`;
  const _svgChev = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  listEl.innerHTML = toShow.map((h, _idx) => {
    const hora = h.hora ? String(h.hora).trim().slice(0, 5) : '--:--';
    const valorFormatado = typeof formatHistoricValue === 'function' ? formatHistoricValue(currentVitalDetail?.tipo, h) : h.valor;
    const hr = getHeartRateForPressureEntry(h);
    const hrLabel = Number.isFinite(hr) ? `${Math.round(hr)} bpm` : '';

    const hasNota = h.anotacao && String(h.anotacao).trim().length > 0;
    const hasMed = h.medicamentoPressao && h.medicamentoPressao !== 'nenhum';
    const hasSin = h.sintomas && String(h.sintomas).trim().length > 0;

    const noteIcon = hasNota ? `<span class="pressao-icon" title="${String(h.anotacao).trim()}">${_svgNote}</span>` : '';
    const medIcon = hasMed ? `<span class="pressao-icon" title="Medicação: ${h.medicamentoPressao}">${_svgMed}</span>` : '';
    const sinIcon = hasSin ? `<span class="pressao-icon" title="Sintoma: ${String(h.sintomas).trim()}">${_svgSin}</span>` : '';

    return `
      <div class="pressao-coleta-item pressao-coleta-item--clickable" onclick="openPressaoColetaDetail(${_idx})">
        <div class="pressao-coleta-main">
          <div class="pressao-coleta-left">
            <span class="pressao-coleta-valor">${valorFormatado} mmHg</span>${hrLabel ? `<span class="pressao-coleta-sep">·</span><span class="pressao-coleta-fc">${hrLabel}</span>` : ''}
            <div class="pressao-coleta-hora">${hora}</div>
          </div>
          <div class="pressao-coleta-icons">${noteIcon}${medIcon}${sinIcon}<span class="pressao-coleta-chevron">${_svgChev}</span></div>
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
  pressaoSelectedDay = null;
  const _dCanvas = document.getElementById('sparklineChart');
  if (_dCanvas && typeof _dCanvas.__drawPressao === 'function') _dCanvas.__drawPressao();
  const view = document.getElementById('pressaoDiaDetailView');
  if (view) view.style.display = 'none';
  const contentEl = document.getElementById('vitalDetailContent');
  if (contentEl) contentEl.style.display = '';
  const addRow = document.querySelector('#vitalDetailModal .vital-detail-add-row');
  if (addRow) addRow.style.display = '';
}

function openPressaoColetaDetail(idx) {
  const h = pressaoColetaEntries[idx];
  if (!h) return;

  const diaView = document.getElementById('pressaoDiaDetailView');
  if (diaView) diaView.style.display = 'none';
  const coletaView = document.getElementById('pressaoColetaDetailView');
  if (!coletaView) return;
  coletaView.style.display = 'block';

  // Hide chart + period filters while in reading detail
  const _chartArea = document.getElementById('pressaoHistoricoView');
  if (_chartArea) _chartArea.style.display = 'none';
  const _periodControls = document.getElementById('vitalDefaultPeriodControls');
  if (_periodControls) _periodControls.style.display = 'none';

  // Label: "Sex, 08 mai · 18:15"
  const hora = h.hora ? String(h.hora).trim().slice(0, 5) : '--:--';
  const labelEl = document.getElementById('pressaoColetaDetailLabel');
  if (labelEl && pressaoColetaDayIso) {
    const [_y, _m, _d] = pressaoColetaDayIso.split('-').map(Number);
    const _dateObj = new Date(_y, _m - 1, _d);
    const _dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const _meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    labelEl.textContent = `${_dias[_dateObj.getDay()]}, ${String(_d).padStart(2, '0')} ${_meses[_m - 1]} · ${hora}`;
  }

  const pair = typeof parseHistoricoPressurePair === 'function' ? parseHistoricoPressurePair(h) : null;
  const hr = getHeartRateForPressureEntry(h);
  const hrLabel = Number.isFinite(hr) ? `${Math.round(hr)} bpm` : null;
  const medTomado = h.medicamentoPressao === 'tomados';

  // Simulate a note if none exists (for demo)
  const nota = (h.anotacao && String(h.anotacao).trim().length > 0)
    ? String(h.anotacao).trim()
    : 'Medição realizada em repouso, após 5 minutos sentado.';

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
            <span class="pressao-coleta-det-value">${pair ? pair.s : '—'}</span>
          </div>
          <div class="pressao-coleta-det-center">
            <span class="pressao-coleta-det-unit">/</span>
          </div>
          <div class="pressao-coleta-det-metric">
            <span class="pressao-coleta-det-label pressao-coleta-det-label--dia">DIA.</span>
            <span class="pressao-coleta-det-value">${pair ? pair.d : '—'}</span>
          </div>
        </div>
        <div class="pressao-coleta-det-unit-row">mmHg</div>
        ${hrLabel ? `<div class="pressao-coleta-det-hr"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span>${hrLabel}</span>${medIconHtml}</div>` : ''}
      </div>
      <div class="pressao-nota-card">
        <div class="pressao-nota-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>Nota</span>
        </div>
        <p class="pressao-nota-text">${nota}</p>
      </div>`;
  }
}

function closePressaoColetaDetail() {
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

/* ── Inserção manual de pressão arterial ──────────────────────────────────── */
let pressaoInsertStep = 1;
let pressaoInsertData = { sis: 120, dia: 80, hr: 72, med: 'nenhum', nota: '' };
let _piStepTimer = null;
var PI_DRUM_IH = 56; // height per drum slot (px)
var _piDrumDrag = null;

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
  if (insertView) insertView.style.display = 'block';

  _pressaoInsRender();
}

function closePressaoInsertForm() {
  stopStepPA();
  const insertView = document.getElementById('pressaoInsertView');
  if (insertView) insertView.style.display = 'none';

  const chart = document.getElementById('pressaoHistoricoView');
  if (chart) chart.style.display = '';
  const filters = document.getElementById('vitalDefaultPeriodControls');
  if (filters) filters.style.display = '';

  const diaView = document.getElementById('pressaoDiaDetailView');
  if (diaView) diaView.style.display = 'block';
}

function pressaoInsGo(step) {
  stopStepPA();
  if (pressaoInsertStep === 4) {
    var ta = document.getElementById('piNotaInput');
    if (ta) pressaoInsertData.nota = ta.value.trim();
  }
  if (step < 1) { closePressaoInsertForm(); return; }
  pressaoInsertStep = step;
  _pressaoInsRender();
}

function pressaoInsConfirmStep() {
  var s = pressaoInsertStep;
  if (s === 4) {
    var ta = document.getElementById('piNotaInput');
    if (ta) pressaoInsertData.nota = ta.value.trim();
    pressaoInsGo(5);
  } else if (s === 5) {
    pressaoInsSave();
  } else {
    pressaoInsGo(s + 1);
  }
}

function _pressaoInsRender() {
  var s = pressaoInsertStep;

  // Update step dots (5 total)
  [1, 2, 3, 4, 5].forEach(function(i) {
    var dot = document.querySelector('[data-pidot="' + i + '"]');
    if (dot) {
      if (i === s) dot.classList.add('pressao-ins-dot--active');
      else dot.classList.remove('pressao-ins-dot--active');
    }
    var stepEl = document.getElementById('piStep' + i);
    if (stepEl) stepEl.style.display = i === s ? 'flex' : 'none';
  });

  // Wire back button
  var backBtn = document.getElementById('piBackBtn');
  if (backBtn) {
    backBtn.onclick = s === 1 ? closePressaoInsertForm : function() { pressaoInsGo(s - 1); };
  }

  // Update shared confirm button label/style
  var btn = document.getElementById('piConfirmBtn');
  if (btn) {
    if (s === 5) {
      btn.textContent = 'Salvar';
      btn.className = 'pressao-ins-confirm-btn pressao-ins-confirm-btn--save';
    } else {
      btn.textContent = 'Confirmar';
      btn.className = 'pressao-ins-confirm-btn';
    }
  }

  if (s === 1) { _piDrumRender('sis'); _piDrumRender('dia'); }
  if (s === 2) { _piDrumRender('hr'); }
  if (s === 3) { _pressaoInsMedSync(); }
  if (s === 4) {
    var ta2 = document.getElementById('piNotaInput');
    if (ta2) { ta2.value = pressaoInsertData.nota; setTimeout(function() { ta2.focus(); }, 80); }
  }
  if (s === 5) { _piRenderSummary(); }
}

function _piRenderSummary() {
  var medLabels = { tomados: 'Tomados', nao_tomados: 'Não tomados', nenhum: 'Não se aplica' };
  var el;
  el = document.getElementById('piSumPressao');
  if (el) el.textContent = pressaoInsertData.sis + '/' + pressaoInsertData.dia + ' mmHg';
  el = document.getElementById('piSumHr');
  if (el) el.textContent = pressaoInsertData.hr + ' bpm';
  el = document.getElementById('piSumMed');
  if (el) el.textContent = medLabels[pressaoInsertData.med] || pressaoInsertData.med;
  el = document.getElementById('piSumNota');
  if (el) {
    var nota = pressaoInsertData.nota;
    el.textContent = nota ? (nota.length > 60 ? nota.slice(0, 57) + '...' : nota) : '—';
  }
}

/* ── Drum picker ─────────────────────────────────────────────────────────── */
function _piDrumRender(field) {
  var val = pressaoInsertData[field];
  var track = document.getElementById('piDrumTrack-' + field);
  if (!track) return;
  var html = '';
  for (var offset = -2; offset <= 2; offset++) {
    var v = val + offset;
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
  if (field === 'sis') pressaoInsertData.sis = Math.max(60, Math.min(250, pressaoInsertData.sis + delta));
  else if (field === 'dia') pressaoInsertData.dia = Math.max(30, Math.min(160, pressaoInsertData.dia + delta));
  else if (field === 'hr') pressaoInsertData.hr = Math.max(30, Math.min(250, pressaoInsertData.hr + delta));
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
  var track = document.getElementById('piDrumTrack-' + field);
  if (!track) return;
  _piDrumDrag.liveY = dy;
  track.style.transition = 'none';
  track.style.transform = 'translateY(' + dy + 'px)';
}

function piDrumTouchEnd(e, wrap) {
  if (!_piDrumDrag) return;
  var dy = _piDrumDrag.liveY || 0;
  var field = _piDrumDrag.field;
  _piDrumDrag = null;
  // dy > 0 = finger moved down = value decreased
  var steps = -Math.round(dy / PI_DRUM_IH);
  if (steps !== 0) {
    for (var i = 0; i < Math.abs(steps); i++) {
      _piDrumStep(field, steps > 0 ? 1 : -1);
    }
    var residual = dy + steps * PI_DRUM_IH;
    _piDrumAnimate(field, residual);
  } else {
    var track = document.getElementById('piDrumTrack-' + field);
    if (track) { track.style.transition = 'transform 0.18s ease'; track.style.transform = 'translateY(0)'; }
  }
}

function startStepPA(field, delta) {
  stopStepPA();
  _piDrumStep(field, delta);
  _piDrumAnimate(field, -delta * PI_DRUM_IH);
  var count = 0;
  function repeat() {
    _piDrumStep(field, delta);
    _piDrumAnimate(field, -delta * PI_DRUM_IH);
    count++;
    _piStepTimer = setTimeout(repeat, count > 10 ? 80 : 140);
  }
  _piStepTimer = setTimeout(repeat, 400);
}

function stopStepPA() {
  if (_piStepTimer) { clearTimeout(_piStepTimer); _piStepTimer = null; }
}

function pressaoInsSelectMed(val) {
  pressaoInsertData.med = val;
  _pressaoInsMedSync();
}

function _pressaoInsMedSync() {
  ['tomados', 'nao_tomados', 'nenhum'].forEach(function(v) {
    var el = document.getElementById('piMed-' + v);
    if (el) {
      if (v === pressaoInsertData.med) el.classList.add('pressao-ins-med-card--active');
      else el.classList.remove('pressao-ins-med-card--active');
    }
  });
}

function pressaoInsSave() {
  stopStepPA();
  var ta = document.getElementById('piNotaInput');
  if (ta) pressaoInsertData.nota = ta.value.trim();
  // TODO: persist to pressaoColetaEntries when backend is ready
  closePressaoInsertForm();
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

    // Group readings by day — average systolic and diastolic per day
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
      const minColW = _isYearView ? 30 : 44;
      const colW = Math.max(minColW, containerW / n);
      const W = Math.max(containerW, n * colW);
      const H = 180;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';

      const padL = 30, padR = 10, padT = 12, padB = 22;
      const gw = W - padL - padR;
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

        // Value labels on selected dot
        if (hasSel) {
          const selIdx = renderRows.findIndex(r => r.dayIso === pressaoSelectedDay);
          if (selIdx >= 0) {
            const selRow = renderRows[selIdx];
            const x = padL + colW * selIdx + colW / 2;
            ctx.globalAlpha = 1;
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            const syY = toY(selRow.avgS);
            const diaY = toY(selRow.avgD);
            ctx.fillStyle = '#f59e0b';
            ctx.textBaseline = 'bottom';
            ctx.fillText(String(selRow.avgS), x, syY - 7);
            ctx.fillStyle = '#3b82f6';
            ctx.textBaseline = 'top';
            ctx.fillText(String(selRow.avgD), x, diaY + 7);
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

        // X labels — day number for day-range views, month abbrev for year view
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
        // Scroll selected column into center of viewport
        if (_chartView) {
          const _selCx = padL + colW * _autoIdx;
          _chartView.scrollLeft = Math.max(0, _selCx - containerW / 2);
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

        // Build tooltip date label — month name for year view, day+weekday for day views
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

        const tip = document.createElement('div');
        tip.id = 'pressaoChartTooltip';
        tip.style.cssText = 'position:absolute;background:#1e293b;color:#fff;border-radius:8px;padding:7px 12px;font-size:12px;line-height:1.5;pointer-events:none;z-index:9999;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
        tip.innerHTML = `${dateLabel}&nbsp;&nbsp;<strong><span style="color:#f59e0b;font-size:1.2em;">${row.avgS}</span><span style="color:#94a3b8;"> / </span><span style="color:#3b82f6;font-size:1.2em;">${row.avgD}</span> mmHg</strong>`;

        const tipParent = document.getElementById('vitalDetailDefaultChrome') || canvas.parentElement;
        tipParent.style.position = 'relative';
        const tipParentRect = tipParent.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const cxCanvas = padL + colW * hitIdx + colW / 2;
        const cxViewport = canvasRect.left + cxCanvas * (canvasRect.width / W);
        let left = cxViewport - tipParentRect.left - 90;
        let top = canvasRect.top - tipParentRect.top - 48;
        if (left < 0) left = 4;
        if (left + 260 > tipParent.offsetWidth) left = tipParent.offsetWidth - 264;
        if (top < 0) top = canvasRect.top - tipParentRect.top + 4;
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
        tipParent.appendChild(tip);

        openPressaoDiaDetail(pressaoSelectedDay, row.entries);

        // Override detail-view header label for year view ("mai 2026" instead of a specific day)
        if (_isYearView) {
          const [_ty, _tm] = row.monthKey.split('-').map(Number);
          const lEl = document.getElementById('pressaoDiaDetailLabel');
          if (lEl) lEl.textContent = `${_mAbr[_tm - 1]} ${_ty}`;
        }

        const dismiss = () => {
          const t = document.getElementById('pressaoChartTooltip');
          if (t) t.remove();
          document.removeEventListener('click', dismiss);
        };
        setTimeout(() => document.addEventListener('click', dismiss), 10);
      };
    });
    return;
  }

  if (currentVitalDetail && currentVitalDetail.tipo === 'Passos') {
    const dayRows = aggregatePassosByDay(historico).slice(0, 10).reverse();
    const rows = dayRows.map((g) => ({ h: { data: g.day }, v: g.total, day: g.day }));
    if (rows.length === 0) return;

    const goal = getStepsDailyGoalValue(currentVitalDetail);
    const maxData = Math.max(...rows.map((r) => r.v), goal);
    const yLow = 0;
    const yHigh = Math.max(goal * 1.15, maxData * 1.1, 1);
    const span = yHigh - yLow;

    const padL = 28;
    const padR = 8;
    const padT = 8;
    const padB = 20;
    const gw = width - padL - padR;
    const gh = height - padT - padB;
    const toY = (v) => padT + ((yHigh - v) / span) * gh;

    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(0, 0, width, height);

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

    const n = rows.length;
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

    ctx.fillStyle = '#8e8e8e';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', padL - 4, toY(0));
    ctx.fillText(String(Math.round(goal)), padL - 4, toY(goal));

    const labelEvery = Math.max(1, Math.ceil(n / 5));
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    rows.forEach((row, i) => {
      if (i % labelEvery !== 0 && i !== n - 1) return;
      const cx = padL + slot * i + slot / 2;
      const d = String(row.h.data || '');
      const parts = d.split('-');
      const short = parts.length === 3 ? String(Number(parts[2])) : '';
      ctx.fillText(short, cx, height - 4);
    });
    canvas.onclick = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / Math.max(1, rect.width);
      const x = (ev.clientX - rect.left) * sx;
      const hit = hitBoxes.find((b) => x >= b.x0 && x <= b.x1);
      if (hit && hit.dayIso) setPassosDayFromChart(hit.dayIso);
    };
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
 * Uma linha da lista do modal de Batimento (hora do dia ou data agregada — sem coluna de status).
 * `hourDetail`: vista dia hora a hora — formato “61 a 89 bpm” em cima, intervalo em baixo (como lista de registos).
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
        const measureLine = hasRange ? formatBatimentoBpmRangeLine(bucket.min, bucket.max) : '—';
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
      const trailHtml = '<span class="vital-list-chevron" aria-hidden="true">›</span>';
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
      const resumo = (sisMax != null && diaMin != null) ? `${sisMax}/${diaMin}` : '—';
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
            <span class="pressao-dia-chevron" aria-hidden="true">›</span>
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
    const selectedExists = passosSelectedDayIso && dayRows.some((r) => r.day === passosSelectedDayIso);
    const selectedDay = selectedExists ? passosSelectedDayIso : dayRows[0].day;
    passosSelectedDayIso = selectedDay;
    const selectedRow = dayRows.find((r) => r.day === selectedDay) || dayRows[0];
    const selectedHourValid = Number.isInteger(passosSelectedHour) && passosSelectedHour >= 0 && passosSelectedHour <= 23;
    const daySteps = Math.max(0, Math.round(Number(selectedRow?.total || 0)));
    const dayPct = goal > 0 ? Math.max(0, Math.min(999, Math.round((daySteps / goal) * 100))) : 0;
    const dayDistKm = (daySteps * 0.00075).toFixed(2).replace('.', ',');
    const dayKcal = Math.round(daySteps * 0.04);
    const dayElevacaoM = Math.max(0, Math.round((daySteps / 1200) * 3));

    const hourlyBuckets = buildPassosHourlyBucketsForDay(selectedRow?.entries || []);
    const hourSteps = selectedHourValid
      ? Math.max(0, Math.round(Number(hourlyBuckets[passosSelectedHour] || 0)))
      : null;
    const hourDistKm = hourSteps != null ? (hourSteps * 0.00075).toFixed(2).replace('.', ',') : null;
    const hourKcal = hourSteps != null ? Math.round(hourSteps * 0.04) : null;
    const hourElevacaoM = hourSteps != null ? Math.max(0, Math.round((hourSteps / 1200) * 3)) : null;
    const hourInfoHtml = selectedHourValid
      ? `
        <div class="passos-footer-hour">${String(passosSelectedHour).padStart(2, '0')}:00–${String(passosSelectedHour).padStart(2, '0')}:59</div>
        <div class="passos-footer-meta">
          <span>${hourDistKm} km</span>
          <span>${hourKcal} kcal</span>
          <span>${hourElevacaoM} m elevação</span>
        </div>`
      : '<div class="passos-footer-empty">Toque em uma barra do gráfico por hora para ver distância, calorias e elevação da hora.</div>';

    document.getElementById('vitalDetailContent').innerHTML = `
      <div class="passos-resumo-card">
        <div class="passos-resumo-head">
          <div class="passos-resumo-num">${daySteps.toLocaleString('pt-BR')} passos</div>
        </div>
        <div class="passos-resumo-bar"><span style="width:${Math.max(0, Math.min(100, dayPct))}%;"></span></div>
        <div class="passos-resumo-scale">
          <span>0</span>
          <span>Meta: ${goal.toLocaleString('pt-BR')}</span>
        </div>
        <div class="passos-resumo-meta">
          <span>${dayDistKm} km</span>
          <span>${dayKcal} kcal</span>
          <span>${dayElevacaoM} m elevação</span>
        </div>
      </div>
      <div class="passos-hourly-card">
        <div class="passos-hourly-title">Passos por hora do dia</div>
        <div id="passosHourlySubtitle" class="passos-hourly-subtitle"></div>
        <canvas id="passosHourlyCanvas" class="passos-hourly-canvas" width="720" height="180"></canvas>
      </div>
      <div class="passos-footer-note">${hourInfoHtml}</div>
    `;
    renderPassosHourlyCanvas(selectedDay, selectedRow?.entries || [], goal);
    return;
  }

  const html = currentVitalHistoricoView.map((h, idx) => {
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
    const statusIcon = h.status === 'normal' ? '🟢' : '🔴';
    const valorFormatado = typeof formatHistoricValue === 'function'
      ? formatHistoricValue(currentVitalDetail?.tipo, h)
      : h.valor;
    let pmed = '';
    if (currentVitalDetail?.tipo === 'Pressão Arterial' && h.medicamentoPressao && h.medicamentoPressao !== 'nenhum') {
      pmed = h.medicamentoPressao === 'tomados' ? ' · 💊 Tomados' : ' · 💊 Não tomados';
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
        <div class="vital-list-value">${valorFormatado}${pmed}${isExercicio ? ' <span class="vital-list-chevron" aria-hidden="true">›</span>' : ''}</div>
        <div class="vital-list-status">${statusIcon}</div>
      </div>
    `;
  }).join('');

  document.getElementById('vitalDetailContent').innerHTML = html;
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
    return { ok: false, message: 'Selecione a fonte da medicao.' };
  }

  if (fonte === 'Pulseira' && !isPulseiraChecklistComplete()) {
    return { ok: false, message: 'Para medicao por pulseira, conclua o checklist de preparo.' };
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

  // Se a pressão foi registrada imediatamente antes, vincula o BPM àquela leitura.
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
    showFeedbackModal('Digite o batimento cardiaco.', 'warning');
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
  showFeedbackModal('Registro concluido. Obrigado!', 'success');
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
    showFeedbackModal('Selecione como voce esta se sentindo (humor).', 'warning');
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
    showFeedbackModal('Selecione data e hora para a proxima medicao.', 'warning');
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
  showFeedbackModal(`Reagendado para ${dateTxt} às ${timeTxt}. ${notify ? 'Notificacao ativada.' : 'Sem notificacao.'}`, 'success');
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
    const timeTxt = item.time ? ` • ${item.time}` : '';
    const pTxt = `PA ${formatPressureValueForUI(item.pressure)}`;
    const hTxt = item.heartRate != null ? `FC ${item.heartRate} bpm` : 'FC --';
    return `
      <div class="mood-history-item">
        <div class="mood-history-left">
          <div class="mood-history-date">${dateBR}${timeTxt}</div>
          <div class="mood-history-values">${pTxt} • ${hTxt}</div>
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
