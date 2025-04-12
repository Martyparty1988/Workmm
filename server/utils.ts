// Calculate deduction based on person
export function calculateDeduction(earnings: number, person: "maru" | "marty"): number {
  const rates = { maru: 1/3, marty: 0.5 };
  return earnings * rates[person];
}
