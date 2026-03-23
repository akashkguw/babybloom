import React, { useEffect, useState } from 'react';

interface ToastState {
  message: string;
  visible: boolean;
}

let toastCallback: ((msg: string) => void) | null = null;

export const toast = (msg: string) => {
  if (toastCallback) {
    toastCallback(msg);
  }
};

type ToastProps = Record<string, never>

export const Toast: React.FC<ToastProps> = () => {
  const [state, setState] = useState<ToastState>({ message: '', visible: false });

  useEffect(() => {
    toastCallback = (msg: string) => {
      setState({ message: msg, visible: true });
      const duration = msg.includes('\n') ? 3000 : 2000;
      setTimeout(() => {
        setState((prev) => ({ ...prev, visible: false }));
      }, duration);
    };

    return () => {
      toastCallback = null;
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#333',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        zIndex: 9999,
        opacity: state.visible ? 1 : 0,
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
      }}
    >
      {state.message.split('\n').map((line, i) => (
        <div key={i} style={i > 0 ? { fontSize: 11, fontWeight: 400, marginTop: 2, opacity: 0.9 } : undefined}>{line}</div>
      ))}
    </div>
  );
};

export default Toast;
