import type {
  CellAnalysis,
  CowPlacement,
  CowPuzzle,
  CowSolution,
  EnumerationReport,
  GridCell,
  SolveReport
} from "../../core/types";

function colorOrder(puzzle: CowPuzzle): string[] {
  const counts = new Map<string, number>();
  for (const row of puzzle.grid) {
    for (const color of row) {
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }
  return Object.keys(puzzle.colors).sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0));
}

function cellsForColor(puzzle: CowPuzzle, color: string): CowPlacement[] {
  const cells: CowPlacement[] = [];
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      if (puzzle.grid[row]?.[col] === color) {
        cells.push({ row, col, color });
      }
    }
  }
  return cells;
}

function adjacent(a: GridCell, b: GridCell): boolean {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1;
}

function toSolution(puzzle: CowPuzzle, cows: CowPlacement[]): CowSolution {
  const matrix = Array.from({ length: puzzle.rows }, () => Array.from({ length: puzzle.cols }, () => false));
  for (const cow of cows) {
    matrix[cow.row][cow.col] = true;
  }
  return {
    cows: [...cows].sort((a, b) => a.row - b.row || a.col - b.col),
    matrix
  };
}

export function enumerateWithFallback(puzzle: CowPuzzle, limit = 200): EnumerationReport {
  const order = colorOrder(puzzle);
  const byColor = new Map(order.map((color) => [color, cellsForColor(puzzle, color)]));
  const solutions: CowSolution[] = [];
  const rowsUsed = new Set<number>();
  const colsUsed = new Set<number>();
  const cows: CowPlacement[] = [];

  function canPlace(cell: CowPlacement): boolean {
    if (puzzle.requireOnePerRow && rowsUsed.has(cell.row)) return false;
    if (puzzle.requireOnePerCol && colsUsed.has(cell.col)) return false;
    return cows.every((cow) => !adjacent(cow, cell));
  }

  function place(cell: CowPlacement): void {
    cows.push(cell);
    rowsUsed.add(cell.row);
    colsUsed.add(cell.col);
  }

  function unplace(cell: CowPlacement): void {
    cows.pop();
    if (!cows.some((cow) => cow.row === cell.row)) rowsUsed.delete(cell.row);
    if (!cows.some((cow) => cow.col === cell.col)) colsUsed.delete(cell.col);
  }

  function search(index: number): boolean {
    if (solutions.length >= limit) return true;
    if (index === order.length) {
      solutions.push(toSolution(puzzle, cows));
      return solutions.length >= limit;
    }

    const color = order[index];
    const candidates = byColor.get(color) ?? [];
    for (const cell of candidates) {
      if (!canPlace(cell)) continue;
      place(cell);
      if (search(index + 1)) return true;
      unplace(cell);
    }
    return false;
  }

  search(0);

  return {
    status: solutions.length > 0 ? "sat" : "unsat",
    solutions,
    hitLimit: solutions.length >= limit,
    usedFallback: true,
    message: "Z3 unavailable; used bounded exact search fallback."
  };
}

export function solveWithFallback(puzzle: CowPuzzle): SolveReport {
  const result = enumerateWithFallback(puzzle, 1);
  return {
    status: result.status,
    solution: result.solutions[0] ?? null,
    usedFallback: true,
    message: result.message
  };
}

export function analyzeFromSolutions(puzzle: CowPuzzle, solutions: CowSolution[]): CellAnalysis {
  const forcedCow: GridCell[] = [];
  const forcedEmpty: GridCell[] = [];
  const undecided: GridCell[] = [];

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      const count = solutions.filter((solution) => solution.matrix[row][col]).length;
      if (count === solutions.length) {
        forcedCow.push({ row, col });
      } else if (count === 0) {
        forcedEmpty.push({ row, col });
      } else {
        undecided.push({ row, col });
      }
    }
  }

  return { forcedCow, forcedEmpty, undecided };
}
