import React, { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import { 
  Users, AlertTriangle, MonitorPlay, Lock, ShieldAlert, LogOut, LayoutGrid, Eye, Search, 
  Sliders, Volume2, Shield, Menu, ChevronLeft, ChevronRight, BarChart3, Sun, Moon, ArrowUpDown 
} from "lucide-react";
import { StudentGridCard } from "../components/StudentGridCard";
import { AlertTimeline } from "../components/AlertTimeline";
import { ConfidenceChart } from "../components/ConfidenceChart";
import { useAlert } from "../components/Modal";

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

// Skeleton Shimmer Components
function SkeletonMetrics() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton-card flex items-center justify-between">
          <div className="flex flex-col gap-2 w-2/3">
            <div className="skeleton-bar title shimmer-loader" style={{ height: "10px", width: "50%", marginBottom: "0" }} />
            <div className="skeleton-bar shimmer-loader" style={{ height: "24px", width: "40%" }} />
          </div>
          <div className="skeleton-circle shimmer-loader" style={{ width: "32px", height: "32px" }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton-card flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-2 w-1/2">
              <div className="skeleton-bar shimmer-loader" style={{ height: "14px" }} />
              <div className="skeleton-bar shimmer-loader" style={{ height: "10px", width: "60%" }} />
            </div>
            <div className="skeleton-bar shimmer-loader" style={{ height: "16px", width: "60px" }} />
          </div>
          <div className="skeleton-bar shimmer-loader" style={{ height: "128px" }} />
          <div className="flex justify-between items-center">
            <div className="skeleton-bar shimmer-loader" style={{ height: "12px", width: "40%" }} />
            <div className="skeleton-bar shimmer-loader" style={{ height: "12px", width: "40%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="w-full border border-primary rounded-lg bg-secondary overflow-hidden p-4 flex flex-col gap-4 mt-6">
      <div className="skeleton-bar title shimmer-loader" style={{ height: "14px", width: "25%", marginBottom: "0" }} />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-4 items-center w-full">
          <div className="skeleton-bar shimmer-loader" style={{ height: "12px", width: "20%" }} />
          <div className="skeleton-bar shimmer-loader" style={{ height: "12px", width: "15%" }} />
          <div className="skeleton-bar shimmer-loader" style={{ height: "12px", width: "15%" }} />
          <div className="skeleton-bar shimmer-loader" style={{ height: "12px", width: "15%" }} />
          <div className="skeleton-bar shimmer-loader" style={{ height: "12px", width: "20%" }} />
          <div className="skeleton-bar shimmer-loader" style={{ height: "12px", width: "15%" }} />
        </div>
      ))}
    </div>
  );
}

