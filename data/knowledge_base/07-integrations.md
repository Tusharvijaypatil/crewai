# Integrations

Nimbus connects to the tools your team already uses. Integrations are configured
under **Settings → Integrations**.

## Available integrations

| Integration | What it does | Minimum plan |
|---|---|---|
| **Slack** | Send run notifications and alerts to channels | Starter |
| **GitHub** | Trigger workflows on push/PR; report status checks | Starter |
| **GitLab** | Trigger on pipeline events; mirror status | Pro |
| **Jira** | Open/transition issues from failed runs | Pro |
| **PagerDuty** | Page on-call when a critical workflow fails | Pro |
| **Webhooks** | Generic inbound triggers and outbound events | Free |
| **AWS / GCP / Azure** | Run automations against your cloud | Free |

## Connecting Slack

1. Open **Settings → Integrations → Slack** and click **Connect**.
2. Authorize the Nimbus app in your Slack workspace (OAuth).
3. Choose a default channel for notifications.
4. Per-workflow, pick which events post to Slack (success, failure, or both).

## Connecting GitHub

1. **Settings → Integrations → GitHub → Connect**, then install the Nimbus GitHub App
   on the repositories you want.
2. Add a **GitHub trigger** to a workflow (on push, PR opened, or release).
3. Optionally publish a status check back to the commit.

## Webhooks

- **Inbound**: every workflow with a webhook trigger gets a unique signed URL. Nimbus
  verifies an `X-Nimbus-Signature` HMAC header so you can reject forged calls.
- **Outbound**: send a POST to any URL as a workflow step, with retries on failure.

## Authentication

All third-party integrations use **OAuth** where supported; Nimbus stores only scoped
access tokens, never your third-party passwords. Revoke any integration at any time
from **Settings → Integrations**.

## Not yet available

Integrations that are **not** currently offered (and are on our roadmap) include a
native Terraform provider, ServiceNow, and Datadog. If you need one of these, contact
support so we can track demand — there is no supported workaround today.
