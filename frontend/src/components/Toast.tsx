import { useToastState } from '../context/ToastContext';

export function Toast() {
  const { message, type, visible } = useToastState();
  const className = ['show', type].filter(Boolean).join(' ');

  return (
    <div id="toast" className={visible ? className : ''}>
      {message}
    </div>
  );
}
