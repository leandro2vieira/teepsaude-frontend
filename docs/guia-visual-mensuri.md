# Guia Visual — Mensuri

> Referência de estilização para manter coesão visual entre todas as telas do app.  
> Use este arquivo como checklist ao criar ou alterar qualquer seção.

---

## 1. Design Tokens (CSS Variables)

```css
:root {
  /* Cores de superfície */
  --surface-card: #ffffff;
  --surface-soft: #f8fafc;
  --surface-subtle: #f1f5f9;

  /* Bordas */
  --border-soft: #e2e8f0;
  --border-strong: #cbd5e1;
  --border-card: 1px solid #efefef;
  --border-card-soft: 1px solid #f1f1f1;

  /* Tipografia */
  --text-title: #0f172a;
  --text-body: #1e293b;
  --text-muted: #64748b;

  /* Acento */
  --accent-primary: #2563eb;
  --wizard-accent: #2563eb;

  /* Cards */
  --radius-card: 16px;
  --shadow-card: 0 2px 10px rgba(0, 0, 0, 0.06);
  --shadow-card-hover: 0 4px 14px rgba(0, 0, 0, 0.08);
  --space-card-padding: 14px;
  --space-card-gap: 10px;
}
```

**Regra de ouro:** usar `var(--token)` sempre que possível. Evitar cores hardcoded.

---

## 2. Paleta de Cores

### Tons estruturais

| Token | Hex | Uso |
|---|---|---|
| `--text-title` | `#0f172a` | Títulos, KPIs, valores principais |
| `--text-body` | `#1e293b` | Corpo de texto, descrições |
| `--text-muted` | `#64748b` | Rótulos, datas, subtítulos, unidades |
| `--surface-card` | `#ffffff` | Fundo de cards |
| `--surface-soft` | `#f8fafc` | Fundo de seções, chips, inputs readonly |
| `--surface-subtle` | `#f1f5f9` | Backgrounds de tags/detalhes |
| `--border-soft` | `#e2e8f0` | Bordas de cards, inputs, listas |
| `--border-strong` | `#cbd5e1` | Bordas de estados ativos/foco |
| `--accent-primary` | `#2563eb` | Acento principal (botões, links, ícones ativos) |

### Cores de status (NÃO vêm de tokens — são fixas para leitura universal)

| Estado | Background | Texto | Borda | Ícone |
|---|---|---|---|---|
| **Ok / Bom** | `#f0fdf4` / `#dcfce7` | `#15803d` | `#bbf7d0` / `#86efac` | `#22c55e` |
| **Atenção** | `#fffbeb` / `#fef3c7` | `#b45309` / `#92400e` | `#fcd34d` / `#fde68a` | `#f59e0b` |
| **Alerta / Ruim** | `#fff7ed` / `#fee2e2` | `#b91c1c` / `#c2410c` / `#9a3412` | `#fda4af` / `#fdba74` | `#ef4444` / `#ea580c` |

### Cores de seção (detail views)

| Seção | Cor de acento (borda esquerda) |
|---|---|
| Geral | `#3b82f6` (azul) |
| Circunferências | `#14b8a6` (teal) |
| Dobras cutâneas | `#a855f7` (roxo) |

### Background global

```css
body {
  background: #f1f5f9;
}

.app-content:has(#homeScreen.active) {
  background: #f3f3f3;
}
```

---

## 3. Tipografia

