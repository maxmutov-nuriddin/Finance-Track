import React from "react";

export default function GlassInput({ className = "", ...props }) {
  return <input {...props} className={`glass-input ${className}`} />;
}
