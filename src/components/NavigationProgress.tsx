"use client";

import { useEffect, useRef, useState } from "react";

export function NavigationProgress() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const targetUrl = new URL(anchor.href, window.location.href);
      if (targetUrl.origin !== window.location.origin) return;
      if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return;
      setVisible(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setVisible(false), 1200);
    }

    function handlePageShow() {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setVisible(false);
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return (
    <div aria-hidden="true" className={`fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}>
      <span className="block h-full w-1/3 animate-[navigation_0.9s_ease-in-out_infinite] bg-blue-500" />
    </div>
  );
}
