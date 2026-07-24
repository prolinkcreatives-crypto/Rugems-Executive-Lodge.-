import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Nav } from "@/components/nav";
import { StaggerWords, GoldHairline, cinematic } from "@/components/motion";

const searchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Admin access · Rugems Executive Lodge" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
      }
      toast.success("Welcome back to Rugems.");
      navigate({ to: next ?? "/admin" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Nav variant="solid" />
      <div className="pt-40 pb-24 min-h-screen flex items-center bg-surface">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: cinematic }}
          className="mx-auto max-w-md w-full px-6"
        >
          <p className="text-label-caps text-gold text-center">Rugems Admin</p>
          <StaggerWords
            text={mode === "in" ? "Welcome back." : "Create your account."}
            as="h1"
            delay={0.2}
            className="text-headline-lg font-display text-primary text-center mt-4"
          />
          <div className="my-6 flex justify-center"><GoldHairline /></div>

          <form onSubmit={submit} className="space-y-6 mt-8">
            <div>
              <label className="text-label-caps text-on-surface-variant">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-outline-variant focus:border-primary transition-colors py-3 text-body-md outline-none"
              />
            </div>
            <div>
              <label className="text-label-caps text-on-surface-variant">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-outline-variant focus:border-primary transition-colors py-3 text-body-md outline-none"
              />
            </div>
            <button
              disabled={busy}
              className="w-full rounded-full bg-primary text-on-primary py-4 text-label-caps hover:-translate-y-0.5 hover:shadow-ambient-lg transition-all duration-500 disabled:opacity-40"
            >
              {busy ? "One moment..." : mode === "in" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-label-caps text-on-surface-variant mt-8 text-center">
            {mode === "in" ? "New to Rugems?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "in" ? "up" : "in")}
              className="text-primary underline underline-offset-4"
            >
              {mode === "in" ? "Create account" : "Sign in"}
            </button>
          </p>
          <p className="text-label-caps text-on-surface-variant text-center mt-6">
            <Link to="/" className="hover:text-primary transition-colors">← Return home</Link>
          </p>
        </motion.div>
      </div>
    </>
  );
}
