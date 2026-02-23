
## Objetivo
Criar uma tela inicial exclusiva para mobile (rota `/`) com layout próprio, respeitando proporção de tela, mantendo os mesmos “blocos” do dashboard desktop, porém reorganizados para uso no celular:

- Carrossel com 3 slides: **Gráfico de presença**, **Distribuição por faixa etária**, **Membros mais frequentes**
- **Estatísticas principais** em pequenos blocos (dashboard), no topo (mas **rolando normal**, sem sticky)
- **Atalhos quadrados**: **Novo Membro** e **Nova Reunião**
- Blocos fixos: **Aniversariantes** e **Notas rápidas**

(Conforme sua resposta: não incluir “Próxima Reunião” e “Frequência Geral” no mobile; e atalhos apenas 2.)

---

## Exploração do que já existe (estado atual)
- `src/pages/Dashboard.tsx` hoje renderiza um layout “desktop” sempre (há comentário “Responsividade removida”).
- Widgets já existentes e reutilizáveis:
  - `StatsWidget` (exibe 4 stats em tamanhos `md/lg`, apenas 2 em `sm`)
  - `ReunioesChartWidget`, `FaixaEtariaWidget`, `TopMembrosWidget`, `AniversariantesWidget`, `NotasWidget`
- Carrossel já existe: `src/components/ui/carousel.tsx` (Embla)
- Mobile shell:
  - Header mobile “sticky” já existe no `AppLayout.tsx`
  - Dock inferior (`MobileBottomNav`) é fixa; precisamos garantir `padding-bottom` no conteúdo para não ficar escondido atrás da dock.

---

## Design do layout mobile (estrutura)
### 1) Contêiner / espaçamento geral
- No `Dashboard.tsx`, detectar mobile com `useIsMobile()`.
- Se for mobile:
  - Layout vira uma coluna vertical scrollável (`overflow-y-auto`).
  - Aplicar `pb-24` (ou equivalente) para não ficar escondido pela dock inferior.
  - Usar `px-3`/`px-4` e `space-y-3` para ritmo visual consistente.

### 2) Bloco de estatísticas (topo, rola normal)
- Meta: “bem organizadas em pequenos blocos”.
- Implementação:
  - Criar um “grid” 2x2 de cards pequenos (4 stats).
  - Existem duas opções:
    1) Reutilizar `StatsWidget` com `size="md"` e ajustar estilos de container para ficar mais “compacto” no mobile.
    2) Criar um novo componente **somente mobile** (ex.: `MobileStatsGrid`) que usa o mesmo conteúdo (total membros, reuniões, média, última) porém com cards menores e layout fixo 2x2.
  - Vou seguir a opção (2) para garantir o “tamanho de bloco” no mobile sem mexer no comportamento do desktop.

### 3) Atalhos quadrados (Novo Membro / Nova Reunião)
- Criar um bloco com 2 botões quadrados (grid 2 colunas).
- Cada botão:
  - Ícone grande, label curta, boa área de toque.
  - Navega para:
    - `/membros/novo`
    - `/reunioes/nova`
- Manter o estilo da UI atual (Tailwind + tokens de cor).

### 4) Carrossel (3 slides)
- Criar um card “Carrossel” com:
  - `Carousel`, `CarouselContent`, `CarouselItem`
  - 3 itens, cada um contendo um widget:
    - Slide 1: `ReunioesChartWidget` (provavelmente `size="md"` para ficar legível)
    - Slide 2: `FaixaEtariaWidget` (`size="md"`)
    - Slide 3: `TopMembrosWidget` (`size="md"`) com os controles já existentes (ordem/período)
- UX mobile:
  - Adicionar “dots” (indicadores de página) abaixo do carrossel para deixar claro que é arrastável.
  - Ajustar altura do slide para evitar “pulos” (definir um wrapper com altura consistente, ex.: `min-h-[260px]`/`h-[300px]` dependendo do resultado).
  - Opcional (recomendado): envolver cada slide com `ExpandableWidget` para abrir uma visualização maior com duplo toque (já existente e funciona bem no mobile).

