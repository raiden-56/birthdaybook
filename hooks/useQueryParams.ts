"use client";

import { useEffect, useState } from "react";

/**
 * Reads the query string on the client. Static export has no server to read
 * search params, and this avoids Suspense boundaries for simple deep links
 * like /person/?id=… that must also work inside the Capacitor shell.
 */
export function useQueryParams(): URLSearchParams | null {
  const [params, setParams] = useState<URLSearchParams | null>(null);
  useEffect(() => {
    const read = () => setParams(new URLSearchParams(window.location.search));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  return params;
}

export function setQueryParam(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value == null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(null, "", url.toString());
}
