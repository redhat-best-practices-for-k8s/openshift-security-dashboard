"use client";

import { HelpCircle, ExternalLink } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import glossary from "@/lib/glossary";

interface LearnTooltipProps {
  term: string;
  children?: React.ReactNode;
  className?: string;
}

export function LearnTooltip({ term, children, className }: LearnTooltipProps) {
  const entry = glossary[term] || Object.values(glossary).find(
    (e) => e.term.toLowerCase() === term.toLowerCase()
  );

  if (!entry) {
    return <>{children || term}</>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span className={`inline-flex items-center gap-1 cursor-help border-b border-dashed border-muted-foreground/40 ${className || ""}`}>
          {children || entry.term}
          <HelpCircle className="h-3 w-3 text-muted-foreground" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" side="top">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{entry.term}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{entry.long}</p>
          {entry.learnMore && (
            <a
              href={entry.learnMore}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Learn more <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
