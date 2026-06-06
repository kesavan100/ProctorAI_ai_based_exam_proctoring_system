import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function ConfidenceChart({ detections }) {
  const getConfidenceColor = (conf) => {
    if (conf >= 0.8) return "bg-emerald-500 shadow-emerald-500/20";
    if (conf >= 0.6) return "bg-amber-500 shadow-amber-500/20";
    return "bg-rose-500 shadow-rose-500/20";
  };

  return (
    <div className="p-4 border rounded-lg glass-panel bg-secondary border-primary">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold tracking-wider text-secondary uppercase">AI Inference Confidence</h4>
        {detections && detections.length > 0 ? (
          <div className="flex items-center gap-1 text-[10px] text-amber-500 font-semibold">
            <AlertCircle className="w-3.5 h-3.5" /> Objects Detected
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Frame Secure
          </div>
        )}
      </div>

      {detections && detections.length > 0 ? (
        <div className="flex flex-col gap-3">
          {detections.map((det, index) => (
            <div key={index} className="flex flex-col">
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="font-semibold text-primary capitalize">{det.class_name || det.class}</span>
                <span className="font-bold text-primary">{Math.round(det.confidence * 100)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-primary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 shadow-sm ${getConfidenceColor(det.confidence)}`}
                  style={{ width: `${det.confidence * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-muted mt-1 font-mono">
                BBox: [{det.bbox.map(b => Math.round(b)).join(", ")}]
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center">
          <span className="text-xs text-muted">No active AI targets detected in frame.</span>
        </div>
      )}
    </div>
  );
}
