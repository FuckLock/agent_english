type ProgressBarProps = {
  label?: string;
  value: number;
};

export function ProgressBar({ label, value }: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="progress">
      {label ? (
        <div className="progress__meta">
          <span>{label}</span>
          <span>{clampedValue}%</span>
        </div>
      ) : null}
      <div
        aria-label={label ?? "progress"}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={clampedValue}
        className="progress__track"
        role="progressbar"
      >
        <span className="progress__fill" style={{ width: `${clampedValue}%` }} />
      </div>
    </div>
  );
}
