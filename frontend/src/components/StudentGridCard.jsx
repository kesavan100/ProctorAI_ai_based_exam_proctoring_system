import React from "react";
import { AlertCircle, Lock, ShieldAlert, CheckCircle2, RefreshCw } from "lucide-react";

const parseUTCDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr !== "string") return new Date(dateStr);
  let normalized = dateStr.replace(" ", "T");
  const hasTimezone = normalized.endsWith("Z") || 
                      normalized.includes("+") || 
                      (normalized.includes("-") && normalized.indexOf("-", 10) !== -1);
  if (!hasTimezone) {
    normalized = normalized + "Z";
  }
  return new Date(normalized);
};

export function StudentGridCard({ student, isSelected, onClick, onUnlock }) {
  const getRiskBorder = (score, status) => {
    if (status === "locked") return "border-red-500 shadow-md shadow-red-500/10 pulsing-alert-red";
    if (score >= 36) return "border-red-500 shadow-red-500/10";
    if (score >= 16) return "border-orange-500";
    return "border-emerald-500/30";
  };

  const getRiskTextClass = (score) => {
    if (score >= 36) return "text-red-500 font-extrabold";
    if (score >= 16) return "text-orange-500 font-bold";
    return "text-emerald-500 font-semibold";
  };

  const getStatusIcon = (status, score) => {
    if (status === "locked") return <Lock className="w-3.5 h-3.5 text-red-500 animate-bounce" />;
    if (score > 50) return <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />;
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
  };

  return (
    <div
      onClick={onClick}
      className={`glass-panel p-4.5 cursor-pointer transition-all duration-300 border-2 flex flex-col justify-between relative hover:-translate-y-1 ${
        isSelected ? "selected-card" : ""
      } ${getRiskBorder(student.risk_score, student.status)}`}
      style={{ height: student.image_base64 ? "290px" : "160px" }}
    >
      <div>
        {/* Header Block */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-primary">{student.student_name}</span>
            <span className="text-[10px] text-secondary font-mono">{student.student_id}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-tertiary border border-primary text-[9px] font-bold uppercase tracking-wider text-primary">
            {getStatusIcon(student.status, student.risk_score)}
            <span>{student.status}</span>
          </div>
        </div>

        {/* Live Surveillance Preview Thumbnail */}
        {student.image_base64 && (
          <div className="relative w-full h-32 mt-3 rounded overflow-hidden bg-primary border border-primary shadow-inner">
            <img
              src={student.image_base64}
              alt="Surveillance Feed"
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {/* Render absolute divs representing YOLO bounding boxes on admin preview! */}
            {student.detections &&
              student.detections.map((det, idx) => {
                const [x1, y1, x2, y2] = det.bbox;
                const left = (x1 / 640) * 100;
                const top = (y1 / 480) * 100;
                const width = ((x2 - x1) / 640) * 100;
                const height = ((y2 - y1) / 480) * 100;
                const color = det.class_name === "cell phone" ? "#ef4444" : "#8b5cf6";

                return (
                  <div
                    key={idx}
                    className="absolute border-2 pointer-events-none scale-x-[-1]"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                      borderColor: color,
                      boxShadow: `0 0 5px ${color}`
                    }}
                  >
                    <span
                      className="absolute left-0 text-[8px] font-bold text-white px-1"
                      style={{
                        top: "-12px",
                        backgroundColor: color,
                        lineHeight: "12px"
                      }}
                    >
                      {det.class_name.toUpperCase()}
                    </span>
                  </div>
                );
              })}
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-secondary">Risk Score:</span>
            <span className={`text-sm ${getRiskTextClass(student.risk_score)}`}>
              {Math.round(student.risk_score)}%
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-secondary">Integrity:</span>
            <span className={`text-sm font-bold ${
              student.behavior_score >= 85 ? "text-emerald-500" :
              student.behavior_score >= 65 ? "text-amber-500" :
              "text-rose-500"
            }`}>
              {Math.round(student.behavior_score)}%
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-primary">
        {student.status === "completed" ? (
          <span className="text-[9px] text-secondary font-medium">
            Completed: {student.end_time ? `${parseUTCDate(student.end_time).toLocaleDateString()} ${parseUTCDate(student.end_time).toLocaleTimeString()}` : "N/A"}
          </span>
        ) : (
          <span className="text-[9px] text-secondary">
            Sync: {student.last_seen ? parseUTCDate(student.last_seen).toLocaleTimeString() : "N/A"}
          </span>
        )}
        {student.status === "locked" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnlock(student.student_id);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white bg-red-600 rounded hover:bg-red-500 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 animate-spin-slow" /> Force Unlock
          </button>
        )}
      </div>
    </div>
  );
}
