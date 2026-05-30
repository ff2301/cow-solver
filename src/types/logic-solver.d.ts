declare module "logic-solver" {
  export interface Formula {
    _logicSolverFormulaBrand?: never;
  }

  export type Term = string | Formula;

  export class Solver {
    require(...formulas: Array<Term | Term[]>): void;
    forbid(...formulas: Array<Term | Term[]>): void;
    solve(): Solution | null;
    solveAssuming(formula: Term): Solution | null;
  }

  export interface Solution {
    getTrueVars(): string[];
    evaluate(expression: Term): boolean;
    getFormula(): Formula;
  }

  export function not(operand: Term): Formula;
  export function or(...operands: Array<Term | Term[]>): Formula;
  export function and(...operands: Array<Term | Term[]>): Formula;
  export function exactlyOne(...operands: Array<Term | Term[]>): Formula;
  export function atMostOne(...operands: Array<Term | Term[]>): Formula;
}
