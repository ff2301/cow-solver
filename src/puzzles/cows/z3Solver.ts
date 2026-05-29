import type { CowPuzzle, CowSolution, EnumerationReport, SolveReport } from "../../core/types";
import { enumerateWithFallback } from "./fallbackSolver";

type Z3Context = Record<string, any>;
type Z3SolverInstance = Record<string, any>;

function asArrayCall(ctx: Z3Context, name: string, values: any[]): any {
  const fn = ctx[name];
  if (typeof fn !== "function") {
    throw new Error(`Z3 context missing ${name}`);
  }
  if (values.length === 1) return values[0];
  try {
    return fn(...values);
  } catch {
    return fn(values);
  }
}

function and(ctx: Z3Context, values: any[]): any {
  return asArrayCall(ctx, "And", values);
}

function or(ctx: Z3Context, values: any[]): any {
  return asArrayCall(ctx, "Or", values);
}

function not(ctx: Z3Context, value: any): any {
  return ctx.Not(value);
}

function exactlyOne(ctx: Z3Context, vars: any[]): any[] {
  const constraints: any[] = [];
  if (vars.length === 0) {
    constraints.push(ctx.Bool.val(false));
    return constraints;
  }
  constraints.push(or(ctx, vars));
  for (let i = 0; i < vars.length; i += 1) {
    for (let j = i + 1; j < vars.length; j += 1) {
      constraints.push(not(ctx, and(ctx, [vars[i], vars[j]])));
    }
  }
  return constraints;
}

function modelBool(model: any, value: any): boolean {
  const evaluated = model.eval(value, true);
  return String(evaluated) === "true";
}

async function createZ3() {
  const z3Module = await import("z3-solver");
  const init = (z3Module as any).init ?? (z3Module as any).default?.init;
  if (typeof init !== "function") {
    throw new Error("z3-solver init export not found");
  }
  const api = await init();
  return api.Context("cow-solver") as Z3Context;
}

function buildVariables(ctx: Z3Context, puzzle: CowPuzzle): any[][] {
  return Array.from({ length: puzzle.rows }, (_, row) =>
    Array.from({ length: puzzle.cols }, (_, col) => ctx.Bool.const(`x_${row}_${col}`))
  );
}

function colorCells(puzzle: CowPuzzle, vars: any[][], color: string): any[] {
  const cells: any[] = [];
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      if (puzzle.grid[row]?.[col] === color) {
        cells.push(vars[row][col]);
      }
    }
  }
  return cells;
}

function solutionFromModel(puzzle: CowPuzzle, vars: any[][], model: any): CowSolution {
  const matrix = Array.from({ length: puzzle.rows }, () => Array.from({ length: puzzle.cols }, () => false));
  const cows = [];
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      if (modelBool(model, vars[row][col])) {
        matrix[row][col] = true;
        cows.push({ row, col, color: puzzle.grid[row][col] });
      }
    }
  }
  return { cows, matrix };
}

function addPuzzleConstraints(ctx: Z3Context, solver: Z3SolverInstance, puzzle: CowPuzzle, vars: any[][]): void {
  for (const color of Object.keys(puzzle.colors)) {
    for (const constraint of exactlyOne(ctx, colorCells(puzzle, vars, color))) {
      solver.add(constraint);
    }
  }

  if (puzzle.requireOnePerRow) {
    for (let row = 0; row < puzzle.rows; row += 1) {
      solver.add(...exactlyOne(ctx, vars[row]));
    }
  }

  if (puzzle.requireOnePerCol) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      solver.add(...exactlyOne(ctx, vars.map((row) => row[col])));
    }
  }

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      for (let nextRow = row - 1; nextRow <= row + 1; nextRow += 1) {
        for (let nextCol = col - 1; nextCol <= col + 1; nextCol += 1) {
          if (nextRow < 0 || nextCol < 0 || nextRow >= puzzle.rows || nextCol >= puzzle.cols) continue;
          if (nextRow < row || (nextRow === row && nextCol <= col)) continue;
          solver.add(not(ctx, and(ctx, [vars[row][col], vars[nextRow][nextCol]])));
        }
      }
    }
  }
}

function addBlockingClause(ctx: Z3Context, solver: Z3SolverInstance, solution: CowSolution, vars: any[][]): void {
  const differences: any[] = [];
  for (let row = 0; row < solution.matrix.length; row += 1) {
    for (let col = 0; col < solution.matrix[row].length; col += 1) {
      differences.push(solution.matrix[row][col] ? not(ctx, vars[row][col]) : vars[row][col]);
    }
  }
  solver.add(or(ctx, differences));
}

export async function enumerateWithZ3(puzzle: CowPuzzle, limit = 200): Promise<EnumerationReport> {
  try {
    const ctx = await createZ3();
    const solver = new ctx.Solver();
    const vars = buildVariables(ctx, puzzle);
    const solutions: CowSolution[] = [];
    addPuzzleConstraints(ctx, solver, puzzle, vars);

    while (solutions.length < limit) {
      const status = await solver.check();
      if (String(status) !== "sat") break;
      const solution = solutionFromModel(puzzle, vars, solver.model());
      solutions.push(solution);
      addBlockingClause(ctx, solver, solution, vars);
    }

    return {
      status: solutions.length > 0 ? "sat" : "unsat",
      solutions,
      hitLimit: solutions.length >= limit,
      usedFallback: false
    };
  } catch (error) {
    const fallback = enumerateWithFallback(puzzle, limit);
    return {
      ...fallback,
      message: error instanceof Error ? `${fallback.message} ${error.message}` : fallback.message
    };
  }
}

export async function solveWithZ3(puzzle: CowPuzzle): Promise<SolveReport> {
  const result = await enumerateWithZ3(puzzle, 1);
  return {
    status: result.status,
    solution: result.solutions[0] ?? null,
    usedFallback: result.usedFallback,
    message: result.message
  };
}
