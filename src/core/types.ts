export type ColorId = string;

export interface GridCell {
  row: number;
  col: number;
}

export interface CowPuzzle {
  rows: number;
  cols: number;
  colors: Record<ColorId, string>;
  grid: ColorId[][];
  requireOnePerRow: boolean;
  requireOnePerCol: boolean;
}

export interface CowPlacement extends GridCell {
  color: ColorId;
}

export interface CowSolution {
  cows: CowPlacement[];
  matrix: boolean[][];
}

export type SolverStatus = "sat" | "unsat" | "unknown";

export interface SolveReport {
  status: SolverStatus;
  solution: CowSolution | null;
  usedFallback: boolean;
  message?: string;
}

export interface EnumerationReport {
  status: SolverStatus;
  solutions: CowSolution[];
  hitLimit: boolean;
  usedFallback: boolean;
  message?: string;
}

export interface CellAnalysis {
  forcedCow: GridCell[];
  forcedEmpty: GridCell[];
  undecided: GridCell[];
}

export interface AnalysisReport {
  solutionCount: number;
  hitLimit: boolean;
  cells: CellAnalysis;
}

export interface CropBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}
