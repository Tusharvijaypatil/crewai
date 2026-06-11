# Getting Started with Nimbus

Nimbus is a cloud automation platform that lets teams build, schedule, and monitor
infrastructure workflows without managing servers. This guide gets you from sign-up
to your first running workflow.

## 1. Create your account

1. Go to **app.nimbus.io/signup** and register with your work email.
2. Verify your email via the confirmation link (valid for 24 hours).
3. You start on the **Free** plan automatically — no credit card required.

## 2. Connect a cloud provider

Nimbus runs your automations against your own cloud accounts. Connect at least one:

1. Open **Settings → Connected Clouds**.
2. Choose **AWS**, **Google Cloud**, or **Azure**.
3. Follow the OAuth / role-assumption flow. For AWS, Nimbus creates a scoped IAM
   role with an external ID — we never ask for long-lived root keys.

## 3. Build your first workflow

1. Click **New Workflow** on the dashboard.
2. Add a **Trigger** — a schedule (cron), a webhook, or a cloud event.
3. Add one or more **Steps** (run a script, call an API, provision a resource).
4. Click **Test Run** to execute once against your connected cloud.
5. Toggle **Enabled** to put it live.

## 4. Monitor runs

Every execution appears under **Runs**, with per-step logs, duration, and status.
Failed runs can be retried manually or configured to auto-retry (see
*Troubleshooting Deployments*).

## Key concepts

| Term | Meaning |
|---|---|
| Workflow | An ordered set of steps with a trigger. |
| Run | A single execution of a workflow. |
| Trigger | What starts a workflow: schedule, webhook, or cloud event. |
| Connected Cloud | An AWS/GCP/Azure account Nimbus runs automations against. |

## Next steps

- Invite teammates under **Settings → Members** (seat limits depend on your plan).
- Review **API Rate Limits** before automating high-frequency calls.
- See **Integrations** to wire Nimbus into Slack, GitHub, Jira, and PagerDuty.
