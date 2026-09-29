# decline-reason-not-surfaced

## Evidence Trail

README behavior tests, stated as knowable expected outcomes (not
ambiguous/oracle ones): "Declined transaction: error message states how
much remains today, not just 'declined'"; "Declined transaction: message
says 'limit reached', not 'insufficient funds'." Both explicitly expect the
decline reason and remaining-amount context to be user-visible.

## Relevant Code

Each decline branch already computes a specific reason and logs it:

```js
if (amount > state.account.balance) {
  logTransaction(amount, false, 'Insufficient account balance');
  showMessage('error', 'Withdrawal denied.');
  ...
}
if (amount > accRemaining) {
  logTransaction(amount, false, 'Account daily limit reached');
  showMessage('error', 'Withdrawal denied.');
  ...
}
if (amount > atmRemaining) {
  logTransaction(amount, false, 'ATM daily limit reached');
  showMessage('error', 'Withdrawal denied.');
  ...
}
if (amount > totalAtmCash()) {
  logTransaction(amount, false, 'ATM out of cash');
  showMessage('error', 'Withdrawal denied.');
  ...
}
if (!dispensed) {
  logTransaction(amount, false, 'Cannot make exact change');
  showMessage('error', 'Withdrawal denied.');
  ...
}
```

(index.html:506-540 — every branch passes a specific `reason` string to
`logTransaction` but calls `showMessage('error', 'Withdrawal denied.')`
with the same literal constant regardless of which branch it is.)

The specific reason is only ever rendered inside the DEBUG panel's
transaction history (`renderHistory()`, index.html:636-657, which reads
`tx.detail` — the value from `logTransaction`) — never in the main-screen
`#messageBox`.

## Failure Scenario

A user (in this teaching tool's case, a tester exploring the requirement)
withdraws an amount that's declined for account-limit reasons but sees the
generic "Withdrawal denied." with no indication of *why* or *how much they
could still withdraw* — they'd have to open the DEBUG panel and read the
transaction history to find out. This directly contradicts the two README
behavior tests quoted above.

## Key Observations

The data needed for the fix already exists at every call site — this is a
wiring gap (pass `reason` through to `showMessage`, and compute/include the
remaining amount), not a missing-computation gap. Low implementation cost
if the fix is wanted.

No open questions — the gap and its fix location are both fully traced;
nothing further to investigate.
