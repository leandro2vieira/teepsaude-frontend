# Plano de Refatoração — Mensuri

## Análise Completa de Código Morto (24/06/2026)

### Metodologia
- Busca exaustiva por funções declaradas vs. chamadas em todos os arquivos `.js` e `.html`
- Verificação de IDs/elementos HTML vs. referências em JS
- Verificação de seletores CSS vs. uso em HTML/JS
- Projeto vanilla JS (sem imports/ módulos) — não há importações não utilizadas
- Nenhum bloco de código comentado sem explicação foi encontrado

---

## ✅ Itens Removidos

### HTML Morto
- [x] `novoSinalModal` (index.html:1670-1707) — modal órfão, nunca aberto por nenhum JS. Substituído por `novoIndicadorModal`

### components.js — 7 funções mortas
- [x] `_corpoShortDate` (linha 991)
- [x] `createComposicaoCard` (linha 1001)
- [x] `calcularDiasRestantes` (linha 1222)
- [x] `calcularComprimidosRestantes` (linha 1230)
- [x] `verificarSeTomadiHoje` (linha 1237)
- [x] `getStatusColor` (linha 1244)
- [x] `getStatusIcon` (linha 1248)

### app.js — 2 variáveis de estado mortas
- [x] `var f7app` (linha 1261) — instância Framework7 declarada mas nunca referenciada
- [x] `let currentTipoDispositivo` (linha 5625) — declarada mas nunca lida

### app.js — 27 funções mortas
- [x] `glicNumpadPress` (403) — teclado numérico customizado da glicemia (UI removida)
- [x] `glicToggleEditTime` (640) — toggle de edição de hora na glicemia
- [x] `setPassosDayFromList` (700) — seleção de dia de passos
- [x] `onVitalDefaultLivreRangeChange` (875) — handler de range livre não conectado
- [x] `toggleVitalBatimentoContextMode` (1001) — toggle de contexto de batimento
- [x] `hidraQuickAddManual` (1630) — add manual de hidratação (substituído por hidraQuickAdd)
- [x] `renderCompartilhamento` (1804) — substituído por `renderCompartilhamentoInPerfil`
- [x] `markAsTaken` (2798) — substituído por `markMedicationByIdAndTime`
- [x] `editMedicacao` (2814) — stub "em desenvolvimento"
- [x] `testAlarm` (2831) — função de teste
- [x] `renderCorpoRows` (3518) — substituído por `renderCorpoRowsWithVariation`
- [x] `renderCorpoWizardHistoryTable` (3712) — tabela de histórico do wizard
- [x] `markMedicationAsTaken` (4384) — alternativa não usada
- [x] `toggleAlertaVitalFields` (5177) — toggle de campos de alerta vital
- [x] `openAlertasModal` (5182) — modal de alertas não usado
- [x] `openValoresIdeaisModal` (5306) — modal de valores ideais não usado
- [x] `openSonoDetalheFromRow` (5963) — abrir detalhe de sono de linha
- [x] `openExercicioDetalheFromBatimentoHour` (5969) — abrir exercício de hora de batimento
- [x] `openSonoDetalheFromBatimentoHour` (5979) — abrir sono de hora de batimento
- [x] `isBatimentoHistoricoExercicio` (6404) — substituído por `isBatimentoSonoOuRepouso`
- [x] `isBatimentoHistoricoRepouso` (6408) — substituído por `isBatimentoSonoOuRepouso`
- [x] `isBatimentoHistoricoSono` (6412) — substituído por `isBatimentoSonoOuRepouso`
- [x] `onBatimentoLivreRangeChange` (8180) — handler de range livre (batimento)
- [x] `setVitalBatimentoPeriod` (8185) — setter de período de batimento
- [x] `clearVitalBatimentoDaySelection` (8839) — limpa seleção de dia
- [x] `_pressaoClassificar` (9333) — classificação de PA (não usada)
- [x] `pressaoInsConfirmStep` (9606) — confirma passo do wizard de PA
- [x] `startStepPA` (9801) — inicia passo do drum de PA

### styles.css — 5 blocos de CSS morto
- [x] `#composicaoModal` selectors (linhas 2024-2039) — modal de composição substituído
- [x] `.profile-card`, `.profile-avatar`, `.profile-info`, `.profile-name`, `.profile-email` (linhas 1189-1230) — legado
- [x] `.card-composicao` + todos `.composicao-*` (linhas 4625-4910) — substituído por `.corpo-*`
- [x] `.clock-widget` + `.clock-time` + `.clock-label` + `.clock-widget-plus` (linhas 5567-5612)
- [x] `.summary-item` + `.summary-item-clickable` + `.summary-label` + `.summary-value` (linhas 5618-5659)

---

## 📝 Observações

### Itens do plano anterior que NÃO foram removidos (confirmados como EM USO):
- `openMedicationPhotoModalById` — chamada via `onclick` em components.js
- `openEditMedicacaoModal` — chamada via `onclick` em components.js
- `getMedicationPhotoColumnHtml` / `getMedicationPhotoHtml` — usadas em `createMedicacaoCard`

### Refatoração futura (não é código morto):
- **Unificar** `formatDateForUI` (app.js:898) → `formatISODateBR` (data.js:1780) — 25 chamadas
- **Unificar** `formatDateTimeForUI` (app.js:902) → `formatISODateTimeBR` (data.js:1787) — 7 chamadas
- Revisar CSS para duplicatas entre `.composicao-*` e `.corpo-*`
