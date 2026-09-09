REQ-042 Password Reset

A registered user should be able to reset their password using a registered email address.

- The system sends a reset link to the email address if it is registered.
- The reset link expires after 30 minutes.
- The new password must be at least 12 characters.
- The new password must not match the previous password.
- After three failed reset attempts within an hour, further attempts are blocked.