# Troubleshooting Deployments

Diagnose and fix failing workflow runs. Start every investigation from the **Runs**
page, where each run shows per-step logs, exit codes, and duration.

## Read the logs first

1. Open **Runs** and click the failed run.
2. Expand the failed step to see stdout/stderr and the exit code.
3. The **Error Summary** banner at the top classifies common failures (auth, timeout,
   rate limit, resource not found).

## Common failures and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| `AccessDenied` / `403` from cloud | Connected-cloud role missing a permission | Update the IAM role/policy in **Settings → Connected Clouds** |
| Step times out after 15 min | Default per-step timeout reached | Increase the step timeout (max 60 min) or split the step |
| `429 Too Many Requests` | Hitting an external or Nimbus API rate limit | Add backoff; see *API Rate Limits* |
| Workflow stuck in `Queued` | No available runner / plan concurrency reached | Wait, or upgrade for more concurrency |
| Webhook trigger never fires | Signature mismatch or wrong URL | Verify the `X-Nimbus-Signature` and the endpoint URL |

## Retries

- Manually retry from the run's **Retry** button.
- Configure **auto-retry** per step: set max attempts (up to 5) and a backoff delay.
  Auto-retry uses exponential backoff by default.

## Timeouts & concurrency

- Default per-step timeout is **15 minutes**; the maximum configurable timeout is
  **60 minutes**.
- Concurrent run limits depend on your plan. If runs sit in `Queued`, you've reached
  your concurrency ceiling.

## Still failing?

Collect the **Run ID** (shown in the run URL) and the step logs, then contact support.
Production-down incidents on Enterprise plans are covered by your SLA — flag them as
**urgent / production outage** so they're routed to on-call immediately.
