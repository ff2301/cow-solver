# Cow Solver

Vite + React + TypeScript puzzle solver for the cow placement game.

## Features

- Upload a screenshot from desktop or phone browser.
- Sample a configurable grid from the screenshot into color regions.
- Manually correct cell colors when image parsing is imperfect.
- Solve with either a local exact DFS engine or a bundled JavaScript SAT engine.
- Save the preferred solver locally and show elapsed time for comparison.
- Check whether a puzzle is unsatisfiable, unique, or has multiple solutions.
- Enumerate solutions with a configurable limit in code.
- Analyze forced cow, forced empty, and undecided cells.

## Rules Modeled

- A puzzle is an `n x m` color grid.
- Each color must contain exactly one cow.
- Each row may optionally contain exactly one cow.
- Each column may optionally contain exactly one cow.
- No two cows may touch in the 8-neighborhood.

The screenshot sample uses the row and column constraints because the game UI says every row and every column has exactly one cow.

## Run

```bash
pnpm install
pnpm run dev
```

For phone upload on the same LAN, open the Network URL printed by Vite. The default dev port is `5174`.

## Structure

- `src/core`: shared puzzle and solver data types.
- `src/puzzles/cows`: cow puzzle examples, solver implementations, and analysis.
- `src/vision`: screenshot grid sampling and color clustering.
- `src/App.tsx`: current React UI.

## Notes

Image recognition is intentionally semi-automatic in this first version: adjust crop sliders, sample the grid, then correct colors by clicking cells. That is more reliable across phone screenshots than assuming one fixed screenshot geometry.
