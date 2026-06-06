import React, { useState, useCallback, useEffect } from "react";
import { AlertTriangle, CheckCircle, XCircle, Info, ShieldAlert, X } from "lucide-react";

/**
 * Premium Modal Dialog — replaces native browser confirm() and alert() popups.
 * 
 * Usage:
 *   const { confirm, ConfirmModal } = useConfirm();
 *   const { alert, AlertModal } = useAlert();
 * 
 *   // Then in JSX: <ConfirmModal /> and <AlertModal />
 *   // To trigger:  const ok = await confirm("Title", "Message", "confirm");
 *   //              await alert("Title", "Message", "error");
 */

// ─── Icon map ───
const iconMap = {
  confirm: <ShieldAlert className="modal-icon-svg modal-icon--indigo" />,
  warning: <AlertTriangle className="modal-icon-svg modal-icon--amber" />,
  error: <XCircle className="modal-icon-svg modal-icon--red" />,
  success: <CheckCircle className="modal-icon-svg modal-icon--green" />,
  info: <Info className="modal-icon-svg modal-icon--indigo" />,
};

const iconBgMap = {
  confirm: "modal-icon-bg--indigo",
  warning: "modal-icon-bg--amber",
  error: "modal-icon-bg--red",
  success: "modal-icon-bg--green",
  info: "modal-icon-bg--indigo",
};

// ─── Base Modal Component ───
function ModalBase({ open, title, message, type, onConfirm, onCancel, confirmText, cancelText, showCancel }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="modal-close-btn" onClick={onCancel}>
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className={`modal-icon-wrapper ${iconBgMap[type] || iconBgMap.info}`}>
          {iconMap[type] || iconMap.info}
        </div>

        {/* Content */}
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>

        {/* Actions */}
        <div className="modal-actions">
          {showCancel && (
            <button className="btn btn-secondary modal-btn" onClick={onCancel}>
              {cancelText || "Cancel"}
            </button>
          )}
          <button
            className={`btn modal-btn ${type === "error" ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── useConfirm Hook ───
export function useConfirm() {
  const [state, setState] = useState({
    open: false,
    title: "",
    message: "",
    type: "confirm",
    confirmText: "Confirm",
    cancelText: "Cancel",
    resolve: null,
  });

  const confirm = useCallback((title, message, type = "confirm", confirmText = "Confirm", cancelText = "Cancel") => {
    return new Promise((resolve) => {
      setState({ open: true, title, message, type, confirmText, cancelText, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, open: false }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, open: false }));
  }, [state.resolve]);

  const ConfirmModal = (
    <ModalBase
      open={state.open}
      title={state.title}
      message={state.message}
      type={state.type}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      showCancel={true}
    />
  );

  return { confirm, ConfirmModal };
}

// ─── useAlert Hook ───
export function useAlert() {
  const [state, setState] = useState({
    open: false,
    title: "",
    message: "",
    type: "error",
    confirmText: "OK",
    resolve: null,
  });

  const alert = useCallback((title, message, type = "error", confirmText = "OK") => {
    return new Promise((resolve) => {
      setState({ open: true, title, message, type, confirmText, resolve });
    });
  }, []);

  const handleClose = useCallback(() => {
    state.resolve?.();
    setState((prev) => ({ ...prev, open: false }));
  }, [state.resolve]);

  const AlertModal = (
    <ModalBase
      open={state.open}
      title={state.title}
      message={state.message}
      type={state.type}
      confirmText={state.confirmText}
      onConfirm={handleClose}
      onCancel={handleClose}
      showCancel={false}
    />
  );

  return { alert, AlertModal };
}
