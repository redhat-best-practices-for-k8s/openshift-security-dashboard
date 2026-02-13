"use client";

import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Tag, Plus, X, ChevronDown } from "lucide-react";

interface LabelPickerProps {
  /** "pod" or "namespace" — determines which label set to show */
  mode: "pod" | "namespace";
  /** Current selector as key=value map */
  value: Record<string, string>;
  /** Called when the selector changes */
  onChange: (labels: Record<string, string>) => void;
  /** Optional: restrict to a specific namespace for pod labels */
  namespace?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Size variant */
  compact?: boolean;
}

interface ClusterLabels {
  podLabels: Record<string, string[]>;
  namespaceLabels: Record<string, string[]>;
}

let labelsCache: ClusterLabels | null = null;
let labelsFetchPromise: Promise<ClusterLabels> | null = null;

async function fetchClusterLabels(): Promise<ClusterLabels> {
  if (labelsCache) return labelsCache;
  if (labelsFetchPromise) return labelsFetchPromise;

  labelsFetchPromise = fetch("/api/labels")
    .then((res) => res.json())
    .then((data: ClusterLabels) => {
      labelsCache = data;
      // Expire cache after 20s
      setTimeout(() => { labelsCache = null; labelsFetchPromise = null; }, 20000);
      return data;
    })
    .catch(() => {
      labelsFetchPromise = null;
      return { podLabels: {}, namespaceLabels: {} };
    });

  return labelsFetchPromise;
}

export function LabelPicker({
  mode,
  value,
  onChange,
  placeholder,
  compact,
}: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<ClusterLabels | null>(null);
  const [filter, setFilter] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    fetchClusterLabels().then(setLabels);
  }, []);

  const availableLabels = useMemo(() => {
    if (!labels) return {};
    return mode === "pod" ? labels.podLabels : labels.namespaceLabels;
  }, [labels, mode]);

  const filteredKeys = useMemo(() => {
    const keys = Object.keys(availableLabels);
    if (!filter) return keys;
    const q = filter.toLowerCase();
    return keys.filter((k) => {
      if (k.toLowerCase().includes(q)) return true;
      // Also match on values
      return availableLabels[k].some((v) => v.toLowerCase().includes(q) || `${k}=${v}`.toLowerCase().includes(q));
    });
  }, [availableLabels, filter]);

  const addLabel = (key: string, val: string) => {
    onChange({ ...value, [key]: val });
  };

  const removeLabel = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const addCustomLabel = () => {
    if (customKey.trim()) {
      addLabel(customKey.trim(), customValue.trim());
      setCustomKey("");
      setCustomValue("");
    }
  };

  const entries = Object.entries(value);
  const textSize = compact ? "text-[10px]" : "text-xs";
  const inputHeight = compact ? "h-6" : "h-7";

  return (
    <div className="space-y-1.5">
      {/* Current labels */}
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entries.map(([k, v]) => (
            <Badge key={k} variant="secondary" className={`${textSize} gap-1 pr-1`}>
              {k}={v}
              <button
                onClick={() => removeLabel(k)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Picker trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`${compact ? "h-6 text-[10px]" : "h-7 text-xs"} gap-1 w-full justify-start`}
          >
            <Tag className="h-3 w-3" />
            {placeholder || `Pick ${mode} labels from cluster...`}
            <ChevronDown className="h-3 w-3 ml-auto" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-7 text-xs pl-7"
                placeholder="Filter labels..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <ScrollArea className="h-[240px]">
            {!labels ? (
              <div className="p-4 text-xs text-muted-foreground text-center">
                Loading labels...
              </div>
            ) : filteredKeys.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center">
                No labels match &quot;{filter}&quot;
              </div>
            ) : (
              <div className="p-1.5">
                {filteredKeys.map((key) => {
                  const values = availableLabels[key];
                  const isSelected = key in value;
                  // If filter matches a specific value, show only matching values
                  const q = filter.toLowerCase();
                  const shownValues = q
                    ? values.filter(
                        (v) =>
                          v.toLowerCase().includes(q) ||
                          key.toLowerCase().includes(q) ||
                          `${key}=${v}`.toLowerCase().includes(q)
                      )
                    : values;

                  return (
                    <div key={key} className="mb-1.5">
                      <div className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5">
                        {key}
                        {isSelected && (
                          <span className="text-primary ml-1">(selected: {value[key]})</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 px-1.5">
                        {shownValues.slice(0, 20).map((v) => {
                          const active = value[key] === v;
                          return (
                            <button
                              key={v}
                              className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                                active
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "hover:bg-muted border-transparent hover:border-border"
                              }`}
                              onClick={() => {
                                if (active) removeLabel(key);
                                else addLabel(key, v);
                              }}
                            >
                              {v}
                            </button>
                          );
                        })}
                        {shownValues.length > 20 && (
                          <span className="text-[9px] text-muted-foreground self-center">
                            +{shownValues.length - 20} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Custom label entry */}
          <div className="border-t p-2 space-y-1.5">
            <div className="text-[10px] text-muted-foreground">Add custom label:</div>
            <div className="flex gap-1">
              <Input
                className={`${inputHeight} text-[10px] flex-1`}
                placeholder="key"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustomLabel();
                }}
              />
              <span className="text-[10px] self-center">=</span>
              <Input
                className={`${inputHeight} text-[10px] flex-1`}
                placeholder="value"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustomLabel();
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className={`${inputHeight} px-2`}
                onClick={addCustomLabel}
                disabled={!customKey.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
