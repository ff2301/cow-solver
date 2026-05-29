import type { CowPuzzle } from "../../core/types";

export const samplePuzzle: CowPuzzle = {
  rows: 6,
  cols: 6,
  requireOnePerRow: true,
  requireOnePerCol: true,
  colors: {
    rose: "#bf5f8b",
    sky: "#66b7dc",
    gold: "#e9c247",
    teal: "#4db2b2",
    pink: "#e5a1c4",
    mist: "#a7bdd8"
  },
  grid: [
    ["rose", "rose", "rose", "rose", "rose", "mist"],
    ["sky", "gold", "rose", "rose", "rose", "rose"],
    ["sky", "gold", "rose", "rose", "rose", "rose"],
    ["sky", "gold", "teal", "teal", "rose", "pink"],
    ["sky", "gold", "gold", "teal", "pink", "pink"],
    ["gold", "gold", "gold", "teal", "teal", "pink"]
  ]
};

export function clonePuzzle(puzzle: CowPuzzle): CowPuzzle {
  return {
    ...puzzle,
    colors: { ...puzzle.colors },
    grid: puzzle.grid.map((row) => [...row])
  };
}
