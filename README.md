# Freebuff

Acompanhamento pessoal: **objetivos → registro → comparação → aprendizado**.

Uma ferramenta simples para responder três perguntas ao longo do tempo:

> O que eu quero fazer? · O que eu realmente fiz? · O que estou aprendendo sobre mim?

Sem cadastro, sem login e sem vira-casaca de produtividade: você define objetivos com tempo desejado, registra em segundos o que realmente fez (inclusive atividades fora dos objetivos), e a IA interpreta os dados — com base no seu **contexto pessoal** — em avaliações diárias, semanais, mensais e de períodos personalizados.

## Stack

- **React 19 + Vite + TypeScript** — frontend modular e mobile-first
- **Convex** — banco e backend (funções tipadas, sem servidor próprio)
- **Groq** — camada de IA; a chave fica **somente no navegador** (IndexedDB), nunca é enviada ao Convex
- **CSS próprio com design tokens** — dois temas (claro/escuro), sem bibliotecas de UI
- Testes unitários com **Vitest** para a camada de cálculos e validadores de IA

## Como rodar

Pré-requisitos: Node 20+.

```bash
npm install

# 1. Backend Convex (gera os tipos em convex/_generated e sobe o banco local)
npx convex dev

# 2. Frontend
npm run dev
```

Abra o endereço indicado pelo Vite. Na primeira execução, o `convex dev` pode pedir login — o backend também funciona em deployment local, sem conta.

### Uso da IA

Sem uma chave, a aplicação funciona 100% (objetivos, registros, histórico, relatórios e memórias). Para avaliações e o Assistente:

1. Crie uma chave gratuita em **console.groq.com**.
2. Em **Configurações → IA**, cole a chave (fica neste navegador, mascarada) e escolha o modelo.
3. Em cada tela de avaliação, toque em **Gerar análise**.

## Estrutura

```text
convex/                  Backend (schema, validação, queries e mutations por domínio)
src/
├── app/                 Providers (instalação, prefs de tema/modelo) + App/rotas
├── components/          UI compartilhada (Button, Sheet, Field, Icon, GoalRow…)
├── features/
│   ├── objectives/      Objetivos (criar, editar, ativar/desativar)
│   ├── records/         Registro rápido (formulário + edição/exclusão)
│   ├── day/             Tela unificada de dia — “Hoje” e /dia/AAAA-MM-DD
│   ├── history/         Histórico por mês
│   ├── reports/         Relatórios e comparação entre períodos
│   ├── memory/          Contexto pessoal (memórias)
│   ├── ai/              Zonas de avaliação da IA
│   ├── assistant/       Conversa livre com a IA
│   └── settings/        Configurações (chave, modelo, tema, dados)
├── hooks/               Hooks de dados (queries Convex)
├── services/
│   ├── ai/              Camada isolada da IA (chamada, prompts, validação)
│   └── keyStore.ts      Chave da API em IndexedDB (único ponto de acesso)
├── lib/                 Lógica pura: datas, formatação, cálculos, router
├── types/               Tipos de domínio
└── styles/              Tokens + base + componentes + telas
```

## Conceitos centrais

- **Sem autenticação:** cada navegador gera um `installationId` local que separa os dados no Convex. Exporte backups em **Configurações → Dados** para portabilidade.
- **Objetivo × realizado:** a comparação usa sempre minutos relacionados a objetivos; atividades fora dos objetivos aparecem separadas (nos registros e relatórios) e nunca inflam o percentual de realização.
- **Histórico preservado:** desativar um objetivo não apaga registros antigos — cada dia mostra os objetivos que existiam naquele momento.
- **Memória:** memórias **declaradas** (informadas por você) e **observadas** (padrões que a IA sugere) têm estados internos (ativa / possivelmente desatualizada / arquivada) e nível de confiança; você sempre pode editar, fixar ou excluir.
- **A IA interpreta, não calcula:** todos os números são derivados localmente por funções puras testadas; a IA recebe dados estruturados e devolve respostas validadas.

## Scripts

| Comando           | Descrição                              |
| ----------------- | -------------------------------------- |
| `npm run dev`     | Frontend em desenvolvimento            |
| `npm run typecheck` | Checagem de tipos (tsc --noEmit)     |
| `npm test`        | Testes unitários (cálculos + validadores) |
| `npm run build`   | Typecheck + build de produção          |
| `npx convex dev`  | Backend Convex local                   |
