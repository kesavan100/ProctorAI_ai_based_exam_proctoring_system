import React from "react";
import { AlertTriangle, Eye, ShieldAlert, Monitor, Copy, EyeOff, Layout } from "lucide-react";

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

export function AlertTimeline({ violations, backendUrl }) {
  const getViolationIcon = (type) => {
    switch (type) {
      case "phone_detected":
        return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case "multiple_persons":
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "face_missing":
      case "no_person":
        return <EyeOff className="w-4 h-4 text-yellow-500" />;
      case "tab_switch":
        return <Layout className="w-4 h-4 text-indigo-400" />;
      case "fullscreen_exit":
        return <Monitor className="w-4 h-4 text-amber-500" />;
      case "copy_paste":
        return <Copy className="w-4 h-4 text-purple-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-muted" />;
    }
  };

  const formatViolationName = (type) => {
    switch (type) {
      case "phone_detected": return "Mobile Phone Detected";
      case "multiple_persons": return "Multiple Persons Present";
      case "face_missing": return "Student Face Missing";
      case "no_person": return "No Student Detected";
      case "tab_switch": return "Browser Tab Switch";
      case "fullscreen_exit": return "Exited Fullscreen";
      case "copy_paste": return "Copy/Paste Clipboard Attempt";
      default: return type.replace(/_/g, " ").toUpperCase();
    }
  };

  const getSeverityClass = (type) => {
    if (["phone_detected", "multiple_persons"].includes(type)) return "border-red-500/20 bg-red-500/5 text-red-200";
    if (["tab_switch", "fullscreen_exit", "face_missing", "no_person"].includes(type)) return "border-orange-500/20 bg-orange-500/5 text-orange-200";
    return "border-indigo-500/10 bg-indigo-500/5 text-indigo-200";
  };

  if (!violations || violations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-lg border-primary">
        <span className="text-sm text-secondary">No violations logged yet. Active monitoring is running.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
      {violations.map((violation, idx) => (
        <div
          key={violation.id || idx}
          className={`flex flex-col p-3 border rounded-lg transition-all hover:bg-tertiary ${getSeverityClass(violation.type)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {getViolationIcon(violation.type)}
              <span className="text-xs font-bold">{formatViolationName(violation.type)}</span>
            </div>
            <span className="text-[10px] text-secondary">
              {violation.timestamp ? parseUTCDate(violation.timestamp).toLocaleTimeString() : "N/A"}
            </span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-secondary">
              Certainty: {Math.round(violation.confidence * 100)}%
            </span>
            {violation.screenshot_path && (
              <a
                href={`${backendUrl}/${violation.screenshot_path}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold hover:underline cursor-pointer"
              >
                <Eye className="w-3 h-3" /> View Evidence
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
