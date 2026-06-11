# Password Reset & Login

How to regain access to your Nimbus account and resolve common sign-in problems.

## Reset a forgotten password

1. Go to **app.nimbus.io/forgot-password**.
2. Enter the email address on your account and submit.
3. You'll receive a **password reset link that is valid for 60 minutes**.
4. Open the link, choose a new password (minimum 12 characters, at least one
   number and one symbol), and confirm.

If the email doesn't arrive within a few minutes:

- Check spam/junk and any corporate email quarantine.
- Confirm you used the exact email you signed up with.
- Add **no-reply@nimbus.io** to your safe-senders list and try again.
- Reset links expire after 60 minutes — request a fresh one if yours has lapsed.

## Single Sign-On (SSO) users

If your organization uses SSO (Okta, Google Workspace, Azure AD), **Nimbus does not
store your password**. The "forgot password" flow will not work — reset your
credentials with your identity provider instead. SSO is available on the Pro and
Enterprise plans.

## Two-factor authentication (2FA)

- Enable 2FA under **Settings → Security → Two-Factor Authentication**.
- Supported methods: authenticator apps (TOTP) and hardware security keys.
- **Lost your 2FA device?** Use a saved backup code at sign-in. If you have no
  backup codes, account recovery requires identity verification by support and
  is handled as a sensitive request.

## Account lockout

After 10 failed sign-in attempts, an account is temporarily locked for 15 minutes
as a brute-force protection. Wait for the window to elapse or reset your password
to clear the lock immediately.
