# REQ-1042 — Schedule a Recurring Payment

## Business value

Retail customers who pay the same beneficiary on a fixed schedule (rent, school
fees, loan instalments) currently re-enter the payment every month and miss due
dates. Letting them schedule the payment once reduces missed-payment fees and
cuts repeat payment traffic in the mobile app.

## Scope

An authenticated retail customer can create a recurring payment from an existing
current account to a beneficiary that is already saved and activated on their
profile. Editing, pausing and deleting an existing schedule are out of scope for
this requirement.

## Actors

- **Customer** — authenticated retail user with at least one active current account
- **Payments service** — executes each instalment on its due date

## Functional behaviour

The customer selects a source account, a saved beneficiary, an amount, a
frequency, a start date and an end condition. On submission the schedule is
stored and the first instalment is queued for its start date.

**Frequency** is one of: `WEEKLY`, `MONTHLY`, `QUARTERLY`.

**End condition** is exactly one of:
- an end date, or
- a fixed number of instalments (1–120), or
- `UNTIL_CANCELLED`

## Acceptance criteria

1. **Successful creation** — Given an active current account, an activated
   beneficiary, an amount of 25.00 GBP, frequency `MONTHLY`, a start date of
   tomorrow and end condition `UNTIL_CANCELLED`, when the customer submits, then
   the schedule is created with status `ACTIVE`, a schedule reference of the form
   `RP-` followed by 10 digits is returned, and the response HTTP status is 201.

2. **Start date must be in the future** — When the start date is today or any
   earlier date, then the schedule is rejected with HTTP 422 and the message
   "Start date must be at least one day in the future."

3. **Minimum amount** — When the amount is below 1.00 GBP, then the schedule is
   rejected with HTTP 422 and the message "Amount must be at least 1.00 GBP."

4. **Maximum amount** — When the amount is above 10,000.00 GBP, then the schedule
   is rejected with HTTP 422 and the message "Amount must not exceed 10,000.00
   GBP." An amount of exactly 10,000.00 GBP is accepted.

5. **Beneficiary must be activated** — When the selected beneficiary is in
   `PENDING_ACTIVATION`, then the schedule is rejected with HTTP 409 and the
   message "Beneficiary is not yet activated."

6. **Source account must be active** — When the source account is `BLOCKED` or
   `CLOSED`, then the schedule is rejected with HTTP 409 and the message "Source
   account cannot be used for payments."

7. **Instalment count bounds** — When the end condition is a fixed number of
   instalments, a value of 1 and a value of 120 are both accepted; 0 and 121 are
   rejected with HTTP 422 and the message "Number of instalments must be between
   1 and 120."

8. **Duplicate schedule guard** — When an `ACTIVE` schedule already exists with
   the same source account, beneficiary, amount and frequency, then the new
   schedule is rejected with HTTP 409 and the message "An identical recurring
   payment already exists."

9. **Insufficient funds do not block creation** — Schedule creation never checks
   the account balance. Balance is evaluated by the payments service on each due
   date, not at creation time.

10. **Audit** — Every accepted creation writes an audit record containing the
    customer ID, schedule reference, source account, beneficiary ID, amount,
    frequency and the creation timestamp in UTC.

## Non-functional

- Creation responds within 2 seconds at the 95th percentile under a load of 50
  concurrent submissions.
- All amounts are held and returned to exactly 2 decimal places.

## Assumptions

- Only GBP is supported in this release.
- The customer has already completed step-up authentication for the session.
