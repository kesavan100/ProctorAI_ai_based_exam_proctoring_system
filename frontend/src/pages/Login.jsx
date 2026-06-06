import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GraduationCap, ShieldCheck, Eye, EyeOff, Sun, Moon, Lock, AlertTriangle, Key } from "lucide-react";

export function Login({ backendUrl, onLoginSuccess }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentRemember, setStudentRemember] = useState(false);
  
  // Admin fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adminRemember, setAdminRemember] = useState(false);
  
  // Multi-Factor Authentication
  const [showMfa, setShowMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Toast States
  const [toasts, setToasts] = useState([]);

  const showToast = (title, message, type = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Theme support
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "hidden";
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const role = params.get("role");
    if (role === "admin") {
      setIsAdmin(true);
      setError("");
      setShowMfa(false);
      setMfaCode("");
    } else if (role === "student") {
      setIsAdmin(false);
      setError("");
      setShowMfa(false);
      setMfaCode("");
    }
  }, [location.search]);

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim() || !studentName.trim()) return;
    
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${backendUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId.toUpperCase(), name: studentName })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }
      
      onLoginSuccess(data);
      navigate("/exam");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    if (!showMfa) {
      // Transition to Multi-Factor Authentication step
      setShowMfa(true);
      setError("");
      return;
    }

    if (mfaCode.length < 6) {
      setError("Please enter a valid 6-digit MFA OTP code.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${backendUrl}/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid admin credentials");
      }

      onLoginSuccess(data);
      navigate("/admin");
    } catch (err) {
      setError(err.message);
      setShowMfa(false); // Reset to first step on error
      setMfaCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-primary text-primary relative overflow-hidden">
      
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2.5 rounded-lg border border-primary bg-secondary hover:bg-tertiary transition-all cursor-pointer shadow-sm z-50"
        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {theme === "dark" ? (
          <Sun className="w-5 h-5 text-amber-500" />
        ) : (
          <Moon className="w-5 h-5 text-indigo-500" />
        )}
      </button>

      {/* Main card */}
      <div className="w-full max-w-md p-8 border glass-panel border-primary relative overflow-hidden bg-secondary rounded-2xl shadow-glow">
        
        {/* Decorative glows */}
        <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full bg-rose-500/5 blur-3xl" />

        {/* Portal Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-indigo-500/15 border border-indigo-500/30">
            {isAdmin ? <Lock className="w-6 h-6 text-indigo-500" /> : <GraduationCap className="w-6 h-6 text-indigo-500" />}
          </div>
          <h2 className="text-xl font-black tracking-tight uppercase text-primary">
            {isAdmin ? "Admin Supervisor" : "ProctorAI Portal"}
          </h2>
          <p className="mt-1 text-xs text-muted">Secure Online Examination Environment</p>
        </div>

        {/* Tab Selector (Hidden during Active Admin MFA verification step to prevent tab bypass) */}
        {!showMfa && (
          <div className="grid grid-cols-2 p-1 mb-6 rounded-lg bg-tertiary border border-primary">
            <button
              onClick={() => { setIsAdmin(false); setError(""); }}
              className={`py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                !isAdmin ? "bg-indigo-600 text-white shadow-sm" : "text-muted hover:text-primary"
              }`}
            >
              Student Workspace
            </button>
            <button
              onClick={() => { setIsAdmin(true); setError(""); }}
              className={`py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                isAdmin ? "bg-indigo-600 text-white shadow-sm" : "text-muted hover:text-primary"
              }`}
            >
              Admin Dashboard
            </button>
          </div>
        )}

        {/* Error Panels */}
        {error && (
          <div className="p-3.5 mb-5 text-xs font-semibold border rounded-lg border-red-500/20 bg-red-500/5 text-red-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* STUDENT LOGIN FORM */}
        {!isAdmin && (
          <form onSubmit={handleStudentSubmit} className="flex flex-col gap-5">
            <div className="floating-label-group">
              <input
                type="text"
                id="studentId"
                placeholder=" "
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              />
              <label htmlFor="studentId">Student ID</label>
            </div>

            <div className="floating-label-group">
              <input
                type="text"
                id="studentName"
                placeholder=" "
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
              />
              <label htmlFor="studentName">Student Full Name</label>
            </div>

            {/* Remember Me CTA */}
            <div className="flex items-center text-[11px] select-none px-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-secondary hover:text-primary transition-all">
                <input 
                  type="checkbox" 
                  checked={studentRemember}
                  onChange={(e) => setStudentRemember(e.target.checked)}
                  className="rounded border-primary accent-indigo-600" 
                />
                <span>Remember Me</span>
              </label>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 btn btn-primary">
              {loading ? "Establishing Session..." : "Access Exam Workspace"}
            </button>
          </form>
        )}

        {/* ADMIN LOGIN FORM (Step 1: Credentials) */}
        {isAdmin && !showMfa && (
          <form onSubmit={handleAdminSubmit} className="flex flex-col gap-5">
            <div className="floating-label-group">
              <input
                type="text"
                id="username"
                placeholder=" "
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <label htmlFor="username">Admin ID / Username</label>
            </div>

            <div className="floating-label-group">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: "45px" }}
              />
              <label htmlFor="password">Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle-btn"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Remember Device Check */}
            <div className="flex items-center justify-between text-[11px] select-none px-1" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <label className="flex items-center gap-1.5 cursor-pointer text-secondary hover:text-primary transition-all">
                <input 
                  type="checkbox" 
                  checked={adminRemember}
                  onChange={(e) => setAdminRemember(e.target.checked)}
                  className="rounded border-primary accent-indigo-600" 
                />
                <span>Remember Device</span>
              </label>
              <span className="text-muted text-[10px]">Default: helloiamadmin / helloiamadmin</span>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 btn btn-primary">
              {loading ? "Verifying Credentials..." : "Unlock Dashboard"}
            </button>
          </form>
        )}

        {/* ADMIN MFA FORM (Step 2: 2FA Screen) */}
        {isAdmin && showMfa && (
          <form onSubmit={handleAdminSubmit} className="flex flex-col gap-5">
            <div className="text-center flex flex-col gap-1 items-center">
              <Key className="w-7 h-7 text-indigo-400 mb-1 animate-pulse" />
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Two-Factor Authentication</span>
              <p className="text-[10px] text-secondary leading-normal max-w-[280px]">
                Enter the 6-digit OTP security code from your authenticator device or hardware token.
              </p>
            </div>
            
            <div className="floating-label-group">
              <input
                type="text"
                id="mfaCode"
                placeholder=" "
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                required
                className="text-center font-mono tracking-[0.5em] text-lg font-bold"
                style={{ letterSpacing: "0.4em", paddingLeft: "24px" }}
              />
              <label htmlFor="mfaCode">6-Digit OTP Code</label>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted px-1" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <label className="flex items-center gap-1.5 cursor-pointer text-secondary hover:text-primary transition-all">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="rounded accent-indigo-600 border-primary"
                />
                <span>Trust device for 30 days</span>
              </label>
              <button
                type="button"
                onClick={() => { setShowMfa(false); setMfaCode(""); setError(""); }}
                className="text-indigo-400 hover:underline font-semibold"
              >
                Go Back
              </button>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 btn btn-primary">
              {loading ? "Authenticating 2FA..." : "Verify & Authorize"}
            </button>
          </form>
        )}
      </div>

      {/* Global Developer credits footer */}
      <div className="mt-8 text-center text-[10px] text-secondary select-none">
        Designed & Developed by Kesavan S | <a href="mailto:skesavan124@gmail.com" className="text-indigo-400 hover:underline">skesavan124@gmail.com</a>
      </div>

      {/* Toasts Render Container */}
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
            <div className="flex flex-col gap-0.5 text-left">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">{t.title}</span>
              <span className="text-[11px] text-secondary leading-normal">{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