export function AdminDashboard({ user, backendUrl, onLogout }) {
  const [stats, setStats] = useState({
    total_students: 0,
    active_exams: 0,
    flagged_students: 0,
    critical_locks: 0
  });
  const [activeSessions, setActiveSessions] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [recentViolations, setRecentViolations] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedSessionViolations, setSelectedSessionViolations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Administrative Calibration states
  const [lockThreshold, setLockThreshold] = useState(80);
  const [audioLimit, setAudioLimit] = useState(68);

  // Theme Switching
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  // Collapsible Navigation & Layout States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(localStorage.getItem("sidebar_collapsed") === "true");
  const [activeTab, setActiveTab] = useState("monitoring"); // "monitoring", "analytics", "calibration"
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Completed Examinations Audit Table Sorting, Filtering, and Pagination
  const [tableSortField, setTableSortField] = useState("end_time");
  const [tableSortOrder, setTableSortOrder] = useState("desc");
  const [tableFilter, setTableFilter] = useState("all"); // "all", "low", "medium", "high"
  const [tablePage, setTablePage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const socketRef = useRef(null);

  // Custom modal hook (replaces native alert)
  const { alert: showAlert, AlertModal } = useAlert();

  const showToast = (title, message, type = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const fetchDashboardData = async (isFirst = false) => {
    try {
      const res = await fetch(`${backendUrl}/admin/dashboard`, {
        headers: {
          "Authorization": `Bearer ${user.access_token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      
      const data = await res.json();
      setStats(data.stats);
      
      // Merge initial sessions with existing socket sessions to preserve frames
      setActiveSessions((prev) => {
        return data.active_sessions.map((newS) => {
          const matched = prev.find((p) => p.session_id === newS.session_id);
          return matched ? { ...newS, ...matched } : newS;
        });
      });
      
      setRecentViolations(data.recent_violations);
      
      if (data.active_sessions.length > 0 && !selectedStudentId) {
        handleSelectStudent(data.active_sessions[0].student_id, data.active_sessions[0].session_id);
      }

      if (isFirst) {
        setTimeout(() => {
          setIsInitialLoading(false);
        }, 750); // Give the user a beautiful micro-shimmer layout on mount
      }
    } catch (err) {
      console.error(err);
      if (isFirst) setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    fetchDashboardData(true);
    const interval = setInterval(() => fetchDashboardData(false), 10000);
    return () => clearInterval(interval);
  }, [backendUrl, user]);

  useEffect(() => {
    const socket = io(backendUrl, {
      auth: { role: "admin" }
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Admin Socket.IO connected");
    });

    // Real-time video frame and coordinates update
    socket.on("frame_update", (data) => {
      setActiveSessions((prev) =>
        prev.map((s) => {
          if (s.session_id === data.session_id) {
            return {
              ...s,
              image_base64: data.image_base64,
              detections: data.detections,
              risk_score: data.risk_score,
              behavior_score: data.behavior_score,
              status: data.status,
              last_seen: new Date()
            };
          }
          return s;
        })
      );
    });

    socket.on("risk_score_update", (data) => {
      setActiveSessions((prev) =>
        prev.map((s) => {
          if (s.session_id === data.session_id) {
            return {
              ...s,
              risk_score: data.risk_score,
              behavior_score: data.behavior_score,
              status: data.status,
              last_seen: new Date()
            };
          }
          return s;
        })
      );
    });

    const handleViolationAlert = (data) => {
      setRecentViolations((prev) => [data, ...prev.slice(0, 19)]);
      
      const session = activeSessions.find(s => s.session_id === data.session_id);
      if (session && session.student_id === selectedStudentId) {
        fetchStudentViolations(data.session_id);
      }
    };

    const formatViolationLabel = (type) => {
      switch (type) {
        case "phone_detected": return "Mobile Phone Detected";
        case "laptop_detected": return "Laptop Detected";
        case "multiple_persons": return "Multiple Persons Present";
        case "face_missing": return "Student Face Missing";
        case "tab_switch": return "Browser Tab Switch";
        case "fullscreen_exit": return "Exited Fullscreen";
        case "copy_paste": return "Copy/Paste Clipboard Attempt";
        default: return type.replace(/_/g, " ").toUpperCase();
      }
    };

    socket.on("phone_detected", (data) => {
      handleViolationAlert(data);
      showToast("Critical: Phone Detected", `${data.student_name} has a mobile device present.`, "critical");
    });
    socket.on("laptop_detected", (data) => {
      handleViolationAlert(data);
      showToast("Critical: Laptop Detected", `${data.student_name} has a secondary screen/laptop present.`, "critical");
    });
    socket.on("multiple_person_detected", (data) => {
      handleViolationAlert(data);
      showToast("Critical: Multiple People", `${data.student_name}: Multiple faces visible in camera view.`, "critical");
    });
    socket.on("face_missing", (data) => {
      handleViolationAlert(data);
      showToast("Warning: Face Absent", `${data.student_name}: Left the proctoring frame.`, "warning");
    });
    socket.on("tab_switch_detected", (data) => {
      handleViolationAlert(data);
      showToast("Warning: Tab Switch", `${data.student_name} switched or left the exam tab.`, "warning");
    });
    socket.on("fullscreen_exit", (data) => {
      handleViolationAlert(data);
      showToast("Warning: Fullscreen Exited", `${data.student_name} closed fullscreen mode.`, "warning");
    });
    socket.on("warning_event", (data) => {
      handleViolationAlert(data);
      const label = formatViolationLabel(data.type);
      showToast(`Warning: ${label}`, `${data.student_name}: Telemetry anomaly flagged.`, "warning");
    });

    socket.on("system_lock", (data) => {
      setActiveSessions((prev) =>
        prev.map((s) => {
          if (s.session_id === data.session_id) {
            return { ...s, status: "locked" };
          }
          return s;
        })
      );
      fetchDashboardData(); 
      const studentName = activeSessions.find(s => s.session_id === data.session_id)?.student_name || "Student";
      showToast("Exam Workspace Locked", `${studentName}'s exam has been auto-locked due to high risk score.`, "critical");
    });

    socket.on("system_unlock", (data) => {
      setActiveSessions((prev) =>
        prev.map((s) => {
          if (s.session_id === data.session_id) {
            return { ...s, status: "active", risk_score: 0.0, behavior_score: 100.0 };
          }
          return s;
        })
      );
      fetchDashboardData();
      const studentName = activeSessions.find(s => s.session_id === data.session_id)?.student_name || "Student";
      showToast("Session Unlocked", `Successfully restored workspace and reset risk score for ${studentName}.`, "info");
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedStudentId, activeSessions, backendUrl]);

  const fetchStudentViolations = async (sessId) => {
    try {
      const res = await fetch(`${backendUrl}/violations/${sessId}`, {
        headers: { "Authorization": `Bearer ${user.access_token}` }
      });
      if (res.ok) {
        const viols = await res.json();
        setSelectedSessionViolations(viols);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectStudent = (studentId, sessionId) => {
    setSelectedStudentId(studentId);
    fetchStudentViolations(sessionId);
  };

  const handleUnlockSession = async (studentId) => {
    try {
      const res = await fetch(`${backendUrl}/admin/unlock-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.access_token}`
        },
        body: JSON.stringify({ student_id: studentId })
      });
      if (!res.ok) throw new Error("Failed to unlock student session");
      
      const session = activeSessions.find((s) => s.student_id === studentId);
      if (session) {
        setSelectedSessionViolations([]);
        fetchStudentViolations(session.session_id);
      }
      
      fetchDashboardData();
    } catch (err) {
      showAlert("Unlock Failed", err.message, "error");
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const val = !prev;
      localStorage.setItem("sidebar_collapsed", String(val));
      return val;
    });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const selectedSession = activeSessions.find((s) => s.student_id === selectedStudentId);

  // Filter Active Sessions (Examinee Monitoring View)
  const activeExaminees = activeSessions.filter((s) => s.status !== "completed");
  const filteredActiveExaminees = activeExaminees.filter((s) =>
    s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter/Sort/Paginate Completed Sessions
  const completedSessions = activeSessions.filter((s) => s.status === "completed");
  
  let processedCompleted = completedSessions.filter((s) =>
    s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (tableFilter === "low") {
    processedCompleted = processedCompleted.filter((s) => s.risk_score <= 15);
  } else if (tableFilter === "medium") {
    processedCompleted = processedCompleted.filter((s) => s.risk_score > 15 && s.risk_score <= 35);
  } else if (tableFilter === "high") {
    processedCompleted = processedCompleted.filter((s) => s.risk_score > 35);
  }

  processedCompleted.sort((a, b) => {
    let valA = a[tableSortField];
    let valB = b[tableSortField];

    if (tableSortField === "end_time" || tableSortField === "start_time") {
      valA = valA ? parseUTCDate(valA).getTime() : 0;
      valB = valB ? parseUTCDate(valB).getTime() : 0;
    }

    if (valA < valB) return tableSortOrder === "asc" ? -1 : 1;
    if (valA > valB) return tableSortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const totalRows = processedCompleted.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const startIndex = (tablePage - 1) * rowsPerPage;
  const paginatedCompleted = processedCompleted.slice(startIndex, startIndex + rowsPerPage);

  const handleSort = (field) => {
    if (tableSortField === field) {
      setTableSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTableSortField(field);
      setTableSortOrder("desc");
    }
    setTablePage(1);
  };

  const getIntegrityClass = (score) => {
    if (score >= 85) return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
    if (score >= 65) return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
    return "bg-rose-500/10 text-rose-500 border border-rose-500/20";
  };

  const getRiskClass = (score) => {
    if (score >= 36) return "bg-red-500/10 text-red-500 border border-red-500/20";
    if (score >= 16) return "bg-orange-500/10 text-orange-500 border border-orange-500/20";
    return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-primary text-primary">
      {/* Collapsible Left Navigation Sidebar */}
      <aside 
        className="flex flex-col border-r border-primary bg-secondary h-full transition-all duration-300 relative select-none shrink-0"
        style={{ width: isSidebarCollapsed ? "68px" : "240px" }}
      >
        {/* Upper Sidebar Logo / Toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-primary">
          <div className={`flex items-center gap-2.5 overflow-hidden transition-all ${isSidebarCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto"}`}>
            <div className="flex items-center justify-center w-8 h-8 rounded bg-indigo-600 shrink-0 shadow-md">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <span className="font-black tracking-wider uppercase text-sm text-primary whitespace-nowrap">ProctorAI</span>
          </div>

          <button 
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg border border-primary hover:bg-tertiary text-secondary hover:text-primary transition-all cursor-pointer shadow-sm mx-auto"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Nav Tabs */}
        <nav className="flex-1 flex flex-col gap-1.5 p-3 overflow-y-auto">
          <button
            onClick={() => setActiveTab("monitoring")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeTab === "monitoring"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-secondary hover:text-primary hover:bg-tertiary"
            }`}
            title="Examinee Monitoring"
          >
            <LayoutGrid className="w-4.5 h-4.5 shrink-0" />
            <span className={`transition-opacity duration-200 whitespace-nowrap ${isSidebarCollapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100 w-auto"}`}>
              Examinee Monitoring
            </span>
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeTab === "analytics"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-secondary hover:text-primary hover:bg-tertiary"
            }`}
            title="Violation Analytics"
          >
            <BarChart3 className="w-4.5 h-4.5 shrink-0" />
            <span className={`transition-opacity duration-200 whitespace-nowrap ${isSidebarCollapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100 w-auto"}`}>
              Violation Analytics
            </span>
          </button>

          <button
            onClick={() => setActiveTab("calibration")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeTab === "calibration"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-secondary hover:text-primary hover:bg-tertiary"
            }`}
            title="System Calibration"
          >
            <Sliders className="w-4.5 h-4.5 shrink-0" />
            <span className={`transition-opacity duration-200 whitespace-nowrap ${isSidebarCollapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100 w-auto"}`}>
              System Calibration
            </span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-primary bg-tertiary/30 flex flex-col gap-2">
          {/* User detail */}
          <div className={`flex items-center gap-2 overflow-hidden transition-all ${isSidebarCollapsed ? "justify-center" : "px-1"}`}>
            <div className="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-500 shrink-0 text-xs shadow-inner">
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-primary truncate">{user.name}</span>
                <span className="text-[9px] text-emerald-500 font-bold">Online</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className={`flex gap-1.5 ${isSidebarCollapsed ? "flex-col items-center" : "flex-row mt-1"}`}>
            <button
              onClick={toggleTheme}
              className="flex-1 p-2 rounded-lg border border-primary bg-secondary hover:bg-tertiary text-secondary hover:text-primary transition-all cursor-pointer flex justify-center shadow-sm"
              title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
            </button>

            <button
              onClick={onLogout}
              className="flex-1 p-2 rounded-lg border border-primary bg-secondary hover:bg-red-500/10 hover:border-red-500/20 text-secondary hover:text-red-500 transition-all cursor-pointer flex justify-center shadow-sm"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {!isSidebarCollapsed && (
            <div className="mt-3.5 border-t border-primary/40 pt-3 text-center text-[9px] text-secondary select-none">
              Designed & Developed by Kesavan S <br />
              <a href="mailto:skesavan124@gmail.com" className="text-indigo-400 hover:underline">skesavan124@gmail.com</a>
            </div>
          )}
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-primary">
        {/* Top Navbar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-primary bg-secondary">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black tracking-wider uppercase text-primary">
              {activeTab === "monitoring" && "Examinee Monitoring Control"}
              {activeTab === "analytics" && "Violation Analytics Platform"}
              {activeTab === "calibration" && "System Threshold Calibration"}
            </h1>
            <span className="text-[10px] text-muted font-mono tracking-widest hidden md:inline">| SYSTEM MONITORING</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right hidden sm:flex">
              <span className="text-[10px] text-secondary font-mono">NODE STATUS: ACTIVE</span>
              <span className="text-[9px] text-emerald-500 font-bold uppercase">Proctor Shield Sync OK</span>
            </div>
            {/* Sync Status Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-500 tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </div>
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          {isInitialLoading ? (
            /* Shimmer Skeleton View */
            <div className="flex-1 flex flex-col overflow-hidden">
              <SkeletonMetrics />
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6 mt-6">
                <SkeletonGrid />
                <SkeletonTable />
              </div>
            </div>
          ) : (
            <>
              {/* MONITORING TAB */}
              {activeTab === "monitoring" && (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden">
                  {/* Left Column: Grid and Table */}
                  <div className={`${selectedSession ? "lg:col-span-3" : "lg:col-span-4"} flex flex-col gap-6 overflow-hidden`}>
                    
                    {/* Stats Metrics Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
                      <div className="glass-panel p-4 flex items-center justify-between indicator-bar-left" style={{ "--bar-color": "var(--color-indigo)" }}>
                        <div className="flex flex-col pl-3">
                          <span className="text-[11px] font-bold text-secondary uppercase tracking-widest">Examinees</span>
                          <span className="text-2xl font-black mt-1 stat-glow">{stats.total_students}</span>
                        </div>
                        <Users className="w-7 h-7 text-indigo-400 opacity-60 mr-2" />
                      </div>

                      <div className="glass-panel p-4 flex items-center justify-between indicator-bar-left" style={{ "--bar-color": "#c084fc" }}>
                        <div className="flex flex-col pl-3">
                          <span className="text-[11px] font-bold text-secondary uppercase tracking-widest">Active Exams</span>
                          <span className="text-2xl font-black mt-1 text-indigo-500 stat-glow">{stats.active_exams}</span>
                        </div>
                        <MonitorPlay className="w-7 h-7 text-indigo-400 opacity-60 mr-2" />
                      </div>

                      <div className="glass-panel p-4 flex items-center justify-between indicator-bar-left" style={{ "--bar-color": "var(--color-orange)" }}>
                        <div className="flex flex-col pl-3">
                          <span className="text-[11px] font-bold text-secondary uppercase tracking-widest">High Risk (&ge;36%)</span>
                          <span className="text-2xl font-black mt-1 text-orange-500 stat-glow">{stats.flagged_students}</span>
                        </div>
                        <AlertTriangle className="w-7 h-7 text-orange-400 opacity-60 mr-2" />
                      </div>

                      <div className="glass-panel p-4 flex items-center justify-between indicator-bar-left" style={{ "--bar-color": "var(--color-red)" }}>
                        <div className="flex flex-col pl-3">
                          <span className="text-[11px] font-bold text-secondary uppercase tracking-widest">Locked Sessions</span>
                          <span className="text-2xl font-black mt-1 text-red-500 stat-glow">{stats.critical_locks}</span>
                        </div>
                        <Lock className="w-7 h-7 text-red-500 opacity-60 mr-2" />
                      </div>
                    </div>

                    {/* Main Monitoring Scrollable Panel */}
                    <div className="flex-1 glass-panel p-5 flex flex-col overflow-hidden bg-secondary">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 shrink-0">
                        <div className="flex items-center gap-2">
                          <LayoutGrid className="w-4.5 h-4.5 text-indigo-500" />
                          <h2 className="text-sm font-black text-primary uppercase tracking-wider">Live Exam Monitoring Grid</h2>
                        </div>
                        
                        {/* Search Bar */}
                        <div className="relative w-full sm:w-64">
                          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="Filter by ID or Name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-1.5 input-field text-xs bg-tertiary border-primary"
                          />
                        </div>
                      </div>

                      {/* Main Monitoring lists */}
                      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6">
                        {/* 1. Active Grid */}
                        <div>
                          <h3 className="text-xs font-bold text-indigo-500 mb-3 tracking-wider uppercase flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Active Examinees ({filteredActiveExaminees.length})
                          </h3>
                          {filteredActiveExaminees.length === 0 ? (
                            <div className="border border-dashed rounded-lg border-primary p-6 text-center text-xs text-secondary">
                              No active students currently taking the exam.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                              {filteredActiveExaminees.map((session) => (
                                <StudentGridCard
                                  key={session.session_id}
                                  student={session}
                                  isSelected={selectedStudentId === session.student_id}
                                  onClick={() => handleSelectStudent(session.student_id, session.session_id)}
                                  onUnlock={handleUnlockSession}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 2. Audit Trail Completed Table */}
                        <div className="border-t border-primary pt-5">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3 shrink-0">
                            <h3 className="text-xs font-bold text-secondary tracking-wider uppercase flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-gray-400" />
                              Completed Examinations / Audit Trail ({totalRows})
                            </h3>

                            {/* Filter Chips */}
                            <div className="flex gap-1.5 flex-wrap">
                              {["all", "low", "medium", "high"].map((filterOpt) => (
                                <button
                                  key={filterOpt}
                                  onClick={() => { setTableFilter(filterOpt); setTablePage(1); }}
                                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase transition-all border cursor-pointer ${
                                    tableFilter === filterOpt
                                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                      : "bg-tertiary text-secondary border-primary hover:text-primary"
                                  }`}
                                >
                                  {filterOpt} Risk
                                </button>
                              ))}
                            </div>
                          </div>

                          {paginatedCompleted.length === 0 ? (
                            <div className="border border-dashed rounded-lg border-primary p-6 text-center text-xs text-secondary bg-tertiary/10">
                              No matching completed student records.
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              <div className="overflow-x-auto w-full border border-primary rounded-lg bg-tertiary/20">
                                <table className="w-full text-left border-collapse text-xs text-secondary">
                                  <thead>
                                    <tr className="border-b border-primary bg-tertiary/40 text-[10px] uppercase font-bold text-secondary tracking-wider">
                                      <th className="p-3">Student Name</th>
                                      <th className="p-3">Student ID</th>
                                      <th className="p-3 cursor-pointer select-none hover:text-primary transition-colors" onClick={() => handleSort("risk_score")}>
                                        <div className="flex items-center gap-1">
                                          Final Risk {tableSortField === "risk_score" && <ArrowUpDown className="w-3 h-3 text-indigo-500" />}
                                        </div>
                                      </th>
                                      <th className="p-3">Integrity Rating</th>
                                      <th className="p-3">Started At</th>
                                      <th className="p-3 cursor-pointer select-none hover:text-primary transition-colors" onClick={() => handleSort("end_time")}>
                                        <div className="flex items-center gap-1">
                                          Completed At {tableSortField === "end_time" && <ArrowUpDown className="w-3 h-3 text-indigo-500" />}
                                        </div>
                                      </th>
                                      <th className="p-3 text-right">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {paginatedCompleted.map((session) => {
                                      const isRowSelected = selectedStudentId === session.student_id;
                                      return (
                                        <tr
                                          key={session.session_id}
                                          onClick={() => handleSelectStudent(session.student_id, session.session_id)}
                                          className={`border-b border-primary hover:bg-tertiary/30 transition-colors cursor-pointer ${
                                            isRowSelected ? "bg-indigo-600/10 text-primary font-bold border-l-2 border-l-indigo-500" : ""
                                          }`}
                                        >
                                          <td className="p-3 font-semibold text-primary">
                                            {session.student_name}
                                          </td>
                                          <td className="p-3 font-mono text-[11px] text-secondary">
                                            {session.student_id}
                                          </td>
                                          <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRiskClass(session.risk_score)}`}>
                                              {Math.round(session.risk_score)}% Risk
                                            </span>
                                          </td>
                                          <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getIntegrityClass(session.behavior_score)}`}>
                                              {Math.round(session.behavior_score)}% Integrity
                                            </span>
                                          </td>
                                          <td className="p-3 text-[11px] text-secondary">
                                            {session.start_time ? parseUTCDate(session.start_time).toLocaleString() : "N/A"}
                                          </td>
                                          <td className="p-3 text-[11px] text-secondary">
                                            {session.end_time ? parseUTCDate(session.end_time).toLocaleString() : "N/A"}
                                          </td>
                                          <td className="p-3 text-right">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectStudent(session.student_id, session.session_id);
                                              }}
                                              className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors cursor-pointer shadow-sm"
                                            >
                                              View Audit Logs
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* Paging Footer controls */}
                              <div className="flex items-center justify-between mt-2 px-1 text-xs text-secondary shrink-0">
                                <span>
                                  Showing <span className="font-bold text-primary">{startIndex + 1}</span> to{" "}
                                  <span className="font-bold text-primary">{Math.min(startIndex + rowsPerPage, totalRows)}</span> of{" "}
                                  <span className="font-bold text-primary">{totalRows}</span> completed records
                                </span>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                                    disabled={tablePage === 1}
                                    className="px-3 py-1.5 border border-primary bg-tertiary rounded hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[11px] font-bold transition-all shadow-sm"
                                  >
                                    Previous
                                  </button>
                                  <span className="font-bold text-primary text-[11px]">
                                    Page {tablePage} of {totalPages}
                                  </span>
                                  <button
                                    onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                                    disabled={tablePage === totalPages}
                                    className="px-3 py-1.5 border border-primary bg-tertiary rounded hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[11px] font-bold transition-all shadow-sm"
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Selected Examinee Audit Panel */}
                  {selectedSession && (
                    <div className="lg:col-span-1 flex flex-col gap-6 overflow-hidden">
                      <div className="glass-panel p-5 flex-1 flex flex-col gap-4 overflow-hidden bg-secondary">
                        {/* Profile Overview */}
                        <div className="border-b border-primary pb-3">
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">SELECTED EXAMINEE</span>
                          <h2 className="text-base font-black text-primary mt-1">{selectedSession.student_name}</h2>
                          <div className="flex items-center justify-between text-xs text-secondary font-mono mt-1">
                            <span>ID: {selectedSession.student_id}</span>
                            <span className="capitalize text-primary">Status: {selectedSession.status}</span>
                          </div>
                        </div>

                        {/* Status Indicators */}
                        <div className="grid grid-cols-2 gap-2 text-xs shrink-0">
                          <div className="flex flex-col p-2.5 rounded bg-tertiary border border-primary text-center">
                            <span className="text-[9px] text-secondary uppercase font-bold">Risk Rating</span>
                            <span className={`text-base font-black mt-1 ${
                              selectedSession.risk_score >= 36 ? "text-red-500" :
                              selectedSession.risk_score >= 16 ? "text-orange-500" :
                              "text-emerald-500"
                            }`}>{Math.round(selectedSession.risk_score)}%</span>
                          </div>
                          <div className="flex flex-col p-2.5 rounded bg-tertiary border border-primary text-center">
                            <span className="text-[9px] text-secondary uppercase font-bold">Integrity Index</span>
                            <span className={`text-base font-black mt-1 ${
                              selectedSession.behavior_score >= 85 ? "text-emerald-500" :
                              selectedSession.behavior_score >= 65 ? "text-amber-500" :
                              "text-rose-500"
                            }`}>{Math.round(selectedSession.behavior_score)}%</span>
                          </div>
                        </div>

                        {/* Bounding Box Confidence Chart */}
                        <ConfidenceChart detections={selectedSession.detections || []} />

                        {/* Force Unlock Option */}
                        {selectedSession.status === "locked" && (
                          <button
                            onClick={() => handleUnlockSession(selectedSession.student_id)}
                            className="w-full btn btn-danger py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md shrink-0"
                          >
                            <Lock className="w-4 h-4 animate-bounce" /> Unlock Student Exam
                          </button>
                        )}

                        {/* Telemetry Timeline logs */}
                        <div className="flex-1 flex flex-col overflow-hidden mt-1">
                          <h3 className="text-xs font-bold text-secondary mb-2.5 tracking-wider uppercase shrink-0">VIOLATIONS TIMELINE</h3>
                          <div className="flex-1 overflow-y-auto">
                            <AlertTimeline violations={selectedSessionViolations} backendUrl={backendUrl} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ANALYTICS TAB */}
              {activeTab === "analytics" && (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden">
                  {/* Left panel: Frequencies & Chart */}
                  <div className="lg:col-span-3 flex flex-col gap-6 overflow-hidden">
                    {/* Overall Violation Frequency analytics */}
                    <div className="glass-panel p-5 bg-secondary flex-1 flex flex-col overflow-hidden">
                      <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-sm font-black text-primary uppercase tracking-wider">Combined Violation Analytics</h2>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 justify-center">
                        <div className="p-6 bg-tertiary/40 border border-primary rounded-xl flex flex-col gap-4 text-center max-w-xl mx-auto w-full">
                          <h3 className="text-xs font-bold text-primary tracking-wide">SYSTEM TELEMETRY SUMMARY</h3>
                          <p className="text-xs text-secondary leading-relaxed">
                            ProctorAI has audited <span className="text-primary font-bold">{stats.total_students} student sessions</span>. High-sensitivity telemetry has mapped violations across active components:
                          </p>
                          <div className="grid grid-cols-3 gap-3 text-xs mt-2">
                            <div className="p-3 bg-secondary border border-primary rounded-lg flex flex-col items-center">
                              <span className="text-red-500 font-bold text-lg">{stats.flagged_students}</span>
                              <span className="text-[9px] text-secondary uppercase font-bold mt-1">Flagged Risk</span>
                            </div>
                            <div className="p-3 bg-secondary border border-primary rounded-lg flex flex-col items-center">
                              <span className="text-indigo-500 font-bold text-lg">{stats.active_exams}</span>
                              <span className="text-[9px] text-secondary uppercase font-bold mt-1">Active Streams</span>
                            </div>
                            <div className="p-3 bg-secondary border border-primary rounded-lg flex flex-col items-center">
                              <span className="text-red-500 font-bold text-lg">{stats.critical_locks}</span>
                              <span className="text-[9px] text-secondary uppercase font-bold mt-1">Locks Active</span>
                            </div>
                          </div>
                        </div>

                        {selectedSession ? (
                          <div className="p-5 bg-tertiary/20 border border-primary rounded-xl flex flex-col gap-3 max-w-xl mx-auto w-full">
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest text-center">Selected Student Confidence Metrics</span>
                            <ConfidenceChart detections={selectedSession.detections || []} />
                          </div>
                        ) : (
                          <div className="p-5 text-center text-xs text-secondary">
                            Select an examinee from the Monitoring tab to load detailed YOLO class confidence charts.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Panel: Combined Realtime Violations Feed */}
                  <div className="lg:col-span-1 flex flex-col gap-6 overflow-hidden">
                    <div className="glass-panel p-5 bg-secondary flex-1 flex flex-col overflow-hidden">
                      <div className="flex items-center gap-2 mb-3 shrink-0">
                        <AlertTriangle className="w-4.5 h-4.5 text-orange-500" />
                        <h2 className="text-xs font-black text-primary uppercase tracking-wider">Live System Alert Log</h2>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-1">
                        {recentViolations.length === 0 ? (
                          <div className="p-8 text-center text-xs text-secondary border border-dashed rounded-lg border-primary">
                            No telemetry logs captured across active channels.
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {recentViolations.map((viol, idx) => (
                              <div 
                                key={viol.id || idx}
                                onClick={() => handleSelectStudent(viol.student_id, viol.session_id)}
                                className="p-3 border border-primary rounded-lg bg-tertiary/40 hover:bg-tertiary cursor-pointer transition-all flex flex-col gap-1.5"
                              >
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-primary">{viol.student_name}</span>
                                  <span className="text-secondary">{viol.timestamp ? parseUTCDate(viol.timestamp).toLocaleTimeString() : "N/A"}</span>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[11px] font-bold text-red-500 capitalize">
                                    {viol.type.replace(/_/g, " ")}
                                  </span>
                                  <span className="text-[10px] text-secondary">
                                    Certainty: {Math.round(viol.confidence * 100)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CALIBRATION TAB */}
              {activeTab === "calibration" && (
                <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto">
                  <div className="glass-panel p-8 bg-secondary max-w-lg w-full flex flex-col gap-6 border-primary shadow-xl">
                    <div className="flex items-center gap-2 pb-3 border-b border-primary">
                      <Sliders className="w-5 h-5 text-indigo-500" />
                      <h2 className="text-sm font-black text-primary uppercase tracking-wider">System Threshold Calibration</h2>
                    </div>

                    <div className="flex flex-col gap-5 text-xs text-secondary">
                      {/* Auto-Lock Limit Slider */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-bold text-primary">
                          <span>Auto-Lock Integrity Threshold</span>
                          <span className="text-indigo-500 text-sm">{lockThreshold}%</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="95"
                          value={lockThreshold}
                          onChange={(e) => setLockThreshold(Number(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-[10px] text-muted leading-relaxed">
                          Sets the risk percentage boundary at which ProctorAI suspends student workspaces and initiates lockout overrides.
                        </span>
                      </div>

                      {/* Audio Limit Slider */}
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex items-center justify-between text-xs font-bold text-primary">
                          <span>Speech Sound Trigger Level</span>
                          <span className="text-indigo-500 text-sm">{audioLimit} dB</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="90"
                          value={audioLimit}
                          onChange={(e) => setAudioLimit(Number(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-[10px] text-muted leading-relaxed">
                          Determines the threshold decibel level for ambient speaking or room noise before logging audio warnings.
                        </span>
                      </div>

                      {/* Config summary card */}
                      <div className="p-4 bg-tertiary border border-primary rounded-xl flex flex-col gap-2.5 mt-2">
                        <span className="font-bold text-primary flex items-center gap-1">
                          <Shield className="w-4 h-4 text-indigo-500" /> Active System Constants:
                        </span>
                        <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-secondary mt-1">
                          <span>YOLO Version: <code>v8s-pt</code></span>
                          <span>Frame Capture: <code>1 frame/s</code></span>
                          <span>Risk Decay: <code>0.0 (Cumulative)</code></span>
                          <span>Confidence Trigger: <code>0.45</code></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Real-time Slide-In Toast Notification Center */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-4 border rounded-xl glass-panel-glow shadow-2xl flex items-start gap-3 toast-slide-in pointer-events-auto ${
              t.type === "critical" 
                ? "border-red-500/20 bg-red-500/5 text-red-500" 
                : t.type === "warning"
                ? "border-orange-500/20 bg-orange-500/5 text-orange-500"
                : "border-indigo-500/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400"
            }`}
          >
            <AlertTriangle className={`w-5 h-5 shrink-0 ${
              t.type === "critical" ? "text-red-500 animate-pulse" : "text-orange-500"
            }`} />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">{t.title}</span>
              <span className="text-[11px] text-secondary leading-normal">{t.message}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Custom Modal Portal */}
      {AlertModal}
    </div>
  );
}
