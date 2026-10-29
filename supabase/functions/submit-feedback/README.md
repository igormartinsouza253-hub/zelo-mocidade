# Feedback por e-mail

`submit-feedback` always saves feedback to `public.user_feedback` and sends an in-app notification to users whose `app_metadata.super_admin` is `true`.

To enable email delivery, set these Edge Function secrets in the Supabase project and deploy the function:

```sh
supabase secrets set RESEND_API_KEY=re_... FEEDBACK_EMAIL=suporte@example.com FEEDBACK_FROM_EMAIL="Zelo <feedback@example.com>"
supabase functions deploy submit-feedback
```

The sender domain must be verified with Resend. Without these secrets, feedback is still saved and super administrators are notified in the app; the form tells the sender that email delivery needs server configuration.
