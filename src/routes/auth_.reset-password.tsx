import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EloShapeMark } from "@/components/brand/EloShapeLogo";
import { PageContainer } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

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

export const Route = createFileRoute("/auth_/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — EloShape" },
      { name: "description", content: "Choose a new password for your EloShape account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setHasSession(Boolean(data.session));
      setCheckingSession(false);
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED"
      ) {
        setHasSession(Boolean(session));
        setCheckingSession(false);
      } else if (event === "SIGNED_OUT") {
        setHasSession(false);
        setCheckingSession(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!hasSession) {
      toast.error("This password reset link is invalid or has expired.");
      return;
    }
    if (!strongPassword(password)) {
      toast.error("Use at least 10 characters with uppercase, lowercase, a number, and a symbol.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Require a fresh sign-in after a recovery password change.
      await supabase.auth.signOut();
      toast.success("Password updated. Sign in with your new password.");
      navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="flex min-h-[70vh] items-center justify-center py-16">
      <div className="bg-surface-gradient shadow-elevated w-full max-w-md rounded-xl border border-border p-8">
        <EloShapeMark className="h-10 w-10" />
        <h1 className="mt-5 text-2xl font-black tracking-tight text-foreground">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your new password must be at least 10 characters and include uppercase, lowercase, a
          number, and a symbol.
        </p>

        {checkingSession ? (
          <p className="mt-6 text-sm text-muted-foreground">Validating your reset link…</p>
        ) : hasSession ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2"
                minLength={10}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2"
                minLength={10}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              This password reset link is invalid or has expired. Request a new link to continue.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => navigate({ to: "/auth", search: { mode: "forgot" } })}
            >
              Request a new reset link
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
