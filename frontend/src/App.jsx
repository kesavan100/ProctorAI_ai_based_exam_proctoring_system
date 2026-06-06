import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Login } from "./pages/Login";
import { Exam } from "./pages/Exam";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Landing } from "./pages/Landing";

/**
 * LoginGuard — ensures clicking "Student Login" when already logged in as admin
 * (or vice versa) clears the stale session and shows the correct login form.
 */
function LoginGuard({ user, onClearUser, children }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const requestedRole = params.get("role"); // "student" or "admin"

  if (user) {
    // If the requested role matches the current user role, redirect to their dashboard
    if (!requestedRole || requestedRole === user.role) {
      return user.role === "admin" ? <Navigate to="/admin" replace /> : <Navigate to="/exam" replace />;
    }
    // Role mismatch — clear old session so login form shows for the new role
    onClearUser();
    return null; // will re-render after state clears
  }

  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Set API backend url dynamically (defaults to local environment port 8000)
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  useEffect(() => {
    // Check if token exists in storage on app boot
    const storedUser = localStorage.getItem("proctor_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        localStorage.removeItem("proctor_user");
      }
    }
    setAuthLoading(false);
  }, []);

  const handleLoginSuccess = (loginData) => {
    setUser(loginData);
    localStorage.setItem("proctor_user", JSON.stringify(loginData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("proctor_user");
    localStorage.removeItem("proctor_session_id");
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-primary text-secondary font-mono text-sm gap-3">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading ProctorAI Secure Shield...</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page Route */}
        <Route path="/" element={<Landing />} />

        {/* Login Route */}
        <Route
          path="/login"
          element={
            <LoginGuard user={user} onClearUser={handleLogout}>
              <Login backendUrl={backendUrl} onLoginSuccess={handleLoginSuccess} />
            </LoginGuard>
          }
        />

        {/* Student Exam Workspace */}
        <Route
          path="/exam"
          element={
            user && user.role === "student" ? (
              <Exam user={user} backendUrl={backendUrl} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin"
          element={
            user && user.role === "admin" ? (
              <AdminDashboard user={user} backendUrl={backendUrl} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Default Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
