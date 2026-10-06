# EloShape authentication email setup

## Gestionar la beta desde EloShape

En el panel de administración, **Lista de acceso a la beta** muestra si la persona
todavía no se registró, espera confirmación o ya confirmó su correo.
**Confirmar correo** permite a un administrador confirmar una cuenta existente
con invitación activa después de verificar su identidad por otro medio. Requiere
confirmación explícita en pantalla y se registra en el historial de auditoría.
No otorga roles de Discord ni permite confirmar correos fuera de la whitelist.

Los jugadores pueden reenviar su confirmación desde el registro o cuando el inicio
de sesión informa que falta confirmar el correo. No se desactiva la confirmación
global. Guardar una invitación no envía un mail: compartí el enlace de registro.

## Sender

- Name: `EloShape`
- Address: `noreply@eloshape.com.ar`
- SMTP host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: a Resend API key stored only in the Supabase Auth SMTP settings

Never commit or paste the Resend API key into application environment variables, source code, issues or screenshots.

## Hosted Supabase setup

Configure staging first, test every flow and then repeat in production:

1. Verify `eloshape.com.ar` in Resend.
2. Create a separate Resend API key for each Supabase environment.
3. In Supabase, open Authentication → Notifications → Email → SMTP Settings.
4. Enable custom SMTP and enter the sender and SMTP values above.
5. Copy the matching subject and HTML from `supabase/templates/` into the hosted email templates.
6. Confirm the Auth Site URL and allowed Redirect URLs for that environment.
7. Test signup confirmation, password recovery and email change with real inboxes.
8. Confirm delivery and absence of exposed secrets in Resend logs and received messages.

## Templates

- Confirmation: `supabase/templates/confirmation.html`
- Password recovery: `supabase/templates/recovery.html`
- Email change: `supabase/templates/email-change.html`

The repository configuration also references these files for reproducible local Supabase development. Hosted projects still require applying the settings in the Supabase dashboard or through an authorized management workflow.
