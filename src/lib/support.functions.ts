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
  if (code.includes("authentication_required")) return "Sign in to contact EloShape support.";
  if (code.includes("invalid_support_category")) return "Choose a valid support category.";
  if (code.includes("invalid_support_subject")) {
    return "Subject must be between 3 and 120 characters.";
  }
  if (code.includes("invalid_support_message")) {
    return "Message must be between 10 and 4,000 characters.";
  }
  if (code.includes("invalid_support_status")) return "Choose a valid support status.";
  if (code.includes("support_response_too_long")) {
    return "Staff response must be 2,000 characters or fewer.";
  }
  if (code.includes("support_request_not_found")) return "That support request could not be found.";
  if (code.includes("forbidden")) return "Staff access required.";
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
      throw new Error("Subject must be between 3 and 120 characters.");
    }
    if (message.length < 10 || message.length > 4000) {
      throw new Error("Message must be between 10 and 4,000 characters.");
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
        error: error instanceof Error ? error.message : "Could not submit support request.",
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
        error: error instanceof Error ? error.message : "Could not update support request.",
      };
    }
  });
