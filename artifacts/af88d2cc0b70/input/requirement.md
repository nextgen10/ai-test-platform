REQ-100 User Login and Session Management
As a verified user, I must be able to securely authenticate using username and password.
Given valid credentials, the system authenticates within 1.5 seconds and returns a session token.
If password is invalid, the system responds with Invalid Credentials.
After 5 consecutive failed attempts, the account is temporarily locked for 15 minutes.
Acceptance Criteria:
- Valid authentication -> 200 OK + JWT within 1.5s
- Invalid authentication -> 401 Unauthorized
- Account lock triggered at attempt 5