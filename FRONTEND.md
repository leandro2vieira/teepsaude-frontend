# Preferências de Frontend — Teep Saúde

## Stack
- **Framework**: Vanilla JS + Framework7 (CSS bundle apenas)
- **Sem React/Vue/Angular**: JS imperativo com funções globais
- **CSS puro**: sem pré-processador (CSS custom properties para tokens)

## Layout Geral
- Container mobile: `max-width: 540px`, centralizado, altura total da viewport
- Background externo: `#f1f5f9` (slate-100)
- Background interno (app content na home): `#f3f3f3`
- App content padding: `14px` laterais, `72px + safe-area` inferior (tabbar)
- Header arredondado (`.navbar.header`): `border-radius: 16px`, `box-shadow` suave, fundo branco

## Tipografia
- Fonte: **Inter** (Google Fonts) — pesos: 400, 500, 600, 700, 800
- Fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif`
- Tamanho base: `18px` (body), mas componentes usam `14-16px`
- Títulos de card: `15px`, bold (700)
- Números grandes (sinais vitais): `40px`, bold (700), `letter-spacing: -0.02em`
- Títulos de seção: `18px`, bold (700)
- Subtítulos: `13-14px`, cor `#94a3b8` (slate-400)
- Texto mutado: `#64748b` (slate-500)
- Texto corpo: `#1e293b` (slate-800)
- Títulos fortes: `#0f172a` (slate-900) ou `#1a2332`

## Cores (Design Tokens)
```css
--surface-card: #ffffff;
--radius-card: 16px;
--shadow-card: 0 2px 10px rgba(0, 0, 0, 0.06);
--shadow-card-hover: 0 4px 14px rgba(0, 0, 0, 0.08);
--border-card: 1px solid #efefef;
--border-card-soft: 1px solid #f1f1f1;
--space-card-padding: 14px;
--space-card-gap: 10px;
--text-title: #0f172a;
--text-body: #1e293b;
--text-muted: #64748b;
--surface-soft: #f8fafc;
--surface-subtle: #f1f5f9;
--border-soft: #e2e8f0;
--border-strong: #cbd5e1;
--accent-primary: #2563eb;
```

### Cores Semânticas por Tipo de Sinal
- Batimento cardíaco: `#ef4444` (red-500) — ícone
- Pressão arterial: `#f59e0b` (amber-500) — ícone
- Passos: `#22c55e` (green-500) — ícone
- Glicemia: semáforo: verde `<99`, amarelo `100-125`, vermelho `>125`
- Oxigenação: verde `>=95`, amarelo `90-94`, vermelho `<90`

### Status Badges (semáforo)
- **Verde** (normal): bg `#dcfce7`, text `#15803d`
- **Laranja** (atenção): bg `#fff7ed`, text `#c2410c`
- **Vermelho** (crítico): bg `#fee2e2`, text `#b91c1c`

## Cards
- `.card` — base com `border-radius: 16px`, `padding: 14px`, `border: 1px solid #f1f1f1`, `box-shadow` suave
- Hover: `translateY(-1px)` + shadow intensify
- Active/press: `scale(0.98)` com transição rápida (`0.08s`)
- Cards na home (`.home-vital-card`): padding `16px 36px 16px 16px`, borda `#e8ecf0`, sombra mais forte
- Cards de consulta: `border-radius: 14px`, padding `14px 16px`

### Estrutura típica de card de sinal vital (home)
```html
<div class="card card-saude vital-card vital-card--tipo home-vital-card" onclick="openVitalDetailModal('Tipo', id)">
  <div class="vital-batimento-home-row">
    <div class="vital-batimento-home-left">
      <div class="vital-batimento-top-left">
        <span class="vital-icon">[SVG icon]</span>
        <span class="vital-batimento-title">Nome</span>
      </div>
      <div class="vital-batimento-value-row">
        <span class="vital-batimento-num">valor</span>
        <span class="vital-batimento-unit">unidade</span>
      </div>
    </div>
    <div class="vital-batimento-home-right">
      <span class="vital-home-badge badge--green">range</span>
      <div class="vital-bat-progress-wrap">[bar]</div>
    </div>
  </div>
</div>
```

## Navegação Inferior (Tabbar)
- Toolbar fixa no bottom, `height: 60px`, bg branco, sombra superior
- 6 abas: Início, Saúde, Corpo, Remédios, Agenda, Perfil
- Ícones SVG inline (22x22), stroke-width 2, cor inativa `#94a3b8`, ativa `#2563eb`
- Label: `11px`, bold (600), Inter
- Indicador ativo: pontinho `4px` abaixo do ícone, cor `#2563eb`
- Transição: `color 0.18s ease`

## Animações
- **Entrada de tela**: `screenSlideIn` — `0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)`, fade + translateY(10px) + scale(0.99)
- **Saída de tela**: `screenFadeOut` — `0.22s ease`, fade out
- **Cards hover**: `transform 0.15s ease`, `box-shadow 0.15s ease`
- **Cards active**: `transform 0.08s ease`, `box-shadow 0.08s ease`
- **Botões/ícones active**: `scale(0.95-0.98)` com transição rápida

## Gráficos (Canvas)
- Todos os gráficos são **canvas HTML5 puro** (sem Chart.js ou libraries)
- Funções globais de renderização, ex: `renderSparklineChart()`, `renderPassosHourlyCanvas()`
- Padrão: limpar canvas, desenhar fundo, grade, dados, labels
- Tooltips em HTML (div posicionada absolutamente sobre o canvas), mostrados/escondidos via `mousemove`/`mouseleave`
- Gráficos de barra: barras com `roundRect` (com fallback para `fillRect`)
- Gráficos de linha: `beginPath`, `moveTo`, `lineTo`, `stroke`
- Touch support: eventos `touchstart`, `touchmove`, `touchend` para interação nos gráficos

