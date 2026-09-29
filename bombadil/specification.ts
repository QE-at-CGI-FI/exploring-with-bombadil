// Bombadil specification for the ATM Simulator (https://qe-at-cgi-fi.github.io/atm/).
//
// The app is a single-page, client-side ATM simulator. All state lives in an
// in-page `state` object (not exposed on `window`) and is rendered into
// specific elements by id, so properties here read the rendered DOM text
// rather than the JS state directly.
//
// Properties below are grounded in the property catalog produced by an
// antithesis-research pass over the SUT (see `scratchbook/property-catalog.md`
// in this repo) — each property or action generator names the catalog slug
// it implements, so the two can be cross-checked.
//
// Relevant elements (see app source):
//   #dispBalance        Account balance, "€<n>"
//   #dispAccLimit        Account daily limit, "€<n>"
//   #dispAccWithdrawn    Withdrawn at this ATM today, "€<n>"
//   #dispAccRemaining    Account remaining today, "€<n>" (rendered via Math.max(0, ...))
//   #dispAtmLimit        ATM daily limit, "€<n>"
//   #dispAtmWithdrawn    ATM withdrawn today, "€<n>"
//   #dispAtmRemaining    ATM remaining today, "€<n>" (rendered via Math.max(0, ...))
//   #inputElsewhere      Simulated "withdrawn at other ATMs today", editable number input
//   #count100/50/20/10   Cash remaining per denomination, "×<n>"
//   #amountInput         Withdrawal amount input (raw string, cleared on success)
//   #messageBox          Last withdrawal result ("success"/"error" class + text)
//   #history             Transaction list (never trimmed; each entry has
//                         .hi-amount (success) or .hi-fail (decline) as its
//                         first child, the decline reason as its second
//                         child, and .hi-time as its third)
//   #dispClock           Simulated/real clock display, "DD/MM/YYYY, HH:MM:SS"
//   #cfgClock            Admin datetime-local input driving applyClock()

import { always, eventually, next } from "@antithesishq/bombadil";
import { extract, actions, registerCustomAction } from "@antithesishq/bombadil/browser";
import { lastAction } from "@antithesishq/bombadil/browser/defaults/actions";

// Re-export Bombadil's default properties (no console errors, no uncaught
// exceptions, no unhandled promise rejections, no 4xx/5xx responses) and
// default action generators (clicks, inputs, navigation, scroll, ...), which
// drive all the exploration for this specification.
export * from "@antithesishq/bombadil/browser/defaults";

