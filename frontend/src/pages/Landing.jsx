import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap,
  ShieldCheck,
  Smartphone,
  Users,
  Sparkles,
  Mic,
  Layout,
  ArrowRight,
  Shield,
  Sun,
  Moon,
  Eye,
  Zap,
  Activity,
  User,
  Mail,
  CheckCircle
} from "lucide-react";

export function Landing() {
  const navigate = useNavigate();

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "hidden";
    };
  }, []);

  const features = [
    {
      icon: <Eye className="landing-icon" />,
      title: "Continuous Face Tracking",
      desc: "Computer vision verifies the candidate remains in focus and flags when the face is missing or turned away."
    },
    {
      icon: <Smartphone className="landing-icon" />,
      title: "Device Detection (YOLOv8)",
      desc: "Real-time object detection identifies unauthorized devices like mobile phones or secondary laptops."
    },
    {
      icon: <Users className="landing-icon" />,
      title: "Multiple Face Detection",
      desc: "Instantly flags when secondary persons enter the camera frame to prevent unauthorized assistance."
    },
    {
      icon: <Sparkles className="landing-icon" />,
      title: "Head Pose & Gaze Analysis",
      desc: "Tracks head rotation and gaze angle to alert when a candidate looks away from the exam screen."
    },
    {
      icon: <Mic className="landing-icon" />,
      title: "Audio Decibel Monitoring",
      desc: "Monitors ambient sound levels and triggers alerts for speech patterns exceeding the 68dB threshold."
    },
    {
      icon: <Layout className="landing-icon" />,
      title: "Browser Lock Sandbox",
      desc: "Monitors tab switching, blocks copy-paste, and locks the editor when window focus is lost."
    }
  ];

  const steps = [
    {
      number: "01",
      icon: <Shield className="landing-icon" />,
      title: "Authenticate",
      desc: "Student logs in with credentials and identity is registered for the session."
    },
    {
      number: "02",
      icon: <Eye className="landing-icon" />,
      title: "Verify Identity",
      desc: "Face matching calibrates the session and verifies browser environment settings."
    },
    {
      number: "03",
      icon: <Zap className="landing-icon" />,
      title: "AI Proctoring Active",
      desc: "YOLOv8 detectors and audio analyzers monitor the workspace in real-time locally."
    },
    {
      number: "04",
      icon: <Activity className="landing-icon" />,
      title: "Audit & Report",
      desc: "Alerts are logged with screenshot evidence and final risk scorecards are generated."
    }
  ];

  return (
    <div className="landing-root">
      {/* ─── NAVIGATION ─── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          {/* Logo */}
          <div className="landing-logo-group">
            <div className="landing-logo-box">
              <GraduationCap className="landing-logo-icon" />
            </div>
            <span className="landing-logo-text">ProctorAI</span>
          </div>

          {/* Center Links */}
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#contact">Contact</a>
          </div>

          {/* Right CTA */}
          <div className="landing-nav-actions">
            <button
              onClick={toggleTheme}
              className="landing-theme-toggle"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
            </button>
            <button
              onClick={() => navigate("/login?role=student")}
              className="btn btn-secondary landing-nav-btn"
            >
              Student Login
            </button>
            <button
              onClick={() => navigate("/login?role=admin")}
              className="btn btn-primary landing-nav-btn"
            >
              Admin Portal
            </button>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <section className="landing-hero">
        <div className="landing-hero-glow landing-hero-glow-1" />
        <div className="landing-hero-glow landing-hero-glow-2" />

        <div className="landing-hero-inner">
          {/* Left: Copy */}
          <div className="landing-hero-copy">
            <div className="landing-badge">
              <Shield className="w-3 h-3" />
              <span>ProctorAI Engine</span>
            </div>

            <h1 className="landing-hero-title">
              AI-Powered Real-Time{" "}
              <span className="landing-gradient-text">Online Exam Proctoring</span>{" "}
              Platform
            </h1>

            <p className="landing-hero-subtitle">
              Advanced AI monitoring using Computer Vision, Audio Analysis, and 
              Behavioral Intelligence to ensure secure, fair, and trustworthy 
              online examinations — all running locally in the browser for 
              privacy-first anomaly detection.
            </p>

            <div className="landing-hero-ctas">
              <button
                onClick={() => navigate("/login?role=student")}
                className="btn btn-primary landing-cta-btn"
              >
                Access Exam Workspace <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/login?role=admin")}
                className="btn btn-secondary landing-cta-btn"
              >
                Open Admin Console
              </button>
            </div>
          </div>

          {/* Right: Floating AI cards */}
          <div className="landing-hero-visual">
            <div className="landing-visual-grid" />

            {/* Card: Face Detected */}
            <div className="landing-float-card animate-float-slow" style={{ top: "8%", left: "8%" }}>
              <div className="landing-float-card-icon landing-float-card-icon--green">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="landing-float-card-content">
                <div className="landing-float-card-status">
                  <span className="landing-dot landing-dot--green" />
                  <span className="landing-float-card-label">Face Detected</span>
                </div>
                <span className="landing-float-card-meta">Confidence: 98%</span>
              </div>
            </div>

            {/* Card: Identity Verified */}
            <div className="landing-float-card animate-float-medium" style={{ top: "12%", right: "6%" }}>
              <div className="landing-float-card-icon landing-float-card-icon--green">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="landing-float-card-content">
                <div className="landing-float-card-status">
                  <span className="landing-dot landing-dot--green" />
                  <span className="landing-float-card-label">Verified</span>
                </div>
                <span className="landing-float-card-meta">Match: 100%</span>
              </div>
            </div>

            {/* Card: Gaze Warning */}
            <div className="landing-float-card animate-float-fast" style={{ top: "38%", left: "5%" }}>
              <div className="landing-float-card-icon landing-float-card-icon--amber">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="landing-float-card-content">
                <div className="landing-float-card-status">
                  <span className="landing-dot landing-dot--amber" />
                  <span className="landing-float-card-label">Looking Away</span>
                </div>
                <span className="landing-float-card-meta">Gaze Deviation</span>
              </div>
            </div>

            {/* Card: Risk Score (Center, prominent) */}
            <div className="landing-float-card landing-float-card--center animate-float-medium" style={{ top: "42%", left: "50%", transform: "translate(-50%, -50%)" }}>
              <div className="landing-risk-header">
                <span className="landing-risk-label">Risk Score</span>
                <span className="landing-risk-value">32%</span>
              </div>
              <div className="landing-risk-bar-track">
                <div className="landing-risk-bar-fill" style={{ width: "32%" }} />
              </div>
              <div className="landing-risk-footer">
                <span>STATUS: SECURE</span>
                <span>COOLDOWN: ACTIVE</span>
              </div>
            </div>

            {/* Card: Phone Detected */}
            <div className="landing-float-card animate-float-slow" style={{ top: "52%", right: "4%" }}>
              <div className="landing-float-card-icon landing-float-card-icon--red">
                <Smartphone className="w-3.5 h-3.5" />
              </div>
              <div className="landing-float-card-content">
                <div className="landing-float-card-status">
                  <span className="landing-dot landing-dot--red" />
                  <span className="landing-float-card-label">Phone Detected</span>
                </div>
                <span className="landing-float-card-meta">Alert: Critical</span>
              </div>
            </div>

            {/* Card: Audio Active */}
            <div className="landing-float-card animate-float-fast" style={{ bottom: "14%", left: "10%" }}>
              <div className="landing-float-card-icon landing-float-card-icon--indigo">
                <Mic className="w-3.5 h-3.5" />
              </div>
              <div className="landing-float-card-content">
                <div className="landing-float-card-status">
                  <span className="landing-dot landing-dot--indigo" />
                  <span className="landing-float-card-label">Audio Active</span>
                </div>
                <span className="landing-float-card-meta">42 dB Normal</span>
              </div>
            </div>

            {/* Card: AI Running */}
            <div className="landing-float-card animate-float-medium" style={{ bottom: "8%", right: "8%" }}>
              <div className="landing-float-card-icon landing-float-card-icon--indigo">
                <Activity className="w-3.5 h-3.5" style={{ animation: "spin 5s linear infinite" }} />
              </div>
              <div className="landing-float-card-content">
                <div className="landing-float-card-status">
                  <span className="landing-dot landing-dot--indigo" />
                  <span className="landing-float-card-label">AI Running</span>
                </div>
                <span className="landing-float-card-meta">Monitoring</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES SECTION ─── */}
      <section id="features" className="landing-section landing-section--alt">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-tag">Platform Capabilities</span>
            <h2 className="landing-section-title">AI Security Checkpoints</h2>
            <p className="landing-section-desc">
              Multi-layered on-device security monitoring candidates locally to safeguard assessment integrity.
            </p>
          </div>

          <div className="landing-features-grid">
            {features.map((f, idx) => (
              <div key={idx} className="landing-card">
                <div className="landing-card-icon-box">
                  {f.icon}
                </div>
                <h3 className="landing-card-title">{f.title}</h3>
                <p className="landing-card-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-tag">System Workflow</span>
            <h2 className="landing-section-title">How It Works</h2>
            <p className="landing-section-desc">
              From authentication to AI monitoring and supervisor audit trails.
            </p>
          </div>

          <div className="landing-steps-grid">
            {steps.map((s, idx) => (
              <div key={idx} className="landing-card landing-step-card">
                <div className="landing-step-header">
                  <span className="landing-step-number">{s.number}</span>
                  <div className="landing-card-icon-box">
                    {s.icon}
                  </div>
                </div>
                <h3 className="landing-card-title">{s.title}</h3>
                <p className="landing-card-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer id="contact" className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-col">
            <div className="landing-logo-group">
              <div className="landing-logo-box">
                <GraduationCap className="landing-logo-icon" />
              </div>
              <span className="landing-logo-text">ProctorAI</span>
            </div>
            <p className="landing-footer-desc">
              AI-Powered Real-Time Online Exam Proctoring Platform. Protecting academic integrity through advanced behavioral intelligence.
            </p>
          </div>

          <div className="landing-footer-col">
            <span className="landing-footer-heading">Navigation</span>
            <div className="landing-footer-links">
              <a href="#features">Platform Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#contact">Contact</a>
            </div>
          </div>

          <div className="landing-footer-col">
            <span className="landing-footer-heading">Developer</span>
            <div className="landing-footer-links">
              <div className="landing-footer-contact">
                <User className="w-4 h-4 text-indigo-400" />
                <span>Kesavan S</span>
              </div>
              <div className="landing-footer-contact">
                <Mail className="w-4 h-4 text-indigo-400" />
                <a href="mailto:skesavan124@gmail.com">skesavan124@gmail.com</a>
              </div>
            </div>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <span>© 2026 ProctorAI — AI Exam Proctoring Platform. All Rights Reserved.</span>
          <span className="landing-footer-credit">
            Designed & Developed by Kesavan S
          </span>
        </div>
      </footer>
    </div>
  );
}
