import { useEffect, useRef, useState } from "react";

/**
 * Reports when an element scrolls into view using IntersectionObserver.
 * With `once`, it disconnects after the first hit, so there is zero ongoing cost.
 */
export function useInView<T extends Element>(options: IntersectionObserverInit & { once?: boolean } = {}) {
  const { once = true, ...observerOptions } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      setInView(entry.isIntersecting);
      if (entry.isIntersecting && once) observer.disconnect();
    }, observerOptions);
    observer.observe(el);
    return () => observer.disconnect();
    // Options are treated as static for the lifetime of the component.
  }, [once]);

  return [ref, inView] as const;
}