### Família

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
```

**NUNCA usar Arial, Roboto puro, ou system fonts. Sempre Inter primeiro.**

### Hierarquia

| Nível | Exemplo | weight | size | letter-spacing | Uso |
|---|---|---|---|---|---|
| KPI gigante | `40px` | 700 | — | `-0.02em` | Números grandes nos cards da home |
| Título de seção | `18px` | 700–800 | — | normal | `.section-title`, `.corpo-av-section-title` |
| Título de card | `15–16px` | 700 | — | normal | `.card-title`, `.corpo-av-row-title` |
| Subtítulo | `13–14px` | 600 | — | normal | `.corpo-av-sub`, `.med-dosage` |
| Corpo | `14px` | 400–500 | `1.35` | normal | `.card-info`, descrições |
| Muted / data | `12–13px` | 500–600 | — | normal | `.corpo-av-row-date`, datas |
| Label / chip | `11–12px` | 700 | — | `0.03–0.08em` uppercase | `.corpo-av-kpi-label`, badges |
| Tab bar | `11px` | 600 | `1` | `-0.01em` | `.tabbar-label` |

### Pesos disponíveis da Inter

`400`, `500`, `600`, `700`, `800`

---

## 4. Cards — Padrão Base

```css
.card {
  background: var(--surface-card);      /* #ffffff */
  border-radius: var(--radius-card);     /* 16px */
  padding: var(--space-card-padding);    /* 14px */
  border: var(--border-card-soft);       /* 1px solid #f1f1f1 */
  box-shadow: var(--shadow-card);        /* 0 2px 10px rgba(0,0,0,0.06) */
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
```

### Interações

```css
.card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-card-hover);  /* 0 4px 14px rgba(0,0,0,0.08) */
}

.card:active {
  transform: scale(0.98);
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}
```

### Variações

| Tipo | Borda | Sombra | Uso |
|---|---|---|---|
| Card padrão | `1px solid #f1f1f1` | `0 2px 10px rgba(0,0,0,0.06)` | Cards genéricos |
| Home vital card | `1px solid #e8ecf0` | `0 2px 8px rgba(0,0,0,0.07)` | Cards de sinais vitais na home |
| Card com ação | + `padding-bottom: 42px` | padrão | Cards com botão "+" no canto |

### Cards com indicador de seção (detail view)

```css
.corpo-av-section--geral  { border-left: 3px solid #3b82f6; }
.corpo-av-section--circ   { border-left: 3px solid #14b8a6; }
.corpo-av-section--dobras { border-left: 3px solid #a855f7; }
```

---

## 5. Botões

### Primário (CTA principal)

```css
background: #2563eb;
color: #fff;
border: 1px solid #1d4ed8;
border-radius: 14px;
font-weight: 700;
box-shadow: 0 10px 24px rgba(37, 99, 235, 0.22);
/* hover: background: #1d4ed8; */
/* active: transform: scale(0.98); */
```

### Ação em card (ícone circular)

```css
width: 36px;
height: 36px;
border-radius: 50%;
border: 1px solid var(--border-soft);
background: #ffffff;
color: #94a3b8;
/* hover: background: #eff6ff; border-color: #93c5fd; color: #2563eb; */
```

### Ação secundária (outline)

```css
flex: 1;
border: 1px solid var(--border-soft);
border-radius: 6px;
background: white;
color: var(--text-body);
/* hover: background: #2563eb; color: white; border-color: #2563eb; */
```

### Voltar (detail view)

```css
width: 38px;
height: 38px;
border: 1px solid var(--border-soft);
background: #ffffff;
color: #334155;
border-radius: 12px;
/* hover: background: #f1f5f9; */
```

---

## 6. Ícones

- Usar SVGs inline com `stroke="currentColor"` e `fill="none"` sempre que possível
- A cor é herdada via `color:` no container
- Tamanhos comuns: `22px`, `16px`, `13px`
- Ícone de coração (saúde): `width:22px; height:22px` com `color: #2563eb`
- Background do ícone: `border-radius: 14px; background: #eff6ff`
- Ícones de status usam cores de status (verde, laranja, vermelho)

### Exemplo de container de ícone

```css
.corpo-av-head-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #eff6ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
```

---

## 7. Chips & Badges

### Badge de status (pill)

```css
font-size: 13px;
font-weight: 700;
padding: 5px 11px;
border-radius: 999px;
```

### Chip KPI inline

```css
font-size: 11px;
font-weight: 700;
padding: 3px 8px;
border-radius: 7px;
background: var(--surface-soft);
color: #475569;
border: 1px solid var(--border-soft);
```

### Chip de variação (evolução)

```css
font-size: 11px;
font-weight: 700;
padding: 3px 8px;
border-radius: 7px;
/* ↓ (redução): color: #15803d; bg: #f0fdf4; border: #bbf7d0 */
/* ↑ (aumento): color: #b45309; bg: #fffbeb; border: #fde68a */
```

---

## 8. Inputs

