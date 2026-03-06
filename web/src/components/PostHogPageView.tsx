"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

type PostHogPageViewProps = {
  apiKey?: string;
};

export default function PostHogPageView({ apiKey }: PostHogPageViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!apiKey) return;

    posthog.init(apiKey, {
      api_host: "https://us.i.posthog.com",
      capture_pageview: false,
      autocapture: true,
      persistence: "localStorage+cookie",
      loaded: (client) => {
        if (process.env.NODE_ENV === "development") {
          client.debug();
        }
      },
    });
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) return;

    posthog.capture("$pageview", {
      $current_url: window.location.href,
      pathname,
    });
  }, [apiKey, pathname, searchParams]);

  return null;
}
