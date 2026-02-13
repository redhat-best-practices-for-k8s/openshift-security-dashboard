"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, SkipForward, Check } from "lucide-react";

export interface WizardStep {
  title: string;
  description?: string;
  optional?: boolean;
}

interface WizardShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
  canProceed: boolean;
  children: React.ReactNode;
}

export function WizardShell({ open, onClose, title, steps, currentStep, onStepChange, onComplete, canProceed, children }: WizardShellProps) {
  const isLast = currentStep === steps.length - 1;
  const step = steps[currentStep];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 pt-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <button
                  onClick={() => i < currentStep && onStepChange(i)}
                  className={cn(
                    "w-7 h-7 rounded-full text-[10px] font-medium flex items-center justify-center transition-colors",
                    i === currentStep
                      ? "bg-primary text-primary-foreground"
                      : i < currentStep
                      ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {i < currentStep ? <Check className="h-3 w-3" /> : i + 1}
                </button>
                {i < steps.length - 1 && (
                  <div className={cn("w-8 h-0.5 rounded", i < currentStep ? "bg-primary/30" : "bg-muted")} />
                )}
              </div>
            ))}
          </div>
          <div className="pt-1">
            <p className="text-sm font-medium">{step.title}</p>
            {step.description && <p className="text-xs text-muted-foreground">{step.description}</p>}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 min-h-[300px]">
          {children}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => currentStep > 0 ? onStepChange(currentStep - 1) : onClose()}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="h-3 w-3" />
            {currentStep > 0 ? "Back" : "Cancel"}
          </Button>
          <div className="flex gap-2">
            {step.optional && !isLast && (
              <Button variant="ghost" size="sm" onClick={() => onStepChange(currentStep + 1)} className="gap-1 text-xs">
                <SkipForward className="h-3 w-3" /> Skip
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={onComplete} disabled={!canProceed} className="gap-1 text-xs">
                <Check className="h-3 w-3" /> Add to Preview
              </Button>
            ) : (
              <Button size="sm" onClick={() => onStepChange(currentStep + 1)} disabled={!canProceed} className="gap-1 text-xs">
                Next <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
