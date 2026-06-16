// ─────────────────────────────────────────────────────────────
// In-process rate limiter for QuickFile API calls.
// QuickFile allows 1000 calls/day by default.
// We budget 900 to leave a 10% safety margin.
// Cloudflare Workers are stateless per-request, so this tracks
// across a single tool invocation (fan-out) not globally.
// For global tracking, replace with a D1/KV-backed counter.
// ─────────────────────────────────────────────────────────────

export class RateLimiter {
  private used = 0;
  private readonly budget: number;

  constructor(budgetOverride?: string) {
    this.budget = budgetOverride ? parseInt(budgetOverride, 10) : 900;
  }

  canMakeCall(count = 1): boolean {
    return this.used + count <= this.budget;
  }

  consume(count = 1): void {
    this.used += count;
  }

  remaining(): number {
    return Math.max(0, this.budget - this.used);
  }

  assertCanCall(callsNeeded: number): void {
    if (!this.canMakeCall(callsNeeded)) {
      throw new Error(
        `❌ Rate limit guard: this fan-out needs ${callsNeeded} API calls but only ${this.remaining()} remain in the current budget (${this.budget}/day). Reduce scope or ask QuickFile to increase your limit.`
      );
    }
  }
}
