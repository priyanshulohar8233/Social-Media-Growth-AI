import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingHeaderProps {
  currentStep: number;
}

const steps = [
  { id: 1, name: "Account", label: "Account" },
  { id: 2, name: "Email", label: "Verify Email" },
  { id: 3, name: "Social", label: "Connect Social" },
  { id: 4, name: "Brand", label: "Brand Details" },
  { id: 5, name: "Tour", label: "Product Tour" },
];

export function OnboardingHeader({ currentStep }: OnboardingHeaderProps) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8 px-4">
      <div className="flex items-center justify-between relative">
        {/* Connecting Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-border -z-10" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-accent -z-10 transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center bg-background px-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 border-2",
                  isCompleted
                    ? "bg-accent border-accent text-accent-foreground"
                    : isCurrent
                    ? "border-accent text-accent bg-accent/10 shadow-md shadow-accent/20"
                    : "border-border text-muted-foreground bg-muted"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.id}
              </div>
              <span
                className={cn(
                  "text-xs mt-1.5 font-medium hidden sm:block",
                  isCurrent ? "text-accent" : isCompleted ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