### Tooltips nos Gráficos
- Div oculta (`style="display:none"`) posicionada sobre o canvas
- Atualizada e mostrada no `mousemove`, escondida no `mouseleave`
- Conteúdo: HTML inline com valor, data, status
- Estilo: fundo escuro `rgba(0,0,0,0.8)`, texto branco, `border-radius: 8px`, padding `8px 12px`, `font-size: 13px`
- Posicionamento calculado com `canvas.getBoundingClientRect()`

## Modais
- `<div class="modal">` — fixed fullscreen overlay com `rgba(0,0,0,0.5)`
- `.modal.active` → `display: flex`
- `.modal-content`: bg branco, `border-radius: 20px`, `max-width: 420px`, `width: 92%`, `max-height: 88vh`
- Header do modal: padding `16px 20px 14px`, `border-bottom: 1px solid #f1f5f9`
- Botão de fechar: círculo `36px` com fundo `#f1f5f9`, ícone ✕ via `::after`
- Z-index: modais normais `1000`, aninhados sobem (`1100`, `1300`)

## Formulários
- `.form-group` — margin-bottom `16px`
- `.form-label` — `16px`, bold (600), `#1e293b`
- `.form-input` — `width: 100%`, border-radius `10px`, `border: 1px solid #e2e8f0`, padding `12px 14px`, `font-size: 18px`
- Inputs de data: input type="date" nativo ou text com máscara `DD/MM/AAAA`

## Componentes Drum (Roda de Seleção)
- Usado para: pressão arterial (SIS/DIA), glicemia, insulina, frequência cardíaca
- Touch events: `touchstart`, `touchmove`, `touchend`
- Mouse wheel: `onwheel`
- Estrutura: `.pi-drum` > `.pi-drum-track` (lista de números) + `.pi-drum-sel` (indicador) + fade top/bot
- Input oculto sobreposto para digitação direta (`onblur`)
- Funções globais: `piDrumTouchStart`, `piDrumTouchMove`, `piDrumTouchEnd`, `piDrumWheel`, `piDcInputBlur`

## Wizard (Passo a Passo)
- Indicador de progresso: dots (`.pi-progress-dot`) com estados `--active` e `.done`
- Steps ocultos via `display:none`, ativados via JS
- Botão "Próximo" com `opacity: 0.35` + `pointer-events:none` quando bloqueado
- Botão "Pular" opcional
- Resumo final com linhas editáveis (`.pi-sum-row` com botão "Editar")
- Exemplos: inserção de glicemia (7 etapas), inserção de pressão (5 etapas)

## Iconografia
- **SVG inline** em todos os lugares (não usa biblioteca de ícones)
- Tamanhos comuns: `18x18`, `20x20`, `22x22`, `24x24`
- Stroke-width: `1.75`, `2`, `2.2`, `2.5` (mais grossos para ícones pequenos)
- Atributos padrão: `fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"`
- Mapa de ícones por tipo de sinal em `components.js:65-91` (função `getVitalIconSvg`)

## Tabela de Estilos por Tela

### Início (homeScreen)
- Status card: `border-radius: 999px`, fundo verde ou laranja
- Vitals em sequência vertical com fade-out no final (`#homeVitals::after`)
- Seção "Próxima Consulta": card horizontal com ícone calendário azul

### Saúde (saudeScreen)
- Subtítulo: `#5f6773`, `font-weight: 600`, `font-size: 15px`

### Medicações (medicacoesScreen)
- Calendário unified: 3 segmentos (Calendário, Agenda, Atraso)
- Chip buttons: `.med-chip-btn` com variante `.med-chip-btn-secondary`
- Card horizontal com foto (`.card-medicacao-com-foto`): foto `64x64`, `border-radius: 12px`

### Composição Corporal (composicaoScreen)
- KPI grid: 2 colunas (massa gorda/magra)
- Seções: Gerais, Circunferências, Dobras (cada uma com SVG icon)
- Wizard de nova avaliação com progress bar

### Perfil (perfilScreen)
- Hero: avatar `80px` circular, nome, meta
- Dados em grid: `grid-template-columns: 70px 1fr auto`
- Config items: `border-radius: 14px`, `box-shadow` suave

## Toast / Feedback
- `.system-toast` — fixed bottom, slide up, auto-hide após 2.2s
- `showFeedbackModal()` — modal com ícone + título + mensagem, tipos: `success`, `warning`, `error`, `info`

## Convenções de Código
- **Funções globais**: todas no escopo `window` (sem módulos)
- **IDs de elementos**: usados extensivamente como seletores
- **Variáveis de estado**: globais (`let`) no início de `app.js`
- **Dados**: objeto global `mockData` em `data.js`
- **Formatação de data**: funções `dateToLocalISODate`, `formatDateForUI`, `formatISODateBR`
- **Índices de hora**: 0-23
- **Datas**: sempre ISO `YYYY-MM-DD` internamente

## Padrão de Imagens
- Fotos de medicamento: apenas base64 (`data:image/...`)
- Logo: `assets/img/DrFazSaude.png`
- Foto de perfil: `assets/img/Foto_Paciente.jpeg`
- Placeholder de foto: SVG com ícone de câmera + label "Imagem"
