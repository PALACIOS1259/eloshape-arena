import { authErrorMessage } from "@/lib/auth-messages";
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
      { title: "Restablecer contraseña — EloShape" },
      { name: "description", content: "Elegí una nueva contraseña para tu cuenta de EloShape." },
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
      toast.error("Este enlace de recuperación es inválido o venció.");
      return;
    }
    if (!strongPassword(password)) {
      toast.error("Usá al menos 10 caracteres con mayúsculas, minúsculas, un número y un símbolo.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Require a fresh sign-in after a recovery password change.
      await supabase.auth.signOut();
      toast.success("Contraseña actualizada. Iniciá sesión con tu nueva contraseña.");
      navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
    } catch (error) {
      toast.error(authErrorMessage(error, "No se pudo actualizar la contraseña."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="flex min-h-[72vh] items-center justify-center py-12">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/95 via-card/80 to-primary/[0.025] p-6 shadow-card sm:p-8">
        <EloShapeMark className="h-10 w-10" />
        <h1 className="mt-5 text-2xl font-black tracking-tight text-foreground">
          Elegí una nueva contraseña
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu nueva contraseña debe tener al menos 10 caracteres e incluir mayúsculas, minúsculas, un
          número y un símbolo.
        </p>

        {checkingSession ? (
          <p className="mt-6 text-sm text-muted-foreground">Validando el enlace de recuperación…</p>
        ) : hasSession ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="newPassword">Nueva contraseña</Label>
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
              <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
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
              {loading ? "Actualizando…" : "Actualizar contraseña"}
            </Button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="border-l-2 border-destructive/35 pl-4 text-sm text-destructive">
              Este enlace de recuperación es inválido o venció. Pedí uno nuevo para continuar.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => navigate({ to: "/auth", search: { mode: "forgot" } })}
            >
              Pedir un nuevo enlace de recuperación
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
