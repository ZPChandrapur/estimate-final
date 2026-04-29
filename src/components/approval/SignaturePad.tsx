import React, { useRef, useEffect, useState } from 'react';
import { RotateCcw, Download, X } from 'lucide-react';

interface SignaturePadProps {
  onSignatureCapture: (signatureData: SignatureData) => void;
  onCancel: () => void;
  userName: string;
  approvalLevel: number;
}

export interface SignatureData {
  signatureImage: string; // Base64 encoded PNG
  signatureMethod: 'handwritten' | 'typed';
  typedText?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureCapture,
  onCancel,
  userName,
  approvalLevel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'handwritten' | 'typed'>('handwritten');
  const [typedSignature, setTypedSignature] = useState('');
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Set white background
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (signatureMode !== 'handwritten') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || signatureMode !== 'handwritten') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const endDrawing = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
    setTypedSignature('');
  };

  const captureSignature = async () => {
    if (signatureMode === 'handwritten' && !hasSignature) {
      alert('Please sign on the canvas');
      return;
    }

    if (signatureMode === 'typed' && !typedSignature.trim()) {
      alert('Please enter your name');
      return;
    }

    let signatureImage = '';

    if (signatureMode === 'handwritten') {
      const canvas = canvasRef.current;
      if (canvas) {
        signatureImage = canvas.toDataURL('image/png');
      }
    } else {
      // Create typed signature as image
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'italic 48px Georgia';
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'middle';
        ctx.fillText(typedSignature, 50, 75);
        signatureImage = canvas.toDataURL('image/png');
      }
    }

    onSignatureCapture({
      signatureImage,
      signatureMethod: signatureMode,
      typedText: signatureMode === 'typed' ? typedSignature : undefined
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Digital Signature</h3>
            <p className="text-blue-100 text-sm">Level {approvalLevel} - {userName}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="px-6 py-4 border-b border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">Choose signature method:</p>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="handwritten"
                checked={signatureMode === 'handwritten'}
                onChange={(e) => {
                  setSignatureMode(e.target.value as 'handwritten' | 'typed');
                  clearSignature();
                }}
                className="w-4 h-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">Handwritten Signature</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="typed"
                checked={signatureMode === 'typed'}
                onChange={(e) => {
                  setSignatureMode(e.target.value as 'handwritten' | 'typed');
                  clearSignature();
                }}
                className="w-4 h-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">Typed Signature</span>
            </label>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {signatureMode === 'handwritten' ? (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Draw your signature in the box below using your mouse or touch pad
              </p>
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={endDrawing}
                onMouseLeave={endDrawing}
                className="border-2 border-gray-300 rounded-lg cursor-crosshair bg-white w-full h-40"
              />
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-3">Enter your name as your signature:</p>
              <input
                type="text"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-italic text-xl"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
          <button
            onClick={clearSignature}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </button>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={captureSignature}
              disabled={
                (signatureMode === 'handwritten' && !hasSignature) ||
                (signatureMode === 'typed' && !typedSignature.trim())
              }
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              Confirm Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