function euros(text: string | null | undefined): number {
  if (!text) return 0;
  const match = text.replace(/ /g, " ").match(/-?\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function count(text: string | null | undefined): number {
  if (!text) return 0;
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

const balance = extract((state) =>
  euros(state.document.querySelector("#dispBalance")?.textContent),
);

const accountLimit = extract((state) =>
  euros(state.document.querySelector("#dispAccLimit")?.textContent),
);

const accountWithdrawnHere = extract((state) =>
  euros(state.document.querySelector("#dispAccWithdrawn")?.textContent),
);

const accountWithdrawnElsewhere = extract((state) => {
  const input = state.document.querySelector<HTMLInputElement>(
    "#inputElsewhere",
  );
  return input ? parseInt(input.value, 10) || 0 : 0;
});

const accountRemaining = extract((state) =>
  euros(state.document.querySelector("#dispAccRemaining")?.textContent),
);

const atmLimit = extract((state) =>
  euros(state.document.querySelector("#dispAtmLimit")?.textContent),
);

const atmWithdrawn = extract((state) =>
  euros(state.document.querySelector("#dispAtmWithdrawn")?.textContent),
);

const atmRemaining = extract((state) =>
  euros(state.document.querySelector("#dispAtmRemaining")?.textContent),
);

const bills100 = extract((state) =>
  count(state.document.querySelector("#count100")?.textContent),
);
const bills50 = extract((state) =>
  count(state.document.querySelector("#count50")?.textContent),
);
const bills20 = extract((state) =>
  count(state.document.querySelector("#count20")?.textContent),
);
const bills10 = extract((state) =>
  count(state.document.querySelector("#count10")?.textContent),
);

function billCount(
  document: Document,
  id: string,
): number {
  return count(document.querySelector(`#${id}`)?.textContent);
}

const cashInAtm = extract(
  (state) =>
    billCount(state.document, "count100") * 100 +
    billCount(state.document, "count50") * 50 +
    billCount(state.document, "count20") * 20 +
    billCount(state.document, "count10") * 10,
);

// The raw withdrawal amount string, exactly as `withdraw()`'s own
// `parseInt(input.value, 10)` sees it — needed both to reproduce the parsed
// amount (for step properties spanning a withdrawal click) and, unparsed, to
// detect fractional input strings before `parseInt` truncates them.
const rawAmountInput = extract((state) =>
  state.document.querySelector<HTMLInputElement>("#amountInput")?.value ??
    "",
);

// Shared by requestedAmount below and by exactChangeFeasible further down —
// extractors may only read from `state`, never from another cell's
// `.current`, so the amount has to be re-read from the DOM in both places
// rather than exactChangeFeasible reusing requestedAmount.current directly.
function readRequestedAmount(document: Document): number {
  const raw = document.querySelector<HTMLInputElement>("#amountInput")
    ?.value ?? "";
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

const requestedAmount = extract((state) =>
  readRequestedAmount(state.document),
);

// One extractor over `#history` covering every property that needs to know
// "did a withdraw() call just log an outcome, and which one". `#history` is
// never trimmed (index.html's `state.transactions.unshift`, matching
// transaction-history-bounded-growth's own finding), so this deliberately
// avoids ever walking the full list: `count` comes from a single native
// `querySelectorAll(...).length` (real entries always have exactly one of
// `.hi-amount`/`.hi-fail`, the placeholder has neither), and the newest
// entry (unshift puts it first) is read directly with `querySelector`. A
// module-level Set tracks decline reasons seen so far, updated only when
// `count` actually grew — O(1) per captured state regardless of how long
// the run has been going, instead of O(history length).
let previousHistoryCount = 0;
const seenDeclineReasons = new Set<string>();

const history = extract((state) => {
  const doc = state.document;
  const count = doc.querySelectorAll("#history .hi-amount, #history .hi-fail")
    .length;
  const first = doc.querySelector<HTMLElement>("#history .history-item");
  const firstIsFail = !!first?.querySelector(".hi-fail");
  const firstIsOk = !!first?.querySelector(".hi-amount");
  const latestOk = firstIsOk ? true : firstIsFail ? false : null;
  const latestReason = firstIsFail
    ? first!.children[1]?.textContent?.trim() ?? ""
    : null;

  if (count > previousHistoryCount) {
    previousHistoryCount = count;
    if (latestReason) {
      seenDeclineReasons.add(latestReason);
    }
  }

  return {
    count,
    latestOk,
    latestReason,
    reasonsSeen: Array.from(seenDeclineReasons),
  };
});

const messageText = extract((state) =>
  state.document.querySelector("#messageBox")?.textContent ?? "",
);

// The simulated/real calendar date currently displayed in the debug clock,
// "DD/MM/YYYY" — a proxy for `todayStr()`'s day-boundary comparison.
const clockDateStr = extract((state) => {
  const text = state.document.querySelector("#dispClock")?.textContent ?? "";
  const match = text.match(/\d{2}\/\d{2}\/\d{4}/);
  return match ? match[0] : "";
});

// The genuine wall-clock day, unaffected by the app's own simulated
// `clockOffset` (which only feeds the app's local `now()` helper, never the
// global `Date` constructor). Lets us tell a real day boundary apart from a
// simulated one.
const realDayStr = extract((_state) => new Date().toDateString());

const adminOpen = extract(
  (state) =>
    state.document.querySelector("#adminPanel")?.classList.contains("open") ??
    false,
);

// --- Reference oracle for exact-change feasibility ---------------------
//
// Independent of `dispenseBills()`'s greedy allocator (index.html:465-481),
// which is confirmed incomplete (property-catalog.md: exact-change-completeness).
// Exhaustively searches €100/€50 counts, then closes the €20/€10 remainder
// with an O(1) range check — bounded box big enough for the app's realistic
// amounts, capped for safety since admin fields have no upper bound.
function feasibleWithTwentyAndTen(
  remainder: number,
  count20: number,
  count10: number,
): boolean {
  const units = remainder / 10; // work in units of €10
  const maxTwenties = Math.min(count20, Math.floor(units / 2));
  const minTwenties = Math.max(0, Math.ceil((units - count10) / 2));
  return minTwenties <= maxTwenties;
}

type BillCounts = { 100: number; 50: number; 20: number; 10: number };

// Returns true only when a feasible combination was exhaustively proven to
// exist. Returns false both when none exists and when the amount is outside
// the safety envelope (unproven) — callers must never treat "false" as
// "proven infeasible".
function canMakeExactChange(amount: number, bills: BillCounts): boolean {
  if (amount <= 0) return true;
  if (amount % 10 !== 0) return false;
  if (amount > 2000) return false; // outside the cheap-oracle safety envelope
  const maxHundreds = Math.min(bills[100], Math.floor(amount / 100));
  for (let hundreds = 0; hundreds <= maxHundreds; hundreds++) {
    const afterHundreds = amount - hundreds * 100;
    const maxFifties = Math.min(bills[50], Math.floor(afterHundreds / 50));
    for (let fifties = 0; fifties <= maxFifties; fifties++) {
      const remainder = afterHundreds - fifties * 50;
      if (feasibleWithTwentyAndTen(remainder, bills[20], bills[10])) {
        return true;
      }
    }
  }
  return false;
}

function currentBills(): BillCounts {
  return {
    100: bills100.current,
    50: bills50.current,
    20: bills20.current,
    10: bills10.current,
  };
}

// Computed once per captured state and shared by exactChangeCompleteness
// and withinLimitWithdrawalNotSpuriouslyDeclined, rather than each property
// re-running the exhaustive search independently every state. Reads the DOM
// directly (via readRequestedAmount/billCount) rather than other cells'
// `.current`, since extractors may only depend on `state`.
const exactChangeFeasible = extract((state) =>
  canMakeExactChange(readRequestedAmount(state.document), {
    100: billCount(state.document, "count100"),
    50: billCount(state.document, "count50"),
    20: billCount(state.document, "count20"),
    10: billCount(state.document, "count10"),
  }),
);

// The gating computation `withdraw()` actually uses (index.html:502-504) is
// deliberately unclamped, unlike the display figures rendered via
// `Math.max(0, ...)` (index.html:578-579, exposed here as accountRemaining /
// atmRemaining). These mirror the unclamped internal values.
function computedAccountRemaining(): number {
  return (
    accountLimit.current -
    accountWithdrawnHere.current -
    accountWithdrawnElsewhere.current
  );
}

function computedAtmRemaining(): number {
  return atmLimit.current - atmWithdrawn.current;
}

// --- Properties -------------------------------------------------------

// The account balance is only ever debited by withdrawals or set directly
// via the admin panel, but should never be allowed to go negative.
// Catalog: balance-never-negative.
export const balanceNeverNegative = always(() => balance.current >= 0);

// Cash counts per denomination should never go negative — the app clamps
// admin refill values with Math.max(0, ...) and only dispenses bills it has.
// Catalog: bill-inventory-never-negative.
export const cashCountsNeverNegative = always(
  () =>
    bills100.current >= 0 &&
    bills50.current >= 0 &&
    bills20.current >= 0 &&
    bills10.current >= 0,
);

// The total cash physically in the ATM should never be less than zero.
export const totalCashNeverNegative = always(() => cashInAtm.current >= 0);

// "Remaining today" figures are rendered with Math.max(0, ...), so they
// should never display as negative.
export const remainingFiguresNeverNegative = always(
  () => accountRemaining.current >= 0 && atmRemaining.current >= 0,
);

// The ATM must never dispense more, in a single day, than its own daily
// limit allows. Catalog: atm-daily-limit-never-exceeded.
export const atmWithdrawalsRespectAtmLimit = always(
  () => atmWithdrawn.current <= atmLimit.current,
);

// The account must never withdraw more, across this ATM and the simulated
// "other ATMs" total, than its own daily limit allows. Note: the "withdrawn
// at other ATMs" debug field has no upper bound (no HTML `max`, and the app
// only clamps it to >= 0), so this is trivially violated just by typing a
// large number into that one field — no actual over-limit withdrawal at
// this ATM is required. That's a real, easily reproducible finding.
// Catalog: account-daily-limit-never-exceeded.
export const accountWithdrawalsRespectAccountLimit = always(
  () =>
    accountWithdrawnHere.current + accountWithdrawnElsewhere.current <=
    accountLimit.current,
);

// A withdrawal that gets far enough to be logged (i.e. isn't rejected by the
// two early-return input-validation checks) but is declined must leave
// balance, both withdrawnToday counters, and the bill inventory untouched.
// Catalog: declined-withdrawals-dont-consume-limit.
export const declinedWithdrawalsDontConsumeCounters = always(() => {
  const pre = {
    balance: balance.current,
    accWithdrawn: accountWithdrawnHere.current,
    atmWithdrawn: atmWithdrawn.current,
    bills: currentBills(),
  };
  const preCount = history.current.count;
  return next(() => {
    const justLogged = history.current.count === preCount + 1;
    if (!justLogged || history.current.latestOk) return true;
    const bills = currentBills();
    return (
      balance.current === pre.balance &&
      accountWithdrawnHere.current === pre.accWithdrawn &&
      atmWithdrawn.current === pre.atmWithdrawn &&
      bills[100] === pre.bills[100] &&
      bills[50] === pre.bills[50] &&
      bills[20] === pre.bills[20] &&
      bills[10] === pre.bills[10]
    );
  });
});

// Whenever a withdrawal is dispensed, the cash removed from the ATM's
// inventory equals exactly the requested amount — never more, never less.
// `dispenseBills()` already enforces this internally (its own
// `remaining !== 0` check), so this is a regression guard against a future
// refactor introducing rounding/off-by-one errors, verified end-to-end
// through the state-mutation step in `withdraw()`.
// Catalog: dispensed-amount-matches-requested.
export const cashDecreaseMatchesRequestedAmount = always(() => {
  const requested = requestedAmount.current;
  const preCash = cashInAtm.current;
  const preCount = history.current.count;
  return next(() => {
    const justSucceeded =
      history.current.count === preCount + 1 && history.current.latestOk;
    return justSucceeded ? cashInAtm.current === preCash - requested : true;
  });
});

// If some combination of available bills sums exactly to the requested
// amount, the ATM must find it — it must never decline a request its cash
// inventory can actually satisfy. Confirmed violated today: with
// bills = {100:0, 50:2, 20:3, 10:0} and amount=110, 1×€50+3×€20=€110 is
// feasible but the greedy allocator declines it (see
// scratchbook/properties/exact-change-completeness.md).
// Catalog: exact-change-completeness.
export const exactChangeCompleteness = always(() => {
  const oracleFeasible = exactChangeFeasible.current;
  const preCount = history.current.count;
  return next(() => {
    const justDeclinedForChange =
      history.current.count === preCount + 1 &&
      !history.current.latestOk &&
      history.current.latestReason === "Cannot make exact change";
    return justDeclinedForChange ? !oracleFeasible : true;
  });
});

// A withdrawal that is within both daily limits, within the account
// balance, and for which the ATM's cash inventory can make exact change,
// must never be declined. Generalizes exact-change-completeness: today it
// fails via that one specific mechanism (the greedy allocator), but this
// property would also catch a different mechanism (e.g. a limit off-by-one)
// breaking the same user-facing guarantee later.
// Catalog: within-limit-withdrawal-not-spuriously-declined.
export const withinLimitWithdrawalNotSpuriouslyDeclined = always(() => {
  const amount = requestedAmount.current;
  const feasibleNow =
    amount > 0 &&
    amount <= balance.current &&
    amount <= computedAccountRemaining() &&
    amount <= computedAtmRemaining() &&
    exactChangeFeasible.current;
  const preCount = history.current.count;
  return next(() => {
    const justLogged = history.current.count === preCount + 1;
    if (!feasibleNow || !justLogged) return true;
    return history.current.latestOk === true;
  });
});

// If an admin lowers the account's daily limit below what's already been
// withdrawn today (across this ATM and "elsewhere"), no further withdrawal
// may be approved until the counters reset for a new day — verifies the
// gating computation (deliberately unclamped, index.html:502) and the
// display computation (clamped, index.html:578) stay consistent in the
// direction that matters.
// Catalog: admin-limit-reduction-blocks-overdrawn-account.
export const overdrawnAccountBlocksFurtherWithdrawals = always(() => {
  const overdrawn = computedAccountRemaining() < 0;
  const preCount = history.current.count;
  return next(() => {
    const justLogged = history.current.count === preCount + 1;
    if (!overdrawn || !justLogged) return true;
    return !history.current.latestOk;
  });
});

// "Withdrawn at other ATMs" — a manually-entered debug value — must never
// exceed the account's own daily limit, whether set directly via the debug
// input or stranded there by the admin panel lowering the limit afterward.
// Catalog: withdrawn-elsewhere-bounded.
export const withdrawnElsewhereNeverExceedsAccountLimit = always(
  () => accountWithdrawnElsewhere.current <= accountLimit.current,
);

// A withdrawal that actually succeeds is always for a positive amount that's
// an exact multiple of €10, the smallest bill denomination.
// Catalog: withdrawal-amount-positive-multiple-of-ten.
export const successfulWithdrawalIsPositiveMultipleOfTen = always(() => {
  const requested = requestedAmount.current;
  const preCount = history.current.count;
  return next(() => {
    const justSucceeded =
      history.current.count === preCount + 1 && history.current.latestOk;
    return justSucceeded ? requested > 0 && requested % 10 === 0 : true;
  });
});

// An amount input containing a fractional part (e.g. "300.50") must be
// rejected by input validation, not silently truncated by `parseInt` into a
// valid-looking integer amount that then gets dispensed or declined as if
// it had been entered as a whole number. Confirmed violated today:
// `parseInt("300.5", 10) === 300`, which passes the multiple-of-10 check and
// proceeds to a real (logged) withdrawal attempt.
// Catalog: fractional-amount-truncated-not-rejected.
export const fractionalAmountRejectedNotTruncated = always(() => {
  const looksFractional = /[.,]/.test(rawAmountInput.current);
  const preCount = history.current.count;
  return next(() =>
    looksFractional ? history.current.count === preCount : true,
  );
});

// On a declined withdrawal, the message shown to the user must stay
// generic ("Withdrawal denied.") and never reveal which specific gate
// failed (insufficient balance vs. account limit vs. ATM limit vs. cash
// availability vs. exact change). This inverts the catalog's original
// framing: scratchbook/property-catalog.md treated README's "message says
// 'limit reached', not 'insufficient funds'" behavior test as something to
// fix, but revealing the specific reason leaks internal account/ATM state
// to whoever is standing at the machine — a real security reason to keep
// the message generic, confirmed on human review to be the correct
// behavior rather than a defect.
// Catalog: decline-reason-not-surfaced (inverted per human review).
export const declineMessageStaysGeneric = always(() => {
  const preCount = history.current.count;
  return next(() => {
    const justDeclined =
      history.current.count === preCount + 1 && !history.current.latestOk;
    if (!justDeclined) return true;
    const reason = history.current.latestReason ?? "";
    return reason === "" || !messageText.current.includes(reason);
  });
});

// A page reload always returns the simulator to its exact hardcoded
// defaults, regardless of what state existed before the reload — there is
// no `localStorage`/`sessionStorage`/cookie persistence to carry state over.
// Catalog: no-state-persistence-across-reload.
export const reloadResetsToDefaults = always(() =>
  next(() =>
    lastAction.current === "Reload"
      ? balance.current === 2000 &&
        accountLimit.current === 500 &&
        atmLimit.current === 300 &&
        bills100.current === 5 &&
        bills50.current === 8 &&
        bills20.current === 15 &&
        bills10.current === 20
      : true,
  ),
);

// Exploration guidance (not a correctness property by itself): over the
// course of a run, all five decline reasons in `withdraw()` should be
// observed at least once, so Antithesis's search prioritizes visiting the
// "cannot make exact change" branch — the one with the confirmed defect
// behind it — rather than letting "insufficient balance" dominate.
// Catalog: atm-decline-reasons-explored.
const ALL_DECLINE_REASONS = [
  "Insufficient account balance",
  "Account daily limit reached",
  "ATM daily limit reached",
  "ATM out of cash",
  "Cannot make exact change",
];
export const allDeclineReasonsExplored = eventually(() =>
  ALL_DECLINE_REASONS.every((reason) =>
    history.current.reasonsSeen.includes(reason),
  ),
);

// Exploration guidance: over the course of a run, at least one bill
// denomination should reach exactly zero while others remain available —
// the partial-exhaustion precondition that made the exact-change-completeness
// counterexample possible in the first place.
// Catalog: atm-denomination-exhausted.
export const denominationExhaustedWhileOthersRemain = eventually(() => {
  const counts = [bills100.current, bills50.current, bills20.current, bills10.current];
  return counts.some((n) => n === 0) && counts.some((n) => n > 0);
});

// Whenever the simulated calendar date shown in the debug clock changes,
// the daily counters (both withdrawnToday figures and "withdrawn
// elsewhere") must read zero shortly after — the concrete answer
// `checkDayReset()` gives to "what does 'daily' mean?". Bounded rather than
// checked on the very next observed state: `resetClock()` ("RESET TO REAL")
// updates the display immediately but doesn't call `checkDayReset()`
// itself — only the 1-second interval timer does, so there's a real gap
// between the display changing and the reset catching up. Confirmed by a
// live run: after "RESET TO REAL", the reset hadn't landed within 2 seconds
// under automation overhead (the interval is real-wall-clock-paced, and CDP
// evaluation adds scheduling jitter on top of the SUT's own 1-second poll).
// 5 seconds comfortably absorbs both without masking a genuinely stuck
// reset.
// Catalog: daily-counters-reset-at-day-boundary.
export const countersResetOnDateChange = always(() => {
  const dateNow = clockDateStr.current;
  return next(() => clockDateStr.current !== dateNow).implies(
    eventually(
      () =>
        accountWithdrawnHere.current === 0 &&
        atmWithdrawn.current === 0 &&
        accountWithdrawnElsewhere.current === 0,
    ).within(5, "seconds"),
  );
});

// `checkDayReset()` compares `state.resetDate` to `todayStr()` by string
// inequality, with no notion of "did real time actually move forward" — so
// rewinding the simulated clock backward across a day boundary resets the
// daily counters exactly as if a real day had passed, even though the real
// wall clock (realDayStr, independent of the app's clockOffset) hasn't
// moved. This is a confirmed, reachable bypass mechanism, kept here as a
// reachability marker rather than a hard failure since the clock control is
// admin/debug-only tooling whose purpose is precisely to let a tester
// construct this scenario — see the open question in
// scratchbook/property-catalog.md before turning this into an `always`.
// Catalog: clock-rewind-resets-counters.
export const clockRewindCausesReset = eventually(() => {
  const realDayNow = realDayStr.current;
  const simDateNow = clockDateStr.current;
  const wasNonZero =
    accountWithdrawnHere.current > 0 ||
    atmWithdrawn.current > 0 ||
    accountWithdrawnElsewhere.current > 0;
  return next(
    () =>
      wasNonZero &&
      realDayStr.current === realDayNow &&
      clockDateStr.current !== simDateNow &&
      accountWithdrawnHere.current === 0 &&
      atmWithdrawn.current === 0 &&
      accountWithdrawnElsewhere.current === 0,
  );
});

// Note: transaction-history-bounded-growth (state.transactions.unshift is
// never trimmed) is intentionally not implemented here — the evaluation
// pass in scratchbook/evaluation/implementability.md found it impractical
// within normal Antithesis timeline limits (it would need a very long
// single-run session to say anything meaningful), and low real-world impact
// given the SUT's intended use as a short-lived teaching demo.

// --- Numeric input actions ---------------------------------------------
//
// Bombadil's default `inputs` action generator types generic filler text
// into editable elements, without regard for `type="number"` fields — it
// never actually inserts numbers. Since almost all of this app's business
// logic (withdrawal limits, exact-change dispensing, daily resets) is only
// reachable by putting real numbers into these fields, we add custom action
// generators that set them directly, both to a curated set of values that
// target the boundaries of the app's rules, and to freeform random digit
// strings for broader fuzzing.

function setInputValue(document: Document, id: string, value: number | string) {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) {
    throw new Error(`Input #${id} not found`);
  }
  input.focus();
  input.value = String(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const setAmount = registerCustomAction(
  "setAmount",
  async (document, _window, value: number) => {
    setInputValue(document, "amountInput", value);
  },
);

const setElsewhere = registerCustomAction(
  "setElsewhere",
  async (document, _window, value: number) => {
    setInputValue(document, "inputElsewhere", value);
  },
);

const setAdminField = registerCustomAction(
  "setAdminField",
  async (document, _window, id: string, value: number) => {
    setInputValue(document, id, value);
  },
);

// Sets the admin panel's simulated-clock field directly, so the default
// `clicks` generator has a value to submit via "SET CLOCK". Used to drive
// countersResetOnDateChange and clockRewindCausesReset (Antithesis Angle for
// daily-counters-reset-at-day-boundary / clock-rewind-resets-counters):
// fixed far-past and far-future values guarantee a day-boundary crossing in
// both directions without needing to compute an offset from the current
// clock.
const setClock = registerCustomAction(
  "setClock",
  async (document, _window, isoDatetimeLocal: string) => {
    setInputValue(document, "cfgClock", isoDatetimeLocal);
  },
);

// Targets the visible withdrawal amount field with values chosen to sit
// right on the boundaries of the app's own rules: zero, the smallest valid
// bill, a non-multiple-of-10 (should be rejected), exactly at/one-step-over
// the account limit / ATM limit / balance, a couple of round numbers, a
// negative value for general robustness, and two fractional amounts
// targeting fractional-amount-truncated-not-rejected (a fixed, deterministic
// scenario per scratchbook/property-catalog.md's Antithesis Angle note,
// since this defect doesn't need fault injection to reproduce).
export const withdrawAmountEntry = actions(() => [
  setAmount(0),
  setAmount(10),
  setAmount(15),
  setAmount(-10),
  setAmount(accountRemaining.current),
  setAmount(accountRemaining.current + 10),
  setAmount(atmRemaining.current),
  setAmount(atmRemaining.current + 10),
  setAmount(balance.current),
  setAmount(balance.current + 10),
  setAmount(20),
  setAmount(50),
  setAmount(1000),
  setAmount(300.5),
  setAmount(10.5),
]);

// Targets the "withdrawn at other ATMs" debug field, which can be edited
// independently of past withdrawals made at this ATM — including values
// that push the account's daily total over its limit after the fact.
export const elsewhereEntry = actions(() => [
  setElsewhere(0),
  setElsewhere(accountLimit.current),
  setElsewhere(accountLimit.current + 10),
  setElsewhere(accountLimit.current * 2),
]);

// Targets the admin panel's numeric fields (cash refill counts, daily
// limits, account balance) when the panel is open, so the "APPLY" action
// (already offered by the default `clicks` generator) has interesting
// values to commit.
export const adminFieldEntry = actions(() => {
  if (!adminOpen.current) {
    return [];
  }
  return [
    setAdminField("cfgBalance", 0),
    setAdminField("cfgBalance", 100),
    setAdminField("cfgBalance", 5000),
    setAdminField("cfgAtmLimit", 0),
    setAdminField("cfgAtmLimit", 300),
    setAdminField("cfgAccLimit", 0),
    setAdminField("cfgAccLimit", 500),
    setAdminField("refill100", 0),
    setAdminField("refill100", 20),
    setAdminField("refill50", 0),
    setAdminField("refill50", 20),
    setAdminField("refill20", 0),
    setAdminField("refill20", 20),
    setAdminField("refill10", 0),
    setAdminField("refill10", 20),
  ];
});

// Targets the admin panel's clock field when the panel is open, with a
// fixed far-past and far-future datetime — see setClock above.
export const clockEntry = actions(() => {
  if (!adminOpen.current) {
    return [];
  }
  return [setClock("2020-01-01T00:00"), setClock("2099-01-01T00:00")];
});

// Broader, uncurated fuzzing: types random digit strings into whatever
// element currently has focus, complementing the targeted actions above.
export const randomDigitEntry = actions(() => [
  { TypeText: { text: { Regexp: "[0-9]{1,4}" }, delayMillis: [10, 60] } },
  { TypeText: { text: { Regexp: "-?[0-9]{1,4}" }, delayMillis: [10, 60] } },
]);
