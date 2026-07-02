// Componentes Reutilizáveis

/**
 * Miniatura do medicamento: só aceita foto real em base64 (data:image/...).
 * Outros valores (emoji, nome de arquivo, vazio) usam placeholder com rótulo "Imagem".
 */
function getMedicationPhotoHtml(med, catalog) {
  const raw =
    med.foto != null && String(med.foto).trim() !== ''
      ? med.foto
      : catalog && catalog.foto != null
        ? catalog.foto
        : null;
  if (typeof raw === 'string' && raw.startsWith('data:image')) {
    return {
      isPhotoImage: true,
      html: `<img src="${raw}" alt="Foto do medicamento ${med.nome}">`
    };
  }
  return {
    isPhotoImage: false,
    html: `<span class="med-photo-placeholder">
      <svg class="med-photo-placeholder-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
      </svg>
      <span class="med-photo-placeholder-label">Imagem</span>
    </span>`
  };
}

/**
 * Miniatura: na lista (card) só a foto — sem “Detalhe”/“Visualizar” embaixo; toque abre foto ou edição.
 * Em manage mantém legenda Visualizar / Detalhe.
 */
function getMedicationPhotoColumnHtml(med, catalog, variant) {
  const { isPhotoImage, html: photoHtml } = getMedicationPhotoHtml(med, catalog);
  const btnClass = variant === 'manage' ? 'med-manage-photo' : 'med-photo';

  if (variant === 'card') {
    const clickAttr = isPhotoImage
      ? `onclick="openMedicationPhotoModalById(${med.id}); event.stopPropagation();"`
      : `onclick="openEditMedicacaoModal(${med.id}); event.stopPropagation();"`;
    return `
    <div class="med-photo-column med-photo-column--card-clean">
      <button type="button" class="${btnClass} is-clickable" ${clickAttr} title="${isPhotoImage ? 'Ver foto' : 'Editar medicação'}">
        ${photoHtml}
      </button>
    </div>`;
  }

  const hint = isPhotoImage
    ? `<button type="button" class="med-photo-hint-btn" onclick="openMedicationPhotoModalById(${med.id}); event.stopPropagation();">Visualizar</button>`
    : `<button type="button" class="med-photo-hint-btn med-photo-hint-btn--muted" onclick="openEditMedicacaoModal(${med.id}); event.stopPropagation();">Detalhe</button>`;
  return `
    <div class="med-photo-column">
      <button class="${btnClass} ${isPhotoImage ? 'is-clickable' : ''}" type="button" ${isPhotoImage ? `onclick="openMedicationPhotoModalById(${med.id}); event.stopPropagation();"` : ''} title="${isPhotoImage ? 'Ver foto em tamanho maior' : 'Sem foto cadastrada'}">
        ${photoHtml}
      </button>
      ${hint}
    </div>
  `;
}