```css
.form-input {
  padding: 14px 16px;
  font-size: 18px;
  border-radius: 12px;
  border: 1.5px solid var(--border-soft);
  background: #ffffff;
  color: var(--text-title);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
  outline: none;
}

.form-input[readonly] {
  background: var(--surface-soft);
  color: #334155;
  cursor: default;
}
```

---

## 9. Lista com Timeline Visual

Usado na seção Corpo e pode ser reutilizado em outras listas cronológicas.

```css
/* Container da lista */
.corpo-av-list {
  position: relative;
}

/* Linha conectora vertical */
.corpo-av-list::before {
  content: '';
  position: absolute;
  left: 21px;
  top: 10px;
  bottom: 10px;
  width: 1.5px;
  background: linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 50%, #e2e8f0 100%);
  border-radius: 1px;
}

/* Row com espaço para dot */
.corpo-av-row {
  background: #ffffff;
  border: 1px solid #e8ecf0;
  border-radius: 16px;
  padding: 14px 14px 14px 40px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.18s;
}

/* Dot na timeline */
.corpo-av-row::before {
  content: '';
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #94a3b8;
  z-index: 1;
}

/* Hover: desloca 1px para cima (padrão do sistema) */
.corpo-av-row:hover {
  border-color: #cbd5e1;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

/* Dot no hover: azul com glow */
.corpo-av-row:hover::before {
  background: #eff6ff;
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}
```

---

## 10. KPIs com Barra de Progresso

```css
.corpo-av-kpi {
  border-radius: 16px;
  padding: 14px 12px 12px;
  border: 1px solid var(--border-soft);
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
}

.corpo-av-kpi-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.corpo-av-kpi-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-title);
}

.corpo-av-kpi-bar-wrap {
  height: 5px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.corpo-av-kpi-bar {
  height: 100%;
  border-radius: 999px;
  background: var(--accent-primary);
  transition: width 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.corpo-av-kpi-status {
  font-size: 12px;
  font-weight: 700;
  border-radius: 999px;
  padding: 4px 10px;
  color: #475569;
  background: #e2e8f0;
}
```

### Estados de KPI (aplicados via JS com `classList.add`)

| Classe | Background card | Borda | Background status | Cor status |
|---|---|---|---|---|
| `is-good` | `linear-gradient(#f7fef9, #f0fdf4)` | `#86efac` | `#dcfce7` | `#15803d` |
| `is-attention` | `linear-gradient(#fffdf5, #fffbeb)` | `#fcd34d` | `#fef3c7` | `#b45309` |
| `is-high` / `is-low` | `linear-gradient(#fff7f8, #fff1f2)` | `#fda4af` | `#ffe4e6` | `#b91c1c` |

---

## 11. Animações e Transições

### Troca de tela

```css
/* Entrada: slide up + fade */
@keyframes screenSlideIn {
  from { opacity: 0; transform: translateY(10px) scale(0.99); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
/* 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94) */

/* Saída: fade out */
@keyframes screenFadeOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
/* 0.22s ease */
```

### Transições em cards

| Gatilho | Propriedade | Duração | Easing |
|---|---|---|---|
| Hover | `transform`, `box-shadow` | 0.15s | ease |
| Active | `transform`, `box-shadow` | 0.08s | ease |
| Foco (input) | `border-color`, `box-shadow` | 0.2s | ease |

### Padrão geral de transição

```css
transition: background 0.15s, border-color 0.15s, transform 0.12s;
```

---

## 12. Layout — Container Mobile

```css
.mobile-container {
  width: 100%;
  max-width: 540px;
  height: 100vh;
  background: white;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px calc(72px + env(safe-area-inset-bottom) + 8px) 14px;
}

.screen {
  padding: 6px 4px;
}
```

---

## 13. Checklist de Coesão Visual

Ao criar/modificar uma tela, verifique:

