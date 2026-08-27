import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { EloShapeMark } from "@/components/brand/EloShapeLogo";
import { PageContainer } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type AuthMode = "signin" | "signup" | "forgot";
type Search = { mode: AuthMode };
type SearchInput = { mode?: unknown };

const LEGAL_VERSION = "2026-08-27";

function strongPassword(password: string) {
  return (
    password.length >= 10 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password) &&
    !/\s/.test(password)
  );
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: SearchInput): Search => ({
    mode: search.mode === "signup" || search.mode === "forgot" ? search.mode : "signin",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — EloShape" },
      {
        name: "description",
        content:
          "Sign in or create an EloShape account to register for tournaments and track your points.",
      },
      { property: "og:title", content: "Sign in to EloShape" },
      { property: "og:description", content: "Join the amateur League of Legends circuit." },
      { name: "robots", content: "noindex" },
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
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) {
          console.error("[EloShape auth] password reset request failed", { name: error.name });
          throw new Error("Could not send the reset email. Please try again shortly.");
        }
        setSent(true);
        return;
      }

      if (isSignup) {
        if (!strongPassword(password)) {
          throw new Error(
            "Use at least 10 characters with uppercase, lowercase, a number, and a symbol.",
          );
        }
        if (!acceptedLegal) {
          throw new Error("You must accept the Terms of Service and Privacy Policy to continue.");
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              display_name: displayName.trim(),
              legal_acceptance: true,
              accepted_terms_version: LEGAL_VERSION,
              accepted_privacy_version: LEGAL_VERSION,
            },
          },
        });
        if (error) {
          if (error.message.toLowerCase().includes("legal_acceptance_required")) {
            throw new Error("You must accept the Terms of Service and Privacy Policy to continue.");
          }
          throw error;
        }
        if (!data.session) {
          setSent(true);
          return;
        }
        navigate({ to: "/dashboard" });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const title = isForgot
    ? "Reset your password"
    : isSignup
      ? "Create your EloShape account"
      : "Sign in to EloShape";

  const description = isForgot
    ? "Enter your account email and we'll send you a secure password reset link."
    : isSignup
      ? "Register for tournaments, link your Riot account for eligibility, and start earning circuit points."
      : "Welcome back. Your division, points and brackets are waiting.";

  return (
    <PageContainer className="flex min-h-[70vh] items-center justify-center py-16">
      <div className="bg-surface-gradient shadow-elevated w-full max-w-md rounded-xl border border-border p-8">
        <EloShapeMark className="h-10 w-10" />
        <h1 className="mt-5 text-2xl font-black tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success">
              {isForgot
                ? "If an EloShape account exists for that email, a password reset link has been sent."
                : "Check your email to confirm your account, then sign in."}
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setSent(false);
                navigate({ to: "/auth", search: { mode: "signin" } });
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
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
                autoComplete="email"
                required
              />
            </div>

            {!isForgot ? (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2"
                  minLength={isSignup ? 10 : undefined}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                />
                {isSignup ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    At least 10 characters with uppercase, lowercase, a number, and a symbol.
                  </p>
                ) : null}
              </div>
            ) : null}

            {isSignup ? (
              <div className="flex items-start gap-3 rounded-md border border-border bg-background/40 p-3">
                <Checkbox
                  id="legal"
                  checked={acceptedLegal}
                  onCheckedChange={(checked) => setAcceptedLegal(checked === true)}
                  aria-describedby="legal-copy"
                />
                <label
                  id="legal-copy"
                  htmlFor="legal"
                  className="text-xs leading-5 text-muted-foreground"
                >
                  I agree to the{" "}
                  <Link to="/terms" className="font-semibold text-foreground hover:text-brand">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="font-semibold text-foreground hover:text-brand">
                    Privacy Policy
                  </Link>
                  .
                </label>
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || (isSignup && !acceptedLegal)}
            >
              {loading
                ? "Please wait…"
                : isForgot
                  ? "Send reset link"
                  : isSignup
                    ? "Create account"
                    : "Sign in"}
            </Button>
          </form>
        )}

        {!sent ? (
          <div className="mt-6 space-y-3 text-center text-sm">
            {mode === "signin" ? (
              <button
                type="button"
                onClick={() => navigate({ to: "/auth", search: { mode: "forgot" } })}
                className="text-muted-foreground hover:text-foreground"
              >
                Forgot your password?
              </button>
            ) : null}

            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/auth",
                  search: { mode: isSignup || isForgot ? "signin" : "signup" },
                })
              }
              className="block w-full text-muted-foreground hover:text-foreground"
            >
              {isSignup || isForgot ? "Back to sign in" : "New to EloShape? Create an account"}
            </button>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}
