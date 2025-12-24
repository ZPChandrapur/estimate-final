import React, { useState } from 'react';
import { X } from 'lucide-react';

interface QuarryChartProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuarryChart: React.FC<QuarryChartProps> = ({ isOpen, onClose }) => {
  const [quarryTitle, setQuarryTitle] = useState('Quarry Chart');
  const [quarryRows, setQuarryRows] = useState(25);
  const [quarryCols, setQuarryCols] = useState(40);
  const [quarryGrid, setQuarryGrid] = useState<string[][]>(() =>
    Array.from({ length: 25 }, () => Array(40).fill(' '))
  );
  const [quarrySelectedTool, setQuarrySelectedTool] =
    useState<'line-h' | 'line-v' | 'node' | 'text' | 'erase'>('line-h');
  const [quarryCurrentLabel, setQuarryCurrentLabel] = useState<string>('');
  const [quarryChar, setQuarryChar] = useState<string>('●');
  const [isDrawing, setIsDrawing] = useState(false);
  const [quarryHistory, setQuarryHistory] = useState<string[][][]>([]);

  if (!isOpen) return null;

  const snapshotQuarry = () => {
    setQuarryHistory(prev => [...prev, quarryGrid.map(r => [...r])].slice(-30));
  };

  const resetQuarryGrid = (rows: number, cols: number) => {
    setQuarryRows(rows);
    setQuarryCols(cols);
    setQuarryGrid(
      Array.from({ length: rows }, () => Array(cols).fill(' '))
    );
    setQuarryHistory([]);
  };

  const handleQuarryUndo = () => {
    setQuarryHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setQuarryGrid(last.map(r => [...r]));
      return prev.slice(0, -1);
    });
  };

  const handleQuarryCellClick = (
    r: number,
    c: number,
    startStroke = false
  ) => {
    setQuarryGrid(prev => {
      const next = prev.map(row => [...row]);

      if (quarrySelectedTool === 'erase') {
        next[r][c] = ' ';
        return next;
      }

      if (quarrySelectedTool === 'line-h') {
        const radius = startStroke ? 3 : 0;
        for (
          let col = Math.max(0, c - radius);
          col <= Math.min(quarryCols - 1, c + radius);
          col++
        ) {
          next[r][col] = '─';
        }
      } else if (quarrySelectedTool === 'line-v') {
        const radius = startStroke ? 3 : 0;
        for (
          let row = Math.max(0, r - radius);
          row <= Math.min(quarryRows - 1, r + radius);
          row++
        ) {
          next[row][c] = '│';
        }
      } else if (quarrySelectedTool === 'node') {
        next[r][c] = quarryChar || '●';
      } else if (quarrySelectedTool === 'text') {
        if (!quarryCurrentLabel) return prev;
        const chars = quarryCurrentLabel.split('');
        chars.forEach((ch, idx) => {
          const col = c + idx;
          if (col < quarryCols) {
            next[r][col] = ch;
          }
        });
      }

      return next;
    });
  };

  const handleInternalClose = () => {
    setIsDrawing(false);
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
              Draw quarry routes using lines, nodes, text labels and special characters. Click and drag on the grid.
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
                  resetQuarryGrid(v, quarryCols);
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
                  resetQuarryGrid(quarryRows, v);
                }}
                className="border border-gray-300 rounded-md px-2 py-1 w-16"
              />
              <button
                onClick={() => {
                  snapshotQuarry();
                  resetQuarryGrid(quarryRows, quarryCols);
                }}
                className="ml-2 px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 text-xs font-medium"
              >
                Clear Grid
              </button>
            </div>
          </div>

          {/* Tools */}
          <div className="min-w-[240px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tool
            </label>
            <div className="flex flex-wrap gap-1 text-xs">
              <button
                onClick={() => setQuarrySelectedTool('line-h')}
                className={`px-3 py-1 rounded-md border ${
                  quarrySelectedTool === 'line-h'
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Horizontal line
              </button>
              <button
                onClick={() => setQuarrySelectedTool('line-v')}
                className={`px-3 py-1 rounded-md border ${
                  quarrySelectedTool === 'line-v'
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Vertical line
              </button>
              <button
                onClick={() => setQuarrySelectedTool('node')}
                className={`px-3 py-1 rounded-md border ${
                  quarrySelectedTool === 'node'
                    ? 'bg-indigo-600 text-white border-indigo-700'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Node / Shape
              </button>
              <button
                onClick={() => setQuarrySelectedTool('text')}
                className={`px-3 py-1 rounded-md border ${
                  quarrySelectedTool === 'text'
                    ? 'bg-sky-600 text-white border-sky-700'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Text label
              </button>
              <button
                onClick={() => setQuarrySelectedTool('erase')}
                className={`px-3 py-1 rounded-md border ${
                  quarrySelectedTool === 'erase'
                    ? 'bg-rose-600 text-white border-rose-700'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Eraser
              </button>
            </div>
          </div>

          {/* Node config */}
          {quarrySelectedTool === 'node' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Node character
              </label>
              <input
                type="text"
                maxLength={2}
                value={quarryChar}
                onChange={e => setQuarryChar(e.target.value || '●')}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs w-16 text-center"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Examples: ● ○ □ △ ◎ ▲ ■ ◆
              </p>
            </div>
          )}

          {/* Text config */}
          {quarrySelectedTool === 'text' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Text to place
              </label>
              <input
                type="text"
                value={quarryCurrentLabel}
                onChange={e => setQuarryCurrentLabel(e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs w-48"
                placeholder="Village name, distance, note..."
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Click on a cell to start the label.
              </p>
            </div>
          )}

          {/* Undo */}
          <div className="ml-auto flex flex-col gap-1 items-end">
            <button
              onClick={handleQuarryUndo}
              disabled={quarryHistory.length === 0}
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
            <div
              className="font-mono text-[11px] leading-none select-none"
              onMouseLeave={() => setIsDrawing(false)}
            >
              {quarryGrid.map((row, rIdx) => (
                <div key={rIdx} className="flex">
                  {row.map((cell, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      onMouseDown={() => {
                        snapshotQuarry();
                        setIsDrawing(true);
                        handleQuarryCellClick(rIdx, cIdx, true);
                      }}
                      onMouseEnter={e => {
                        if (isDrawing && e.buttons === 1) {
                          handleQuarryCellClick(rIdx, cIdx, false);
                        }
                      }}
                      onMouseUp={() => setIsDrawing(false)}
                      className="w-5 h-5 flex items-center justify-center border border-gray-200 hover:bg-amber-50 focus:outline-none"
                    >
                      {cell || '·'}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Text export */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Plain text view (copy into reports)
            </label>
            <textarea
              readOnly
              value={quarryGrid.map(r => r.join('')).join('\n')}
              className="w-full h-32 border border-gray-300 rounded-md text-[11px] font-mono p-2 bg-gray-50"
            />
          </div>

          <p className="mt-2 text-[11px] text-gray-500">
            Use lines for roads and haul routes, nodes/shapes for quarries, crushers, depots or junctions, and text labels for village names, chainage and distances.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 flex justify-between">
          <button
            onClick={() => {
              snapshotQuarry();
              resetQuarryGrid(quarryRows, quarryCols);
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
