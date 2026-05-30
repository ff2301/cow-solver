import * as Logic from "logic-solver";
import type { CowPlacement, CowPuzzle, CowSolution, EnumerationReport, SolveReport } from "../../core/types";

function varName(row: number, col: number): string {
  return `x_${row}_${col}`;
}

function cellVars(puzzle: CowPuzzle): string[][] {
  return Array.from({ length: puzzle.rows }, (_, row) =>
    Array.from({ length: puzzle.cols }, (_, col) => varName(row, col))
  );
}

function colorCells(puzzle: CowPuzzle, vars: string[][], color: string): string[] {
  const cells: string[] = [];
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      if (puzzle.grid[row]?.[col] === color) cells.push(vars[row][col]);
    }
  }
  return cells;
}

function solutionFromAssignment(puzzle: CowPuzzle, vars: string[][], solution: { evaluate(expression: string): boolean }): CowSolution {
  const matrix = Array.from({ length: puzzle.rows }, () => Array.from({ length: puzzle.cols }, () => false));
  const cows: CowPlacement[] = [];

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      if (solution.evaluate(vars[row][col])) {
        matrix[row][col] = true;
        cows.push({ row, col, color: puzzle.grid[row][col] });
      }
    }
  }

  return {
    cows: cows.sort((a, b) => a.row - b.row || a.col - b.col),
    matrix
  };
}

function addPuzzleConstraints(solver: Logic.Solver, puzzle: CowPuzzle, vars: string[][]): void {
  for (const color of Object.keys(puzzle.colors)) {
    solver.require(Logic.exactlyOne(colorCells(puzzle, vars, color)));
  }

  if (puzzle.requireOnePerRow) {
    for (let row = 0; row < puzzle.rows; row += 1) {
      solver.require(Logic.exactlyOne(vars[row]));
    }
  }

  if (puzzle.requireOnePerCol) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      solver.require(Logic.exactlyOne(vars.map((row) => row[col])));
    }
  }

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      for (let nextRow = row - 1; nextRow <= row + 1; nextRow += 1) {
        for (let nextCol = col - 1; nextCol <= col + 1; nextCol += 1) {
          if (nextRow < 0 || nextCol < 0 || nextRow >= puzzle.rows || nextCol >= puzzle.cols) continue;
          if (nextRow < row || (nextRow === row && nextCol <= col)) continue;
          solver.require(Logic.atMostOne(vars[row][col], vars[nextRow][nextCol]));
        }
      }
    }
  }
}

function blockSolution(solver: Logic.Solver, solution: CowSolution, vars: string[][]): void {
  const differences: string[] = [];
  for (let row = 0; row < solution.matrix.length; row += 1) {
    for (let col = 0; col < solution.matrix[row].length; col += 1) {
      differences.push(solution.matrix[row][col] ? `-${vars[row][col]}` : vars[row][col]);
    }
  }
  solver.require(Logic.or(differences));
}

export function enumerateWithLogicSolver(puzzle: CowPuzzle, limit = 200): EnumerationReport {
  const solver = new Logic.Solver();
  const vars = cellVars(puzzle);
  const solutions: CowSolution[] = [];

  addPuzzleConstraints(solver, puzzle, vars);

  while (solutions.length < limit) {
    const assignment = solver.solve();
    if (!assignment) break;
    const solution = solutionFromAssignment(puzzle, vars, assignment);
    solutions.push(solution);
    blockSolution(solver, solution, vars);
  }

  return {
    status: solutions.length > 0 ? "sat" : "unsat",
    solutions,
    hitLimit: solutions.length >= limit,
    engine: "Logic solver"
  };
}

export function solveWithLogicSolver(puzzle: CowPuzzle): SolveReport {
  const result = enumerateWithLogicSolver(puzzle, 1);
  return {
    status: result.status,
    solution: result.solutions[0] ?? null,
    engine: result.engine,
    message: result.message
  };
}
