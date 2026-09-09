REQ-AUTH-204: Zero-Trust Step-Up Authentication
The authentication service must enforce OAuth 2.0 Authorization Code flow with PKCE and adaptive risk-based MFA.
- PKCE code_challenge (S256) is mandatory on all client authorization requests.
- High-risk operations (e.g. payout modification, password change) must prompt FIDO2/WebAuthn step-up.
- Failed TOTP / FIDO2 verification must lock step-up session after 3 consecutive failures for 15 minutes.
- Expired access tokens (TTL > 900s) must be refreshed seamlessly using single-use rotating refresh tokens.