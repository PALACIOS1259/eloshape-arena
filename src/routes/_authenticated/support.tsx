import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getMySupportRequests,
  submitMySupportRequest,
  type SupportCategory,
  type SupportStatus,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support — EloShape" },
      {
        name: "description",
        content:
          "Contact EloShape support, report a bug, ask a privacy question or request account deletion.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupportPage,
});

const categoryOptions: { value: SupportCategory; label: string }[] = [
  { value: "support", label: "General support" },
  { value: "bug", label: "Report a bug" },
  { value: "privacy", label: "Privacy request" },
  { value: "account_deletion", label: "Account deletion" },
];

function SupportPage() {
  const queryClient = useQueryClient();
  const fetchRequests = useServerFn(getMySupportRequests);
  const submit = useServerFn(submitMySupportRequest);
  const [category, setCategory] = useState<SupportCategory>("support");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const query = useQuery({
    queryKey: ["my-support-requests"],
    queryFn: () => fetchRequests(),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => submit({ data: { category, subject, message } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Support request submitted.");
      setSubject("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["my-support-requests"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not submit support request.");
    },
  });

  return (
    <div>
      <PageHeading
        eyebrow="Help · Privacy"
        title="EloShape support"
        description="Ask for help, report a bug, send a privacy request or request deletion of your EloShape account. Requests are tied to your signed-in account so Staff can follow up safely."
      />

      <PageContainer className="grid gap-8 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="bg-surface-gradient rounded-lg border border-border p-6 shadow-card">
          <p className="eyebrow">New request</p>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="support-category">Category</Label>
              <select
                id="support-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as SupportCategory)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={120}
                placeholder={
                  category === "account_deletion"
                    ? "Delete my EloShape account"
                    : "How can we help?"
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-message">Message</Label>
              <Textarea
                id="support-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={4000}
                rows={7}
                placeholder={
                  category === "account_deletion"
                    ? "Confirm that you want EloShape Staff to review deletion of your account and associated personal data. Competitive records may need to be retained or anonymized where required for tournament integrity."
                    : "Include enough detail for Staff to reproduce or understand the issue."
                }
              />
              <p className="text-xs text-muted-foreground">{message.length}/4000 characters</p>
            </div>

            {category === "account_deletion" ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-muted-foreground">
                Submitting this request does not instantly erase tournament history. Staff will
                review the request and remove or anonymize personal data while preserving records
                that are necessary for competitive integrity or legal obligations.
              </div>
            ) : null}

            <Button
              onClick={() => mutation.mutate()}
              disabled={
                mutation.isPending || subject.trim().length < 3 || message.trim().length < 10
              }
            >
              {mutation.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </section>

        <section>
          <p className="eyebrow">Your requests</p>
          <div className="mt-3 space-y-3">
            {query.isPending ? (
              <>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </>
            ) : query.error ? (
              <EmptyState title="Could not load your support requests" />
            ) : !query.data?.length ? (
              <EmptyState
                title="No support requests yet"
                description="Requests you submit will appear here with their current Staff status."
              />
            ) : (
              query.data.map((request) => (
                <article
                  key={request.id}
                  className="bg-surface-gradient rounded-lg border border-border p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">{categoryLabel(request.category)}</p>
                      <h2 className="mt-1 font-black text-foreground">{request.subject}</h2>
                    </div>
                    <SupportStatusBadge status={request.status} />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {request.message}
                  </p>
                  {request.staffResponse ? (
                    <div className="mt-4 rounded-md border border-border bg-background/60 p-4">
                      <p className="eyebrow">Staff response</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {request.staffResponse}
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-4 text-xs text-muted-foreground">
                    Submitted {new Date(request.createdAt).toLocaleString()}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </PageContainer>
    </div>
  );
}

function categoryLabel(category: SupportCategory) {
  return categoryOptions.find((option) => option.value === category)?.label ?? category;
}

function SupportStatusBadge({ status }: { status: SupportStatus }) {
  const label = status.replace("_", " ");
  return (
    <Badge variant={status === "resolved" || status === "closed" ? "secondary" : "outline"}>
      {label}
    </Badge>
  );
}
