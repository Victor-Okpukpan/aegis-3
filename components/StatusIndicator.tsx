interface StatusIndicatorProps {
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  showLabel?: boolean;
}

export default function StatusIndicator({ status, showLabel = true }: StatusIndicatorProps) {
  const classes = {
    pending: 'status-pending',
    analyzing: 'status-analyzing',
    completed: 'status-completed',
    failed: 'status-failed',
  };

  const labels = {
    pending: 'PENDING',
    analyzing: 'ANALYZING',
    completed: 'COMPLETED',
    failed: 'FAILED',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={classes[status]} />
      {showLabel && (
        <span className="text-xs uppercase tracking-wider text-slate-400">
          {labels[status]}
        </span>
      )}
    </div>
  );
}
