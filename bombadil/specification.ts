// Bombadil specification for the ATM Simulator (https://qe-at-cgi-fi.github.io/atm/).
//
// The app is a single-page, client-side ATM simulator. All state lives in an
// in-page `state` object (not exposed on `window`) and is rendered into
// specific elements by id, so properties here read the rendered DOM text
// rather than the JS state directly.
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
//   #messageBox          Last withdrawal result ("success"/"error" class + text)
//   #history             Transaction list

import { extract, always } from "@antithesishq/bombadil";
import { actions, registerCustomAction } from "@antithesishq/bombadil/browser";

// Re-export Bombadil's default properties (no console errors, no uncaught
// exceptions, no unhandled promise rejections, no 4xx/5xx responses) and
// default action generators (clicks, inputs, navigation, scroll, ...), which
// drive all the exploration for this specification.
export * from "@antithesishq/bombadil/browser/defaults";

function euros(text: string | null | undefined): number {
  if (!text) return 0;
  const match = text.replace(/ /g, " ").match(/-?\d+/);
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

// --- Properties -------------------------------------------------------

// The account balance is only ever debited by withdrawals or set directly
// via the admin panel, but should never be allowed to go negative.
export const balanceNeverNegative = always(() => balance.current >= 0);

// Cash counts per denomination should never go negative — the app clamps
// admin refill values with Math.max(0, ...) and only dispenses bills it has.
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
// limit allows.
export const atmWithdrawalsRespectAtmLimit = always(
  () => atmWithdrawn.current <= atmLimit.current,
);

// The account must never withdraw more, across this ATM and the simulated
// "other ATMs" total, than its own daily limit allows. Note: the "withdrawn
// at other ATMs" debug field has no upper bound (no HTML `max`, and the app
// only clamps it to >= 0), so this is trivially violated just by typing a
// large number into that one field — no actual over-limit withdrawal at
// this ATM is required. That's a real, easily reproducible finding.
export const accountWithdrawalsRespectAccountLimit = always(
  () =>
    accountWithdrawnHere.current + accountWithdrawnElsewhere.current <=
    accountLimit.current,
);

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

const adminOpen = extract(
  (state) =>
    state.document.querySelector("#adminPanel")?.classList.contains("open") ??
    false,
);

function setInputValue(document: Document, id: string, value: number) {
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

// Targets the visible withdrawal amount field with values chosen to sit
// right on the boundaries of the app's own rules: zero, the smallest valid
// bill, a non-multiple-of-10 (should be rejected), exactly at/one-step-over
// the account limit / ATM limit / balance, and a couple of round numbers
// and a negative value for general robustness.
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

// Broader, uncurated fuzzing: types random digit strings into whatever
// element currently has focus, complementing the targeted actions above.
export const randomDigitEntry = actions(() => [
  { TypeText: { text: { Regexp: "[0-9]{1,4}" }, delayMillis: [10, 60] } },
  { TypeText: { text: { Regexp: "-?[0-9]{1,4}" }, delayMillis: [10, 60] } },
]);
