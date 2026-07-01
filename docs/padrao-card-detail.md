# Padrão Card-per-Section — Telas de Detalhe

Referência visual: **Batimento Cardíaco** (detail modal).

## Regra

Cada seção de informação na view de detalhe é um **card independente** com:
- `background: #ffffff`
- `border-radius: var(--radius-card)`
- `box-shadow: var(--shadow-card)`
- `border: var(--border-card-soft)`
- `padding: 14px 14px 10px`
- `margin-bottom: 12px`

## Estrutura HTML esperada

```
vitalDetailDefaultChrome          ← contém gráfico + controles de período
  └── div.hidra-card              ← Card 1: progresso/resumo
  └── div.hidra-card--list        ← Card 2: lista de registros
```

O `#vitalDetailContent` fica `display: none` para esse tipo de tela. Os cards são inseridos via JS dentro do `vitalDetailDefaultChrome`.

## CSS base (copiar para novas telas)

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

## Implementação no JS (padrão)

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

## Cleanup ao abrir outro vital

```js
var _existingCards = document.getElementById('meuContainerCards');
if (_existingCards) _existingCards.remove();
```

## Exemplo vivo: Hidratação

- `components.js` → `buildHidraDetailPanel()` retorna HTML do resumo
- `app.js` → renderiza os dois cards dentro de `vitalDetailDefaultChrome`
- `styles.css` → `.hidra-card` com o padrão acima
