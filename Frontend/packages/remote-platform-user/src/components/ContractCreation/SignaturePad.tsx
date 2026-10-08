import React, { useRef, useState } from "react";

/** A canvas the user can draw a signature on with mouse/touch; reports the drawn PNG data URL (or null when cleared). */
export const SignaturePad: React.FC<{ onDraw: (dataUrl: string | null) => void }> = ({ onDraw }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ("clientX" in e) {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = "#1D4ED8";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (isEmpty) {
      setIsEmpty(false);
    }
    onDraw(canvas.toDataURL("image/png"));
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onDraw(null);
  };

  return (
    <div>
      <div className="contract-sigpad-box">
        <canvas
          ref={canvasRef}
          width={640}
          height={220}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="contract-sigpad-canvas"
        />
        {isEmpty && (
          <div className="contract-sigpad-placeholder">
            ✍️ Draw your signature here with cursor / touchpad...
          </div>
        )}
      </div>
      <div className="contract-sigpad-footer">
        <span className="contract-caption">
          {isEmpty ? "Canvas empty" : "Signature captured"}
        </span>
        <button
          type="button"
          onClick={clearCanvas}
          className="contract-sigpad-clear"
        >
          Clear Signature
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
