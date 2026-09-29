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
// "other ATMs" total, than its own daily limit allows. This can be violated
// by editing "withdrawn at other ATMs" *after* withdrawals have already
// happened at this ATM, since the app does not retroactively re-check past
// withdrawals against a newly lowered budget.
export const accountWithdrawalsRespectAccountLimit = always(
  () =>
    accountWithdrawnHere.current + accountWithdrawnElsewhere.current <=
    accountLimit.current,
);
