REQ-SWIFT-101: High-Value Cross-Border Wire Transfer
The payments gateway must process SWIFT MT103 wire messages with real-time sanctions screening.
- Transfers exceeding $1,000,000.00 require Dual-Control authorization.
- Beneficiary IBAN and BIC must pass ISO 13616 modulus-97 validation before ledger debit.
- OFAC/Sanction hit must freeze transaction in PENDING_COMPLIANCE within 500ms.
- Currency exchange rate must be locked for exactly 120 seconds during checkout.
- Negative balances or overdraft limit breaches must reject the transaction immediately.