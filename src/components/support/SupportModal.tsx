import { useEffect, useRef } from "react";
import { SUPPORT_EMAIL } from "../../lib/support";

export function SupportModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <section
      ref={dialogRef}
      className="supportModal"
      aria-labelledby="support-title"
      aria-modal="true"
      role="dialog"
      tabIndex={-1}
    >
      <h2 id="support-title">Need a hand?</h2>
      <p className="supportLead">
        For questions, feedback, or teacher access, write to this email. We
        usually reply within a day.
      </p>
      <p className="supportEmail">{SUPPORT_EMAIL}</p>
      <button className="primary" onClick={onClose} type="button">
        Close
      </button>
    </section>
  );
}
