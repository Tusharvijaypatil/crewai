# Security & Data Privacy

How Nimbus protects your data and supports your compliance needs.

## Certifications & compliance

- **SOC 2 Type II** — audited annually. A copy of the report is available to
  customers and prospects under NDA; request it from support or your account team.
- **GDPR** — Nimbus acts as a data processor. A **Data Processing Addendum (DPA)** is
  available and can be countersigned from **Settings → Legal → DPA** or via support.
- **ISO 27001** — certification is in progress (roadmap), not yet complete.

## Encryption

- **In transit:** all traffic uses TLS 1.2 or higher.
- **At rest:** data is encrypted with **AES-256**.
- Secrets and connected-cloud credentials are stored in an isolated secrets vault and
  are never written to logs.

## Data residency

- Data is hosted in the **United States (us-east)** by default.
- **EU data residency (eu-central)** is available on **Enterprise** plans — choose your
  region at onboarding.

## Sub-processors

Nimbus uses a small set of sub-processors (cloud hosting, email delivery, payment
processing via Stripe). The current list is published at **nimbus.io/subprocessors**
and customers are notified before any material change.

## Account data deletion (GDPR / right to erasure)

You can delete individual workflows and runs yourself at any time. **Full account and
personal-data deletion requests** (GDPR Article 17 "right to be forgotten") must be
submitted to support and require verification of the requester's identity. These are
processed within 30 days and are handled as sensitive requests by a human agent — they
cannot be completed automatically through self-service.

## Reporting a vulnerability

Email **security@nimbus.io** to report a security issue. Please do not post details
publicly until we've confirmed a fix.