// Mapa de ícones SVG minimalistas por tipo de indicador
function getVitalIconSvg(tipo) {
  const b = 'xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  const map = {
    // Sinais vitais
    'Hidratação':             `<svg ${b}><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
    'Oxigenação':             `<svg ${b}><circle cx="12" cy="12" r="9"/><polyline points="7 12 10 9 13 15 16 11"/></svg>`,
    'Sono':                   `<svg ${b}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    'Temperatura':            `<svg ${b}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
    'Calorias':               `<svg ${b}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
    'HRV':                    `<svg ${b}><polyline points="3 12 6 9 9 15 12 10 15 14 18 11 21 12"/></svg>`,
    'Nível de Estresse':      `<svg ${b}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    'Freq. Respiratória':     `<svg ${b}><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`,
    'Glicemia':               `<svg ${b}><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/><line x1="12" y1="13" x2="12" y2="17"/><line x1="10" y1="15" x2="14" y2="15"/></svg>`,
    // Composição corporal
    'Peso':                   `<svg ${b}><circle cx="12" cy="5" r="3"/><path d="M5.5 20h13l-2-12H7.5z"/></svg>`,
    'IMC':                    `<svg ${b}><rect x="2" y="14" width="4" height="6" rx="1"/><rect x="9" y="9" width="4" height="11" rx="1"/><rect x="16" y="4" width="4" height="16" rx="1"/></svg>`,
    'Músculo Esquelético':     `<svg ${b}><rect x="2" y="10" width="4" height="4" rx="1"/><rect x="18" y="10" width="4" height="4" rx="1"/><line x1="6" y1="12" x2="18" y2="12"/><rect x="5" y="8" width="2" height="8" rx="1"/><rect x="17" y="8" width="2" height="8" rx="1"/></svg>`,
    'Massa Gorda':             `<svg ${b}><ellipse cx="12" cy="13" rx="7" ry="8"/><path d="M9 8 C9 5 15 5 15 8"/></svg>`,
    'Água Corporal':           `<svg ${b}><path d="M12 3C12 3 5 11 5 16a7 7 0 0 0 14 0C19 11 12 3 12 3z"/><path d="M9 17a3 3 0 0 0 4.5 0" stroke-width="1.4"/></svg>`,
    'Gordura Corporal':        `<svg ${b}><circle cx="9" cy="9" r="3"/><circle cx="15" cy="15" r="3"/><line x1="17" y1="7" x2="7" y2="17"/></svg>`,
    'Percentual de Gordura':  `<svg ${b}><path d="M12 2v10l8.5 5A10 10 0 1 1 12 2z"/></svg>`,
    'Massa Muscular':         `<svg ${b}><rect x="2" y="10" width="4" height="4" rx="1"/><rect x="18" y="10" width="4" height="4" rx="1"/><line x1="6" y1="12" x2="18" y2="12"/><rect x="5" y="8" width="2" height="8" rx="1"/><rect x="17" y="8" width="2" height="8" rx="1"/></svg>`,
    'Circunferência Cintura': `<svg ${b}><rect x="2" y="8" width="20" height="8" rx="2"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="17" y1="8" x2="17" y2="16"/></svg>`,
    'Altura':                 `<svg ${b}><path d="M12 2v20"/><path d="M5 9l7-7 7 7"/><path d="M5 15l7 7 7-7"/></svg>`,
  };
  return map[tipo] || null;
}

// Card de Hidratação para layout home — com botões de adição rápida
function buildHomeHidratacaoCard(vital) {
  var tipoSafe = String(vital.tipo).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  var tipoAttr = String(vital.tipo).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  var current = vital.valor != null ? parseFloat(vital.valor) : 0;

  // Parse meta mínima do ideal
  var goalMin = 2000;
  if (vital.ideal && typeof vital.ideal === 'string') {
    var m = vital.ideal.match(/(\d+)/);
    if (m) goalMin = Number(m[1]);
  }

  var pct = Math.min(100, (current / Math.max(goalMin, 1)) * 100);
  var faltam = Math.max(0, goalMin - current);

  // Cor e status
  var statusLabel, statusBg, statusColor, barColor;
  if (pct >= 100) {
    statusLabel = 'Meta atingida'; statusBg = '#dcfce7'; statusColor = '#16a34a'; barColor = '#22c55e';
  } else if (pct >= 75) {
    statusLabel = 'Quase lá'; statusBg = '#dbeafe'; statusColor = '#2563eb'; barColor = '#3b82f6';
  } else if (pct >= 50) {
    statusLabel = 'Metade'; statusBg = '#dbeafe'; statusColor = '#2563eb'; barColor = '#3b82f6';
  } else {
    statusLabel = 'Abaixo'; statusBg = '#fef3c7'; statusColor = '#d97706'; barColor = '#f59e0b';
  }

  var unit = vital.unidade || 'ml';

  function fmtMl(ml) {
    return ml >= 1000 ? (ml / 1000).toFixed(1).replace('.0', '') + ' L' : ml + ' ml';
  }

  var dropSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>';

  // Copos SVG inline simples
  var glassSvg  = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="22"/><path d="M8 2l8 0 2 5-2 15H8"/><line x1="4" y1="7" x2="16" y2="7"/></svg>';

  var faltamHtml = pct < 100
    ? '<span class="hidra-faltam">Faltam ' + fmtMl(faltam) + '</span>'
    : '<span class="hidra-faltam hidra-faltam--ok">✓ Meta diária atingida!</span>';

  return (
    '<div class="card card-saude vital-card vital-card--hidra home-vital-card" role="article" aria-label="' + tipoAttr + '" style="cursor:pointer;" onclick="openVitalDetailModal(\'' + tipoSafe + '\', ' + vital.id + ')">' +
      '<div class="hidra-header">' +
        '<div class="hidra-title-row">' +
          '<span class="vital-icon vital-icon--hidra" aria-hidden="true">' + dropSvg + '</span>' +
          '<span class="hidra-title">Hidratação</span>' +
          '<span class="hidra-status-chip" style="background:' + statusBg + ';color:' + statusColor + ';">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="hidra-value-row">' +
          '<span class="hidra-num">' + fmtMl(current) + '</span>' +
          '<span class="hidra-goal">/ ' + fmtMl(goalMin) + '</span>' +
        '</div>' +
        '<div class="hidra-meta-label">Meta di\u00e1ria: ' + fmtMl(goalMin) + '</div>' +
      '</div>' +
    '</div>'
  );
}

// Painel de detalhes de Hidratação — exibido no topo da view de detalhe ao clicar no card
function buildHidraDetailPanel(vital) {
  var current = vital.valor != null ? parseFloat(vital.valor) : 0;

  var goalMin = 2000;
  if (vital.ideal && typeof vital.ideal === 'string') {
    var m = vital.ideal.match(/(\d+)/);
    if (m) goalMin = Number(m[1]);
  }

  var pct = Math.min(100, (current / Math.max(goalMin, 1)) * 100);
  var faltam = Math.max(0, goalMin - current);

  var statusText = '';
  if (pct >= 100) {
    statusText = '✓ Meta diária atingida!';
  } else if (pct >= 50) {
    statusText = '⏳ Faltam ' + fmtMl(faltam);
  } else {
    statusText = '⚠ Faltam ' + fmtMl(faltam);
  }

  function fmtMl(ml) {
    return ml >= 1000 ? (ml / 1000).toFixed(1).replace('.0', '') + ' L' : ml + ' ml';
  }

  var currentDisplay = fmtMl(current);
  var goalDisplay = fmtMl(goalMin);
  var barColor = pct >= 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b';

  return (
    '<div class="vital-detail-summary-panel vital-detail-summary-panel--hidra">' +
      '<div class="hidra-kpi-header">' +
        '<span class="hidra-kpi-icon">💧</span>' +
        '<span class="hidra-kpi-title">Hidratação</span>' +
      '</div>' +
      '<div class="hidra-kpi-value-row">' +
        '<span class="hidra-kpi-current">' + currentDisplay.replace(' L', '').replace(' ml', '') + '</span>' +
        '<span class="hidra-kpi-current-unit">' + (current >= 1000 ? 'L' : 'ml') + '</span>' +
      '</div>' +
      '<div class="hidra-kpi-goal">de <b>' + goalDisplay + '</b></div>' +
      '<div class="hidra-progress-track">' +
        '<div class="hidra-progress-fill" style="width:' + pct.toFixed(1) + '%;background:' + barColor + '"></div>' +
      '</div>' +
      '<div class="hidra-kpi-footer">' +
        '<span class="hidra-kpi-status ' + (pct >= 100 ? 'hidra-kpi-status--ok' : '') + '">' + statusText + '</span>' +
        '<button type="button" class="hidra-lembrete-btn" onclick="showHidraLembrete()">🔔 Simular lembrete</button>' +
      '</div>' +
    '</div>'
  );
}

function getHidraLembreteConfig() {
  try {
    var raw = localStorage.getItem('hidraLembreteConfig');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { enabled: false, interval: 60 };
}

function saveHidraLembreteConfig(cfg) {
  try { localStorage.setItem('hidraLembreteConfig', JSON.stringify(cfg)); } catch (e) {}
}

var _hidraAutoTimer = null;

function openHidraConfigView() {
  var chrome = document.getElementById('vitalDetailDefaultChrome');
  if (!chrome) return;

  var existing = document.getElementById('hidraConfigView');
  if (existing) return;

  var hidCards = document.getElementById('vitalDetailHidraCards');
  if (hidCards) hidCards.style.display = 'none';

  var cfg = getHidraLembreteConfig();

  var view = document.createElement('div');
  view.id = 'hidraConfigView';
  view.className = 'hidra-config-view';
  view.innerHTML =
    '<div class="hidra-config-view-head">' +
      '<button type="button" class="hidra-config-back-btn" onclick="closeHidraConfigView()" aria-label="Voltar">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
      '</button>' +
      '<span class="hidra-config-view-title">Configurar lembrete</span>' +
    '</div>' +
    '<div class="hidra-config-view-body">' +
      '<div class="hidra-config-card">' +
        '<div class="hidra-config-row">' +
          '<span class="hidra-config-label">Lembretes automáticos</span>' +
          '<label class="hidra-toggle">' +
            '<input type="checkbox" id="hidraAutoToggle" ' + (cfg.enabled ? 'checked' : '') + ' onchange="toggleHidraAutoLembrete(this.checked)">' +
            '<span class="hidra-toggle-slider"></span>' +
          '</label>' +
        '</div>' +
        '<div class="hidra-config-row hidra-config-interval-row" id="hidraIntervalRow" style="' + (cfg.enabled ? '' : 'display:none;') + '">' +
          '<span class="hidra-config-label">Intervalo</span>' +
          '<div class="hidra-config-intervals">' +
            [30, 60, 120, 180].map(function(m) {
              return '<button type="button" class="hidra-config-intv-btn' + (cfg.interval === m ? ' active' : '') + '" onclick="setHidraInterval(' + m + ')">' + (m < 60 ? m + ' min' : (m / 60) + ' h') + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="hidra-config-info">O lembrete aparece automaticamente enquanto a tela de hidratação estiver aberta.</div>' +
    '</div>';

  chrome.appendChild(view);

  var periodControls = document.getElementById('vitalDefaultPeriodControls');
  if (periodControls) periodControls.style.display = 'none';
}

function closeHidraConfigView() {
  var view = document.getElementById('hidraConfigView');
  if (view) view.remove();

  var hidCards = document.getElementById('vitalDetailHidraCards');
  if (hidCards) hidCards.style.display = '';

  var periodControls = document.getElementById('vitalDefaultPeriodControls');
  if (periodControls) periodControls.style.display = '';
}

function toggleHidraAutoLembrete(checked) {
  var cfg = getHidraLembreteConfig();
  cfg.enabled = checked;
  saveHidraLembreteConfig(cfg);
  var row = document.getElementById('hidraIntervalRow');
  if (row) row.style.display = checked ? '' : 'none';
  restartHidraAutoReminder();
}

function setHidraInterval(minutes) {
  var cfg = getHidraLembreteConfig();
  cfg.interval = minutes;
  saveHidraLembreteConfig(cfg);
  document.querySelectorAll('.hidra-config-intv-btn').forEach(function(b) {
    b.classList.toggle('active', Number(b.getAttribute('onclick').match(/\d+/)[0]) === minutes);
  });
  restartHidraAutoReminder();
}

function startHidraAutoReminder() {
  stopHidraAutoReminder();
  var cfg = getHidraLembreteConfig();
  if (!cfg.enabled) return;
  _hidraAutoTimer = setInterval(function() {
    var modal = document.getElementById('vitalDetailModal');
    if (!modal || !modal.classList.contains('active')) {
      stopHidraAutoReminder();
      return;
    }
    showHidraLembrete();
  }, cfg.interval * 60 * 1000);
}

function stopHidraAutoReminder() {
  if (_hidraAutoTimer) {
    clearInterval(_hidraAutoTimer);
    _hidraAutoTimer = null;
  }
}

function restartHidraAutoReminder() {
  stopHidraAutoReminder();
  startHidraAutoReminder();
}

function showHidraLembrete() {
  var existing = document.getElementById('hidraLembreteOverlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'hidraLembreteOverlay';
  overlay.className = 'hidra-lembrete-overlay';
  overlay.innerHTML =
    '<div class="hidra-lembrete-modal">' +
      '<div class="hidra-lembrete-icon">💧</div>' +
      '<div class="hidra-lembrete-title">Hora de beber água!</div>' +
      '<div class="hidra-lembrete-msg">Você já bebeu água nos últimos 60 minutos?</div>' +
      '<div class="hidra-lembrete-actions">' +
        '<button type="button" class="hidra-lembrete-btn--primary" onclick="beberAgora()">Beber agora</button>' +
        '<button type="button" class="hidra-lembrete-btn--sec" onclick="fecharHidraLembrete()">Agora não</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('visible'); });
}

function beberAgora() {
  fecharHidraLembrete();
  restartHidraAutoReminder();
  if (typeof openHidraInsertView === 'function') {
    openHidraInsertView();
  }
}

function fecharHidraLembrete() {
  var overlay = document.getElementById('hidraLembreteOverlay');
  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(function() { overlay.remove(); }, 300);
  }
  restartHidraAutoReminder();
}

// Card de Oxigenação para layout home
function buildHomeOxigCard(vital) {
  var tipoSafe = String(vital.tipo).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  var tipoAttr = String(vital.tipo).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  var current = vital.valor != null ? parseFloat(vital.valor) : null;

  // Min/Max da sessão atual do histórico
  var histVals = [];
  if (Array.isArray(vital.historico)) {
    vital.historico.forEach(function(h) {
      var v = parseFloat(h.valor);
      if (Number.isFinite(v)) histVals.push(v);
    });
  }
  var histMin = histVals.length ? Math.min.apply(null, histVals) : null;
  var histMax = histVals.length ? Math.max.apply(null, histVals) : null;
  var histAvg = histVals.length ? Math.round(histVals.reduce(function(a,b){return a+b;},0) / histVals.length) : null;

  // Parse ideal range
  var idealLow = 95, idealHigh = 100;
  if (vital.ideal && typeof vital.ideal === 'string') {
    var idealMatch = vital.ideal.match(/(\d+)[–\-](\d+)/);
    if (idealMatch) { idealLow = Number(idealMatch[1]); idealHigh = Number(idealMatch[2]); }
  }

  // Status
  var statusLabel, statusBg, statusColor;
  if (current == null) {
    statusLabel = '—'; statusBg = '#f1f5f9'; statusColor = '#64748b';
  } else if (current >= idealLow) {
    statusLabel = 'Normal'; statusBg = '#dcfce7'; statusColor = '#16a34a';
  } else if (current >= 90) {
    statusLabel = 'Atenção'; statusBg = '#fef3c7'; statusColor = '#d97706';
  } else {
    statusLabel = 'Crítico'; statusBg = '#fee2e2'; statusColor = '#dc2626';
  }

  // Progress bar: scale 85→100
  var scaleMin = 85, scaleMax = 100, scaleRange = scaleMax - scaleMin;
  var currentPct = current != null ? Math.max(0, Math.min(100, ((current - scaleMin) / scaleRange) * 100)) : 0;
  var idealStartPct = ((idealLow - scaleMin) / scaleRange) * 100;
  var idealWidthPct = ((idealHigh - idealLow) / scaleRange) * 100;
  var markerColor = statusColor;

  var oxigSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="7 12 10 9 13 15 16 11"/></svg>';

  var currentStr = current != null ? current.toFixed(0) : '—';
  var unit = vital.unidade || '%';

  var statsHtml =
    '<div class="oxig-stats-row">' +
      (histMin != null ? '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Mín</span><span class="oxig-stat-val">' + histMin + unit + '</span></div>' : '') +
      (histAvg != null ? '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Média</span><span class="oxig-stat-val">' + histAvg + unit + '</span></div>' : '') +
      (histMax != null ? '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Máx</span><span class="oxig-stat-val">' + histMax + unit + '</span></div>' : '') +
      '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Ideal</span><span class="oxig-stat-val">' + idealLow + '–' + idealHigh + unit + '</span></div>' +
    '</div>';

  var barHtml =
    '<div class="oxig-bar-wrap">' +
      '<div class="oxig-bar-track">' +
        '<div class="oxig-bar-ideal-zone" style="left:' + idealStartPct.toFixed(1) + '%;width:' + idealWidthPct.toFixed(1) + '%"></div>' +
        '<div class="oxig-bar-fill" style="width:' + currentPct.toFixed(1) + '%;background:' + markerColor + '"></div>' +
        '<div class="oxig-bar-marker" style="left:' + currentPct.toFixed(1) + '%;background:' + markerColor + '"></div>' +
      '</div>' +
      '<div class="oxig-bar-labels">' +
        '<span>' + scaleMin + '%</span>' +
        '<span>Zona ideal</span>' +
        '<span>' + scaleMax + '%</span>' +
      '</div>' +
    '</div>';

  return (
    '<div class="card card-saude vital-card vital-card--oxig home-vital-card" role="article" aria-label="' + tipoAttr + '" style="cursor:pointer;" onclick="openVitalDetailModal(\'' + tipoSafe + '\', ' + vital.id + ')">' +
      '<div class="oxig-home-header">' +
        '<div class="oxig-home-title-row">' +
          '<span class="vital-icon vital-icon--oxig" aria-hidden="true">' + oxigSvg + '</span>' +
          '<span class="oxig-title">Oxigenação</span>' +
          '<span class="oxig-status-chip" style="background:' + statusBg + ';color:' + statusColor + ';">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="oxig-home-value-row">' +
          '<span class="oxig-num">' + currentStr + '</span>' +
          '<span class="oxig-unit">' + unit + '</span>' +
          '<span class="oxig-sublabel">SpO₂</span>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// Card de Sono para layout home — card rico com fases de sono
function buildHomeSonoCard(vital) {
  var tipoSafe = String(vital.tipo).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  var tipoAttr = String(vital.tipo).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  // Localiza sonoSessao no histórico de Batimento Cardíaco
  var sessao = null;
  if (typeof mockData !== 'undefined' && Array.isArray(mockData.sinaisVitais)) {
    var bat = mockData.sinaisVitais.find(function(v) { return v.tipo === 'Batimento Cardíaco'; });
    if (bat && Array.isArray(bat.historico)) {
      var batEntry = bat.historico.find(function(h) { return h.sonoSessao; });
      if (batEntry) sessao = batEntry.sonoSessao;
    }
  }

  var totalMin = sessao ? sessao.duracaoMinutos : (vital.valor ? Math.round(parseFloat(vital.valor) * 60) : 0);
  var score = (sessao && sessao.score != null) ? sessao.score : null;
  var profMin = sessao ? (sessao.profundoMin || 0) : 0;
  var remMin  = sessao ? (sessao.remMin     || 0) : 0;
  var leveMin = sessao ? (sessao.leveMin    || 0) : 0;
  var acordMin = sessao ? (sessao.acordadoMin || 0) : 0;
  var latMin   = sessao ? (sessao.latenciaMin  || 0) : 0;
  var realMin  = profMin + remMin + leveMin;
  var totalForPct = Math.max(totalMin, 1);

  var dormiu = '', acordou = '';
  if (sessao) {
    dormiu  = sessao.inicioISO ? sessao.inicioISO.split('T')[1].slice(0, 5) : '';
    acordou = sessao.fimISO   ? sessao.fimISO.split('T')[1].slice(0, 5) : '';
  }

  function fmtMin(m) {
    var h = Math.floor(m / 60), mn = m % 60;
    return h > 0 ? (mn > 0 ? h + 'h ' + mn + 'm' : h + 'h') : mn + 'm';
  }

  var totalH = Math.floor(totalMin / 60);
  var totalM = totalMin % 60;
  var efficiency = realMin > 0 ? Math.round((realMin / totalForPct) * 100) : 0;

  var scoreColor = score >= 85 ? '#16a34a' : score >= 70 ? '#d97706' : '#dc2626';
  var scoreHtml = score != null
    ? '<span class="sono-score-chip" style="background:' + (score >= 85 ? '#dcfce7' : score >= 70 ? '#fef3c7' : '#fee2e2') + ';color:' + scoreColor + ';">' + score + '<span class="sono-score-max">/100</span></span>'
    : '';

  var profPct  = (profMin  / totalForPct * 100).toFixed(1);
  var remPct   = (remMin   / totalForPct * 100).toFixed(1);
  var levePct  = (leveMin  / totalForPct * 100).toFixed(1);
  var acordPct = (acordMin / totalForPct * 100).toFixed(1);

  var moonSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var moonSmSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var sunSmSvg  = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  var timesHtml = (dormiu || acordou)
    ? '<div class="sono-times-row">' +
        '<span class="sono-time-icon sono-time-icon--moon">' + moonSmSvg + '</span>' +
        '<span class="sono-time-val">' + (dormiu  || '—') + '</span>' +
        '<span class="sono-time-arrow">→</span>' +
        '<span class="sono-time-icon sono-time-icon--sun">' + sunSmSvg + '</span>' +
        '<span class="sono-time-val">' + (acordou || '—') + '</span>' +
      '</div>'
    : '';

  var stagesHtml = '';
  if (profMin || remMin || leveMin) {
    stagesHtml =
      '<div class="sono-stages-bar">' +
        '<div class="sono-bar-seg sono-bar--profundo" style="width:' + profPct + '%"></div>' +
        '<div class="sono-bar-seg sono-bar--rem"      style="width:' + remPct  + '%"></div>' +
        '<div class="sono-bar-seg sono-bar--leve"     style="width:' + levePct + '%"></div>' +
        (acordMin > 0 ? '<div class="sono-bar-seg sono-bar--acordado" style="width:' + acordPct + '%"></div>' : '') +
      '</div>' +
      '<div class="sono-stages-legend">' +
        '<div class="sono-stage-pill">' +
          '<span class="sono-stage-dot sono-dot--profundo"></span>' +
          '<span class="sono-stage-lbl">Profundo</span>' +
          '<span class="sono-stage-dur">' + fmtMin(profMin) + '</span>' +
        '</div>' +
        '<div class="sono-stage-pill">' +
          '<span class="sono-stage-dot sono-dot--rem"></span>' +
          '<span class="sono-stage-lbl">REM</span>' +
          '<span class="sono-stage-dur">' + fmtMin(remMin) + '</span>' +
        '</div>' +
        '<div class="sono-stage-pill">' +
          '<span class="sono-stage-dot sono-dot--leve"></span>' +
          '<span class="sono-stage-lbl">Leve</span>' +
          '<span class="sono-stage-dur">' + fmtMin(leveMin) + '</span>' +
        '</div>' +
        (acordMin > 0
          ? '<div class="sono-stage-pill">' +
              '<span class="sono-stage-dot sono-dot--acordado"></span>' +
              '<span class="sono-stage-lbl">Acordado</span>' +
              '<span class="sono-stage-dur">' + fmtMin(acordMin) + '</span>' +
            '</div>'
          : '') +
      '</div>';
  }

  var statsHtml = (efficiency > 0 || latMin > 0)
    ? '<div class="sono-stats-row">' +
        (efficiency > 0
          ? '<div class="sono-stat-item"><span class="sono-stat-lbl">Eficiência</span><span class="sono-stat-val">' + efficiency + '%</span></div>'
          : '') +
        (realMin > 0
          ? '<div class="sono-stat-item"><span class="sono-stat-lbl">Sono real</span><span class="sono-stat-val">' + fmtMin(realMin) + '</span></div>'
          : '') +
        (latMin > 0
          ? '<div class="sono-stat-item"><span class="sono-stat-lbl">Latência</span><span class="sono-stat-val">' + fmtMin(latMin) + '</span></div>'
          : '') +
      '</div>'
    : '';

  return (
    '<div class="card card-saude vital-card vital-card--sono home-vital-card" role="article" aria-label="' + tipoAttr + '" style="cursor:pointer;" onclick="openVitalDetailModal(\'' + tipoSafe + '\', ' + vital.id + ')">' +
      '<div class="sono-home-header">' +
        '<div class="sono-home-title-row">' +
          '<span class="vital-icon vital-icon--sono" aria-hidden="true">' + moonSvg + '</span>' +
          '<span class="sono-title">Sono</span>' +
          scoreHtml +
        '</div>' +
        '<div class="sono-home-value-row">' +
          '<span class="sono-num">' + totalH + 'h</span>' +
          '<span class="sono-unit">' + String(totalM).padStart(2, '0') + 'min</span>' +
        '</div>' +
        timesHtml +
      '</div>' +
    '</div>'
  );
}

// Painel de detalhes do Sono — exibido no topo da view de detalhe ao clicar no card
function buildSonoDetailPanel(vital) {
  var sessao = null;
  if (typeof mockData !== 'undefined' && Array.isArray(mockData.sinaisVitais)) {
    var bat = mockData.sinaisVitais.find(function(v) { return v.tipo === 'Batimento Cardíaco'; });
    if (bat && Array.isArray(bat.historico)) {
      var batEntry = bat.historico.find(function(h) { return h.sonoSessao; });
      if (batEntry) sessao = batEntry.sonoSessao;
    }
  }

  var totalMin = sessao ? sessao.duracaoMinutos : (vital.valor ? Math.round(parseFloat(vital.valor) * 60) : 0);
  var score    = (sessao && sessao.score != null) ? sessao.score : null;
  var profMin  = sessao ? (sessao.profundoMin  || 0) : 0;
  var remMin   = sessao ? (sessao.remMin       || 0) : 0;
  var leveMin  = sessao ? (sessao.leveMin      || 0) : 0;
  var acordMin = sessao ? (sessao.acordadoMin  || 0) : 0;
  var latMin   = sessao ? (sessao.latenciaMin  || 0) : 0;
  var realMin  = profMin + remMin + leveMin;
  var totalForPct = Math.max(totalMin, 1);
  var efficiency   = realMin > 0 ? Math.round((realMin / totalForPct) * 100) : 0;

  var dormiu  = sessao && sessao.inicioISO ? sessao.inicioISO.split('T')[1].slice(0, 5) : '';
  var acordou = sessao && sessao.fimISO   ? sessao.fimISO.split('T')[1].slice(0, 5) : '';

  function fmtMin(m) {
    var h = Math.floor(m / 60), mn = m % 60;
    return h > 0 ? (mn > 0 ? h + 'h ' + mn + 'm' : h + 'h') : mn + 'm';
  }

  var totalH = Math.floor(totalMin / 60);
  var totalM = totalMin % 60;

  var scoreColor = score != null ? (score >= 85 ? '#16a34a' : score >= 70 ? '#7c3aed' : '#dc2626') : '#64748b';
  var scoreBg    = score != null ? (score >= 85 ? '#dcfce7' : score >= 70 ? '#ede9fe' : '#fee2e2') : '#f1f5f9';

  var moonSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var sunSvg  = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  // Card 1: Última noite — duração + qualidade (estilo bat-minmax-card)
  var card1 =
    '<div class="sono-det-card">' +
      '<div class="sono-det-card-title">Última noite</div>' +
      '<div class="sono-det-main-row">' +
        '<div class="sono-det-col">' +
          '<span class="sono-det-label">DURAÇÃO</span>' +
          '<div class="sono-det-bigval-row">' +
            '<span class="sono-det-bigval">' + totalH + '</span>' +
            '<span class="sono-det-bigunit">h</span>' +
            (totalM > 0 ? '<span class="sono-det-bigval sono-det-bigval--min">' + String(totalM).padStart(2,'0') + '</span><span class="sono-det-bigunit">min</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="sono-det-divider"></div>' +
        '<div class="sono-det-col">' +
          '<span class="sono-det-label">QUALIDADE</span>' +
          '<div class="sono-det-bigval-row">' +
            (score != null
              ? '<span class="sono-det-score-pill" style="background:' + scoreBg + ';color:' + scoreColor + ';">' + score + '<span style="font-size:14px;font-weight:500;margin-left:1px;">/100</span></span>'
              : '<span class="sono-det-bigval">—</span>') +
          '</div>' +
        '</div>' +
      '</div>' +
      ((dormiu || acordou)
        ? '<div class="sono-det-times-row">' +
            '<span class="sono-det-time-ico">' + moonSvg + '</span>' +
            '<span class="sono-det-time-val">' + (dormiu || '—') + '</span>' +
            '<span class="sono-det-time-arrow">→</span>' +
            '<span class="sono-det-time-ico">' + sunSvg + '</span>' +
            '<span class="sono-det-time-val">' + (acordou || '—') + '</span>' +
          '</div>'
        : '') +
    '</div>';

  // Card 2: Fases do sono (estilo bat-hourly-chart-card)
  var profPct  = (profMin  / totalForPct * 100).toFixed(1);
  var remPct   = (remMin   / totalForPct * 100).toFixed(1);
  var levePct  = (leveMin  / totalForPct * 100).toFixed(1);
  var acordPct = (acordMin / totalForPct * 100).toFixed(1);

  var card2 = '';
  if (profMin || remMin || leveMin) {
    card2 =
      '<div class="sono-det-card">' +
        '<div class="sono-det-card-title">Fases do sono</div>' +
        '<div class="sono-stages-bar" style="margin-bottom:12px;">' +
          '<div class="sono-bar-seg sono-bar--profundo" style="width:' + profPct + '%"></div>' +
          '<div class="sono-bar-seg sono-bar--rem"      style="width:' + remPct  + '%"></div>' +
          '<div class="sono-bar-seg sono-bar--leve"     style="width:' + levePct + '%"></div>' +
          (acordMin > 0 ? '<div class="sono-bar-seg sono-bar--acordado" style="width:' + acordPct + '%"></div>' : '') +
        '</div>' +
        '<div class="sono-stages-legend">' +
          '<div class="sono-stage-pill"><span class="sono-stage-dot sono-dot--profundo"></span><span class="sono-stage-lbl">Profundo</span><span class="sono-stage-dur">' + fmtMin(profMin) + '</span></div>' +
          '<div class="sono-stage-pill"><span class="sono-stage-dot sono-dot--rem"></span><span class="sono-stage-lbl">REM</span><span class="sono-stage-dur">' + fmtMin(remMin) + '</span></div>' +
          '<div class="sono-stage-pill"><span class="sono-stage-dot sono-dot--leve"></span><span class="sono-stage-lbl">Leve</span><span class="sono-stage-dur">' + fmtMin(leveMin) + '</span></div>' +
          (acordMin > 0 ? '<div class="sono-stage-pill"><span class="sono-stage-dot sono-dot--acordado"></span><span class="sono-stage-lbl">Acordado</span><span class="sono-stage-dur">' + fmtMin(acordMin) + '</span></div>' : '') +
        '</div>' +
      '</div>';
  }

  // Card 3: Estatísticas (estilo bat-resting-section)
  var card3 = '';
  if (efficiency > 0 || latMin > 0) {
    card3 =
      '<div class="sono-det-card sono-det-card--stats">' +
        '<div class="sono-det-stats-row">' +
          (efficiency > 0 ? '<div class="sono-det-stat"><span class="sono-det-stat-lbl">Eficiência</span><span class="sono-det-stat-val">' + efficiency + '%</span></div>' : '') +
          (realMin > 0    ? '<div class="sono-det-stat"><span class="sono-det-stat-lbl">Sono real</span><span class="sono-det-stat-val">'   + fmtMin(realMin) + '</span></div>' : '') +
          (latMin > 0     ? '<div class="sono-det-stat sono-det-stat--last"><span class="sono-det-stat-lbl">Latência</span><span class="sono-det-stat-val">'    + fmtMin(latMin)  + '</span></div>' : '') +
        '</div>' +
      '</div>';
  }

  return '<div class="sono-det-chrome">' + card1 + card2 + card3 + '</div>';
}

// Painel de detalhes de Oxigenação — exibido no topo da view de detalhe ao clicar no card
function buildOxigDetailPanel(vital) {
  var current = vital.valor != null ? parseFloat(vital.valor) : null;

  var histVals = [];
  if (Array.isArray(vital.historico)) {
    vital.historico.forEach(function(h) {
      var v = parseFloat(h.valor);
      if (Number.isFinite(v)) histVals.push(v);
    });
  }
  var histMin = histVals.length ? Math.min.apply(null, histVals) : null;
  var histMax = histVals.length ? Math.max.apply(null, histVals) : null;
  var histAvg = histVals.length ? Math.round(histVals.reduce(function(a, b) { return a + b; }, 0) / histVals.length) : null;

  var idealLow = 95, idealHigh = 100;
  if (vital.ideal && typeof vital.ideal === 'string') {
    var idealMatch = vital.ideal.match(/(\d+)[–\-](\d+)/);
    if (idealMatch) { idealLow = Number(idealMatch[1]); idealHigh = Number(idealMatch[2]); }
  }

  var statusColor;
  if (current == null)         { statusColor = '#64748b'; }
  else if (current >= idealLow){ statusColor = '#16a34a'; }
  else if (current >= 90)      { statusColor = '#d97706'; }
  else                         { statusColor = '#dc2626'; }

  var scaleMin = 85, scaleMax = 100, scaleRange = scaleMax - scaleMin;
  var currentPct     = current != null ? Math.max(0, Math.min(100, ((current - scaleMin) / scaleRange) * 100)) : 0;
  var idealStartPct  = ((idealLow  - scaleMin) / scaleRange) * 100;
  var idealWidthPct  = ((idealHigh - idealLow) / scaleRange) * 100;
  var unit = vital.unidade || '%';

  var barHtml =
    '<div class="oxig-bar-wrap">' +
      '<div class="oxig-bar-track">' +
        '<div class="oxig-bar-ideal-zone" style="left:' + idealStartPct.toFixed(1) + '%;width:' + idealWidthPct.toFixed(1) + '%"></div>' +
        '<div class="oxig-bar-fill" style="width:' + currentPct.toFixed(1) + '%;background:' + statusColor + '"></div>' +
        '<div class="oxig-bar-marker" style="left:' + currentPct.toFixed(1) + '%;background:' + statusColor + '"></div>' +
      '</div>' +
      '<div class="oxig-bar-labels"><span>' + scaleMin + '%</span><span>Zona ideal</span><span>' + scaleMax + '%</span></div>' +
    '</div>';

  var statsHtml =
    '<div class="oxig-stats-row">' +
      (histMin != null ? '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Mín</span><span class="oxig-stat-val">'   + histMin + unit + '</span></div>' : '') +
      (histAvg != null ? '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Média</span><span class="oxig-stat-val">' + histAvg + unit + '</span></div>' : '') +
      (histMax != null ? '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Máx</span><span class="oxig-stat-val">'   + histMax + unit + '</span></div>' : '') +
      '<div class="oxig-stat-item"><span class="oxig-stat-lbl">Ideal</span><span class="oxig-stat-val">' + idealLow + '–' + idealHigh + unit + '</span></div>' +
    '</div>';

  return '<div class="vital-detail-summary-panel vital-detail-summary-panel--oxig">' + barHtml + statsHtml + '</div>';
}

// Card de Sinal Vital: ícone + valores (sem nome do indicador no cartão — o ícone identifica)
function createVitalCard(vital, options) {
  const config = options || {};
  const isHomeLayout = config.layout === 'home';
  const featuredClass = config.featured ? ' vital-card--featured' : '';
  const variacaoIcon = vital.variacao === 'normal' ? '🟢' : '🔴';
  const unit = vital.unidade ? ` ${vital.unidade}` : '';
  let valueHtml;
  if (vital.tipo === 'Pressão Arterial' && vital.valor && typeof vital.valor === 'object') {
    const s = vital.valor.sistolica;
    const d = vital.valor.diastolica;
    valueHtml = `<span class="vital-pressure-abbr">SIS</span> ${s} / <span class="vital-pressure-abbr">DIA</span> ${d}${unit}`;
  } else {
    const vitalValue = typeof formatVitalValue === 'function' ? formatVitalValue(vital) : vital.valor;
    valueHtml = `${vitalValue}${unit}`;
  }

  let dataHoraFormatada = '';
  if (vital.dataHora) {
    dataHoraFormatada = typeof formatISODateTimeBR === 'function' ? formatISODateTimeBR(vital.dataHora) : vital.dataHora;
  }
  const ultimaMedicaoLabel = dataHoraFormatada ? `Ultima medicao: ${dataHoraFormatada}` : '';

  const tipoSafe = String(vital.tipo).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const tipoAttr = String(vital.tipo).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const homeClass = isHomeLayout ? ' home-vital-card' : '';

  if (vital.tipo === 'Pressão Arterial') {
    const parsed =
      vital.valor && typeof vital.valor === 'object'
        ? vital.valor
        : typeof parsePressureValue === 'function'
          ? parsePressureValue(vital.valor)
          : null;
    const sAtual = parsed && Number.isFinite(Number(parsed.sistolica)) ? Math.round(Number(parsed.sistolica)) : null;
    const dAtual = parsed && Number.isFinite(Number(parsed.diastolica)) ? Math.round(Number(parsed.diastolica)) : null;

    const pressureSvg = `<svg class="vital-pressao-heart" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" aria-hidden="true" focusable="false"><polyline stroke-linecap="round" stroke-linejoin="round" points="2 12 6 12 8 5 11 19 13 12 15 9 17 15 19 12 22 12"/></svg>`;

    const sisVal = sAtual != null ? sAtual : '—';
    const diaVal = dAtual != null ? dAtual : '—';
    let idealRaw = vital.ideal;

    // Parse ideal SIS/DIA from string "120/80" or object
    let idealSis = null, idealDia = null;
    if (idealRaw && typeof idealRaw === 'string') {
      const parts = idealRaw.match(/(\d+)\s*\/\s*(\d+)/);
      if (parts) { idealSis = Number(parts[1]); idealDia = Number(parts[2]); }
    } else if (idealRaw && typeof idealRaw === 'object') {
      if (idealRaw.sistolica != null) { idealSis = Number(idealRaw.sistolica); idealDia = Number(idealRaw.diastolica); }
      else if (idealRaw.systolic != null) { idealSis = Number(idealRaw.systolic); idealDia = Number(idealRaw.diastolic); }
    }

    // Calculate min/max SIS and DIA from historico
    let sisMins = [], sisMaxs = [], diaMins = [], diaMaxs = [];
    if (Array.isArray(vital.historico) && vital.historico.length > 0) {
      vital.historico.forEach(h => {
        const v = h.valor;
        let s = null, d = null;
        if (v && typeof v === 'object') { s = Number(v.sistolica); d = Number(v.diastolica); }
        else if (typeof v === 'string') {
          const p = v.match(/(\d+)\s*\/\s*(\d+)/);
          if (p) { s = Number(p[1]); d = Number(p[2]); }
        }
        if (Number.isFinite(s)) { sisMins.push(s); sisMaxs.push(s); }
        if (Number.isFinite(d)) { diaMins.push(d); diaMaxs.push(d); }
      });
    }
    const sisMin = sisMins.length ? Math.min(...sisMins) : null;
    const sisMax = sisMaxs.length ? Math.max(...sisMaxs) : null;
    const diaMin = diaMins.length ? Math.min(...diaMins) : null;
    const diaMax = diaMaxs.length ? Math.max(...diaMaxs) : null;

    let pressaoRightHtml = '';
    if (isHomeLayout) {
      const rangeText = (min, max) => (min != null && max != null) ? `${min} – ${max}` : '—';
      pressaoRightHtml = `
        <div class="vital-pressao-home-right">
          <div class="vital-pressao-badge-row">
            <span class="vital-pressao-badge-label vital-pressao-badge-label--sis">SIS</span>
            <span class="vital-pressao-badge-val">${rangeText(sisMin, sisMax)}</span>
          </div>
          <div class="vital-pressao-badge-row">
            <span class="vital-pressao-badge-label vital-pressao-badge-label--dia">DIA</span>
            <span class="vital-pressao-badge-val">${rangeText(diaMin, diaMax)}</span>
          </div>
        </div>`;
    }

    return `
    <div class="card card-saude vital-card vital-card--pressao${homeClass}${featuredClass}" role="article" aria-label="${tipoAttr}" style="cursor: pointer;" onclick="openVitalDetailModal('${tipoSafe}', ${vital.id})">
      <div class="vital-pressao-stack">
        ${isHomeLayout ? `
        <div class="vital-batimento-home-row">
          <div class="vital-batimento-home-left">
            <div class="vital-pressao-top-left">
              <span class="vital-icon vital-icon--pressao" aria-hidden="true">${pressureSvg}</span>
              <span class="vital-pressao-title">Pressão Arterial</span>
            </div>
            <div class="vital-pressao-value-row">
              <span class="vital-pressao-num">${sisVal} / ${diaVal}</span><span class="vital-pressao-unit">mmHg</span>
            </div>
          </div>
          ${pressaoRightHtml}
        </div>
        ` : `
        <div class="vital-pressao-top">
          <div class="vital-pressao-top-left">
            <span class="vital-icon vital-icon--pressao" aria-hidden="true">${pressureSvg}</span>
            <span class="vital-pressao-title">Pressão Arterial</span>
          </div>
        </div>
        <div class="vital-pressao-value-row">
          <span class="vital-pressao-num">${sisVal} / ${diaVal}</span><span class="vital-pressao-unit">mmHg</span>
        </div>
        `}
      </div>
    </div>
  `;
  }

  if (vital.tipo === 'Batimento Cardíaco') {
    const toneClass =
      typeof getBatimentoCardTone === 'function' ? getBatimentoCardTone(vital) : 'vital-batimento-tone--none';
    const mm =
      typeof getBatimentoMinMaxForCard === 'function' ? getBatimentoMinMaxForCard(vital) : null;
    const mmText =
      mm && mm.minStr != null && mm.maxStr != null
        ? `${mm.minStr} - ${mm.maxStr} bpm`
        : '';
    const rawVal = typeof formatVitalValue === 'function' ? formatVitalValue(vital) : vital.valor;
    const n = parseFloat(rawVal);
    const numHtml = Number.isNaN(n) ? '—' : String(Math.round(n));
    const heartSvg = `<svg class="vital-batimento-heart" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" aria-hidden="true" focusable="false"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"/></svg>`;
    let batBadge;
    let idealBadgeText = '';
    let batProgressHtml = '';
    const idealVal = vital.ideal;
    if (idealVal && typeof idealVal === 'string') {
      const im = idealVal.match(/^(\d+)\s*-\s*(\d+)$/);
      if (im) idealBadgeText = `${im[1]} - ${im[2]} bpm`;
    } else if (idealVal && typeof idealVal === 'object') {
      if (idealVal.type === 'range' && idealVal.min != null && idealVal.max != null) {
        idealBadgeText = `${idealVal.min} - ${idealVal.max} bpm`;
      } else if (idealVal.type === 'max' && idealVal.max != null) {
        idealBadgeText = `até ${idealVal.max} bpm`;
      }
    }
    if (!idealBadgeText && mmText) idealBadgeText = mmText;

    if (isHomeLayout) {
      const batColor = vital.variacao === 'normal' ? 'badge--green' : 'badge--orange';
      batBadge = idealBadgeText ? `<span class="vital-home-badge ${batColor}">${idealBadgeText}</span>` : '';

      // Progress bar
      let minBpm = NaN, maxBpm = NaN;
      if (idealVal && typeof idealVal === 'string') {
        const im2 = idealVal.match(/(\d+)\s*-\s*(\d+)/);
        if (im2) { minBpm = Number(im2[1]); maxBpm = Number(im2[2]); }
      } else if (idealVal && typeof idealVal === 'object') {
        if (idealVal.type === 'range') { minBpm = Number(idealVal.min); maxBpm = Number(idealVal.max); }
        else if (idealVal.type === 'max') { minBpm = 0; maxBpm = Number(idealVal.max); }
      }
      const currentBpm = Number.isFinite(n) ? n : NaN;
      if (Number.isFinite(currentBpm) && Number.isFinite(maxBpm) && maxBpm > 0) {
        const displayMax = maxBpm * 1.5;
        const pct = Math.max(2, Math.min(100, (currentBpm / displayMax) * 100));
        const inRange = Number.isFinite(minBpm) ? (currentBpm >= minBpm && currentBpm <= maxBpm) : (currentBpm <= maxBpm);
        const barColor = inRange ? '#22c55e' : '#f59e0b';
        batProgressHtml = `<div class="vital-bat-progress-wrap"><div class="vital-bat-progress-bar" style="width:${pct.toFixed(1)}%;background:${barColor};"></div><div class="vital-bat-progress-marker" style="left:${pct.toFixed(1)}%;background:${barColor};"></div></div>`;
      }
    } else {
      batBadge = mmText
        ? `<span class="vital-batimento-badge ${toneClass}">${mmText}</span>`
        : `<span class="vital-batimento-badge vital-batimento-badge--empty vital-batimento-tone--none" aria-hidden="true">—</span>`;
    }

    const batInnerHtml = isHomeLayout ? `
      <div class="vital-batimento-home-row">
        <div class="vital-batimento-home-left">
          <div class="vital-batimento-top-left">
            <span class="vital-icon vital-icon--batimento" aria-hidden="true">${heartSvg}</span>
            <span class="vital-batimento-title">Batimentos</span>
          </div>
          <div class="vital-batimento-value-row">
            <span class="vital-batimento-num">${numHtml}</span><span class="vital-batimento-unit">bpm</span>
          </div>
        </div>
        <div class="vital-batimento-home-right">
          ${batBadge}
          ${batProgressHtml}
        </div>
      </div>
    ` : `
      <div class="vital-batimento-top">
        <div class="vital-batimento-top-left">
          <span class="vital-icon vital-icon--batimento" aria-hidden="true">${heartSvg}</span>
          <span class="vital-batimento-title">Batimentos</span>
        </div>
        ${batBadge}
      </div>
      <div class="vital-batimento-value-row">
        <span class="vital-batimento-num">${numHtml}</span><span class="vital-batimento-unit">bpm</span>
      </div>
    `;

    return `
    <div class="card card-saude vital-card vital-card--batimento${homeClass}${featuredClass}" role="article" aria-label="${tipoAttr}" style="cursor: pointer;" onclick="openVitalDetailModal('${tipoSafe}', ${vital.id})">
      <div class="vital-batimento-stack">
        ${batInnerHtml}
      </div>
    </div>
  `;
  }

  if (vital.tipo === 'Passos') {
    const lastEntry = Array.isArray(vital.historico) && vital.historico.length > 0 ? vital.historico[0] : null;
    const raw = lastEntry && lastEntry.valor != null ? Number(lastEntry.valor) : Number(vital.valor);
    const currentSteps = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
    const idealTxt = String(vital.ideal || '');
    const idealMatch = idealTxt.match(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)/);
    const minGoal = idealMatch ? Number(String(idealMatch[1]).replace(',', '.')) : NaN;
    const maxGoal = idealMatch ? Number(String(idealMatch[2]).replace(',', '.')) : NaN;
    const dailyGoal = Number.isFinite(minGoal) && Number.isFinite(maxGoal) ? Math.round((minGoal + maxGoal) / 2) : 10000;
    const pct = dailyGoal > 0 ? Math.max(0, Math.min(999, Math.round((currentSteps / dailyGoal) * 100))) : 0;
    const numHtml = currentSteps.toLocaleString('pt-BR');
    const goalHtml = dailyGoal.toLocaleString('pt-BR');
    const stepsIcon = String(vital.icon || '👣');
    const passosHomeSvg = `<svg class="vital-passos-home-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/></svg>`;
    let passosUpdate = '';
    if (lastEntry && lastEntry.data && lastEntry.hora && typeof formatISODateTimeBR === 'function') {
      passosUpdate = `Ultima atualizacao: ${formatISODateTimeBR(`${lastEntry.data}T${lastEntry.hora}`)}`;
    } else if (lastEntry && lastEntry.data) {
      const d = typeof formatISODateBR === 'function' ? formatISODateBR(lastEntry.data) : lastEntry.data;
      passosUpdate = `Ultima atualizacao: ${d}`;
    }
    const passosColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
    const passosBadgeClass = pct >= 80 ? 'badge--green' : pct >= 50 ? 'badge--orange' : 'badge--red';
    const pctClamped = Math.min(pct, 100);
    return `
    <div class="card card-saude vital-card vital-card--passos${homeClass}${featuredClass}" role="article" aria-label="${tipoAttr}" style="cursor: pointer;" onclick="openVitalDetailModal('${tipoSafe}', ${vital.id})">
      <div class="vital-passos-stack">
        ${isHomeLayout ? `
        <div class="vital-batimento-home-row">
          <div class="vital-batimento-home-left">
            <div class="vital-passos-top-left">
              <span class="vital-icon vital-icon--passos" aria-hidden="true">${passosHomeSvg}</span>
              <span class="vital-passos-title">Passos</span>
            </div>
            <div class="vital-passos-value-row">
              <span class="vital-passos-num">${numHtml}</span><span class="vital-passos-unit">passos</span>
            </div>
          </div>
          <div class="vital-batimento-home-right">
            <span class="vital-home-badge ${passosBadgeClass}">Meta: ${goalHtml}</span>
            <div class="vital-bat-progress-wrap"><div class="vital-bat-progress-bar" style="width:${pctClamped}%;background:${passosColor};"></div><div class="vital-bat-progress-marker" style="left:${pctClamped}%;background:${passosColor};"></div></div>
            <span class="vital-passos-pct-label">${pct}% da meta</span>
          </div>
        </div>
        ` : `
        <div class="vital-passos-top">
          <div class="vital-passos-top-left">
            <span class="vital-icon vital-icon--passos" aria-hidden="true">${passosHomeSvg}</span>
            <span class="vital-passos-title">Passos</span>
          </div>
          <span class="vital-passos-badge">${pct}%</span>
        </div>
        <div class="vital-passos-value-row">
          <span class="vital-passos-num">${numHtml}</span>
        </div>
        <div class="vital-passos-goal-row">Meta diaria: ${goalHtml} passos</div>
        `}
      </div>
    </div>
  `;
  }

  if (vital.tipo === 'Glicemia') {
    const rawVal = typeof formatVitalValue === 'function' ? formatVitalValue(vital) : vital.valor;
    const current = parseFloat(rawVal);
    const numHtml = Number.isNaN(current) ? '—' : String(Math.round(current));
    const unit = vital.unidade || 'mg/dL';
    const idealVal = vital.ideal;
    let idealMin = null, idealMax = null;
    if (idealVal && typeof idealVal === 'object' && idealVal.type === 'range') {
      idealMin = idealVal.min != null ? Number(idealVal.min) : null;
      idealMax = idealVal.max != null ? Number(idealVal.max) : null;
    } else {
      const idealTxt = String(idealVal || '');
      const idealMatch = idealTxt.match(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)/);
      if (idealMatch) {
        idealMin = Number(String(idealMatch[1]).replace(',', '.'));
        idealMax = Number(String(idealMatch[2]).replace(',', '.'));
      }
    }

    const glicSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="10" y1="11" x2="14" y2="11"/></svg>`;

    // Min/max from historico
    const histVals = Array.isArray(vital.historico)
      ? vital.historico.map(h => parseFloat(h.valor)).filter(v => Number.isFinite(v))
      : [];
    const histMin = histVals.length ? Math.min(...histVals) : null;
    const histMax = histVals.length ? Math.max(...histVals) : null;

    let glicRightHtml = '';
    if (isHomeLayout) {
      // Semáforo glicemia (jejum): verde=70-99, amarelo=100-125, vermelho=<70 ou >=126
      let markerColor, badgeClass;
      if (!Number.isFinite(current)) {
        markerColor = '#94a3b8'; badgeClass = 'badge--green';
      } else if (current >= 70 && current <= 99) {
        markerColor = '#22c55e'; badgeClass = 'badge--green';      // normal
      } else if (current >= 100 && current <= 125) {
        markerColor = '#f59e0b'; badgeClass = 'badge--orange';     // pré-diabetes
      } else {
        markerColor = '#ef4444'; badgeClass = 'badge--red';        // hipoglicemia ou diabetes
      }

      // Escala clínica fixa: 40 (hipoglicemia severa) a 160 (acima do limiar de diabetes)
      const displayMin = 40;
      const displayMax = 160;
      const badgeMin = idealMin != null ? idealMin : (histMin != null ? histMin : null);
      const badgeMax = idealMax != null ? idealMax : (histMax != null ? histMax : null);

      if (badgeMin != null && badgeMax != null) {
        const barPct = Math.max(2, Math.min(98, ((current - displayMin) / (displayMax - displayMin)) * 100));
        const badgeText = `${badgeMin} – ${badgeMax} ${unit}`;
        glicRightHtml = `
          <div class="vital-batimento-home-right">
            <span class="vital-home-badge ${badgeClass}">${badgeText}</span>
            <div class="vital-bat-progress-wrap"><div class="vital-bat-progress-bar" style="width:${barPct.toFixed(1)}%;background:${markerColor};"></div><div class="vital-bat-progress-marker" style="left:${barPct.toFixed(1)}%;background:${markerColor};"></div></div>
          </div>`;
      }
    }

    if (isHomeLayout) {
      return `
    <div class="card card-saude vital-card vital-card--glicemia${homeClass}${featuredClass}" role="article" aria-label="${tipoAttr}" style="cursor: pointer;" onclick="openVitalDetailModal('${tipoSafe}', ${vital.id})">
      <div class="vital-batimento-stack">
        <div class="vital-batimento-home-row">
          <div class="vital-batimento-home-left">
            <div class="vital-batimento-top-left">
              <span class="vital-icon vital-icon--glicemia" aria-hidden="true">${glicSvg}</span>
              <span class="vital-batimento-title">Glicemia</span>
            </div>
            <div class="vital-batimento-value-row">
              <span class="vital-batimento-num">${numHtml}</span><span class="vital-batimento-unit">${unit}</span>
            </div>
          </div>
          ${glicRightHtml}
        </div>
      </div>
    </div>
  `;
    }
  }

  if (vital.tipo === 'Sono' && isHomeLayout) {
    return buildHomeSonoCard(vital);
  }

  if (vital.tipo === 'Oxigenação' && isHomeLayout) {
    return buildHomeOxigCard(vital);
  }

  if (vital.tipo === 'Hidratação' && isHomeLayout) {
    return buildHomeHidratacaoCard(vital);
  }

  const rangeLine =
    typeof formatVital24hRangeLine === 'function'
      ? formatVital24hRangeLine(vital)
      : '<div class="vital-24h-line"><span class="vital-24h-clock" aria-hidden="true">🕐</span><span class="vital-24h-empty">—</span></div>';

  const valueMainClass =
    vital.tipo === 'Pressão Arterial' ? 'vital-value-main vital-value-main--pressure' : 'vital-value-main';
  const iconSvg = getVitalIconSvg(vital.tipo);
  const iconHtml = iconSvg || vital.icon;
  const dotClass = vital.variacao === 'normal' ? 'vital-variacao-dot--ok' : 'vital-variacao-dot--alert';
  return `
    <div class="card card-saude vital-card card-has-action${featuredClass}" role="article" aria-label="${tipoAttr}" style="cursor: pointer;" onclick="openVitalDetailModal('${tipoSafe}', ${vital.id})">
      <div class="vital-header-compact vital-header--icon-value">
        <span class="vital-icon" aria-hidden="true">${iconHtml}</span>
        <span class="${valueMainClass}">${valueHtml}</span>
        <span class="vital-variacao-dot ${dotClass}" aria-hidden="true"></span>
      </div>
      <div class="vital-meta-line">
        <span class="vital-datetime">${dataHoraFormatada}</span>
      </div>
      ${rangeLine}
      <span class="card-action-plus" aria-hidden="true">+</span>
    </div>
  `;
}

// Card de Composição Corporal — grid tile 2 colunas
var _corpoCardColors = {
  'Peso':                { bg: '#eff6ff', fg: '#2563eb' },
  'IMC':                 { bg: '#f5f3ff', fg: '#7c3aed' },
  'Músculo Esquelético': { bg: '#fff1f2', fg: '#e11d48' },
  'Massa Gorda':         { bg: '#fff7ed', fg: '#ea580c' },
  'Água Corporal':       { bg: '#ecfeff', fg: '#0891b2' },
  'Gordura Corporal':    { bg: '#fffbeb', fg: '#d97706' },
};

// Card ECG (mesma lógica: ícone + números, sem rótulos de texto)
function createEcgCard(ecg) {
  const dataHora = typeof formatISODateTimeBR === 'function' ? formatISODateTimeBR(ecg.dataHora) : ecg.dataHora;
  return `
    <div class="card card-ecg card-has-action" role="article" aria-label="Eletrocardiograma" onclick="openEcgDetail(${ecg.id})">
      <div class="ecg-header ecg-header--compact">
        <div class="ecg-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 12 6 12 8 5 11 19 13 12 15 9 17 15 19 12 22 12"/></svg></div>
        <div class="ecg-value-stack">
          <div class="ecg-value-line"><span class="ecg-value-num">${ecg.frequenciaCardiaca}</span><span class="ecg-value-unit"> bpm</span></div>
          <div class="ecg-rhythm-line">${ecg.ritmo}</div>
        </div>
      </div>
      <div class="ecg-meta"><span class="ecg-date">📅 ${dataHora}</span></div>
      <div class="ecg-interpretation">${ecg.interpretacao}</div>
      <span class="card-action-plus" aria-hidden="true">+</span>
    </div>
  `;
}

// Card de Medicação — layout alinhado ao protótipo (lista de horários em grelha, estoque numa linha)
function createMedicacaoCard(med) {
  const catalog = (typeof mockData !== 'undefined' && mockData.catalogoMedicamentos)
    ? mockData.catalogoMedicamentos.find(m => m.nome === med.nome)
    : null;
  const photoColumnHtml = getMedicationPhotoColumnHtml(med, catalog, 'card');

  const hoje = typeof getTodayISODate === 'function'
    ? getTodayISODate()
    : new Date().toISOString().slice(0, 10);

  const horaAtual = typeof getCurrentHHMM === 'function'
    ? getCurrentHHMM()
    : `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

  const estoqueAtual = med.estoqueAtual || 0;
  const estoqueMinimo = med.estoqueMinimo || 7;
  const dosesPorDia = Math.max(1, (med.horarios || []).length);
  const diasRestantes = estoqueAtual > 0 ? Math.ceil(estoqueAtual / dosesPorDia) : 0;
  const temAviso = estoqueAtual <= estoqueMinimo;

  const horariosHtml = med.horarios.map((horario) => {
    const status = typeof getMedicationStatusForDate === 'function'
      ? getMedicationStatusForDate(med, hoje, horario, horaAtual)
      : 'pendente';

    const statusClass = status === 'tomado'
      ? 'status-tomado'
      : status === 'atrasado'
        ? 'status-atrasado'
        : 'status-a-tomar';

    const statusLabel = status === 'tomado'
      ? 'Tomado'
      : status === 'atrasado'
        ? 'Atrasado'
        : 'A\u00A0tomar';

    const clickHandler = status === 'tomado'
      ? `handleMedicationScheduleClick(${med.id}, '${horario}', 'tomado', '${med.nome}', '${med.dosagem}', '${hoje}')`
      : `handleMedicationScheduleClick(${med.id}, '${horario}', '${status}', '${med.nome}', '${med.dosagem}', '${hoje}')`;

    return `
      <div class="horario-item ${statusClass}" onclick="${clickHandler}">
        <span class="horario-time">${horario}</span>
        <span class="horario-status">${statusLabel}</span>
      </div>
    `;
  }).join('');

  const estoqueHtml = `
    <div class="med-estoque compact${temAviso ? ' med-estoque--aviso' : ''}">
      <span class="estoque-text estoque-line-main">
        Restam <strong>${estoqueAtual}</strong> un.
        ${estoqueAtual > 0 ? `· ~${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}` : '· sem estoque'}
      </span>
      ${temAviso ? `<span class="med-estoque-badge-aviso"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Estoque baixo</span>` : ''}
    </div>
  `;

  return `
    <div class="card card-medicacao-enhanced">
      <div class="med-header-enhanced">
        <div class="med-header-inner">
          <div class="med-card-name-block">
            <div class="med-title-enhanced">
              ${photoColumnHtml}
              <div class="med-title-text">
                <div class="med-name">${med.nome} <span class="med-title-feature">${med.dosagem}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div class="med-actions-enhanced">
          <button type="button" class="med-action-btn-enhanced" onclick="openEditMedicacaoModal(${med.id})" title="Editar">✏️</button>
        </div>
      </div>

      <div class="med-horarios-interactive">
        <div class="horarios-list-interactive">
          ${horariosHtml}
        </div>
      </div>

      ${estoqueHtml}
    </div>
  `;
}