### 5) Blocos fixos abaixo do carrossel
- `AniversariantesWidget` como bloco dedicado (provavelmente `size="md"` para listar pessoas).
- `NotasWidget` como bloco dedicado (provavelmente `size="md"`), preferencialmente dentro de `ExpandableWidget` para abrir maior quando necessário (mantendo consistência com desktop).

---

## Mudanças de código (o que será alterado)
1) **`src/pages/Dashboard.tsx`**
   - Reintroduzir responsividade:
     - `const isMobile = useIsMobile();`
     - `if (isMobile) return <MobileDashboard ... />; else return <DesktopDashboard ... />;`
   - Manter a mesma lógica de carregamento de dados (stats, frequência, notas, aniversariantes) para ambos layouts (evitar duplicar fetch).
   - Refatorar o JSX atual do “desktop” para um bloco/componente interno para manter legibilidade.

2) **Novo componente para layout mobile**
   - Criar um componente (por exemplo em `src/components/dashboard/MobileDashboardHome.tsx`) responsável apenas pelo layout mobile.
   - Props: `stats`, `frequenciaData`, `notas`, `aniversariantes`, handlers (`deletarNota`, toggles de top membros etc.).
   - Dentro dele:
     - Stats grid 2x2
     - Atalhos quadrados
     - Carrossel com 3 widgets
     - Aniversariantes e Notas

3) **Novo componente para “estatísticas compactas”**
   - Criar `src/components/dashboard/MobileStatsGrid.tsx` (ou similar) para renderizar 4 cards compactos.
   - Ele reutiliza o mesmo cálculo/formatting (dia/mês da última reunião) que hoje está no `StatsWidget` (vamos centralizar essa lógica de forma simples, ou duplicar de forma mínima e segura).

4) **Indicadores (dots) do carrossel**
   - Implementar um pequeno componente interno do mobile home que usa a `api` do `Carousel` (via `setApi`) para:
     - saber o `selectedScrollSnap()`
     - renderizar 3 dots
     - permitir tocar no dot e navegar para o slide

5) **Ajustes de espaçamento para dock inferior**
   - Garantir `pb-24` (ou maior) no contêiner mobile do dashboard.

---

## Critérios de aceitação (o que você vai ver no preview)
- No desktop/tablet (`>=768px`), a home continua como está hoje (layout 3 colunas).
- No mobile (`<768px`):
  1) Topo mostra 4 estatísticas em blocos pequenos (2x2).
  2) Em seguida, 2 atalhos quadrados: “Novo Membro” e “Nova Reunião”.
  3) Carrossel com 3 cards (arrastar para os lados) + dots indicando a página.
  4) Abaixo: bloco de Aniversariantes e bloco de Notas rápidas.
  5) Nada fica escondido pela barra inferior (dock).

---

## Riscos e cuidados
- **Altura dos widgets no carrossel**: alguns widgets podem variar altura conforme conteúdo. Vamos padronizar a altura do slide para ficar estável.
- **Interação do carrossel vs scroll vertical**: ajustar padding/margens e deixar o carrossel com área clara de arraste.
- **Performance no mobile**: o dashboard hoje faz várias queries; não vamos aumentar chamadas, apenas reorganizar UI.

---

## Testes (manual, rápido)
1) No preview, alternar para modo celular (ícone de dispositivo) e validar a rota `/`.
2) Arrastar o carrossel e verificar que os 3 widgets aparecem e os dots acompanham.
3) Tocar nos atalhos e confirmar navegação para:
   - `/membros/novo`
   - `/reunioes/nova`
4) Abrir Aniversariantes e Notas e confirmar que conteúdo aparece e rola bem.
5) Verificar que nada fica por trás da dock inferior (especialmente o último card).

---

## Sequência de implementação (ordem)
1) Refatorar `Dashboard.tsx` para separar “desktop layout” e “mobile layout” sem mexer na lógica de dados.
2) Implementar `MobileDashboardHome` com o layout solicitado.
3) Implementar `MobileStatsGrid`.
4) Implementar carrossel com dots e altura consistente.
5) Ajustar espaçamentos finais (safe-area/dock) e revisar aparência geral no mobile.

