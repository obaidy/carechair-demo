import { useCallback, useEffect, useRef, useState } from "react";

export function useToast() {
  const timerRef = useRef(null);
  const [toast, setToast] = useState({ show: false, type: "success", text: "" });

  const showToast = useCallback((type, text) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ show: true, type, text });
    timerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, showToast };
}
