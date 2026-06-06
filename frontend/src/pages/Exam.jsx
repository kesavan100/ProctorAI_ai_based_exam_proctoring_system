import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import { Play, PlayCircle, ShieldAlert, Wifi, WifiOff, Maximize, Lock, CheckCircle, Terminal, Mic, AlertCircle, Volume2, AlertTriangle, Sun, Moon } from "lucide-react";
import { CircularGauge } from "../components/RiskGauge";
import { useBrowserSecurity } from "../hooks/useBrowserSecurity";
import { useConfirm, useAlert } from "../components/Modal";

export function Exam({ user, backendUrl, onLogout }) {
  const [sessionId, setSessionId] = useState(localStorage.getItem("proctor_session_id") || "");
  const [examStarted, setExamStarted] = useState(!!localStorage.getItem("proctor_session_id"));
  const [loading, setLoading] = useState(false);
  const [riskScore, setRiskScore] = useState(0);
  const [behaviorScore, setBehaviorScore] = useState(100);
  const [examStatus, setExamStatus] = useState("active"); 
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(1800); 
  
  // Real-time audio proctoring states
  const [dbLevel, setDbLevel] = useState(0);

  // Theme support
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };
  
  // Code runner / Terminal states
  const [code, setCode] = useState("");
  const [activeTab, setActiveTab] = useState("logs"); // "logs" or "testcases"
  const [runnerLogs, setRunnerLogs] = useState("Console idle. Write code and click 'Run Code' to execute assertions.");
  const [testCases, setTestCases] = useState([]);
  const [runningCode, setRunningCode] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);

  // Timeline events for the student's notification feed
  const [clientEvents, setClientEvents] = useState([]);
  const [toasts, setToasts] = useState([]);

  const showToast = (title, message, type = "warning") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const socketRef = useRef(null);
  
  const frameIntervalRef = useRef(null);
  const audioIntervalRef = useRef(null);
  
  const audioContextRef = useRef(null);
  const audioAnalyserRef = useRef(null);

  // Custom modal hooks (replaces native confirm/alert)
  const { confirm, ConfirmModal } = useConfirm();
  const { alert: showAlert, AlertModal } = useAlert();
  const audioStreamRef = useRef(null);

  const handleStartExam = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/start_exam`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.access_token}`
        },
        body: JSON.stringify({ student_id: user.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to start exam session");
      
      setSessionId(data.session_id);
      localStorage.setItem("proctor_session_id", data.session_id);
      setExamStarted(true);
      
      // Enter Fullscreen
      requestFullscreen();
    } catch (err) {
      showAlert("Session Error", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const requestFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // 1. Setup Webcam & Audio Streams
  useEffect(() => {
    if (!examStarted) return;
    
    let stream = null;
    // Request both camera and audio permissions
    navigator.mediaDevices
      .getUserMedia({ 
        video: { width: 640, height: 480, frameRate: 30 },
        audio: true
      })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        
        // Setup Web Audio Analyser
        setupAudioMonitoring(s);
      })
      .catch((err) => {
        console.error("Device acquisition failed:", err);
        addClientEvent("Hardware Error", "Both Camera and Microphone access are required. Grant permissions to proceed.", "critical");
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      clearInterval(audioIntervalRef.current);
    };
  }, [examStarted]);

  // Audio Monitoring Logic
  const setupAudioMonitoring = (stream) => {
    try {
      audioStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      audioAnalyserRef.current = analyser;
      analyser.fftSize = 256;
      
      // Connect microphone input
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let consecutiveNoiseFrames = 0;
      
      audioIntervalRef.current = setInterval(() => {
        if (examStatus === "locked" || examStatus === "completed") return;
        
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate Root Mean Square (RMS) volume level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        
        // Scale RMS to a decibel-like indicator (0 to 100)
        const dbValue = Math.min(100, Math.round((rms / 128) * 100));
        setDbLevel(dbValue);
        
        // Calibrate threshold: voice threshold is 68dB
        if (dbValue > 68) {
          consecutiveNoiseFrames += 1;
          // Noise persists for more than 1.5 seconds (8 samples of 200ms)
          if (consecutiveNoiseFrames >= 8) {
            consecutiveNoiseFrames = 0; // reset
            handleBrowserViolation("voice_detected", "Suspicious room noise/voice detected by microphone.");
          }
        } else {
          // Slowly decay consecutive counter
          consecutiveNoiseFrames = Math.max(0, consecutiveNoiseFrames - 1);
        }
      }, 200);
      
    } catch (e) {
      console.error("Audio recording setup failed", e);
    }
  };

  // 2. Setup Socket.IO Client
  useEffect(() => {
    if (!examStarted || !sessionId) return;

    const socket = io(backendUrl, {
      auth: { role: "student", session_id: sessionId }
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      addClientEvent("Secure Sync Established", "Proctor system active. Feeds are synchronized.");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      addClientEvent("Disconnection Alert", "Lost connection. Reconnecting...");
    });

    socket.on("risk_score_update", (data) => {
      if (data.session_id === sessionId) {
        setRiskScore(data.risk_score);
        setBehaviorScore(data.behavior_score);
        setExamStatus(data.status);
      }
    });

    socket.on("phone_detected", (data) => {
      if (data.session_id === sessionId) {
        addClientEvent("ALERT: Phone Present", "Please store all mobile devices away from workspace.", "critical");
        showToast("Phone Detected", "Please store all mobile devices away from workspace.", "critical");
      }
    });

    socket.on("laptop_detected", (data) => {
      if (data.session_id === sessionId) {
        addClientEvent("ALERT: Laptop Present", "Secondary computer screens are unauthorized during the exam.", "critical");
        showToast("Laptop Detected", "Secondary computer screens are unauthorized during the exam.", "critical");
      }
    });

    socket.on("multiple_person_detected", (data) => {
      if (data.session_id === sessionId) {
        addClientEvent("ALERT: Multiple People", "Grid flagged multiple faces in webcam frame.", "critical");
        showToast("Multiple People Detected", "Grid flagged multiple faces in webcam frame.", "critical");
      }
    });

    socket.on("face_missing", (data) => {
      if (data.session_id === sessionId) {
        addClientEvent("ALERT: Face Absent", "Keep your face visible and centered inside the camera view.", "warning");
        showToast("Face Absent", "Keep your face visible and centered inside the camera view.", "warning");
      }
    });

    socket.on("system_lock", (data) => {
      if (data.session_id === sessionId) {
        setExamStatus("locked");
        addClientEvent("EXAM SHUTDOWN", "Your session is locked due to safety threshold overrides.", "critical");
      }
    });

    socket.on("system_unlock", (data) => {
      if (data.session_id === sessionId) {
        setExamStatus("active");
        setRiskScore(0);
        setBehaviorScore(100);
        addClientEvent("Workspace Restored", "Override authorization granted. You may resume code typing.", "info");
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [examStarted, sessionId, backendUrl]);

  // 3. Telemetry capture: Send frames and draw boxes returned by YOLOv8s
  useEffect(() => {
    if (!examStarted || examStatus === "locked" || examStatus === "completed") {
      clearInterval(frameIntervalRef.current);
      return;
    }

    const drawDetections = (detections) => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (!detections || detections.length === 0) return;
      
      detections.forEach((det) => {
        const [x1, y1, x2, y2] = det.bbox;
        
        // Map bbox from 640x480 (input) to overlay canvas size (which mirrors it)
        const scaleX = canvas.width / 640;
        const scaleY = canvas.height / 480;
        
        const rectX = x1 * scaleX;
        const rectY = y1 * scaleY;
        const rectW = (x2 - x1) * scaleX;
        const rectH = (y2 - y1) * scaleY;
        
        // Color based on class
        const color = det.class_name === "cell phone" ? "#ef4444" : "#8b5cf6";
        
        // Draw box
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.strokeRect(rectX, rectY, rectW, rectH);
        ctx.shadowBlur = 0; // reset
        
        // Draw Label tag
        ctx.fillStyle = color;
        ctx.font = "bold 10px Plus Jakarta Sans";
        const label = `${det.class_name.toUpperCase()} (${Math.round(det.confidence * 100)}%)`;
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(rectX, rectY - 18, textWidth + 10, 18);
        
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, rectX + 5, rectY - 5);
      });
    };

    const sendFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      // Ensure video is playing and has valid frame data to avoid sending black frames
      if (video.paused || video.ended || video.readyState < 2 || video.videoWidth === 0) {
        if (video.paused && video.srcObject) {
          video.play().catch((err) => console.log("Webcam play error:", err));
        }
        return;
      }

      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL("image/jpeg", 0.6); // Faster transfer with lower quality

      fetch(`${backendUrl}/detect_frame`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.access_token}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          image_base64: base64Image
        })
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            setRiskScore(data.risk_score);
            setBehaviorScore(data.behavior_score);
            setExamStatus(data.status);
            
            // Draw boxes directly on webcam overlay!
            drawDetections(data.detections);
          }
        })
        .catch((err) => {
          console.error("Report telemetry error:", err);
        });
    };

    sendFrame();
    frameIntervalRef.current = setInterval(sendFrame, 500);

    return () => clearInterval(frameIntervalRef.current);
  }, [examStarted, examStatus, sessionId, backendUrl, user]);

  // 4. Timer
  useEffect(() => {
    if (!examStarted || examStatus === "locked" || examStatus === "completed") return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleEndExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, examStatus]);

  const addClientEvent = (title, msg, severity = "info") => {
    setClientEvents((prev) => [
      {
        title,
        msg,
        severity,
        time: new Date().toLocaleTimeString()
      },
      ...prev.slice(0, 15)
    ]);
  };

  // 5. Browser Telemetry Callback
  const handleBrowserViolation = async (eventType, details) => {
    let title = eventType.replace("_", " ").toUpperCase();
    let sev = "warning";
    if (eventType === "clipboard_injection") {
      title = "CLIPBOARD INJECTION ANOMALY";
      sev = "critical";
    }
    
    addClientEvent(`Telemetry Alert: ${title}`, details, sev);
    showToast(title, details, sev);

    if (!sessionId) return;
    try {
      await fetch(`${backendUrl}/log_event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.access_token}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          event_type: eventType,
          details
        })
      });
    } catch (err) {
      console.error("Failed to log event:", err);
    }
  };

  useBrowserSecurity({
    onViolation: handleBrowserViolation,
    isActive: examStarted && examStatus === "active"
  });

  const handleEndExam = async () => {
    const ok = await confirm(
      "Submit Exam",
      "Are you sure you want to submit your exam? This action cannot be undone and your session will end permanently.",
      "warning",
      "Submit Exam",
      "Continue Exam"
    );
    if (ok) {
      try {
        await fetch(`${backendUrl}/end_exam`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${user.access_token}`
          },
          body: JSON.stringify({ student_id: user.id })
        });
      } catch (err) {
        console.error(err);
      }
      
      localStorage.removeItem("proctor_session_id");
      setExamStarted(false);
      onLogout();
    }
  };

  // 6. Monaco Mock Code Runner
  const handleRunCode = async () => {
    setRunningCode(true);
    setConsoleOpen(true);
    setActiveTab("logs");
    setRunnerLogs("Compiling scripts...\nLinking libraries...\nInitializing assertions...");
    
    try {
      const res = await fetch(`${backendUrl}/execute_code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.access_token}`
        },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      
      setRunnerLogs(data.console_logs);
      setTestCases(data.test_cases);
      
      if (!data.success) {
        setActiveTab("logs");
      } else {
        setActiveTab("testcases");
      }
    } catch (err) {
      setRunnerLogs("Code execution engine returned a network crash error.");
    } finally {
      setRunningCode(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const defaultEditorCode = `// Solve Max Subarray Sum
function solve(nums) {
  let maxSum = nums[0];
  let currentSum = nums[0];
  
  for(let i = 1; i < nums.length; i++) {
    currentSum = Math.max(nums[i], currentSum + nums[i]);
    maxSum = Math.max(maxSum, currentSum);
  }
  
  return maxSum;
}
`;

  return (
    <div className="min-h-screen bg-primary text-primary relative">
      {/* 1. Pre-Exam Verification Landing */}
      {!examStarted ? (
        <div className="flex items-center justify-center min-h-screen p-6 relative">
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

          <div className="w-full max-w-xl p-8 border glass-panel border-primary bg-secondary flex flex-col items-center">
            <ShieldAlert className="w-16 h-16 text-indigo-500 mb-4 animate-pulse" />
            <h2 className="text-2xl font-black text-center text-primary tracking-tight uppercase">EXAMINATION BOARD</h2>
            <p className="mt-2 text-sm text-center text-secondary max-w-md">
              Welcome, <span className="text-primary font-bold">{user.name}</span>. This examination workspace utilizes real-time AI computer vision, browser tracking, and microphone sound capture.
            </p>

            <div className="w-full p-4 mt-6 rounded-lg bg-tertiary border border-primary text-xs text-secondary flex flex-col gap-2.5">
              <span className="font-bold text-primary">PROCTORING GUIDELINES:</span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Webcam and microphone must remain enabled.</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Do not leave fullscreen or switch tabs.</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Mobile phones/assistants must be completely absent.</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Pasting copied external code triggers a clipboard injection anomaly.</span>
              </div>
            </div>

            <button
              onClick={handleStartExam}
              disabled={loading}
              className="w-full mt-8 btn btn-primary flex items-center justify-center gap-2"
            >
              <PlayCircle className="w-5 h-5" />
              {loading ? "Constructing Secure VM..." : "Begin Proctored Examination"}
            </button>
          </div>
        </div>
      ) : (
        /* 2. Main Exam Grid Layout (3 Columns) */
        <div className="layout-container relative">
          
          {/* Column 1: Questions */}
          <div className="flex flex-col border-r border-primary bg-tertiary h-full overflow-y-auto p-5 select-none">
            {/* Header badges */}
            <div className="flex items-center justify-between pb-3 border-b border-primary mb-4 shrink-0">
              <span className="text-[10px] font-bold text-indigo-400 tracking-widest uppercase">Problem Description</span>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-extrabold tracking-wide">
                  MEDIUM
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-extrabold tracking-wide">
                  150 PTS
                </span>
              </div>
            </div>
            
            {/* Content body */}
            <div className="flex flex-col gap-5 text-sm leading-relaxed text-secondary">
              <div>
                <h1 className="text-xl font-black text-primary tracking-tight">Max Subarray Sum</h1>
                <p className="mt-2.5 text-xs text-secondary leading-relaxed">
                  Given an integer array <code className="text-indigo-400 font-mono bg-primary/40 px-1 py-0.5 rounded border border-primary text-[10px]">nums</code>, find the contiguous subarray (containing at least one number) which has the largest sum and return <em className="text-primary font-semibold">its sum</em>.
                </p>
              </div>

              {/* Example Block */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-extrabold text-primary tracking-wider uppercase">Example 1</span>
                <div className="p-4 bg-secondary border border-primary rounded-xl flex flex-col gap-2.5 font-mono text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Input</span>
                    <span className="text-primary">nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Output</span>
                    <span className="text-emerald-400 font-bold">6</span>
                  </div>
                  <div className="flex flex-col gap-0.5 border-t border-primary/50 pt-2.5 mt-0.5">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Explanation</span>
                    <span className="text-secondary leading-normal text-[11px] font-sans">
                      The contiguous subarray <code className="text-indigo-400 font-mono bg-primary/40 px-1 py-0.5 rounded border border-primary text-[10px]">[4, -1, 2, 1]</code> has the largest sum of <strong className="text-primary font-bold">6</strong>.
                    </span>
                  </div>
                </div>
              </div>

              {/* Constraints Block */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-extrabold text-primary tracking-wider uppercase">Constraints</span>
                <div className="flex flex-col gap-2.5 text-xs text-secondary">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                    <code className="text-indigo-400 font-mono bg-primary/40 px-1.5 py-0.5 rounded border border-primary text-[10px]">1 &le; nums.length &le; 10<sup>5</sup></code>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                    <code className="text-indigo-400 font-mono bg-primary/40 px-1.5 py-0.5 rounded border border-primary text-[10px]">-10<sup>4</sup> &le; nums[i] &le; 10<sup>4</sup></code>
                  </div>
                </div>
              </div>

              {/* Tips Block */}
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex gap-2.5 items-start mt-1">
                <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Proctor Warning</span>
                  <span className="text-[10px] text-secondary leading-normal">
                    This window's focus and telemetry state are continuously audited by the Examination Board.
                  </span>
                </div>
              </div>

              {/* Developer Credits */}
              <div className="border-t border-primary/40 pt-4 mt-2 text-center text-[10px] text-secondary select-none">
                Designed & Developed by Kesavan S | <a href="mailto:skesavan124@gmail.com" className="text-indigo-400 hover:underline">skesavan124@gmail.com</a>
              </div>
            </div>
          </div>

          {/* Column 2: Code Editor + Runner Drawer */}
          <div className="flex flex-col bg-secondary h-full overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-3 border-b border-primary bg-tertiary">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary">solution.js</span>
                <span className="text-[10px] text-muted font-mono">JavaScript (Node.js)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleRunCode}
                  disabled={runningCode}
                  className="btn btn-secondary py-1.5 px-3.5 text-xs font-bold flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> {runningCode ? "Running..." : "Run Code"}
                </button>
                <button
                  onClick={handleEndExam}
                  className="btn btn-primary py-1.5 px-3.5 text-xs font-bold flex items-center gap-1.5"
                >
                  Submit Exam
                </button>
              </div>
            </div>
            
            <div className="flex-1 w-full flex flex-col overflow-hidden relative">
              <div className="flex-1 w-full relative">
                <Editor
                  height="100%"
                  defaultLanguage="javascript"
                  theme={theme === "dark" ? "vs-dark" : "light"}
                  value={defaultEditorCode}
                  onChange={(val) => setCode(val)}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineHeight: 22,
                    fontFamily: "JetBrains Mono",
                    readOnly: examStatus === "locked",
                    cursorBlinking: "smooth",
                    padding: { top: 12 }
                  }}
                />
              </div>
              
              {/* Compiler Terminal Output Console Drawer */}
              <div
                className="border-t border-primary bg-tertiary flex flex-col z-10 shrink-0"
                style={{
                  height: consoleOpen ? "220px" : "40px",
                  transition: "height 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  width: "100%"
                }}
              >
                {/* Console Toggle Bar */}
                <div
                  onClick={() => setConsoleOpen(!consoleOpen)}
                  className="flex items-center justify-between px-6 py-2 bg-primary border-b border-primary cursor-pointer hover:bg-white/5 select-none"
                  style={{ height: "40px", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
                >
                  <div className="flex items-center gap-2" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Terminal className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold tracking-wider text-primary">COMPILER CONSOLE</span>
                  </div>
                  <span className="text-[10px] text-indigo-500 font-bold">
                    {consoleOpen ? "Collapse Drawer ▾" : "Expand Console ▴"}
                  </span>
                </div>
                
                {/* Console Content Tabs */}
                {consoleOpen && (
                  <div className="flex-1 flex flex-col overflow-hidden" style={{ display: "flex", flexDirection: "column", height: "180px" }}>
                    <div className="flex bg-secondary border-b border-primary px-6" style={{ display: "flex" }}>
                      <button
                        onClick={() => setActiveTab("logs")}
                        className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                          activeTab === "logs" ? "border-indigo-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        Terminal Logs
                      </button>
                      <button
                        onClick={() => setActiveTab("testcases")}
                        className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                          activeTab === "testcases" ? "border-indigo-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        Test Cases ({testCases.length})
                      </button>
                    </div>
                    
                    {/* Tab Views */}
                    <div className="flex-1 p-5 overflow-y-auto font-mono text-[11px] leading-relaxed text-secondary">
                      {activeTab === "logs" ? (
                        <pre className="whitespace-pre-wrap">{runnerLogs}</pre>
                      ) : (
                        <div className="flex flex-col gap-3" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {testCases.length === 0 ? (
                            <span className="text-secondary text-center py-4">No execution tests loaded. Run code to execute check assertions.</span>
                          ) : (
                            testCases.map((tc) => (
                              <div key={tc.id} className="p-3 border rounded border-primary bg-secondary flex flex-col md:flex-row md:items-center justify-between gap-2" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div className="flex flex-col gap-1" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span className="text-xs font-bold text-primary">Test Case {tc.id}</span>
                                  <span>Input: <code className="text-secondary">{tc.input}</code></span>
                                  <span>Expected: <code className="text-emerald-500">{tc.expected}</code> | Output: <code className={tc.passed ? "text-emerald-500" : "text-rose-400"}>{tc.output}</code></span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-center ${
                                  tc.passed ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                }`}>
                                  {tc.passed ? "PASSED" : "FAILED"}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 3: Proctoring Controls */}
          <div className="flex flex-col border-l border-primary bg-tertiary h-full overflow-y-auto p-4 justify-between select-none">
            <div>
              {/* Header Status */}
              <div className="flex items-center justify-between pb-3 border-b border-primary mb-3.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">AI Monitoring</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={toggleTheme}
                    className="p-1 rounded-md border border-primary bg-secondary hover:bg-tertiary text-secondary hover:text-primary transition-all cursor-pointer flex items-center justify-center shadow-sm"
                    style={{ width: "24px", height: "24px" }}
                    title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  >
                    {theme === "dark" ? (
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                    )}
                  </button>
                  <div className="text-[11px] font-mono font-bold text-indigo-400">{formatTime(timeRemaining)}</div>
                </div>
              </div>

              {/* Invisible Webcam Capture Elements running in the background */}
              <div style={{ position: "fixed", bottom: "10px", right: "10px", width: "4px", height: "3px", opacity: 0.01, zIndex: -50, pointerEvents: "none" }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  width="320"
                  height="240"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <canvas
                  ref={overlayCanvasRef}
                  width="320"
                  height="240"
                />
                <canvas ref={canvasRef} width="640" height="480" />
              </div>

              {/* Attractive Proctor Shield visual indicator (Webcam hidden to student) */}
              <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-4 flex flex-col gap-3 shadow-inner">
                <div className="flex items-center justify-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <div className="flex items-center gap-2" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center pulse-ring shrink-0">
                      <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <span className="text-[10px] font-extrabold text-primary tracking-wider uppercase">Proctor Shield</span>
                  </div>
                  {isConnected ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-extrabold uppercase tracking-wider" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Wifi className="w-2.5 h-2.5" /> SYNCED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[8px] font-extrabold uppercase tracking-wider" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <WifiOff className="w-2.5 h-2.5" /> OFFLINE
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-secondary leading-relaxed">
                  Your camera and microphone are silently auditing the exam workspace.
                </p>
              </div>

              {/* Real-time Decibel Microphone Meter */}
              <div className="mt-3 p-2.5 border rounded-lg bg-secondary border-primary">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-primary">
                    <Mic className="w-3 h-3 text-indigo-400" /> Sound Monitoring
                  </div>
                  <span className="text-[9px] font-mono text-secondary">{dbLevel} dB</span>
                </div>
                {/* Visual DB level meter */}
                <div className="w-full h-1.5 rounded-full bg-primary/50 border border-primary overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      dbLevel > 68 ? "sound-meter-bar-danger" : "sound-meter-bar"
                    }`}
                    style={{ width: `${dbLevel}%`, transition: "width 0.1s ease-out" }}
                  />
                </div>
                {dbLevel > 68 && (
                  <span className="text-[8px] text-red-400 font-bold block mt-1 animate-pulse">
                    ⚠ Warning: Loud audio / talking detected.
                  </span>
                )}
              </div>

              {/* Live Risk and Behavior Gauges */}
              <div className="mt-3 grid grid-cols-2 gap-2 border rounded-lg bg-secondary border-primary p-2 shadow-inner">
                <div className="border-r border-primary">
                  <CircularGauge score={riskScore} type="risk" title="Risk Rating" />
                </div>
                <div>
                  <CircularGauge score={behaviorScore} type="integrity" title="Integrity Score" />
                </div>
              </div>
            </div>

            {/* Alert Logs */}
            <div className="flex-1 mt-4 overflow-hidden flex flex-col justify-end">
              <h3 className="text-xs font-bold text-secondary mb-3 tracking-wider uppercase">Exam Activity Logs</h3>
              <div className="flex flex-col gap-2 max-h-[115px] overflow-y-auto border border-primary rounded-lg p-2 bg-secondary">
                {clientEvents.length === 0 ? (
                  <span className="text-[11px] text-secondary text-center py-4">Logs will appear as exam processes...</span>
                ) : (
                  clientEvents.map((evt, idx) => (
                    <div key={idx} className="flex flex-col p-2 bg-tertiary/40 border border-primary/50 rounded-md gap-1 transition-all hover:bg-tertiary">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-extrabold uppercase tracking-wide ${
                          evt.severity === "critical" ? "text-red-400 animate-pulse" :
                          evt.severity === "warning" ? "text-orange-400" :
                          "text-indigo-400"
                        }`}>{evt.title}</span>
                        <span className="text-[9px] text-secondary font-mono">{evt.time}</span>
                      </div>
                      <span className="text-[10px] text-secondary leading-normal">{evt.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3. Fullscreen Block Overlay */}
          {!isFullscreen && examStatus === "active" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
              <div className="w-full max-w-md p-6 text-center border rounded-lg glass-panel-glow border-orange-500/10 mx-4 animate-slide-in">
                <Maximize className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-bounce" />
                <h3 className="text-lg font-black text-primary uppercase tracking-tight">Fullscreen Enforcement</h3>
                <p className="mt-2 text-xs text-secondary">
                  This examination must be completed in fullscreen mode. Your exam timer is active but your workspace is frozen.
                </p>
                <button
                  onClick={requestFullscreen}
                  className="w-full mt-6 btn btn-primary flex items-center justify-center gap-2"
                >
                  Enable Fullscreen Workspace
                </button>
              </div>
            </div>
          )}

          {/* 4. Critical Lock Modal (Auto Lockout Screen) */}
          {examStatus === "locked" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg">
              <div className="w-full max-w-lg p-8 text-center border-2 glass-panel-glow border-red-500/20 pulsing-alert-red mx-4 animate-slide-in">
                <Lock className="w-14 h-14 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-black text-red-500 uppercase tracking-wider">EXAM WORKSPACE LOCKED</h2>
                <p className="mt-3 text-xs text-secondary leading-relaxed max-w-sm mx-auto">
                  The ProctorAI Engine flagged repeated safety violations (risk score peaked above 80%). Your inputs and timer have been suspended.
                </p>

                <div className="p-4 mt-6 rounded bg-red-500/5 border border-red-500/10 text-left">
                  <span className="text-[10px] font-bold text-red-500 block mb-1">LOCK DETAILS:</span>
                  <div className="flex flex-col gap-1 text-[11px] text-secondary font-mono">
                    <span>- Session: {sessionId}</span>
                    <span>- Trigger: Risk Score Exceeded Threshold &gt; 5 seconds</span>
                    <span>- Status: Pending Admin Override/Bypass</span>
                  </div>
                </div>

                <div className="mt-8 flex flex-col items-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-muted">
                    Awaiting authorization from the administrator panel...
                  </span>
                </div>
              </div>
            </div>
          )}
          {/* Toast Container */}
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
        </div>
      )}
      {/* Custom Modal Portals */}
      {ConfirmModal}
      {AlertModal}
    </div>
  );
}
