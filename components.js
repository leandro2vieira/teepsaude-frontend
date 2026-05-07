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
    'Percentual de Gordura':  `<svg ${b}><path d="M12 2v10l8.5 5A10 10 0 1 1 12 2z"/></svg>`,
    'Massa Muscular':         `<svg ${b}><rect x="2" y="10" width="4" height="4" rx="1"/><rect x="18" y="10" width="4" height="4" rx="1"/><line x1="6" y1="12" x2="18" y2="12"/><rect x="5" y="8" width="2" height="8" rx="1"/><rect x="17" y="8" width="2" height="8" rx="1"/></svg>`,
    'Circunferência Cintura': `<svg ${b}><rect x="2" y="8" width="20" height="8" rx="2"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="17" y1="8" x2="17" y2="16"/></svg>`,
    'Altura':                 `<svg ${b}><path d="M12 2v20"/><path d="M5 9l7-7 7 7"/><path d="M5 15l7 7 7-7"/></svg>`,
  };
  return map[tipo] || null;
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
            <span class="vital-pressao-badge-label">SIS</span>
            <span class="vital-pressao-badge-val">${rangeText(sisMin, sisMax)}</span>
          </div>
          <div class="vital-pressao-badge-row">
            <span class="vital-pressao-badge-label">DIA</span>
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

// Card de Composição Corporal: ícone + nome do indicador + valores
function createComposicaoCard(item) {
  const variacaoClass = item.variacao === 'normal' ? 'variacao-normal' : 'variacao-alerta';
  const variacaoIcon = item.variacao === 'normal' ? '🟢' : '🔴';
  const fontePadrao = item.fonte || 'Manual';
  const dataHora = item.dataHora
    ? (typeof formatISODateTimeBR === 'function' ? formatISODateTimeBR(item.dataHora) : item.dataHora)
    : '';
  const tipoArg = JSON.stringify(item.tipo);
  const tipoAttr = String(item.tipo).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const tipoHtml = String(item.tipo)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const composicaoIconHtml = getVitalIconSvg(item.tipo) || item.icon;
  const composicaoDotClass = item.variacao === 'normal' ? 'vital-variacao-dot--ok' : 'vital-variacao-dot--alert';
  return `
    <div class="card card-composicao card-has-action" role="article" aria-label="${tipoAttr}" style="cursor: pointer;" onclick="openComposicaoModal(${item.id}, ${tipoArg})">
      <div class="composicao-header composicao-header--with-title">
        <div class="composicao-icon" aria-hidden="true">${composicaoIconHtml}</div>
        <div class="composicao-info">
          <div class="composicao-title">${tipoHtml}</div>
          <div class="composicao-value-row">
            <div class="composicao-value">${item.valor} ${item.unidade}</div>
            <span class="vital-variacao-dot ${composicaoDotClass}" aria-hidden="true"></span>
          </div>
        </div>
      </div>
      <div class="composicao-footer composicao-footer--compact">
        <span class="composicao-date">${dataHora}</span>
        <span class="composicao-source-icon" title="${fontePadrao}">📍</span>
      </div>
      <span class="card-action-plus" aria-hidden="true">+</span>
    </div>
  `;
}

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
    <div class="med-estoque compact">
      <span class="estoque-text estoque-line-main">
        Restam <strong>${estoqueAtual}</strong> un.
        ${estoqueAtual > 0 ? `· ~${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}` : '· sem estoque'}
        ${temAviso ? '<span class="med-estoque-aviso" title="Estoque abaixo do mínimo configurado">⚠️</span>' : ''}
      </span>
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

// Funções auxiliares
function calcularDiasRestantes(medicacao) {
  if (!medicacao.dataFim || String(medicacao.dataFim).trim() === '') return null;
  const dataFim = new Date(medicacao.dataFim);
  const hoje = new Date();
  const diferenca = dataFim - hoje;
  return Math.ceil(diferenca / (1000 * 60 * 60 * 24));
}

function calcularComprimidosRestantes(medicacao) {
  const base = medicacao.estoqueAtual != null ? medicacao.estoqueAtual : medicacao.estoque;
  const est = parseInt(String(base), 10);
  const tomados = medicacao.historico.filter(h => h.status === 'tomado').length;
  return (Number.isNaN(est) ? 0 : est) - tomados;
}

function verificarSeTomadiHoje(medicacao) {
  const hoje = typeof getTodayISODate === 'function'
    ? getTodayISODate()
    : new Date().toISOString().slice(0, 10);
  return medicacao.historico.some(h => h.data === hoje && h.status === 'tomado');
}

function getStatusColor(status) {
  return statusColors[status] || statusColors.normal;
}

function getStatusIcon(status) {
  const icons = {
    'tomado': '✅',
    'pendente': '⏳',
    'nao_tomado': '❌'
  };
  return icons[status] || '❓';
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
