# Templates de e-mail do Supabase

Estes arquivos sao modelos prontos para colar no painel do Supabase.

## Onde aplicar

1. Abra o Supabase do projeto.
2. Va em **Authentication > Emails**.
3. Abra o template **Confirm signup**.
4. Cole o conteudo de `confirm-signup.html`.
5. Salve.
6. Abra o template **Reset password** ou **Recovery**.
7. Cole o conteudo de `reset-password.html`.
8. Salve.

## Assuntos sugeridos

Confirm signup:

```text
Confirme seu e-mail para acessar o Zelo
```

Reset password / Recovery:

```text
Redefina sua senha no Zelo
```

## Variaveis usadas

Os templates usam variaveis oficiais do Supabase:

- `{{ .ConfirmationURL }}` para o link de confirmacao ou recuperacao.
- `{{ .Email }}` para o e-mail do usuario.

O logo aponta para:

```text
https://zelo-mocidade.vercel.app/logo-zelo-transparent.png
```
