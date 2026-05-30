import type { AnalysisReport, CowPuzzle, CowSolution, CowSolverId } from "../../core/types";
import { analyzeFromSolutions } from "./localSolver";
import { enumerateCowPuzzle } from "./solvers";

export async function isUnique(puzzle: CowPuzzle, solverId: CowSolverId): Promise<{
  hasSolution: boolean;
  unique: boolean;
  engine: string;
  message?: string;
}> {
  const result = enumerateCowPuzzle(puzzle, solverId, 2);
  return {
    hasSolution: result.solutions.length > 0,
    unique: result.solutions.length === 1 && !result.hitLimit,
    engine: result.engine,
    message: result.message
  };
}

export async function analyzeCells(
  puzzle: CowPuzzle,
  solverId: CowSolverId,
  limit = 500
): Promise<AnalysisReport & { engine: string; message?: string }> {
  const result = enumerateCowPuzzle(puzzle, solverId, limit);
  return {
    solutionCount: result.solutions.length,
    hitLimit: result.hitLimit,
    cells: result.solutions.length > 0
      ? analyzeFromSolutions(puzzle, result.solutions)
      : { forcedCow: [], forcedEmpty: [], undecided: [] },
    engine: result.engine,
    message: result.message
  };
}

export function minimumGuessCount(solutions: CowSolution[]): number {
  const memo = new Map<string, number>();

  function keyOf(set: CowSolution[]): string {
    return set.map((solution) => solution.cows.map((cow) => `${cow.row},${cow.col}`).join(";")).sort().join("|");
  }

  function solve(set: CowSolution[]): number {
    if (set.length <= 1) return 0;
    const key = keyOf(set);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let best = Number.POSITIVE_INFINITY;
    const rows = set[0].matrix.length;
    const cols = set[0].matrix[0].length;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const yes = set.filter((solution) => solution.matrix[row][col]);
        const no = set.filter((solution) => !solution.matrix[row][col]);
        if (yes.length === 0 || no.length === 0) continue;
        best = Math.min(best, 1 + Math.max(solve(yes), solve(no)));
      }
    }

    const result = Number.isFinite(best) ? best : 0;
    memo.set(key, result);
    return result;
  }

  return solve(solutions);
}
