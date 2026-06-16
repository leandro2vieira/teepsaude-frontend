# Referências Visuais — Home & Batimentos

> Referência para manter consistência visual ao modificar a **Tela Início** e a **Tela de Batimentos (drill-down)**.
> Complementar ao `guia-visual-mensuri.md`.

---

## 1. TELA INÍCIO (Home)

### Layout Geral

- Background: `#f3f3f3`
- Padding: `14px` laterais, `6px 4px` no screen
- Gap entre cards: `12px`
- Transição de tela: `screenSlideIn 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)`

### Header (Navbar)

```css
.navbar.header {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
  border-bottom: 1px solid #e2e8f0;
}
.header-top-row {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
  padding: 10px 12px;
  gap: 12px;
}
```

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| Avatar (iniciais) | 52×52px, border-radius 50% | 700 | bg `#e8f0fe`, text `#2563eb`, border `2px solid #e2e8f0` |
| Saudação | 16px | 500 | `#64748b` |
| Nome | 18px | 700 | `#1a2332` |
| Data | 15px | 500 | `#64748b` |

### Card de Status (Medicamentos)

- Border-radius: `999px` (pill)
- Padding: `7px 14px`
- Ícone: 22×24px, border-radius 50%, font 11px weight 800

| Estado | Background | Borda | Ícone bg | Título cor |
|---|---|---|---|---|
| OK | `#f0fdf4` | `1px solid #bbf7d0` | `#22c55e` | `#1a2332` |
| Alerta | `#fff7ed` | `1px solid #fdba74` | `#ea580c` | `#9a3412` |

### Títulos de Seção

```css
.section-title { font-size: 18px; font-weight: 700; color: #1a2332; }
.section-subtitle { font-size: 13px; font-weight: 500; color: #94a3b8; margin-top: 2px; }
.home-section-header { margin-top: 28px; margin-bottom: 12px; }
```

### Cards de Sinais Vitais (Home)

```css
.home-vital-card {
  background: #ffffff;
  border: 1px solid #e8ecf0;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
  padding: 16px 36px 16px 16px !important;
  margin-bottom: 12px !important;
}
/* Seta chevron */
.home-vital-card::after {
  content: '\203a';
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  font-size: 20px; font-weight: 400; color: #d1d5db;
}
```

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| Título do card | 15-16px | 500-600 | `#64748b` / `#6b7280` |
| Valor (KPI gigante) | 34-40px | 650-700 | `#1a2332` / `#4F4F4F` |
| Unidade (bpm, etc.) | 17px | 600 | `#64748b` |

### Ícones por Tipo de Sinal Vital

| Tipo | Cor do ícone | Cor do background |
|---|---|---|
| Batimentos | `#e53935` | — |
| Pressão | `#f59e0b` | — |
| Passos | `#22c55e` | — |
| Glicemia | `#7c3aed` | — |

### Badges de Status

```css
.vital-home-badge {
  font-size: 13px; font-weight: 700; line-height: 1.2;
  padding: 5px 11px; border-radius: 999px; white-space: nowrap;
}
```

| Estado | Background | Cor do texto |
|---|---|---|
| Bom | `#dcfce7` | `#15803d` |
| Atenção | `#fff7ed` | `#c2410c` |
| Alerta | `#fee2e2` | `#b91c1c` |

### Card de Batimentos (Home)

```css
.vital-batimento-home-row {
  display: flex; flex-direction: row; align-items: center;
  justify-content: space-between; gap: 10px;
}
```

- Ícone coração: SVG inline, `width="22" height="22"`, `stroke-width="1.75"`, cor `#e53935`

---

## 2. TELA DE BATIMENTOS (Drill-down)

### Modal Container

```css
#vitalDetailModal {
  background: #f3f3f3;
}
#vitalDetailModal .modal-content {
  max-width: min(480px, 100vw);
  background: #f3f3f3;
  border-radius: 0;
}
```

### Header Sticky

```css
.vital-detail-modal-header {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center;
  padding: 14px 12px 12px;
  background: #ffffff;
  border-bottom: 1px solid #f1f5f9;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  gap: 4px;
}
```

| Elemento | Estilo |
|---|---|
| Título | 17px, weight 700, cor `#0f172a`, letter-spacing `-0.02em` |
| Subtítulo | 12px, weight 500, cor `#94a3b8` |
| Botão voltar | 36×36px, border-radius 50%, bg `#f1f5f9`, cor `#475569` |
| Botão compartilhar | 36×36px, border-radius 50%, bg `#eff6ff`, cor `#2563eb` |

### Day Picker Card (Seletor de dias)

```css
.bat-day-picker-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  border: 1px solid #f1f1f1;
  padding: 12px 0 10px;
  margin-bottom: 12px;
}
```