// Card de Consulta
function createConsultaCard(consulta, variant) {
  const colors = categoryColors.agenda;
  const tipoIcon = consulta.tipo === 'Presencial' ? '🏥' : '💻';
  const dataBR = typeof formatISODateBR === 'function' ? formatISODateBR(consulta.data) : consulta.data;
  const cardVariant = variant || 'default';

  if (cardVariant === 'home') {
    const MESES_HOME = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const dateLong = (() => {
      if (!consulta.data) return dataBR;
      const p = consulta.data.split('-');
      if (p.length !== 3) return dataBR;
      const d = parseInt(p[2], 10);
      const m = parseInt(p[1], 10) - 1;
      return `${d} de ${MESES_HOME[m] || p[1]}`;
    })();
    return `
      <div class="card card-agenda card-agenda--home" style="cursor:pointer;" onclick="switchScreen('agendaScreen')">
        <div class="consulta-home-row">
          <div class="consulta-home-cal-wrap">
            <svg class="consulta-home-cal-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="consulta-home-info">
            <div class="consulta-home-doctor">${consulta.medico}</div>
            <div class="consulta-home-specialty">${consulta.especialidade}</div>
            <div class="consulta-home-date">${dateLong} às ${consulta.hora}</div>
          </div>
          <div class="consulta-home-arrow">›</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="card card-agenda">
      <div class="card-header">
        <div class="card-icon">${colors.icon}</div>
        <div class="card-title">${consulta.medico}</div>
      </div>
      <div class="card-info">${consulta.especialidade}</div>
      <div class="card-info">${dataBR} às ${consulta.hora}</div>
      <div class="card-info">${tipoIcon} ${consulta.tipo} • ${consulta.local}</div>
      <div class="card-info">Motivo: ${consulta.motivo}</div>
    </div>
  `;
}

// Card de Exame
function createExameCard(exame, isRealizado = false) {
  const statusBadge = isRealizado
    ? `<span class="exame-status exame-status--realizado">Realizado</span>`
    : `<span class="exame-status exame-status--agendado">Agendado</span>`;
  const dataBR = typeof formatISODateBR === 'function' ? formatISODateBR(exame.data) : exame.data;
  
  return `
    <div class="exame-card">
      <div class="exame-header">
        <div>
          <div class="exame-title">${exame.nome}</div>
          <div class="card-info" style="margin-top: 4px;">${dataBR} • ${exame.local}</div>
        </div>
        <div class="exame-status">
          ${statusBadge}
        </div>
      </div>
      ${isRealizado ? `
        <div class="resultado-box">
          <div class="resultado-title">Resultado:</div>
          <div class="resultado-text">${exame.resultado}</div>
        </div>
      ` : `
        <div class="card-info">Solicitado por: ${exame.medico}</div>
      `}
    </div>
  `;
}

// Card de Compartilhamento
function createCompartilhamentoCard(compartilhamento) {
  const dados = compartilhamento.dadosCompartilhados.join(', ');
  const dataBR = typeof formatISODateBR === 'function' ? formatISODateBR(compartilhamento.dataAutorizacao) : compartilhamento.dataAutorizacao;
  const medicoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const statusDot = compartilhamento.ativo
    ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:5px;vertical-align:middle;"></span>Ativo`
    : `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-right:5px;vertical-align:middle;"></span>Inativo`;

  return `
    <div class="card card-saude">
      <div class="card-header">
        <div class="card-icon">${medicoSvg}</div>
        <div class="card-title">${compartilhamento.medico}</div>
      </div>
      <div class="card-info">${compartilhamento.especialidade}</div>
      <div class="card-info">Dados: ${dados}</div>
      <div class="card-info">Desde: ${dataBR}</div>
      <div class="card-info">Status: ${statusDot}</div>
    </div>
  `;
}

// Deletar medicação (ex.: a partir do modal Editar)
function deleteMedicacao(medicacaoId) {
  const medicacao = mockData.medicacoes.find(m => m.id === medicacaoId);
  if (!medicacao) return false;
  if (!confirm(`Tem certeza que deseja excluir ${medicacao.nome}?`)) return false;
  mockData.medicacoes = mockData.medicacoes.filter(m => m.id !== medicacaoId);
  renderMedicacoes();

  const em = document.getElementById('editMedicacaoModal');
  if (em) {
    em.classList.remove('active');
    const ef = document.getElementById('editMedicacaoForm');
    if (ef) ef.reset();
  }
  if (typeof setSemDataFimMedicacaoUI === 'function') {
    try {
      setSemDataFimMedicacaoUI('edit', false);
    } catch (e) { /* app ainda não carregou */ }
  }
  if (typeof removerFotoEdit === 'function') {
    try {
      removerFotoEdit();
    } catch (e) { /* */ }
  }

  if (typeof showFeedbackModal === 'function') {
    showFeedbackModal(`${medicacao.nome} excluído.`, 'success');
  } else {
    alert(`${medicacao.nome} excluído.`);
  }
  return true;
}
