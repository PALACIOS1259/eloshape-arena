import { Check, Circle } from "lucide-react";

import { Progress } from "@/components/ui/progress";

export type OnboardingStep = { key: string; label: string; done: boolean };

export function OnboardingChecklist({
  steps,
  completion,
}: {
  steps: OnboardingStep[];
  completion: number;
}) {
  return (
    <div className="bg-surface-gradient shadow-card rounded-lg border border-border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Onboarding</p>
        <span className="tabular text-sm font-black text-gold">{completion}%</span>
      </div>
      <Progress value={completion} className="mt-3 h-1.5" />
      <ul className="mt-4 space-y-2.5">
        {steps.map((step) => (
          <li key={step.key} className="flex items-start gap-2.5 text-sm">
            {step.done ? (
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className={step.done ? "text-muted-foreground line-through" : "text-foreground"}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
