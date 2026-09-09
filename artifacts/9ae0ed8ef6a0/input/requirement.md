REQ-089 Automated Merchant Refund Processing

Provide a multi-tier refund processing API for global ecommerce merchants.

- Partial refunds are permitted up to the total original transaction amount.
- Refunds requested within 14 days must route to original payment method without interchange penalties.
- High-risk accounts flagged with chargeback ratio > 1.5% require automated fraud screening step.
- Deny refund requests on settled chargeback disputes.
- All refund transactions must generate immutable audit logs with idempotency keys.