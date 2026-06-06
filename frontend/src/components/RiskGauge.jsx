import React from "react";

export function RiskGauge({ score }) {
  // Convert 0-100 to circular stroke progress
  const radius = 50;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getRiskColor = (val) => {
    if (val <= 15) return "var(--color-green)"; // Low
    if (val <= 35) return "var(--color-orange)"; // Medium
    return "var(--color-red)"; // High
  };

  const getRiskLabel = (val) => {
    if (val <= 15) return "LOW RISK";
    if (val <= 35) return "MEDIUM RISK";
    return "HIGH RISK";
  };

  const currentColor = getRiskColor(score);
  const currentLabel = getRiskLabel(score);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center" style={{ width: "120px", height: "120px" }}>
        <svg height="120" width="120" className="transform -rotate-90">
          {/* Background Circle */}
          <circle
            stroke="var(--border-color)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx="60"
            cy="60"
          />
          {/* Active Risk Circle */}
          <circle
            stroke={currentColor}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + " " + circumference}
            style={{ strokeDashoffset, transition: "stroke-dashoffset 0.5s ease, stroke 0.5s ease" }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx="60"
            cy="60"
          />
        </svg>
        {/* Inner Score Label */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold tracking-tight" style={{ color: currentColor, transition: "color 0.5s ease" }}>
            {Math.round(score)}%
          </span>
        </div>
      </div>
      <span className="mt-3 text-xs font-bold tracking-widest text-center" style={{ color: currentColor, transition: "color 0.5s ease" }}>
        {currentLabel}
      </span>
    </div>
  );
}

export function CircularGauge({ score, type = "risk", title }) {
  const radius = 36;
  const stroke = 5;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getRiskColor = (val) => {
    if (val <= 15) return "var(--color-green)"; // Low
    if (val <= 35) return "var(--color-orange)"; // Medium
    return "var(--color-red)"; // High
  };

  const getIntegrityColor = (val) => {
    if (val >= 85) return "var(--color-green)"; // Excellent
    if (val >= 65) return "var(--color-yellow)"; // Suspicious
    return "var(--color-red)"; // Critical
  };

  const getRiskLabel = (val) => {
    if (val <= 15) return "LOW RISK";
    if (val <= 35) return "MEDIUM RISK";
    return "HIGH RISK";
  };

  const getIntegrityLabel = (val) => {
    if (val >= 85) return "EXCELLENT";
    if (val >= 65) return "SUSPICIOUS";
    return "CRITICAL";
  };

  const currentColor = type === "risk" ? getRiskColor(score) : getIntegrityColor(score);
  const currentLabel = type === "risk" ? getRiskLabel(score) : getIntegrityLabel(score);

  return (
    <div className="flex flex-col items-center justify-center p-1.5 text-center w-full">
      {title && (
        <span className="text-[9px] font-bold tracking-widest text-secondary uppercase mb-1.5">
          {title}
        </span>
      )}
      <div className="relative flex items-center justify-center" style={{ width: "72px", height: "72px" }}>
        <svg height="72" width="72" className="transform -rotate-90">
          <circle
            stroke="var(--border-color)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx="36"
            cy="36"
          />
          <circle
            stroke={currentColor}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + " " + circumference}
            style={{ strokeDashoffset, transition: "stroke-dashoffset 0.5s ease, stroke 0.5s ease" }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx="36"
            cy="36"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-sm font-black tracking-tight" style={{ color: currentColor, transition: "color 0.5s ease" }}>
            {Math.round(score)}%
          </span>
        </div>
      </div>
      <span className="mt-1.5 text-[8px] font-extrabold tracking-wider" style={{ color: currentColor, transition: "color 0.5s ease" }}>
        {currentLabel}
      </span>
    </div>
  );
}
