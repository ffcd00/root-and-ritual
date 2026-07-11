interface ToastProps {
  readonly message: string | null;
}

export function Toast({ message }: ToastProps) {
  return (
    <div className={`toast ${message === null ? '' : 'is-visible'}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
