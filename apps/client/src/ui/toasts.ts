import { useState } from 'react';

export interface Toast {
  id: number;
  text: string;
  kind?: 'good' | 'bad' | 'info';
}

/** Auto-expiring toast list. */
export function useToasts(): [Toast[], (t: Omit<Toast, 'id'>) => void] {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((l) => [...l.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 3500);
  };
  return [toasts, push];
}
