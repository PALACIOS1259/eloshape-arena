# EloShape authentication email setup

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
