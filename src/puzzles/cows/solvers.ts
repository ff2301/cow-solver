import type { CowPuzzle, CowSolverId, EnumerationReport, SolveReport } from "../../core/types";
import { enumerateWithLocalSolver, solveWithLocalSolver } from "./localSolver";
import { enumerateWithLogicSolver, solveWithLogicSolver } from "./logicSolver";

export const solverOptions: Array<{ id: CowSolverId; label: string }> = [
  { id: "local", label: "Local DFS" },
  { id: "logic", label: "Logic SAT" }
];

export function solveCowPuzzle(puzzle: CowPuzzle, solverId: CowSolverId): SolveReport {
  if (solverId === "logic") return solveWithLogicSolver(puzzle);
  return solveWithLocalSolver(puzzle);
}

export function enumerateCowPuzzle(puzzle: CowPuzzle, solverId: CowSolverId, limit = 200): EnumerationReport {
  if (solverId === "logic") return enumerateWithLogicSolver(puzzle, limit);
  return enumerateWithLocalSolver(puzzle, limit);
}