- [ ] **Fonte**: Inter como primeira opção em todos os elementos?
- [ ] **Cores de texto**: `var(--text-title)` para títulos, `var(--text-muted)` para secundários?
- [ ] **Cores de fundo**: `#ffffff` / `var(--surface-card)` para cards, `var(--surface-soft)` para áreas secundárias?
- [ ] **Bordas**: `var(--border-soft)` (`#e2e8f0`) ou `#e8ecf0` (nunca cinzas quentes)?
- [ ] **Acento**: `#2563eb` para ações primárias, ícones ativos, links?
- [ ] **Sombras**: `rgba(0, 0, 0, 0.07)` (preto puro com opacidade, nunca tons quentes)?
- [ ] **Hover em cards**: `translateY(-1px)` (NÃO `translateX`)?
- [ ] **Active em cards**: `scale(0.98)`?
- [ ] **Border-radius**: `16px` para cards, `12-14px` para botões, `999px` para badges/chips?
- [ ] **Botão primário**: azul `#2563eb` com `box-shadow` azul (NÃO botão escuro)?
- [ ] **Cores de status**: usa a paleta universal verde/laranja/vermelho?
- [ ] **SVGs**: usam `currentColor` e herdam cor do container?
- [ ] **Usou `var(--token)`** em vez de cores hardcoded quando aplicável?
- [ ] **Espaçamento**: `gap: 10-14px` entre cards e seções?
- [ ] **Timeline**: dot cinza `#94a3b8`, hover azul `#2563eb` com glow, linha `#e2e8f0`?

---

## 14. Exemplos de Cores por Contexto

### Backgrounds

| Contexto | Cor |
|---|---|
| Card principal | `#ffffff` |
| Seção secundária dentro de card | `#f8fafc` (surface-soft) |
| Chip / tag inline | `#f8fafc` (surface-soft) |
| Ícone container | `#eff6ff` (azul muito claro) |
| Review / resumo | `#f8fafc` (surface-soft) |
| Input readonly | `#f8fafc` (surface-soft) |
| Background da página | `#f1f5f9` |
| Background da home | `#f3f3f3` |

### Textos

| Contexto | Cor |
|---|---|
| Título do card | `#0f172a` (text-title) |
| Valor KPI grande | `#0f172a` (text-title) |
| Nome de medicamento | `#1e293b` (text-body) |
| Rótulo / data / unidade | `#64748b` (text-muted) |
| Label de seção uppercase | `#64748b` (text-muted) |
| Texto muted extra | `#94a3b8` |

### Bordas

| Contexto | Cor |
|---|---|
| Card padrão | `#efefef` / `#f1f1f1` |
| Card com destaque | `#e8ecf0` |
| Input / select | `#e2e8f0` (border-soft) |
| Chip / tag | `#e2e8f0` (border-soft) |
| Separador entre rows | `#f1f5f9` (surface-subtle) |
| Ativo / foco | `#2563eb` |

---

## 15. Perfil — Hero + Config Items

### Hero (avatar, nome, dados pessoais)

```css
.perfil-hero {
  background: var(--surface-card);
  border-radius: var(--radius-card);
  padding: 24px 20px 20px;
  border: 1px solid #e8ecf0;
  box-shadow: var(--shadow-card);
}

.perfil-hero-avatar--initials {
  background: #eff6ff;
  color: #2563eb;
  /* 80px circle, 26px font, weight 700 */
}

.perfil-hero-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-title);
}

.perfil-hero-meta {
  font-size: 14px;
  color: var(--text-muted);
}

/* Dados (email, CPF, telefone) */
.perfil-hero-dados {
  background: var(--surface-soft);
  border: 1px solid var(--border-soft);
  border-radius: 12px;
}

.perfil-dado-lbl {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}

.perfil-dado-val {
  font-size: 14px;
  color: var(--text-body);
}
```

### Config Items (cards de navegação)

```css
.config-item {
  background: var(--surface-card);
  border-radius: var(--radius-card);     /* 16px */
  padding: 14px 16px;
  border: var(--border-card);
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.config-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-card-hover);
}

.config-item:active {
  transform: scale(0.98);
}
```

### Ícone de config item

```css
.config-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #eff6ff;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.config-icon svg {
  width: 20px;
  height: 20px;
}
```

**Variações de cor** (aplicar via classe adicional):

| Classe | Background | Cor |
|---|---|---|
| (padrão) | `#eff6ff` | `#2563eb` |
| `config-icon--bell` | `#eff6ff` | `#3b82f6` |
| `config-icon--purple` | `#f3e8ff` | `#7c3aed` |
| `config-icon--red` | `#fef2f2` | `#ef4444` |
| `config-icon--amber` | `#fefce8` | `#d97706` |

