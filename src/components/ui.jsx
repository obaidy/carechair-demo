import React from "react";

export function Button({
  as: Component = "button",
  variant = "primary",
  className = "",
  children,
  ...props
}) {
  const buttonProps =
    Component === "button" && props.type == null
      ? { ...props, type: "button" }
      : props;

  return (
    <Component className={`ui-btn ui-btn-${variant} ${className}`.trim()} {...buttonProps}>
      {children}
    </Component>
  );
}

export function Card({ className = "", children, ...props }) {
  return (
    <section className={`ui-card ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

export function Container({ className = "", children, ...props }) {
  return (
    <div className={`cc-container ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function Section({ className = "", children, ...props }) {
  return (
    <section className={`cc-section ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

export function Badge({ variant = "neutral", className = "", children }) {
  return <span className={`ui-badge ui-badge-${variant} ${className}`.trim()}>{children}</span>;
}

export function TextInput({ label, className = "", ...props }) {
  return (
    <label className={`field ${className}`.trim()}>
      {label ? <span>{label}</span> : null}
      <input className="input" {...props} />
    </label>
  );
}

export function SelectInput({ label, className = "", children, ...props }) {
  return (
    <label className={`field ${className}`.trim()}>
      {label ? <span>{label}</span> : null}
      <select className="input" {...props}>
        {children}
      </select>
    </label>
  );
}

export function ConfirmModal({ open, title, text, loading, confirmText = "تأكيد", onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="modal-bg" role="dialog" aria-modal="true">
      <div className="modal">
        <h4>{title}</h4>
        <p>{text}</p>
        <div className="actions">
          <Button variant="ghost" type="button" onClick={onCancel} disabled={loading}>
            رجوع
          </Button>
          <Button variant="danger" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? "جاري التنفيذ..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`.trim()} aria-hidden="true" />;
}
