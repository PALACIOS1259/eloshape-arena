import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";

type RpcResult<T> = { data: T | null; error: { message: string } | null };

export type SupportCategory = "support" | "bug" | "privacy" | "account_deletion";
export type SupportStatus = "open" | "in_review" | "resolved" | "closed";

export type SupportRequest = {
  id: string;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  staffResponse: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type StaffSupportRequest = SupportRequest & {
  profile: null | {
    id: string;
    handle: string;
    displayName: string;
  };
};

function friendlySupportError(message: string) {
  const code = message.toLowerCase();
  if (code.includes("authentication_required"))
    return "Iniciá sesión para contactar al soporte de EloShape.";
  if (code.includes("invalid_support_category")) return "Elegí una categoría de soporte válida.";
  if (code.includes("invalid_support_subject")) {
    return "El asunto debe tener entre 3 y 120 caracteres.";
  }
  if (code.includes("invalid_support_message")) {
    return "El mensaje debe tener entre 10 y 4000 caracteres.";
  }
  if (code.includes("invalid_support_status")) return "Elegí un estado de soporte válido.";
  if (code.includes("support_response_too_long")) {
    return "La respuesta de la organización no puede superar los 2000 caracteres.";
  }
  if (code.includes("support_request_not_found")) return "No se encontró esa solicitud de soporte.";
  if (code.includes("forbidden")) return "Se requiere acceso de organización.";
  return message;
}

async function rpc<T>(accessToken: string, fn: string, args?: Record<string, unknown>) {
  const supabase = createAuthenticatedSupabaseClient(accessToken);
  const call = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    values?: Record<string, unknown>,
  ) => Promise<RpcResult<T>>;
  const { data, error } = await call(fn, args);
  if (error) throw new Error(friendlySupportError(error.message));
  return data as T;
}

export const getMySupportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    rpc<SupportRequest[]>(context.accessToken, "get_my_support_requests"),
  );

export const submitMySupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { category: SupportCategory; subject: string; message: string }) => {
    const subject = input.subject.trim();
    const message = input.message.trim();
    if (subject.length < 3 || subject.length > 120) {
      throw new Error("El asunto debe tener entre 3 y 120 caracteres.");
    }
    if (message.length < 10 || message.length > 4000) {
      throw new Error("El mensaje debe tener entre 10 y 4000 caracteres.");
    }
    return { category: input.category, subject, message };
  })
  .handler(async ({ data, context }) => {
    try {
      const result = await rpc<{ ok: boolean; id: string; status: SupportStatus }>(
        context.accessToken,
        "submit_my_support_request",
        {
          p_category: data.category,
          p_subject: data.subject,
          p_message: data.message,
        },
      );
      return { ok: true as const, result };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : "No se pudo enviar la solicitud de soporte.",
      };
    }
  });

export const getStaffSupportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    rpc<StaffSupportRequest[]>(context.accessToken, "staff_list_support_requests"),
  );

export const updateStaffSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { requestId: string; status: SupportStatus; response?: string }) => ({
    requestId: input.requestId,
    status: input.status,
    response: input.response?.trim() ?? "",
  }))
  .handler(async ({ data, context }) => {
    try {
      const result = await rpc<{
        ok: boolean;
        id: string;
        status: SupportStatus;
        staffResponse: string | null;
        updatedAt: string;
        resolvedAt: string | null;
      }>(context.accessToken, "staff_update_support_request", {
        p_request: data.requestId,
        p_status: data.status,
        p_response: data.response || null,
      });
      return { ok: true as const, result };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : "No se pudo actualizar la solicitud de soporte.",
      };
    }
  });
