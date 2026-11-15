/**
 * @file Scrollspy: which page section is currently being read.
 */
import { useEffect, useState } from "react";

/**
 * Scrollspy: reports which section currently crosses the middle band of the viewport.
 * One IntersectionObserver watches every section, so there are no scroll listeners.
 */
export function useActiveSection(ids: readonly string[]) {
  // `ids` must be a stable array (module constant), or the observer would be rebuilt every render.
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
