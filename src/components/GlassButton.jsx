import React from "react";

export default function GlassButton({ variant = "primary", className = "", ...props }) {
  const variantClass =
    variant === "secondary" ? "secondary" : variant === "ghost" ? "ghost" : "";
  return (
    <button
      {...props}
      className={`glass-button ${variantClass} ${className}`}
    />
  );
}
