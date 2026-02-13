"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import glossary from "@/lib/glossary";

interface FieldLabelProps {
  /** Key into the glossary */
  term: string;
  /** Override display text (defaults to the glossary term name) */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Lightweight field-level tooltip.
 * Renders an inline label with a subtle help icon.
 * On hover shows the glossary `short` description.
 * Falls back to plain text if the term is not found.
 */
export function FieldLabel({ term, children, className }: FieldLabelProps) {
  const entry = glossary[term] || Object.values(glossary).find(
    (e) => e.term.toLowerCase() === term.toLowerCase()
  );

  const label = children || entry?.term || term;

  if (!entry) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-0.5 cursor-help ${className || ""}`}>
          {label}
          <HelpCircle className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        <p className="font-medium mb-0.5">{entry.term}</p>
        <p className="text-muted">{entry.short}</p>
      </TooltipContent>
    </Tooltip>
  );
}
