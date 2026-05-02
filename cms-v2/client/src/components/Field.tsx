interface Props {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Field({ label, hint, children, className = '' }: Props) {
  return (
    <div className={`mb-3 ${className}`}>
      <label className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
