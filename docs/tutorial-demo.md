# Capturas do tutorial

As imagens usadas pela Central de ajuda vêm de um ambiente de demonstração local, não da conta de produção. O ambiente não autentica usuários e os nomes, idades, datas, eventos, notas e e-mail exibidos são exemplos fictícios.

## Gerar novamente

Execute na raiz do projeto:

```bash
npm run capture:tutorial
```

O comando inicia um servidor Vite isolado em `127.0.0.1:8081` quando necessário e captura os 15 passos em duas resoluções fixas:

- Desktop: 1440 × 900
- Celular: 390 × 844

As imagens JPEG são gravadas em `output/playwright/tutorial/{desktop,mobile}` e copiadas para `public/tutorial/{desktop,mobile}`, onde a Central de ajuda as carrega. O roteiro cobre lista, cadastro e perfil de membros; reuniões e presenças; agenda, visitas e eventos; notas; perfil, notificações e instalação do aplicativo.

O modo de demonstração fica em `/tutorial-demo/:screen` somente durante o desenvolvimento. Em produção, essa rota redireciona para a página inicial.
