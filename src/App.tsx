import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleOff,
  FileImage,
  Grid3X3,
  ListChecks,
  Play,
  RefreshCcw,
  Search,
  Upload
} from "lucide-react";
import type { AnalysisReport, ColorId, CowPuzzle, CowSolution, CropBounds, EnumerationReport } from "./core/types";
import { analyzeCells, isUnique } from "./puzzles/cows/analyzer";
import { clonePuzzle, samplePuzzle } from "./puzzles/cows/examples";
import { enumerateWithLocalSolver, solveWithLocalSolver } from "./puzzles/cows/localSolver";
import { defaultCrop, samplePuzzleFromImage } from "./vision/imageGrid";

type RunState = "idle" | "running";

const CROP_SETTINGS_KEY = "cow-solver.crop-settings.v1";
const SAMPLE_IMAGE_URL = `${import.meta.env.BASE_URL}sample-cow-puzzle.jpg`;

interface CropSettings {
  crop: CropBounds;
  clusterThreshold: number;
}

function firstColor(puzzle: CowPuzzle): ColorId {
  return Object.keys(puzzle.colors)[0] ?? "c1";
}

function blankPuzzle(rows = 6, cols = 6): CowPuzzle {
  return {
    rows,
    cols,
    requireOnePerRow: true,
    requireOnePerCol: true,
    colors: { c1: "#d7dde5" },
    grid: Array.from({ length: rows }, () => Array.from({ length: cols }, () => "c1"))
  };
}

function resizePuzzle(puzzle: CowPuzzle, rows: number, cols: number): CowPuzzle {
  const defaultColor = firstColor(puzzle);
  const grid = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => puzzle.grid[row]?.[col] ?? defaultColor)
  );
  return { ...puzzle, rows, cols, grid };
}

function coordinateKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function loadCropSettings(): CropSettings {
  if (typeof window === "undefined") return { crop: defaultCrop, clusterThreshold: 50 };
  try {
    const saved = window.localStorage.getItem(CROP_SETTINGS_KEY);
    if (!saved) return { crop: defaultCrop, clusterThreshold: 50 };
    const parsed = JSON.parse(saved) as Partial<CropSettings>;
    const crop = parsed.crop;
    if (
      !crop ||
      !validNumber(crop.left) ||
      !validNumber(crop.top) ||
      !validNumber(crop.width) ||
      !validNumber(crop.height)
    ) {
      return { crop: defaultCrop, clusterThreshold: 50 };
    }
    const left = clamp(crop.left, 0, 0.88);
    const top = clamp(crop.top, 0, 0.88);
    return {
      crop: {
        left,
        top,
        width: clamp(crop.width, 0.12, 1 - left),
        height: clamp(crop.height, 0.12, 1 - top)
      },
      clusterThreshold: validNumber(parsed.clusterThreshold) ? clamp(parsed.clusterThreshold, 16, 90) : 50
    };
  } catch {
    return { crop: defaultCrop, clusterThreshold: 50 };
  }
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export default function App() {
  const initialCropSettings = useMemo(() => loadCropSettings(), []);
  const [puzzle, setPuzzle] = useState<CowPuzzle>(() => blankPuzzle());
  const [activeColor, setActiveColor] = useState<ColorId>("c1");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [crop, setCrop] = useState<CropBounds>(initialCropSettings.crop);
  const [clusterThreshold, setClusterThreshold] = useState(initialCropSettings.clusterThreshold);
  const [runState, setRunState] = useState<RunState>("idle");
  const [message, setMessage] = useState("Upload a screenshot");
  const [solution, setSolution] = useState<CowSolution | null>(null);
  const [enumeration, setEnumeration] = useState<EnumerationReport | null>(null);
  const [analysis, setAnalysis] = useState<(AnalysisReport & { engine: string; message?: string }) | null>(null);
  const sampleRequestRef = useRef(0);

  const solutionCowSet = useMemo(() => {
    const values = new Set<string>();
    for (const cow of solution?.cows ?? []) values.add(coordinateKey(cow.row, cow.col));
    return values;
  }, [solution]);

  const forcedCowSet = useMemo(() => {
    const values = new Set<string>();
    for (const cell of analysis?.cells.forcedCow ?? []) values.add(coordinateKey(cell.row, cell.col));
    return values;
  }, [analysis]);

  const undecidedSet = useMemo(() => {
    const values = new Set<string>();
    for (const cell of analysis?.cells.undecided ?? []) values.add(coordinateKey(cell.row, cell.col));
    return values;
  }, [analysis]);

  function resetDerived() {
    setSolution(null);
    setEnumeration(null);
    setAnalysis(null);
  }

  function updatePuzzle(next: CowPuzzle) {
    setPuzzle(next);
    setActiveColor(firstColor(next));
    resetDerived();
  }

  function updateCell(row: number, col: number) {
    setPuzzle((current) => {
      const grid = current.grid.map((line) => [...line]);
      grid[row][col] = activeColor;
      return { ...current, grid };
    });
    resetDerived();
  }

  function updatePuzzleSize(size: number) {
    updatePuzzle(resizePuzzle(puzzle, size, size));
  }

  function updateCropValue(key: keyof CropBounds, value: number) {
    setCrop((current) => {
      const next = { ...current };
      if (key === "left") next.left = clamp(value, 0, 1 - current.width);
      if (key === "top") next.top = clamp(value, 0, 1 - current.height);
      if (key === "width") next.width = clamp(value, 0.12, 1 - current.left);
      if (key === "height") next.height = clamp(value, 0.12, 1 - current.top);
      return next;
    });
  }

  function nudgeCrop(key: keyof CropBounds, delta: number) {
    updateCropValue(key, crop[key] + delta);
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    resetDerived();
    setMessage(file.name);
  }

  async function sampleImage(requestId = ++sampleRequestRef.current) {
    if (!imageUrl) return;
    setRunState("running");
    setMessage("Sampling image");
    try {
      const next = await samplePuzzleFromImage(imageUrl, puzzle.rows, puzzle.cols, crop, clusterThreshold);
      if (sampleRequestRef.current !== requestId) return;
      updatePuzzle(next);
      setMessage(`Detected ${Object.keys(next.colors).length} colors`);
    } catch (error) {
      if (sampleRequestRef.current !== requestId) return;
      setMessage(error instanceof Error ? error.message : "Image sampling failed");
    } finally {
      if (sampleRequestRef.current === requestId) setRunState("idle");
    }
  }

  async function solve() {
    setRunState("running");
    setMessage("Solving");
    resetDerived();
    try {
      const result = solveWithLocalSolver(puzzle);
      setSolution(result.solution);
      setMessage(result.status === "sat" ? "Solved with local engine" : "No solution");
    } finally {
      setRunState("idle");
    }
  }

  async function enumerate() {
    setRunState("running");
    setMessage("Enumerating");
    resetDerived();
    try {
      const result = enumerateWithLocalSolver(puzzle, 500);
      setEnumeration(result);
      setSolution(result.solutions[0] ?? null);
      setMessage(`${result.solutions.length} solution${result.solutions.length === 1 ? "" : "s"}${result.hitLimit ? " (limited)" : ""}`);
    } finally {
      setRunState("idle");
    }
  }

  async function checkUnique() {
    setRunState("running");
    setMessage("Checking uniqueness");
    resetDerived();
    try {
      const result = await isUnique(puzzle);
      setMessage(!result.hasSolution ? "No solution" : result.unique ? "Unique solution" : "Multiple solutions");
    } finally {
      setRunState("idle");
    }
  }

  async function analyze() {
    setRunState("running");
    setMessage("Analyzing cells");
    resetDerived();
    try {
      const result = await analyzeCells(puzzle, 500);
      setAnalysis(result);
      setMessage(`${result.solutionCount} solution${result.solutionCount === 1 ? "" : "s"} analyzed`);
    } finally {
      setRunState("idle");
    }
  }

  function loadSample() {
    setImageUrl(SAMPLE_IMAGE_URL);
    updatePuzzle(clonePuzzle(samplePuzzle));
    setMessage("Sample loaded");
  }

  const colorCount = Object.keys(puzzle.colors).length;
  const busy = runState === "running";

  useEffect(() => {
    if (!imageUrl) return;
    const requestId = ++sampleRequestRef.current;
    const timeout = window.setTimeout(() => {
      void sampleImage(requestId);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [imageUrl, puzzle.rows, puzzle.cols, crop.left, crop.top, crop.width, crop.height, clusterThreshold]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CROP_SETTINGS_KEY, JSON.stringify({ crop, clusterThreshold }));
    } catch {
      // Storage may be unavailable in some private browsing contexts.
    }
  }, [crop, clusterThreshold]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Cow Solver</h1>
          <div className="meta-row">
            <StatusPill tone={colorCount === puzzle.rows && colorCount === puzzle.cols ? "good" : "warn"}>
              {puzzle.rows}x{puzzle.cols}
            </StatusPill>
            <StatusPill tone="neutral">{colorCount} colors</StatusPill>
            <StatusPill tone={busy ? "warn" : "neutral"}>{message}</StatusPill>
          </div>
        </div>
      </header>

      <section className="workspace">
        <aside className="panel image-panel">
          <div className="panel-head">
            <h2>Screenshot</h2>
            <button className="icon-button" onClick={loadSample} title="Reload sample">
              <RefreshCcw size={16} />
            </button>
          </div>
          <label className="upload-box">
            <Upload size={18} />
            <span>Upload</span>
            <input type="file" accept="image/*" onChange={handleImage} />
          </label>
          {imageUrl ? (
            <div className="screenshot-preview">
              <img className="screenshot" src={imageUrl} alt="" />
              <div
                className="crop-overlay"
                style={{
                  left: `${crop.left * 100}%`,
                  top: `${crop.top * 100}%`,
                  width: `${crop.width * 100}%`,
                  height: `${crop.height * 100}%`,
                  gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)`,
                  gridTemplateRows: `repeat(${puzzle.rows}, 1fr)`
                }}
                aria-hidden="true"
              >
                {Array.from({ length: puzzle.rows * puzzle.cols }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-shot"><FileImage /></div>
          )}
          <div className="controls-grid">
            <div className="size-presets" aria-label="board size presets">
              {[6, 8, 9, 12].map((size) => (
                <button
                  key={size}
                  className={puzzle.rows === size && puzzle.cols === size ? "active" : ""}
                  type="button"
                  onClick={() => updatePuzzleSize(size)}
                >
                  {size}x{size}
                </button>
              ))}
            </div>
            <label>
              Rows
              <input
                type="number"
                min={2}
                max={16}
                value={puzzle.rows}
                onChange={(event) => updatePuzzle(resizePuzzle(puzzle, Number(event.target.value), puzzle.cols))}
              />
            </label>
            <label>
              Cols
              <input
                type="number"
                min={2}
                max={16}
                value={puzzle.cols}
                onChange={(event) => updatePuzzle(resizePuzzle(puzzle, puzzle.rows, Number(event.target.value)))}
              />
            </label>
            <details className="crop-details">
              <summary>
                <span>Position Adjust</span>
                <strong>
                  T{Math.round(crop.top * 100)} L{Math.round(crop.left * 100)} W{Math.round(crop.width * 100)} H{Math.round(crop.height * 100)}
                </strong>
              </summary>
              <div className="crop-details-body">
                <div className="control-field">
                  <div className="control-label">
                    <span>Top</span>
                    <strong>{Math.round(crop.top * 100)}%</strong>
                  </div>
                  <div className="range-row">
                    <button type="button" onClick={() => nudgeCrop("top", -0.01)}>-</button>
                    <input
                      aria-label="Top"
                      type="range"
                      min={0}
                      max={0.8}
                      step={0.002}
                      value={crop.top}
                      onChange={(event) => updateCropValue("top", Number(event.target.value))}
                    />
                    <button type="button" onClick={() => nudgeCrop("top", 0.01)}>+</button>
                  </div>
                </div>
                <div className="control-field">
                  <div className="control-label">
                    <span>Height</span>
                    <strong>{Math.round(crop.height * 100)}%</strong>
                  </div>
                  <div className="range-row">
                    <button type="button" onClick={() => nudgeCrop("height", -0.01)}>-</button>
                    <input
                      aria-label="Height"
                      type="range"
                      min={0.1}
                      max={0.7}
                      step={0.002}
                      value={crop.height}
                      onChange={(event) => updateCropValue("height", Number(event.target.value))}
                    />
                    <button type="button" onClick={() => nudgeCrop("height", 0.01)}>+</button>
                  </div>
                </div>
                <div className="control-field">
                  <div className="control-label">
                    <span>Left</span>
                    <strong>{Math.round(crop.left * 100)}%</strong>
                  </div>
                  <div className="range-row">
                    <button type="button" onClick={() => nudgeCrop("left", -0.01)}>-</button>
                    <input
                      aria-label="Left"
                      type="range"
                      min={0}
                      max={0.6}
                      step={0.002}
                      value={crop.left}
                      onChange={(event) => updateCropValue("left", Number(event.target.value))}
                    />
                    <button type="button" onClick={() => nudgeCrop("left", 0.01)}>+</button>
                  </div>
                </div>
                <div className="control-field">
                  <div className="control-label">
                    <span>Width</span>
                    <strong>{Math.round(crop.width * 100)}%</strong>
                  </div>
                  <div className="range-row">
                    <button type="button" onClick={() => nudgeCrop("width", -0.01)}>-</button>
                    <input
                      aria-label="Width"
                      type="range"
                      min={0.2}
                      max={1}
                      step={0.002}
                      value={crop.width}
                      onChange={(event) => updateCropValue("width", Number(event.target.value))}
                    />
                    <button type="button" onClick={() => nudgeCrop("width", 0.01)}>+</button>
                  </div>
                </div>
                <div className="control-field">
                  <div className="control-label">
                    <span>Cluster</span>
                    <strong>{clusterThreshold}</strong>
                  </div>
                  <div className="range-row">
                    <button type="button" onClick={() => setClusterThreshold((value) => clamp(value - 2, 16, 90))}>-</button>
                    <input
                      aria-label="Cluster"
                      type="range"
                      min={16}
                      max={90}
                      step={1}
                      value={clusterThreshold}
                      onChange={(event) => setClusterThreshold(Number(event.target.value))}
                    />
                    <button type="button" onClick={() => setClusterThreshold((value) => clamp(value + 2, 16, 90))}>+</button>
                  </div>
                </div>
                <button className="secondary-button" type="button" onClick={() => setCrop(defaultCrop)}>
                  Reset Crop
                </button>
              </div>
            </details>
          </div>
          <button className="wide-button" onClick={() => void sampleImage()} disabled={busy || !imageUrl}>
            <Grid3X3 size={16} /> Sample Grid
          </button>
        </aside>

        <section className="panel board-panel">
          <div className="panel-head">
            <h2>Grid</h2>
            <div className="toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={puzzle.requireOnePerRow}
                  onChange={(event) => updatePuzzle({ ...puzzle, requireOnePerRow: event.target.checked })}
                />
                Rows
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={puzzle.requireOnePerCol}
                  onChange={(event) => updatePuzzle({ ...puzzle, requireOnePerCol: event.target.checked })}
                />
                Cols
              </label>
            </div>
          </div>

          <div className="palette" aria-label="color palette">
            {Object.entries(puzzle.colors).map(([id, value]) => (
              <button
                key={id}
                className={`swatch ${activeColor === id ? "active" : ""}`}
                style={{ backgroundColor: value }}
                onClick={() => setActiveColor(id)}
                title={id}
              />
            ))}
          </div>

          <div
            className="board"
            style={{
              gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${puzzle.rows}, minmax(0, 1fr))`
            }}
          >
            {puzzle.grid.flatMap((row, rowIndex) =>
              row.map((color, colIndex) => {
                const key = coordinateKey(rowIndex, colIndex);
                return (
                  <button
                    key={key}
                    className={[
                      "cell",
                      solutionCowSet.has(key) ? "cow" : "",
                      forcedCowSet.has(key) ? "forced" : "",
                      undecidedSet.has(key) ? "undecided" : ""
                    ].join(" ")}
                    style={{ backgroundColor: puzzle.colors[color] ?? "#d7dde5" }}
                    onClick={() => updateCell(rowIndex, colIndex)}
                    title={`${rowIndex + 1}, ${colIndex + 1}`}
                  >
                    {solutionCowSet.has(key) || forcedCowSet.has(key) ? "🐮" : undecidedSet.has(key) ? "?" : ""}
                  </button>
                );
              })
            )}
          </div>
        </section>

        <aside className="panel result-panel">
          <div className="actions solve-actions">
            <button onClick={solve} disabled={busy}>
              <Play size={16} /> Solve
            </button>
            <button onClick={checkUnique} disabled={busy}>
              <CheckCircle2 size={16} /> Unique
            </button>
            <button onClick={enumerate} disabled={busy}>
              <ListChecks size={16} /> All
            </button>
            <button onClick={analyze} disabled={busy}>
              <Search size={16} /> Analyze
            </button>
          </div>
          <div className="panel-head">
            <h2>Result</h2>
            {solution ? <StatusPill tone="good">SAT</StatusPill> : <StatusPill>Idle</StatusPill>}
          </div>
          {solution ? (
            <div className="cow-list">
              {solution.cows.map((cow) => (
                <div key={`${cow.row}:${cow.col}`} className="cow-row">
                  <span className="mini-swatch" style={{ backgroundColor: puzzle.colors[cow.color] }} />
                  <span>R{cow.row + 1} C{cow.col + 1}</span>
                  <code>{cow.color}</code>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-result">
              <CircleOff size={20} />
              <span>No active solution</span>
            </div>
          )}

          {enumeration ? (
            <div className="summary">
              <div><strong>{enumeration.solutions.length}</strong> solutions</div>
              <div>{enumeration.hitLimit ? "Limit reached" : "Complete within limit"}</div>
              <div>{enumeration.engine}</div>
            </div>
          ) : null}

          {analysis ? (
            <div className="summary">
              <div><strong>{analysis.solutionCount}</strong> analyzed</div>
              <div>{analysis.cells.forcedCow.length} forced cows</div>
              <div>{analysis.cells.forcedEmpty.length} forced empty</div>
              <div>{analysis.cells.undecided.length} undecided</div>
              <div>{analysis.engine}</div>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
