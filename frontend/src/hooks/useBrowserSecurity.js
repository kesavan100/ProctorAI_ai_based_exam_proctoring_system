import { useEffect } from "react";

export function useBrowserSecurity({ onViolation, isActive }) {
  useEffect(() => {
    if (!isActive) return;

    // 1. Disable Right Click (contextmenu)
    const handleContextMenu = (e) => {
      e.preventDefault();
      onViolation("right_click", "Attempted to open context menu");
    };

    // 2. Detect Tab Switch / Focus Loss
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onViolation("tab_switch", "Left exam tab (switched window/tab)");
      }
    };
    
    const handleBlur = () => {
      onViolation("window_focus_lost", "Exam window lost focus");
    };

    // 3. Detect Fullscreen Exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onViolation("fullscreen_exit", "Exited full-screen exam mode");
      }
    };

    // 4. Detect Copy / Cut / Paste
    const handleCopy = (e) => {
      e.preventDefault();
      onViolation("copy_paste", "Attempted to copy text");
    };
    const handleCut = (e) => {
      e.preventDefault();
      onViolation("copy_paste", "Attempted to cut text");
    };
    const handlePaste = (e) => {
      e.preventDefault();
      const pastedText = e.clipboardData ? e.clipboardData.getData("text") : "";
      if (pastedText.length > 50) {
        onViolation(
          "clipboard_injection",
          `Pasted large text block: "${pastedText.substring(0, 30)}..." (${pastedText.length} chars)`
        );
      } else {
        onViolation("copy_paste", "Attempted to paste text");
      }
    };

    // 5. Intercept Restricted Keyboard Shortcuts
    const handleKeyDown = (e) => {
      // Keys to block:
      // Ctrl+T (New Tab), Ctrl+W (Close Tab) - note: browser prevents fully blocking Ctrl+W but we can catch keypresses
      // F12 (DevTools), Ctrl+Shift+I (Inspect), Ctrl+U (View Source)
      // Ctrl+C, Ctrl+V, Ctrl+X (Clipboard)
      
      const isCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      
      if (e.key === "F12") {
        e.preventDefault();
        onViolation("shortcut_pressed", "Pressed F12 (DevTools)");
      } else if (isCtrl && key === "u") {
        e.preventDefault();
        onViolation("shortcut_pressed", "Pressed Ctrl+U (View Source)");
      } else if (isCtrl && e.shiftKey && key === "i") {
        e.preventDefault();
        onViolation("shortcut_pressed", "Pressed Ctrl+Shift+I (Inspect DevTools)");
      } else if (isCtrl && (key === "c" || key === "v" || key === "x")) {
        e.preventDefault();
        onViolation("copy_paste", `Attempted clipboard shortcut (Ctrl+${key.toUpperCase()})`);
      } else if (isCtrl && (key === "t" || key === "n")) {
        // Can sometimes be caught before default browser action
        onViolation("shortcut_pressed", `Attempted browser controls (Ctrl+${key.toUpperCase()})`);
      }
    };

    // Register all event listeners
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste);
    window.addEventListener("keydown", handleKeyDown);

    // Clean up
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, onViolation]);
}
