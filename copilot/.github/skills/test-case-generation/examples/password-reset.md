# Worked example

A reference requirement and the shape of a good response. Use this to calibrate
depth and specificity — do not copy its content into unrelated suites.

## Requirement

```markdown
REQ-042 Password Reset

A registered user should be able to reset their password using a registered
email address.

- The system sends a reset link to the email address if it is registered.
- The reset link expires after 30 minutes.
- The new password must be at least 12 characters.
- The new password must not match the previous password.
- After three failed reset attempts within an hour, further attempts are blocked.
```

## Good output (excerpt)

```json
{
  "requirement_reference": "REQ-042",
  "assumptions": [
    "Requirement does not state whether an unregistered email produces a distinct message; assumed a generic response is shown to avoid account enumeration."
  ],
  "test_cases": [
    {
      "id": "TC-001",
      "title": "Reset link is sent to a registered email address",
      "category": "functional",
      "priority": "high",
      "preconditions": ["A user account exists with the email user@example.com"],
      "steps": [
        "Navigate to the Forgot Password page",
        "Enter 'user@example.com' in the Email field",
        "Select Send reset link"
      ],
      "expected_result": "A confirmation message is displayed and a reset email containing a unique link is delivered to user@example.com within 2 minutes.",
      "requirement_reference": "REQ-042"
    },
    {
      "id": "TC-002",
      "title": "Reset link is rejected after its 30 minute expiry",
      "category": "boundary",
      "priority": "high",
      "preconditions": [
        "A reset link was issued for user@example.com",
        "31 minutes have elapsed since the link was issued"
      ],
      "steps": [
        "Open the previously issued reset link",
        "Observe the page that loads"
      ],
      "expected_result": "The link is rejected, an 'This reset link has expired' message is displayed, and no password change form is shown.",
      "requirement_reference": "REQ-042"
    },
    {
      "id": "TC-003",
      "title": "New password shorter than 12 characters is rejected",
      "category": "validation",
      "priority": "high",
      "preconditions": ["A valid, unexpired reset link has been opened"],
      "steps": [
        "Enter 'Short1!pass' (11 characters) in the New password field",
        "Enter the same value in the Confirm password field",
        "Select Save"
      ],
      "expected_result": "The password is not changed and a validation message stating the minimum length of 12 characters is displayed next to the New password field.",
      "requirement_reference": "REQ-042"
    }
  ]
}
```

## Why this is good

- **Expected results are observable.** "A validation message stating the minimum
  length of 12 characters is displayed" can be checked. "Validation works" cannot.
- **Steps name concrete data.** `'Short1!pass' (11 characters)` makes the
  boundary being tested unambiguous.
- **The assumption is recorded, not buried.** The requirement is silent on
  account enumeration; the generator says so instead of inventing a rule.
- **Boundaries are real boundaries.** 31 minutes against a 30 minute expiry, and
  11 characters against a 12 character minimum.

## What would be rejected

- `"expected_result": "The system handles it correctly"` — not verifiable.
- Two cases both titled "Reset password successfully" — duplicate.
- A case referencing `REQ-099`, which appears nowhere in the requirement.
- A case with a single step, or with no preconditions.
