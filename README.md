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

## Ativar notificações push

O projeto já inclui o service worker, o armazenamento de dispositivos, a fila
de envio, a tela de preferências e a Edge Function. Para receber notificações
com o app fechado, conclua a configuração abaixo no ambiente publicado.

### 1. Pré-requisitos

- O app publicado em um domínio HTTPS. Push não funciona em HTTP (exceto
  `localhost`).
- Acesso de administrador ao projeto Supabase conectado ao app.
- A dependência Supabase CLI deste projeto e autenticação em uma conta com
  permissão administrativa no Supabase.

No Windows, o script deste repositório gera as chaves VAPID e mantém toda a
configuração (incluindo chave privada e segredo de despacho) criptografada por
DPAPI para a conta Windows atual. O arquivo fica em `.secrets/`, já ignorado
pelo Git e só pode ser aberto pela mesma conta Windows neste computador.

### 2. Preparar as chaves e o deploy

Abra PowerShell na pasta do projeto. A referência do Supabase costuma estar no
`.env` como `VITE_SUPABASE_PROJECT_ID`; o script tenta detectá-la. Primeiro,
gere as chaves sem enviar nada ao Supabase:

```powershell
./scripts/setup-web-push.ps1
```

Autentique a CLI na conta Supabase correta e rode:

```powershell
npm exec supabase -- login
./scripts/setup-web-push.ps1 -Deploy
```

Se a referência do projeto não for detectada, informe-a explicitamente:

```powershell
npm exec supabase -- login
./scripts/setup-web-push.ps1 -ProjectRef "sua-referencia" -Deploy
```

O modo `-Deploy` vincula o diretório ao projeto, envia `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` e `PUSH_DISPATCH_SECRET` como secrets da
Edge Function, habilita `pg_cron`, `pg_net` e Vault, aplica somente a migration
de notificações, grava os secrets de despacho no Vault, agenda os dois jobs e
implanta `send-web-push`. Ele não imprime as chaves. A privada fica apenas nos
secrets Supabase e no arquivo local protegido; nunca a coloque em `VITE_*`, no
frontend ou no Git. A migration é aplicada diretamente para não tentar
reconciliar versões históricas de outros recursos.

O script usa a configuração `verify_jwt = false` porque a mesma função aceita chamadas autenticadas
do app e uma chamada agendada autenticada pelo segredo dedicado. A função valida
JWT nas ações de inscrição e envio feitas pelo app; o worker agendado valida
`PUSH_DISPATCH_SECRET`.

### 3. Conferir o envio agendado

O script `-Deploy` cria os secrets e agenda ambos os jobs. No Dashboard
Supabase, confira em **Integrations → Cron** (ou na tabela `cron.job`) se
`zelo-dispatch-notification-push` está ativo a cada minuto e
`zelo-generate-daily-birthdays` está ativo para 09:00 de São Paulo (12:00 UTC).
O primeiro job já processa a fila de push. O job de aniversários executa a
partir do próximo horário agendado.

Se algum dos jobs não aparecer ativo, execute novamente
`./scripts/setup-web-push.ps1 -Deploy`. O script habilita as extensões, atualiza
os secrets e recria os jobs de forma idempotente.

### 4. Habilitar no dispositivo

1. Publique a versão atualizada do app e abra-a no telefone pelo domínio HTTPS.
2. Entre na conta e abra **Configurações → Notificações**.
3. Ative **Ativar notificações**. Se ainda não estiver inscrito, toque em
   **Ativar neste dispositivo** e escolha **Permitir** no navegador.
4. Ative ou desative as categorias desejadas: aniversariantes, notas,
   mensagens no chat, solicitações de grupo, eventos e acompanhamento de presença.
5. Toque em **Enviar notificação de teste** e confira a central de notificações
   do telefone. Ao tocar no aviso, o Zelo abre a central de notificações interna.

Quando `-Deploy` termina, o servidor está configurado. Ainda é necessário
publicar o frontend deste checkout para que o telefone receba a tela de
preferências, o botão de inscrição e o service worker atualizado.

O prompt de permissão só pode ser mostrado após uma ação do usuário; por isso,
a inscrição começa ao ativar o toggle. Se a permissão já foi negada, altere-a
nas configurações do navegador/site e tente novamente.

No iPhone/iPad, use uma versão recente do iOS, escolha **Compartilhar → Adicionar
à Tela de Início**, abra o Zelo pelo ícone instalado e habilite notificações
quando solicitado. O suporte depende do iOS e do modo instalado como app web.
Android/Chrome normalmente permite instalar o app ou habilitar notificações
nas configurações do site.

### 5. Onde configurar e resolver problemas

- A central in-app continua disponível mesmo sem permissão push.
- Para interromper push, desative **Ativar notificações** no app. Para impedir
  apenas uma categoria, desligue o toggle correspondente.
- Se o app informar que VAPID não está configurado, confira os secrets em
  **Edge Functions → Secrets** e implante novamente a função.
- Se a inscrição falhar, confirme HTTPS, permissão do site, service worker ativo
  e que `send-web-push` foi implantada no projeto correto.
- Se o app receber notificações apenas enquanto está aberto, confirme que o
  dispositivo aparece inscrito, que o job Cron está ativo e que as últimas
  execuções conseguem chamar a Edge Function.
- Se uma chave VAPID for perdida, o arquivo DPAPI não puder ser aberto em outra
  conta Windows ou as chaves forem rotacionadas, rode novamente o script após
  guardar/remover os arquivos em `.secrets/`; usuários precisarão renovar a
  inscrição no dispositivo após rotação.

## Usar o Zelo no celular e atualizar o app

A versão atual foi classificada como **1.0.0 Estável**. O número fica em
`package.json` e a tela **Configurações → Notificações** exibe também o
identificador do build (o commit do Vercel, quando disponível). Para próximas
versões, atualize o número seguindo o formato `MAJOR.MINOR.PATCH` e publique o
frontend no Vercel.

Em um navegador de computador, usuários autenticados recebem um convite para
abrir o Zelo no celular por QR code. O convite pode ser adiado e reaparece após
sete dias; ele também pode ser reaberto em **Configurações → Notificações → Usar
no celular**. O QR abre o mesmo domínio do app. No celular, entre na conta e, se
quiser, use a opção do navegador para adicionar o site à tela inicial. O app
continua disponível no computador e em qualquer navegador compatível.

O app verifica atualizações ao abrir, ao voltar para a aba e depois a cada hora.
Quando uma nova versão do service worker estiver pronta, mostra um aviso com a
opção **Atualizar agora**. A central de notificações também permite verificar e
aplicar a atualização manualmente. A página só recarrega após a ação do usuário.
