interface EmptyStateProps {
  icon: string;
  text: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, text, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty-icon" dangerouslySetInnerHTML={{ __html: icon }} />
      <div className="empty-text">{text}</div>
      {action && (
        <button className="btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
