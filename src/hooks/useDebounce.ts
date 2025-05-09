import { useState, useEffect, useCallback } from 'react';

export function useDebounce<T extends (...args: any[]) => Promise<any>>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Clear the timeout when component unmounts
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  // The debounced function
  const debouncedFunction = useCallback((...args: Parameters<T>) => {
    // If a previous timeout exists, clear it
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }

    // Don't set a new timeout if already processing
    if (isProcessing) {
      return;
    }

    // Set a new timeout
    const id = setTimeout(async () => {
      setIsProcessing(true);
      try {
        await func(...args);
      } finally {
        setIsProcessing(false);
        setTimeoutId(null);
      }
    }, delay);

    setTimeoutId(id);
  }, [func, delay, timeoutId, isProcessing]);

  return debouncedFunction;
}