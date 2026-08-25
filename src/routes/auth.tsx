import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { EloShapeMark } from "@/components/brand/EloShapeLogo";
import { PageContainer } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Search = { mode: "signin" | "signup" };
type SearchInput = { mode?: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: SearchInput): Search => ({
    mode: search.mode ?? "signin",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — EloShape" },
      {
        name: "description",
        content: "Sign in or create an EloShape account to register for tournaments and track your points.",
      },
      { property: "og:title", content: "Sign in to EloShape" },
      { property: "og:description", content: "Join the amateur League of Legends circuit." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const isSignup = mode === "signup";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="flex min-h-[70vh] items-center justify-center py-16">
      <div className="bg-surface-gradient shadow-elevated w-full max-w-md rounded-xl border border-border p-8">
        <EloShapeMark className="h-10 w-10" />
        <h1 className="mt-5 text-2xl font-black tracking-tight text-foreground">
          {isSignup ? "Create your EloShape account" : "Sign in to EloShape"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignup
            ? "Register for tournaments, link your Riot account for eligibility, and start earning circuit points."
            : "Welcome back. Your division, points and brackets are waiting."}
        </p>

        {sent ? (
          <p className="mt-6 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success">
            Check your email to confirm your account, then sign in.
          </p>
        ) : (
          <>
            <form onSubmit={submit} className="space-y-4">
              {isSignup ? (
                <div>
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="YourTag"
                    className="mt-2"
                    required
                  />
                </div>
              ) : null}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
              </Button>
            </form>
          </>
        )}

        <button
          type="button"
          onClick={() => navigate({ to: "/auth", search: { mode: isSignup ? "signin" : "signup" } })}
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {isSignup ? "Already have an account? Sign in" : "New to EloShape? Create an account"}
        </button>
      </div>
    </PageContainer>
  );
}
