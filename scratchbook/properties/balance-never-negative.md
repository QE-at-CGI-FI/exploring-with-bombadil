# balance-never-negative

## Evidence Trail

README behavior test: "Withdraw €300 when account balance is €0 —
declined (balance check)."

## Relevant Code

- Gate: `if (amount > state.account.balance) { ... return; }` index.html:506-511,
  the first of the four gate checks, runs before limit/cash checks.
- Mutation: `state.account.balance -= amount;` index.html:546, inside the
  commit block, only reachable after the balance gate already passed.

## Failure Scenario

Since `amount > 0` is already enforced earlier (index.html:493-496) and the
balance gate is a plain numeric comparison with no clamping tricks, there's
no currently-known path to a negative balance. This property is a
regression guard, not a suspected defect — included because it's the most
fundamental invariant an ATM simulator has, and cheap to check on every
transaction.

## Key Observations

`applyAdmin()` can set `balance` directly to any non-negative value
(`Math.max(0, parseInt(...) || 0)`, index.html:700) — an admin action, not a
withdrawal, so it's out of scope for *this* property but worth noting it's
the one other place balance changes.

No open questions.
