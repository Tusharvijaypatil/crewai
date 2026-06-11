# API Rate Limits

The Nimbus REST API enforces per-plan rate limits to keep the platform fast and fair.

## Limits by plan

| Plan | Sustained limit | Burst |
|---|---|---|
| Free | 60 requests / minute | up to 100 in a 10s window |
| Starter | 300 requests / minute | up to 500 in a 10s window |
| Pro | 1,200 requests / minute | up to 2,000 in a 10s window |
| Enterprise | Custom | Negotiated |

Limits are applied **per organization**, not per API key.

## How throttling works

- Each response includes headers:
  - `X-RateLimit-Limit` — your per-minute ceiling.
  - `X-RateLimit-Remaining` — requests left in the current window.
  - `X-RateLimit-Reset` — epoch seconds when the window resets.
- When you exceed the limit, Nimbus returns **HTTP 429 Too Many Requests** with a
  **`Retry-After`** header (seconds to wait).

## Handling 429s

1. **Back off**: wait for the number of seconds in `Retry-After` before retrying.
2. Use **exponential backoff with jitter** for automated clients.
3. **Batch** where possible and cache responses that don't change often.
4. Spread scheduled workflows so they don't all fire at the same second.

Intermittent 429s usually mean short bursts are exceeding the burst window — smooth
out request timing or upgrade for a higher ceiling.

## Requesting higher limits

Pro customers who consistently hit the ceiling can request a temporary increase from
support. Permanent higher limits are part of **Enterprise** plans and are set in your
contract.