| Elemento | Estilo |
|---|---|
| Coluna (dia) | min-width 46px, border-radius 10px, padding 6px 4px |
| Barra mini | 7px largura, border-radius 4px |
| Barra default | `#d1d5db` |
| Barra selecionada | `#2563eb` |
| Dia da semana | 10px, weight 500, `#94a3b8` (selecionado: `#2563eb`) |
| Número do dia | 12px, weight 500 (selecionado: 700, `#2563eb`) |
| Ponto "hoje" | 4×4px, border-radius 50%, `#2563eb` |
| Coluna selecionada bg | `rgba(37,99,235,0.08)` |

### Card Min/Max

```css
.bat-minmax-card {
  background: #ffffff;
  border: 1px solid #f1f1f1;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  border-radius: 16px;
  padding: 16px 20px 12px;
  margin-bottom: 12px;
}
```

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| Label (Mín/Máx) | 11px | 600 | `#94a3b8`, uppercase, letter-spacing 0.05em |
| Valor | 44px | 800 | `#0f172a`, letter-spacing -1px |
| Unidade | 13px | 600 | `#94a3b8` |
| Divisória vertical | 1×56px | — | `#e2e8f0` |
| Referência (rodapé) | 11px | — | `#94a3b8` |

### Gráfico de Barras por Hora

```css
.bat-hourly-chart-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  border: 1px solid #f1f1f1;
  padding: 14px 14px 10px;
  margin-bottom: 12px;
}
```

| Elemento | Estilo |
|---|---|
| Título | 13px, weight 600, `#0f172a` |
| Canvas height | 160px, DPR-aware |
| Padding canvas | `padL=28, padR=6, padT=10, padB=22` |
| Grid lines | `#f1f5f9`, width 1 |
| Y-labels | 9px Inter 500, `#94a3b8` |
| Barra normal (60-100) | `#2563eb` |
| Barra alta (>100) | `#ef4444` |
| Barra baixa (<60) | `#f59e0b` |
| Largura da barra | 7px |
| Banda ideal (60-100) | fill `rgba(34,197,94,0.09)`, bordas tracejadas `rgba(34,197,94,0.35)` |
| X-labels | 8px sans-serif, `#666666` |

### Legenda do Gráfico

```css
.bat-hourly-chart-legend { display: flex; gap: 12px; margin-top: 8px; }
.bhc-leg { font-size: 10px; color: #64748b; font-weight: 500; }
.bhc-dot { width: 8px; height: 8px; border-radius: 2px; }
```

| Legenda | Cor |
|---|---|
| Normal | `#2563eb` |
| Alta | `#ef4444` |
| Baixa | `#f59e0b` |
| Referência | `rgba(34,197,94,0.6)` tracejado |

### Tabela por Hora (Últimas medições)

```css
.bat-hourly-section {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  border: 1px solid #f1f1f1;
  padding: 14px 14px 10px;
  margin-bottom: 12px;
}
```

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| Título data | 16px | 700 | `#0f172a` |
| Título seção | 13px | 700 | `#0f172a` |
| Row | — | — | bg `#f8fafc`, border-radius 14px, padding 14px 16px |
| Row hover | — | — | bg `#f1f5f9` |
| Range (ex: 62 – 89) | 18px | 700 | `#0f172a`, letter-spacing -0.5px |
| Separador (–) | — | 400 | `#94a3b8` |
| Unidade (bpm) | 14px | 500 | `#94a3b8` |
| Faixa horário | 11px | 600 | `#94a3b8`, letter-spacing 0.02em |
| Botão "Ver mais" | 13px | 600 | `#2563eb`, border 1px solid `#e2e8f0`, border-radius 10px |

### Drill-down por Hora (bat-hd-*)

| Elemento | Estilo |
|---|---|
| Título do slot | 16px, weight 700, `#0f172a` |
| Botão voltar | bg none, border none, cor `#0f172a`, border-radius 8px |
| Card min/max | 28px weight 700 `#0f172a`, label 11px weight 600 `#94a3b8` |
| Título do chart | 13px, weight 600, `#64748b` |
| Canvas | height 160px, padding `PAD_L=30, PAD_R=6, PAD_T=6, PAD_B=22` |
| Barra | 7px, border-radius 3px |
| Barra selecionada | `globalAlpha=1`,其他 `globalAlpha=0.2` |
| Linha de seleção | `#475569`, line-width 1.5, dash [4,3], alpha 0.7 |
| Tooltip | bg `#1e293b`, cor `#fff`, font 12px, valor forte em `#fbbf24`, border-radius 8px |

### Card Tendência em Repouso

```css
.bat-resting-section {
  background: #ffffff;
  border: 1px solid #f1f1f1;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  border-radius: 16px;
  padding: 14px 16px 10px;
  margin-bottom: 12px;
  cursor: pointer;
}
```

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| Título | 13px | 700 | `#0f172a` |
| Subtítulo | 11px | 500 | `#94a3b8` |
| Valor média | 48px | 800 | `#2563eb`, letter-spacing -1px |
| Unidade | 14px | 600 | `#94a3b8` |
| Canvas | height 100px, padding `padL=28, padR=8, padT=12, padB=8` |
| Labels dos dias | 10px, weight 600, `#94a3b8` |
| Banda referência | fill `rgba(34,197,94,0.08)`, bordas `rgba(34,197,94,0.25)` |

