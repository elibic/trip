// חישוב התחשבנות בין משפחות — פונקציה טהורה, בלי תלות ב-Firebase.
// families: { famId: {name} }, expenses: { expId: {paidByFamilyId, amount, splitAmong?} }
// מחזיר: { total, perFamily: {famId: {paid, share, net}}, transfers: [{from, to, amount}] }
export function computeSettlement(families, expenses) {
  const famIds = Object.keys(families || {});
  const perFamily = {};
  for (const id of famIds) perFamily[id] = { paid: 0, share: 0, net: 0 };

  let total = 0;
  for (const exp of Object.values(expenses || {})) {
    const amount = Number(exp.amount) || 0;
    if (amount <= 0) continue;
    total += amount;

    if (perFamily[exp.paidByFamilyId]) perFamily[exp.paidByFamilyId].paid += amount;

    let participants = exp.splitAmong
      ? Object.keys(exp.splitAmong).filter((id) => perFamily[id])
      : famIds;
    if (participants.length === 0) participants = famIds;
    const share = amount / participants.length;
    for (const id of participants) perFamily[id].share += share;
  }

  for (const id of famIds) perFamily[id].net = perFamily[id].paid - perFamily[id].share;

  // העברות מינימליות: התאמה חמדנית של החייב הגדול לזכאי הגדול
  const debtors = famIds.filter((id) => perFamily[id].net < -0.01)
    .map((id) => ({ id, amt: -perFamily[id].net }));
  const creditors = famIds.filter((id) => perFamily[id].net > 0.01)
    .map((id) => ({ id, amt: perFamily[id].net }));

  const transfers = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.amt - a.amt);
    creditors.sort((a, b) => b.amt - a.amt);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.amt, c.amt);
    transfers.push({ from: d.id, to: c.id, amount });
    d.amt -= amount;
    c.amt -= amount;
    if (d.amt < 0.01) debtors.shift();
    if (c.amt < 0.01) creditors.shift();
  }

  return { total, perFamily, transfers };
}
