import React from "react";

export default function Toast({ show, type, text }) {
  return <div className={`floating-toast ${show ? "show" : ""} ${type || "success"}`}>{text}</div>;
}
