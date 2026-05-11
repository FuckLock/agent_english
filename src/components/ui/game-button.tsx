import type { ButtonHTMLAttributes, ReactNode } from "react";

type GameButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "dark" | "ghost";
};

export function GameButton({
  children,
  className = "",
  icon,
  size = "md",
  variant = "primary",
  ...props
}: GameButtonProps) {
  return (
    <button
      className={[
        "game-button",
        `game-button--${variant}`,
        `game-button--${size}`,
        className
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      {...props}
    >
      {icon ? <span className="game-button__icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
