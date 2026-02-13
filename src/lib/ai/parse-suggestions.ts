import type { AISuggestion } from "@/types";

export function parseSuggestions(content: string): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const regex = /```suggestion\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    try {
      const json = JSON.parse(match[1].trim());
      suggestions.push({
        id: `suggestion-${Date.now()}-${suggestions.length}`,
        action: json.action || "create",
        kind: json.kind || "Unknown",
        name: json.name || "unnamed",
        namespace: json.namespace,
        spec: json.spec || json,
        explanation: "",
        applied: false,
      });
    } catch {
      // Skip malformed JSON
    }
  }

  return suggestions;
}

export function suggestionToPendingChange(suggestion: AISuggestion, explanation: string) {
  return {
    id: `ai-${suggestion.id}`,
    action: suggestion.action,
    resourceKind: suggestion.kind,
    resourceName: suggestion.name,
    namespace: suggestion.namespace,
    before: suggestion.action === "create" ? null : undefined,
    after: suggestion.action === "delete" ? null : suggestion.spec,
    description: `${suggestion.action} ${suggestion.kind} "${suggestion.name}"${suggestion.namespace ? ` in ${suggestion.namespace}` : ""}`,
    aiSuggested: true,
    aiExplanation: explanation,
  };
}
