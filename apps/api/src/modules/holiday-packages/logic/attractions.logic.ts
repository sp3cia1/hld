/** Something a day can take, and what it costs. */
export type Option = { id: string; cost: number };

/**
 * Gives every day a different option at the lowest total cost, or returns null when that is impossible.
 * `options` lists what each day can take.
 *
 * This is the assignment problem (days × options), solved exactly with the Hungarian algorithm, O(days² ×
 * options). A greedy pick can fail or overpay: if day 1 takes the only free option that day 2 also needs, day 2 may
 * be left with nothing, or with an expensive one. On equal cost, options that appear earlier in the lists win.
 */
export function assignCheapest(
  days: string[],
  options: Map<string, Option[]>,
): Map<string, string> | null {
  // Every option once, in the order it first appears: that order breaks ties.
  const ids = [...new Set(days.flatMap((day) => (options.get(day) ?? []).map((o) => o.id)))];
  if (days.length === 0) return new Map();
  if (ids.length < days.length) return null;

  // Cost decides first. The id's position only splits equal costs: `weight` is larger than any sum of positions.
  const weight = days.length * ids.length + 1;
  const maxCost = Math.max(
    0,
    ...days.flatMap((day) => (options.get(day) ?? []).map((o) => o.cost)),
  );
  // More than any whole assignment of allowed options can cost, so a forbidden pair is never chosen if avoidable.
  const forbidden = days.length * ((maxCost + 1) * weight) + 1;

  const cost = days.map((day) => {
    const allowed = new Map((options.get(day) ?? []).map((o) => [o.id, o.cost]));
    return ids.map((id, position) => {
      const price = allowed.get(id);
      return price === undefined ? forbidden : price * weight + position;
    });
  });

  const columnOfRow = hungarian(cost);
  const assignment = new Map<string, string>();
  for (const [row, day] of days.entries()) {
    const column = columnOfRow[row];
    if (cost[row][column] >= forbidden) return null;
    assignment.set(day, ids[column]);
  }
  return assignment;
}

/**
 * Minimum-cost assignment of every row to a different column, for a matrix with no more rows than columns.
 * Returns the column of each row. The classic potentials version (Kuhn-Munkres), with 1-based working arrays.
 */
function hungarian(cost: number[][]): number[] {
  const rows = cost.length;
  const columns = cost[0].length;
  const u = new Array<number>(rows + 1).fill(0);
  const v = new Array<number>(columns + 1).fill(0);
  const rowOfColumn = new Array<number>(columns + 1).fill(0);
  const way = new Array<number>(columns + 1).fill(0);

  for (let row = 1; row <= rows; row++) {
    rowOfColumn[0] = row;
    let column0 = 0;
    const minSlack = new Array<number>(columns + 1).fill(Infinity);
    const used = new Array<boolean>(columns + 1).fill(false);
    do {
      used[column0] = true;
      const row0 = rowOfColumn[column0];
      let delta = Infinity;
      let column1 = 0;
      for (let column = 1; column <= columns; column++) {
        if (used[column]) continue;
        const slack = cost[row0 - 1][column - 1] - u[row0] - v[column];
        if (slack < minSlack[column]) {
          minSlack[column] = slack;
          way[column] = column0;
        }
        if (minSlack[column] < delta) {
          delta = minSlack[column];
          column1 = column;
        }
      }
      for (let column = 0; column <= columns; column++) {
        if (used[column]) {
          u[rowOfColumn[column]] += delta;
          v[column] -= delta;
        } else {
          minSlack[column] -= delta;
        }
      }
      column0 = column1;
    } while (rowOfColumn[column0] !== 0);
    do {
      const column1 = way[column0];
      rowOfColumn[column0] = rowOfColumn[column1];
      column0 = column1;
    } while (column0 !== 0);
  }

  const columnOfRow = new Array<number>(rows).fill(0);
  for (let column = 1; column <= columns; column++) {
    if (rowOfColumn[column] !== 0) columnOfRow[rowOfColumn[column] - 1] = column - 1;
  }
  return columnOfRow;
}
