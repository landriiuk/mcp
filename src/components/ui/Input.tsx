import { forwardRef } from "react";
import "./Input.css";

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  invalid?: boolean;
  /** `md` — forms/modals; `sm` — compact sidebar rows */
  size?: "md" | "sm";
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, size = "md", type = "text", ...props },
  ref,
) {
  const classes = [
    "uiInput",
    size === "sm" ? "uiInputSm" : "uiInputMd",
    invalid ? "isInvalid" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <input
      ref={ref}
      className={classes}
      type={type}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});
