import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getStaffSupportRequests,
  updateStaffSupportRequest,
  type StaffSupportRequest,
  type SupportStatus,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/admin_/support")({
  head: () => ({
    meta: [
      { title: "Support queue — EloShape Staff" },
      { name: "description", content: "Review EloShape support, privacy and deletion requests." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StaffSupportPage,
});

function StaffSupportPage() {
  const fetchRequests = useServerFn(getStaffSupportRequests);
  const query = useQuery({
    queryKey: ["staff-support-requests"],
    queryFn: () => fetchRequests(),
    retry: false,
  });

  const openCount = query.data?.filter((request) => request.status === "open").length ?? 0;
  const reviewCount = query.data?.filter((request) => request.status === "in_review").length ?? 0;

  return (
    <div>
      <PageHeading
        eyebrow="Staff · Support"
        title="Support queue"
        description="Review player support, bug, privacy and account-deletion requests. Account deletion is a reviewed workflow so competitive history can be preserved or anonymized safely."
        aside={
          <Button asChild variant="outline">
            <Link to="/admin">Back to moderation console</Link>
          </Button>
        }
      />

      <PageContainer className="py-10">
        {query.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : query.error || !query.data ? (
          <EmptyState
            title="Staff access required"
            description="This queue is limited to EloShape admin and moderator accounts."
          />
        ) : (
          <>
            <div className="mb-8 flex flex-wrap gap-2">
              <Badge variant="outline">{openCount} open</Badge>
              <Badge variant="outline">{reviewCount} in review</Badge>
              <Badge variant="secondary">{query.data.length} total</Badge>
            </div>

            <div className="space-y-4">
              {query.data.length ? (
                query.data.map((request) => <SupportCard key={request.id} request={request} />)
              ) : (
                <EmptyState title="Support queue clear" />
              )}
            </div>
          </>
        )}
      </PageContainer>
    </div>
  );
}

function SupportCard({ request }: { request: StaffSupportRequest }) {
  const queryClient = useQueryClient();
  const update = useServerFn(updateStaffSupportRequest);
  const [response, setResponse] = useState(request.staffResponse ?? "");

  const mutation = useMutation({
    mutationFn: (status: SupportStatus) =>
      update({ data: { requestId: request.id, status, response } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Support request marked ${result.result.status.replace("_", " ")}.`);
      void queryClient.invalidateQueries({ queryKey: ["staff-support-requests"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not update support request.");
    },
  });

  const requester = request.profile
    ? `${request.profile.displayName} (@${request.profile.handle})`
    : "Account without a linked public profile";

  return (
    <article className="bg-surface-gradient rounded-lg border border-border p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{request.category.replace("_", " ")}</Badge>
            <StatusBadge status={request.status} />
          </div>
          <h2 className="mt-3 text-lg font-black text-foreground">{request.subject}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {requester} · {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        {request.profile ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/players/$handle" params={{ handle: request.profile.handle }}>
              Player profile
            </Link>
          </Button>
        ) : null}
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{request.message}</p>

      <div className="mt-5">
        <p className="eyebrow">Response visible to player</p>
        <Textarea
          className="mt-2"
          rows={4}
          maxLength={2000}
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          placeholder="Add a response or resolution note."
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("in_review")}
        >
          Mark in review
        </Button>
        <Button
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("resolved")}
        >
          Resolve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("closed")}
        >
          Close
        </Button>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: SupportStatus }) {
  return (
    <Badge variant={status === "resolved" || status === "closed" ? "secondary" : "outline"}>
      {status.replace("_", " ")}
    </Badge>
  );
}