### Chevron de navegação

Usar SVG inline (`polyline points="9 18 15 12 9 6"`), NÃO caractere `▶`:

```html
<span class="config-chevron">
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
</span>
```

Para estado aberto: adicionar classe `config-chevron--open` (rotate 90deg).

### Toggle switch

```css
.toggle {
  width: 50px;
  height: 28px;
  background: var(--border-soft);
  border-radius: 14px;
  transition: background 0.25s ease;
}

.toggle.active {
  background: #2563eb;
}

.toggle::after {
  /* knob: 24px white circle, transitions left from 2px to 24px */
}
```

### Item danger (ex: sair da conta)

```css
.config-item--danger {
  border: 1px solid #fecaca;
}

.config-item--danger .config-title {
  color: #ef4444;
}
```

### Título de seção muted (ex: "Demo")

```css
.perfil-section-title--muted {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

---

## 16. Regras Obrigatórias

1. **Sempre usar tokens CSS** (`--text-title`, `--surface-card`, etc.) — nunca hardcodar cores
2. **Sempre usar Inter** como fonte — nunca introduzir fontes novas
3. **Cards sempre brancos** com sombra sutil — nunca fundo colorido ou cream
4. **Acento principal: azul `#2563eb`** — nunca substituir por teal, roxo, etc.
5. **Border-radius: 16px** para cards, 10-12px para botões
6. **Badges: pill format** com cores de status padronizadas
7. **Icones de seção:** manter as 3 cores (azul, teal, roxo) para Gerais/Circ/Dobras
8. **Animações:** usar stagger delay para listas, spring easing para números

---

## 17. Padrão Card-per-Section — Telas de Detalhe

Cada seção de informação na view de detalhe é um **card independente** com:

```css
.meu-componente-card {
  background: #ffffff;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  border: var(--border-card-soft);
  padding: 14px 14px 10px;
  margin-bottom: 12px;
}
```

### Estrutura HTML esperada

```
vitalDetailDefaultChrome          ← contém gráfico + controles de período
  └── div.hidra-card              ← Card 1: progresso/resumo
  └── div.hidra-card--list        ← Card 2: lista de registros
```

O `#vitalDetailContent` fica `display: none` para esse tipo de tela. Os cards são inseridos via JS dentro do `vitalDetailDefaultChrome`.

### Implementação no JS (padrão)

```js
// Esconder vitalDetailContent
document.getElementById('vitalDetailContent').style.display = 'none';

// Criar container dos cards
var _chromeEl = document.getElementById('vitalDetailDefaultChrome');
var _existingCards = document.getElementById('meuContainerCards');
if (_existingCards) _existingCards.remove();
var _cardsDiv = document.createElement('div');
_cardsDiv.id = 'meuContainerCards';
_cardsDiv.innerHTML =
  '<div class="meu-componente-card">' + resumoHtml + '</div>' +
  '<div class="meu-componente-card">' + listaHtml + '</div>';
_chromeEl.appendChild(_cardsDiv);
```

### Cleanup ao abrir outro vital

```js
var _existingCards = document.getElementById('meuContainerCards');
if (_existingCards) _existingCards.remove();
```

### Exemplo vivo

- **Hidratação**: `components.js` → `buildHidraDetailPanel()` retorna HTML do resumo; `app.js` renderiza os dois cards dentro de `vitalDetailDefaultChrome`; `styles.css` → `.hidra-card` com o padrão acima.

---

## 18. Arquivos de Referência

| Arquivo | Conteúdo |
|---------|----------|
| `docs/guia-visual-mensuri.md` | Este arquivo — guia visual completo (tokens, cores, componentes, padrões) |
| `docs/refs-visuais-home-batimentos.md` | Specs específicas das telas Home e Batimentos (gráficos, day picker, etc.) |
| `styles.css` (linhas 19-46) | Variáveis CSS `:root` com todos os tokens |

---

*Última atualização: 2026-07-02 — mesclados design-system.md e padrao-card-detail.md neste guia.*
