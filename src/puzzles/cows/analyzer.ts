import type { AnalysisReport, CowPuzzle, CowSolution } from "../../core/types";
import { analyzeFromSolutions } from "./fallbackSolver";
import { enumerateWithZ3 } from "./z3Solver";

export async function isUnique(puzzle: CowPuzzle): Promise<{
  hasSolution: boolean;
  unique: boolean;
  usedFallback: boolean;
  message?: string;
}> {
  const result = await enumerateWithZ3(puzzle, 2);
  return {
    hasSolution: result.solutions.length > 0,
    unique: result.solutions.length === 1 && !result.hitLimit,
    usedFallback: result.usedFallback,
    message: result.message
  };
}

export async function analyzeCells(puzzle: CowPuzzle, limit = 500): Promise<AnalysisReport & { usedFallback: boolean; message?: string }> {
  const result = await enumerateWithZ3(puzzle, limit);
  return {
    solutionCount: result.solutions.length,
    hitLimit: result.hitLimit,
    cells: result.solutions.length > 0
      ? analyzeFromSolutions(puzzle, result.solutions)
      : { forcedCow: [], forcedEmpty: [], undecided: [] },
    usedFallback: result.usedFallback,
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
