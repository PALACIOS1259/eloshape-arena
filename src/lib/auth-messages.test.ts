import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-messages";

describe("authentication error display", () => {
  it("uses a known provider code instead of exposing an English message", () => {
    const error = Object.assign(new Error("Invalid login credentials"), {
      code: "invalid_credentials",
    });
    expect(authErrorMessage(error)).toBe("El correo o la contraseña son incorrectos.");
  });

  it("keeps local Spanish validation while hiding unknown provider details", () => {
    expect(authErrorMessage(new Error("Las contraseñas no coinciden."))).toBe(
      "Las contraseñas no coinciden.",
    );
    expect(authErrorMessage(new Error("Internal provider details"))).toBe(
      "No se pudo completar la autenticación. Volvé a intentar.",
    );
  });
});
