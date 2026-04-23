export function calculateHonestyScore(consistentActions: number, totalComparableStatements: number): number {
  if (totalComparableStatements <= 0) {
    return 0;
  }

  return Number(((consistentActions / totalComparableStatements) * 100).toFixed(2));
}
