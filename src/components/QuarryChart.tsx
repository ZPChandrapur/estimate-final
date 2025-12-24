import React, { useState, useRef } from 'react';
import { Stage, Layer, Line, Circle, Text, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import { X } from 'lucide-react';

interface QuarryChartProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tool =
  | 'select'
  | 'free-line'
  | 'straight-line'
  | 'node'
  | 'text'
  | 'erase';

type ShapeType = 'line' | 'node' | 'text';

interface BaseShape {
  id: string;
  type: ShapeType;
}

interface LineShape extends BaseShape {
  type: 'line';
  points: number[]; // x1,y1,x2,y2,...
}

interface NodeShape extends BaseShape {
  type: 'node';
  x: number;
  y: number;
  radius: number;
}

interface TextShape extends BaseShape {
  type: 'text';
  x: number;
  y: number;
  text: string;
}

type QuarryShape = LineShape | NodeShape | TextShape;

const QuarryChart: React.FC<QuarryChartProps> = ({ isOpen, onClose }) => {
  const [quarryTitle, setQuarryTitle] = useState('Quarry Chart');
  const [quarryRows, setQuarryRows] = useState(25);
  const [quarryCols, setQuarryCols] = useState(40);

  const [tool, setTool] = useState<Tool>('free-line');
  const [nodeChar, setNodeChar] = useState<string>('●');
  const [textLabel, setTextLabel] = useState<string>('');

  const [shapes, setShapes] = useState<QuarryShape[]>([]);
  const [history, setHistory] = useState<QuarryShape[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isDrawingRef = useRef(false);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  if (!isOpen) return null;

  const gridWidth = quarryCols * 20;
  const gridHeight = quarryRows * 20;

  const snapshot = () => {
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(shapes))].slice(-50));
  };

  const handleUndo = () => {
    setHistory(prev => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setShapes(last);
      return prev.slice(0, -1);
    });
  };

  const resetGrid = (rows: number, cols: number) => {
    setQuarryRows(rows);
    setQuarryCols(cols);
    setShapes([]);
    setHistory([]);
    setSelectedId(null);
  };

  const exportAscii = () => {
    const cellSize = 20;
    const rows = quarryRows;
    const cols = quarryCols;
    const grid: string[][] = Array.from({ length: rows }, () =>
      Array(cols).fill(' ')
    );

    shapes.forEach(s => {
      if (s.type === 'node') {
        const r = Math.floor((s.y ?? 0) / cellSize);
        const c = Math.floor((s.x ?? 0) / cellSize);
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          grid[r][c] = nodeChar || '●';
        }
      } else if (s.type === 'text') {
        const r = Math.floor((s.y ?? 0) / cellSize);
        const c = Math.floor((s.x ?? 0) / cellSize);
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          s.text.split('').forEach((ch, idx) => {
            const cc = c + idx;
            if (cc < cols) grid[r][cc] = ch;
          });
        }
      } else if (s.type === 'line') {
        for (let i = 0; i < s.points.length - 2; i += 2) {
          const x1 = s.points[i];
          const y1 = s.points[i + 1];
          const r = Math.floor(y1 / cellSize);
          const c = Math.floor(x1 / cellSize);
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            grid[r][c] = '─';
          }
        }
      }
    });

    return grid.map(r => r.join('')).join('\n');
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (tool === 'select') {
      if (e.target === stage) {
        setSelectedId(null);
        return;
      }
      const clickedId = (e.target as any).attrs.id as string | undefined;
      setSelectedId(clickedId || null);
      return;
    }

    snapshot();
    isDrawingRef.current = true;

    if (tool === 'free-line') {
      const id = `line-${Date.now()}`;
      const newLine: LineShape = {
        id,
        type: 'line',
        points: [pos.x, pos.y, pos.x, pos.y]
      };
      setShapes(prev => [...prev, newLine]);
    } else if (tool === 'straight-line') {
      startPointRef.current = { x: pos.x, y: pos.y };
      const id = `line-${Date.now()}`;
      const newLine: LineShape = {
        id,
        type: 'line',
        points: [pos.x, pos.y, pos.x, pos.y]
      };
      setShapes(prev => [...prev, newLine]);
    } else if (tool === 'node') {
      const id = `node-${Date.now()}`;
      const node: NodeShape = {
        id,
        type: 'node',
        x: pos.x,
        y: pos.y,
        radius: 4
      };
      setShapes(prev => [...prev, node]);
    } else if (tool === 'text') {
      if (!textLabel.trim()) return;
      const id = `text-${Date.now()}`;
      const t: TextShape = {
        id,
        type: 'text',
        x: pos.x,
        y: pos.y,
        text: textLabel
      };
      setShapes(prev => [...prev, t]);
    } else if (tool === 'erase') {
      const target = e.target;
      if (target && target !== stage) {
        const id = (target as any).attrs.id as string | undefined;
        if (!id) return;
        setShapes(prev => prev.filter(s => s.id !== id));
      }
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawingRef.current) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    setShapes(prev => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last || last.type !== 'line') return prev;

      if (tool === 'free-line') {
        const updated: LineShape = {
          ...last,
          points: [...last.points, pos.x, pos.y]
        };
        next[next.length - 1] = updated;
      } else if (tool === 'straight-line') {
        const sp = startPointRef.current;
        if (!sp) return prev;
        const updated: LineShape = {
          ...last,
          points: [sp.x, sp.y, pos.x, pos.y]
        };
        next[next.length - 1] = updated;
      }
      return next;
    });
  };

  const handleStageMouseUp = () => {
    isDrawingRef.current = false;
    startPointRef.current = null;
  };

  const onDragShape = (id: string, x: number, y: number) => {
    setShapes(prev =>
      prev.map(s => {
        if (s.id !== id) return s;
        if (s.type === 'node' || s.type === 'text') {
          return { ...s, x, y } as QuarryShape;
        }
        return s;
      })
    );
  };

  const textExport = exportAscii();

  const handleInternalClose = () => {
    isDrawingRef.current = false;
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-11/12 max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Quarry Chart / Route Diagram
            </h2>
            <p className="text-xs text-gray-500">
              Draw quarry routes with freehand lines, straight segments, nodes, text and Excel‑style selection.
            </p>
          </div>
          <button
            onClick={handleInternalClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b bg-gray-50 flex flex-wrap gap-4 items-end">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Chart Title
            </label>
            <input
              type="text"
              value={quarryTitle}
              onChange={e => setQuarryTitle(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs w-60"
            />
          </div>

          {/* Grid size */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Grid (rows × cols)
            </label>
            <div className="flex items-center gap-1 text-xs">
              <input
                type="number"
                min={10}
                max={60}
                value={quarryRows}
                onChange={e => {
                  const v = Number(e.target.value || 10);
                  resetGrid(v, quarryCols);
                }}
                className="border border-gray-300 rounded-md px-2 py-1 w-16"
              />
              <span>×</span>
              <input
                type="number"
                min={20}
                max={100}
                value={quarryCols}
                onChange={e => {
                  const v = Number(e.target.value || 20);
                  resetGrid(quarryRows, v);
                }}
                className="border border-gray-300 rounded-md px-2 py-1 w-16"
              />
            </div>
          </div>

          {/* Tools */}
          <div className="min-w-[260px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tool
            </label>
            <div className="flex flex-wrap gap-1 text-xs">
              <button
                onClick={() => setTool('free-line')}
                className={`px-3 py-1 rounded-md border ${
                  tool === 'free-line'
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Free line
              </button>
              <button
                onClick={() => setTool('straight-line')}
                className={`px-3 py-1 rounded-md border ${
                  tool === 'straight-line'
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Straight line
              </button>
              <button
                onClick={() => setTool('node')}
                className={`px-3 py-1 rounded-md border ${
                  tool === 'node'
                    ? 'bg-indigo-600 text-white border-indigo-700'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Node / Junction
              </button>
              <button
                onClick={() => setTool('text')}
                className={`px-3 py-1 rounded-md border ${
                  tool === 'text'
                    ? 'bg-sky-600 text-white border-sky-700'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Text label
              </button>
              <button
                onClick={() => setTool('erase')}
                className={`px-3 py-1 rounded-md border ${
                  tool === 'erase'
                    ? 'bg-rose-600 text-white border-rose-700'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Eraser
              </button>
              <button
                onClick={() => setTool('select')}
                className={`px-3 py-1 rounded-md border ${
                  tool === 'select'
                    ? 'bg-slate-700 text-white border-slate-800'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Select / Resize
              </button>
            </div>
          </div>

          {/* Node config */}
          {tool === 'node' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Node character
              </label>
              <input
                type="text"
                maxLength={2}
                value={nodeChar}
                onChange={e => setNodeChar(e.target.value || '●')}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs w-16 text-center"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Examples: ● ○ □ △ ◎ ▲ ■ ◆
              </p>
            </div>
          )}

          {/* Text config */}
          {tool === 'text' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Text to place
              </label>
              <input
                type="text"
                value={textLabel}
                onChange={e => setTextLabel(e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs w-48"
                placeholder="Village name, distance, note..."
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Click on the canvas to drop the label.
              </p>
            </div>
          )}

          {/* Undo */}
          <div className="ml-auto flex flex-col gap-1 items-end">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className="px-3 py-1 rounded-md border border-gray-300 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-40"
            >
              Undo
            </button>
          </div>
        </div>

        {/* Chart body */}
        <div className="px-6 pt-3 flex-1 overflow-auto">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            {quarryTitle}
          </h3>

          <div className="inline-block bg-white border border-gray-300 rounded-md shadow-inner">
            <Stage
              width={gridWidth}
              height={gridHeight}
              ref={node => {
                stageRef.current = node as any;
              }}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
            >
              <Layer ref={node => (layerRef.current = node as any)}>
                {/* background grid */}
                {Array.from({ length: quarryRows + 1 }).map((_, i) => (
                  <Line
                    key={`h-${i}`}
                    points={[0, i * 20, gridWidth, i * 20]}
                    stroke="#e5e7eb"
                    strokeWidth={1}
                  />
                ))}
                {Array.from({ length: quarryCols + 1 }).map((_, i) => (
                  <Line
                    key={`v-${i}`}
                    points={[i * 20, 0, i * 20, gridHeight]}
                    stroke="#e5e7eb"
                    strokeWidth={1}
                  />
                ))}

                {/* shapes */}
                {shapes.map(s => {
                  if (s.type === 'line') {
                    return (
                      <Line
                        key={s.id}
                        id={s.id}
                        points={s.points}
                        stroke="#111827"
                        strokeWidth={2}
                        lineCap="round"
                        lineJoin="round"
                        draggable={tool === 'select'}
                        onDragEnd={e =>
                          setShapes(prev =>
                            prev.map(sh =>
                              sh.id === s.id
                                ? {
                                    ...sh,
                                    points: s.points.map((p, idx) =>
                                      idx % 2 === 0
                                        ? p + e.target.x()
                                        : p + e.target.y()
                                    )
                                  }
                                : sh
                            )
                          )
                        }
                        onClick={() => setSelectedId(s.id)}
                      />
                    );
                  }
                  if (s.type === 'node') {
                    return (
                      <Circle
                        key={s.id}
                        id={s.id}
                        x={s.x}
                        y={s.y}
                        radius={s.radius}
                        fill="#111827"
                        draggable={tool === 'select'}
                        onDragEnd={e =>
                          onDragShape(s.id, e.target.x(), e.target.y())
                        }
                        onClick={() => setSelectedId(s.id)}
                      />
                    );
                  }
                  if (s.type === 'text') {
                    return (
                      <Text
                        key={s.id}
                        id={s.id}
                        x={s.x}
                        y={s.y}
                        text={s.text}
                        fontSize={11}
                        fontFamily="monospace"
                        fill="#111827"
                        draggable={tool === 'select'}
                        onDragEnd={e =>
                          onDragShape(s.id, e.target.x(), e.target.y())
                        }
                        onClick={() => setSelectedId(s.id)}
                      />
                    );
                  }
                  return null;
                })}

                {/* selection transformer */}
                {selectedId && (
                  <>
                    {/* invisible rect so Transformer has a node */}
                    <Rect
                      id={`${selectedId}-handle`}
                      x={0}
                      y={0}
                      visible={false}
                    />
                    <Transformer
                      ref={node => {
                        transformerRef.current = node as any;
                        if (!node) return;
                        const stage = node.getStage();
                        if (!stage) return;
                        const found = stage.findOne(`#${selectedId}`);
                        if (found) {
                          node.nodes([found]);
                          node.getLayer()?.batchDraw();
                        }
                      }}
                      rotateEnabled
                      enabledAnchors={[
                        'top-left',
                        'top-right',
                        'bottom-left',
                        'bottom-right'
                      ]}
                      anchorSize={6}
                      borderStroke="#10b981"
                      anchorFill="#10b981"
                    />
                  </>
                )}
              </Layer>
            </Stage>
          </div>

          {/* Text export */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Plain text view (copy into reports)
            </label>
            <textarea
              readOnly
              value={textExport}
              className="w-full h-32 border border-gray-300 rounded-md text-[11px] font-mono p-2 bg-gray-50"
            />
          </div>

          <p className="mt-2 text-[11px] text-gray-500">
            Use free lines or straight lines for roads and haul routes, nodes for quarries/depots, and text labels for village names and distances.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 flex justify-between">
          <button
            onClick={() => {
              snapshot();
              resetGrid(quarryRows, quarryCols);
            }}
            className="px-4 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            Clear
          </button>
          <button
            onClick={handleInternalClose}
            className="px-4 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuarryChart;
