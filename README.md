# Zelo

Aplicativo de gestão para grupos de mocidade, com membros, reuniões, calendário,
visitas, notas, estatísticas e suporte offline para consulta.

## Requisitos

- Node.js 20 ou superior
- npm
- Projeto Supabase configurado

## Desenvolvimento local

```sh
npm install
npm run dev
```

O servidor de desenvolvimento utiliza `http://127.0.0.1:8080`.

## Verificações

```sh
npm run typecheck
npm test
npm run build
```

## Variáveis do frontend

Crie um arquivo `.env.local` com as credenciais públicas do Supabase:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

## Funções de IA opcionais

As funções `spell-check` e `ai-assistant` aceitam qualquer provedor compatível
com o formato Chat Completions. Configure os secrets no Supabase:

```env
AI_API_KEY=
AI_API_URL=
AI_MODEL=
```

O projeto não depende de serviços ou ferramentas do Lovable.
