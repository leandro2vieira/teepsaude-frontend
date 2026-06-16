# Mensuri - Projeto Overview

## O que é
Aplicativo web de saúde em pt-BR, SPA estática (sem backend). Protótipo de UX/produto para gestão de saúde do paciente.

## Stack
- HTML5, CSS3, JavaScript vanilla (sem transpilação)
- Framework7 (vendored em `vendor/framework7/`)
- Fonte: Google Fonts Inter (400-800)
- Canvas para gráficos de sinais vitais

## Estrutura
```
index.html      → Shell da SPA (~1700 linhas, 6 telas + modais)
app.js          → Lógica principal (~12500 linhas)
components.js   → Componentes UI reutilizáveis (~1288 linhas)
data.js         → Dados mock (~1400 linhas)
styles.css      → Design system CSS (~12548 linhas)
vendor/framework7/ → Framework7 bundle minificado
docs/guia-visual-mensuri.md → Guia visual/design tokens
```

## Telas
1. **Início** → Dashboard: alertas de medicação, sinais vitais principais, próxima consulta
2. **Saúde** → 12 tipos de sinais vitais, gráficos sparkline, drill-down
3. **Corpo** → Avaliações antropométricas, composição corporal
4. **Remédios** → Gestão de medicações, estoque, adesão, alertas
5. **Agenda** → Consultas e exames com lembretes
6. **Perfil** → Dados pessoais, dispositivos, compartilhamento

## Funcionalidades-chave
- Wizard de glicose (7 etapas) e pressão arterial (5 etapas)
- Hidratação e oxigenação com input rápido
- Gráficos Canvas (sparklines, barras, distribuição horária)
- Sistema de alarmes para medicação e limiares de sinais vitais
- Compartilhamento com médicos
- 30 medicações no catálogo mock

## Como rodar
```bash
python -m http.server 8080
# Acessar http://localhost:8080
```

## Dados
100% mock/in-memory. Não há backend, API ou banco de dados.

## Notas
- Projeto teve problemas de encoding pt-BR (scripts de fix em `fix_*.mjs` e `fix_*.py`)
- Playwright como dependência (sem testes implementados)
- Design tokens e guia visual em `docs/guia-visual-mensuri.md`
- **Referências visuais da Home e Batimentos** em `docs/refs-visuais-home-batimentos.md`
