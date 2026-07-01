# Design System — Teep Saude

Referencia visual para todas as telas do sistema. Qualquer nova tela DEVE seguir esses tokens.

---

## 1. Paleta de Cores

### Fundo
| Uso | Cor | CSS Variable |
|-----|-----|--------------|
| App (root) | `#f1f5f9` | — |
| Home screen | `#f3f3f3` | — |
| Superficie suave | `#f8fafc` | `--surface-soft` |
| Superficie sutil | `#f1f5f9` | `--surface-subtle` |

### Cards
| Uso | Cor | CSS Variable |
|-----|-----|--------------|
| Fundo do card | `#ffffff` | `--surface-card` |
| Borda card | `1px solid #efefef` | `--border-card` |
| Borda suave | `1px solid #f1f1f1` | `--border-card-soft` |
| Borda leve | `#e2e8f0` | `--border-soft` |
| Borda forte | `#cbd5e1` | `--border-strong` |

### Texto
| Uso | Cor | CSS Variable |
|-----|-----|--------------|
| Titulo principal | `#0f172a` | `--text-title` |
| Corpo de texto | `#1e293b` | `--text-body` |
| Texto secundario | `#64748b` | `--text-muted` |
| Titulo cabecalho | `#1a2332` | — |

### Acento Principal
| Uso | Cor | CSS Variable |
|-----|-----|--------------|
| Primario (azul) | `#2563eb` | `--accent-primary` |
| Hover primario | `#1d4ed8` | `--wizard-accent` |

### Status / Badges
| Status | Cor Fundo | Cor Texto |
|--------|-----------|-----------|
| Bom / Verde | `#dcfce7` | `#15803d` |
| Atencao / Laranja | `#fef3c7` | `#b45309` |
| Alto / Ruim | `#ffe4e6` | `#b91c1c` |
| Neutro | `#e2e8f0` | `#475569` |

### Cores por Secao (icones)
| Secao | Cor Icone | Cor Fundo Icone |
|-------|-----------|-----------------|
| Gerais | `#3b82f6` | `#eff6ff` |
| Circunferencias | `#14b8a6` | `#f0fdfa` |
| Dobras | `#a855f7` | `#faf5ff` |

---

## 2. Tipografia

**Fonte principal:** Inter (Google Fonts)

| Elemento | Tamanho | Peso | Cor |
|----------|---------|------|-----|
| Titulo de pagina | 20px | 700 | `--text-title` |
| Titulo de secao | 18px | 700 | `#1a2332` |
| Nome do usuario | 19px | 700 | `#1a2332` |
| Titulo de card | 16px | 700 | `--text-title` |
| Subtitulo de card | 15px | 600 | `#64748b` |
| Valor grande (KPI) | 28-40px | 700 | `--text-title` |
| Unidade de valor | 17px | 600 | `#64748b` |
| Corpo de texto | 14px | 400-500 | `--text-body` |
| Texto pequeno | 13px | 500 | `--text-muted` |
| Badge / Label | 11-12px | 700 | varia |
| Rodape | 11px | 400 | `#cbd5e1` |

**NUNCA usar fontes serifadas (DM Serif Display, Georgia, etc.) nos cards e titulos.**
**NUNCA usar fontes alternativas (DM Sans, Space Grotesk, etc.) — apenas Inter.**

---

## 3. Espacamento e Layout

### Cards
| Propriedade | Valor | CSS Variable |
|-------------|-------|--------------|
| Border-radius | 16px | `--radius-card` |
| Padding interno | 14px | `--space-card-padding` |
| Gap entre cards | 10px | `--space-card-gap` |
| Sombra padrao | `0 2px 10px rgba(0,0,0,0.06)` | `--shadow-card` |
| Sombra hover | `0 4px 14px rgba(0,0,0,0.08)` | `--shadow-card-hover` |

### Botoes
| Tipo | Border-radius | Altura minima |
|------|---------------|---------------|
| Botao de acao | 10px | 40px |
| Botao sticky (CTA) | 12px | 46px |
| Botao inline | 10px | 36px |

### Cabecalho
| Propriedade | Valor |
|-------------|-------|
| Border-radius interno | 16px |
| Sombra | `0 8px 18px rgba(15,23,42,0.06)` |
| Avatar tamanho | 52x52px (circular) |

---

## 4. Componentes Padrao

### Card de Vital (Home)
```
.icone (cor por tipo)  +  titulo (16px/600/muted)
valor grande (40px/700/titulo)  +  unidade (17px/600/muted)
[badge de status]  +  barra de progresso
```
- Border-radius: 16px
- Sombra: `0 2px 8px rgba(0,0,0,0.07)`
- Borda: `1px solid #e8ecf0`
- Chevron a direita: `\203a` cor `#d1d5db`

### Card Generico
```
.titulo (15px/700/titulo)
.descricao (13px/muted)
```
- Usar variaveis `--surface-card`, `--shadow-card`, `--radius-card`

### Badges de Status
- Formato: pill (border-radius: 999px)
- Padding: `4px 10px`
- Fonte: 12-13px, peso 700
- Cores conforme tabela de status acima

### Titulos de Secao
- Usar classe `.section-title` (18px, 700, `#1a2332`)
- Subtitulo: `.section-subtitle` (13px, 500, `#94a3b8`)
- Margem superior: 28px (primeira secao), 12px (outras)

---

## 5. Animacoes

| Animacao | Duracao | Easing |
|----------|---------|--------|
| FadeSlideIn (lista) | 0.35s | ease |
| Stagger delay por item | 40ms | — |
| KpiCount (numeros) | 0.5s | cubic-bezier(0.34, 1.56, 0.64, 1) |
| Screen slide in | 0.3s | ease |

---

## 6. Regras Obrigatorias

1. **Sempre usar tokens CSS** (`--text-title`, `--surface-card`, etc.) — nunca hardcodar cores
2. **Sempre usar Inter** como fonte — nunca introduzir fontes novas
3. **Cards sempre brancos** com sombra sutil — nunca fundo colorido ou cream
4. **Acento principal: azul `#2563eb`** — nunca substituir por teal, roxo, etc.
5. **Border-radius: 16px** para cards, 10-12px para botoes
6. **Badges: pill format** com cores de status padronizadas
7. **Icones de secao:** manter as 3 cores (azul, teal, roxo) para Gerais/Circ/Dobras
8. **Animacoes:** usar stagger delay para listas, spring easing para numeros

---

## 7. Exemplo de Card Correto

```css
.meu-card {
  background: var(--surface-card);
  border: var(--border-card);
  border-radius: var(--radius-card);
  padding: var(--space-card-padding);
  box-shadow: var(--shadow-card);
}

.meu-card-titulo {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-title);
}

.meu-card-valor {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-title);
}

.meu-card-sub {
  font-size: 13px;
  color: var(--text-muted);
}
```

---

## 8. Arquivos de Referencia

| Arquivo | Conteudo |
|---------|----------|
| `docs/design-system.md` | Este arquivo — tokens e regras |
| `docs/guia-visual-mensuri.md` | Guia visual detalhado com screenshots |
| `styles.css` (linhas 19-46) | Variaveis CSS `:root` com todos os tokens |