### Card Resumo (Repouso Detail)

```css
.brd-summary-card {
  background: #fff;
  border: 1px solid #f1f1f1;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  padding: 18px 18px 16px;
}
```

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| Label "Média" | 18px | 700 | `#475569` |
| Valor média | 52px | 800 | `#2563eb`, letter-spacing -2px |
| Unidade | 16px | 600 | `#94a3b8` |
| Badge status | 12px, weight 700, padding 5px 13px, border-radius 99px |
| Dica (tip) | 12px, weight 600, `#0f172a`, bg `#f1f5f9`, border-left 3px `#2563eb` |

| Badge | Background | Cor |
|---|---|---|
| Verde | `#dcfce7` | `#15803d` |
| Amarelo | `#fef9c3` | `#a16207` |
| Vermelho | `#fee2e2` | `#dc2626` |
| Azul | `#dbeafe` | `#1d4ed8` |

### Chips de Período

```css
.brd-chip {
  flex: 1; padding: 8px 0; border-radius: 10px;
  border: 1.5px solid #e2e8f0;
  background: #fff; font-size: 13px; font-weight: 600; color: #64748b;
}
.brd-chip-active { background: #2563eb; border-color: #2563eb; color: #fff; }
```

### Cores de Fundo por Contexto (Listas)

| Contexto | Background | Ativo (press) |
|---|---|---|
| Exercício | `#d1fae5` | `#bbf7d0` |
| Repouso | `#fefce8` | `#fef08a` |
| Sono | `#f3e8ff` | `#e9d5ff` |
| Outros | `#fff4e6` | `#fed7aa` |

### Cores de Barras por Faixa Ideal

| Faixa | Gradiente |
|---|---|
| Abaixo do ideal | `linear-gradient(180deg, #fdba74, #9a3412)` |
| Dentro do ideal | `linear-gradient(180deg, #ffedd5, #fb923c)` |
| Acima do ideal | `linear-gradient(180deg, #ffc9c9, #c92a2a)` |

### Cores de Legenda por Contexto (Gráfico)

| Contexto | Gradiente |
|---|---|
| Sono | `linear-gradient(180deg, #f3e8ff, #6b21a8)` |
| Exercício | `linear-gradient(180deg, #d1fae5, #047857)` |
| Repouso | `linear-gradient(180deg, #fefce8, #ca8a04)` |
| Outros | `linear-gradient(180deg, #ffedd5, #c2410c)` |

### Modal Minuto (batimentoMinutoModal)

```css
.modal-content--bmin {
  max-width: min(420px, calc(100vw - 16px));
  height: min(88vh, 740px);
  border-radius: 14px;
  padding: 16px 16px 20px;
}
```

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| Título | 17px | 700 | `#0f172a` |
| Subtítulo | 12px | — | `#64748b` |
| Range grande | 28px | 800 | `#0f172a` |
| Contexto badge | 12px | 700 | `#64748b`, bg `#f0f0f0`, border-radius 999px |
| Canvas | border-radius 8px, bg `#fff` |
| Linha de medida | 17px | 700 | `#5a6a85` |
| Linha de hora | 12px | 500 | `#64748b` |
| Chevron | 18px | — | `#c5c5c5` |

### Botão "Ver Mais"

```css
.vital-ver-mais-btn {
  width: 100%; padding: 10px;
  border: 1px dashed #e2e8f0; border-radius: 8px;
  background: #fafafa; color: #64748b;
  font-size: 13px; font-weight: 700; text-align: center;
}
.vital-ver-mais-btn:hover {
  background: #f0f0f0; border-color: #cbd5e1; color: #1e293b;
}
```

---

## 3. PALETA CONSOLIDADA (Home + Batimentos)

### Cores Principais

| Uso | Hex |
|---|---|
| Fundo modal | `#f3f3f3` |
| Fundo card | `#ffffff` |
| Borda card | `#f1f1f1` / `#e8ecf0` |
| Sombra card | `rgba(0,0,0,0.06)` / `rgba(0,0,0,0.07)` |
| Título | `#0f172a` / `#1a2332` |
| Corpo | `#1e293b` |
| Muted | `#64748b` / `#94a3b8` |
| Acento | `#2563eb` |

### Cores de Status

| Estado | Background | Texto |
|---|---|---|
| Ok | `#dcfce7` | `#15803d` |
| Atenção | `#fff7ed` | `#c2410c` |
| Alerta | `#fee2e2` | `#b91c1c` |

### Cores de Batimentos

| Elemento | Hex |
|---|---|
| Coração (home) | `#e53935` |
| Barra normal | `#2563eb` |
| Barra alta | `#ef4444` |
| Barra baixa | `#f59e0b` |
| Banda ideal | `rgba(34,197,94,0.09)` |
| Valor em repouso | `#2563eb` |
| Tooltip bg | `#1e293b` |
| Tooltip valor | `#fbbf24` |

---

*Última atualização: 2026-06-16*
