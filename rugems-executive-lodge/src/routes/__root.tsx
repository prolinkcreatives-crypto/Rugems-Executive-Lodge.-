import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { FloatingBookCTA } from "@/components/floating-book-cta";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="text-label-caps text-gold mb-6">404 — Path unfound</p>
        <h1 className="text-display-hero text-primary mb-4">Beyond the map.</h1>
        <p className="text-body-md text-on-surface-variant mb-8">
          The page you sought has drifted somewhere else. Return home and begin your journey anew.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-primary text-primary-foreground text-label-caps btn-glow hover:[--tw-shadow:var(--shadow-ambient-lg)] hover:-translate-y-0.5 transition-all"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="text-label-caps text-gold mb-6">A small interruption</p>
        <h1 className="text-headline-lg text-primary mb-4">This page didn't settle.</h1>
        <p className="text-body-md text-on-surface-variant mb-8">
          Something interrupted the moment. Refresh gently or return home.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="px-6 py-3 rounded-full bg-primary text-primary-foreground text-label-caps"
          >
            Try again
          </button>
          <a href="/" className="px-6 py-3 rounded-full border border-primary text-primary text-label-caps">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Rugems Executive Lodge · Boutique Stay in Lusaka" },
      {
        name: "description",
        content:
          "Rugems Executive Lodge — a boutique retreat on Imboswa Road, New Avondale, Lusaka. Refined suites, warm hospitality, and quiet luxury minutes from the city.",
      },
      { name: "author", content: "Rugems Executive Lodge" },
      { property: "og:title", content: "Rugems Executive Lodge · Lusaka" },
      { property: "og:description", content: "Boutique stay on Imboswa Road, New Avondale, Lusaka." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Rugems Executive Lodge" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#fbf9f8" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <FloatingBookCTA />
      <Toaster

        position="bottom-center"
        toastOptions={{
          style: {
            background: "var(--surface-container-lowest)",
            border: "1px solid var(--outline-variant)",
            color: "var(--on-surface)",
            fontFamily: "var(--font-body)",
            borderRadius: "12px",
            boxShadow: "var(--shadow-ambient)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
