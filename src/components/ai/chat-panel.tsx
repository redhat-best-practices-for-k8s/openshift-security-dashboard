"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import { useClusterStore } from "@/store/cluster-store";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { parseSuggestions, suggestionToPendingChange } from "@/lib/ai/parse-suggestions";
import type { ChatMessage, AISuggestion } from "@/types";
import { Bot, Send, Plus, Loader2, Sparkles, X } from "lucide-react";

interface ResourceContext {
  kind: string;
  name: string;
  namespace?: string;
  details: string;
  summary: string;
}

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [resourceContext, setResourceContext] = useState<ResourceContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { availableNamespaces } = useClusterStore();
  const { addChange } = useChangesStore();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Listen for AI fix requests (analysis page -- prefills input)
  useEffect(() => {
    const fixHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.prompt) {
        setInput(detail.prompt);
        setOpen(true);
      }
    };
    window.addEventListener("ai-fix-request", fixHandler);
    return () => window.removeEventListener("ai-fix-request", fixHandler);
  }, []);

  // Listen for resource context (Ask AI button -- sets context, empty input)
  useEffect(() => {
    const ctxHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ResourceContext;
      if (detail?.kind) {
        setResourceContext(detail);
        setInput("");
        setOpen(true);
      }
    };
    window.addEventListener("ai-resource-context", ctxHandler);
    return () => window.removeEventListener("ai-resource-context", ctxHandler);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      // Fetch cluster context for enriched AI prompt
      let roleNames: string[] = [];
      let clusterRoleNames: string[] = [];
      let sccNames: string[] = [];
      let saNames: string[] = [];
      let workloadNames: string[] = [];
      try {
        const [rbacRes, sccRes, saRes, wlRes] = await Promise.all([
          fetch("/api/rbac").then((r) => r.json()).catch(() => null),
          fetch("/api/scc").then((r) => r.json()).catch(() => null),
          fetch("/api/service-accounts").then((r) => r.json()).catch(() => null),
          fetch("/api/workloads").then((r) => r.json()).catch(() => null),
        ]);
        if (rbacRes) {
          roleNames = (rbacRes.roles || []).map((r: { name: string }) => r.name);
          clusterRoleNames = (rbacRes.clusterRoles || []).map((r: { name: string }) => r.name);
        }
        if (Array.isArray(sccRes)) sccNames = sccRes.map((s: { name: string }) => s.name);
        if (Array.isArray(saRes)) saNames = saRes.map((s: { namespace: string; name: string }) => `${s.namespace}/${s.name}`);
        if (Array.isArray(wlRes)) workloadNames = wlRes.map((w: { kind: string; namespace: string; name: string }) => `${w.kind}/${w.namespace}/${w.name}`);
      } catch { /* ignore context fetch errors */ }

      let systemPrompt = buildSystemPrompt({
        namespaces: availableNamespaces,
        roleNames,
        clusterRoleNames,
        sccNames,
        serviceAccountSummary: saNames,
        workloadSummary: workloadNames,
      });

      // Inject resource context if the user is asking about a specific resource
      if (resourceContext) {
        systemPrompt += `\n\nCURRENT RESOURCE CONTEXT:
The user is currently viewing ${resourceContext.kind} "${resourceContext.name}"${resourceContext.namespace ? ` in namespace "${resourceContext.namespace}"` : ""}.
${resourceContext.details ? `Resource details: ${resourceContext.details}` : ""}
The user's question is about this specific resource. Focus your answer on this resource. You can suggest modifications to it or explain its security implications. If suggesting changes, use the suggestion JSON format for this specific resource.`;
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: `Error: ${err.error}` } : m))
        );
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.content) {
              fullContent += json.content;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullContent } : m))
              );
            }
          } catch {
            // skip
          }
        }
      }

      // Parse suggestions from final content
      const suggestions = parseSuggestions(fullContent);
      if (suggestions.length > 0) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, suggestions } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: "Failed to connect to AI. Is Ollama running?" } : m
        )
      );
    } finally {
      setStreaming(false);
    }
  };

  const handleApplySuggestion = (suggestion: AISuggestion, messageContent: string) => {
    const change = suggestionToPendingChange(suggestion, messageContent);
    addChange({ ...change, id: generateChangeId() });
    // Mark as applied
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        suggestions: m.suggestions?.map((s) => (s.id === suggestion.id ? { ...s, applied: true } : s)),
      }))
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Strip suggestion blocks from display
  const formatContent = (content: string) => {
    return content.replace(/```suggestion\s*\n[\s\S]*?```/g, "").trim();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 fixed bottom-4 right-4 z-50 shadow-lg">
          <Sparkles className="h-4 w-4" />
          AI Assistant
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[420px] sm:w-[480px] flex flex-col p-0 overflow-hidden h-full">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Bot className="h-4 w-4" />
            Security AI Assistant
            <Badge variant="secondary" className="text-[10px]">qwen3:32b</Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-8 w-8 mx-auto mb-3 opacity-50" />
                {resourceContext ? (
                  <>
                    <p className="text-sm font-medium">Ask about {resourceContext.kind} &quot;{resourceContext.name}&quot;</p>
                    <p className="text-xs mt-1">I have full context on this resource. Ask me anything or request changes.</p>
                    <div className="mt-4 space-y-2">
                      {[
                        `Is this ${resourceContext.kind} secure? What should I improve?`,
                        `Explain what this ${resourceContext.kind} does in simple terms`,
                        `Harden this ${resourceContext.kind} following best practices`,
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => { setInput(q); }}
                          className="block w-full text-left text-xs p-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">Ask me about your cluster security</p>
                    <p className="text-xs mt-1">I can suggest roles, policies, SCCs, and explain security concepts.</p>
                    <div className="mt-4 space-y-2">
                      {["Lock down namespace prod with network policies", "Create a read-only role for monitoring", "Which service accounts have too many permissions?"].map((q) => (
                        <button
                          key={q}
                          onClick={() => { setInput(q); }}
                          className="block w-full text-left text-xs p-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-lg p-3 text-sm ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <div className="whitespace-pre-wrap text-xs leading-relaxed">
                    {msg.role === "assistant" ? formatContent(msg.content) : msg.content}
                    {streaming && msg.role === "assistant" && msg === messages[messages.length - 1] && (
                      <Loader2 className="h-3 w-3 inline ml-1 animate-spin" />
                    )}
                  </div>

                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-3 space-y-2 border-t pt-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">Suggested Changes</p>
                      {msg.suggestions.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-2 rounded bg-background/50 border">
                          <div className="text-[11px]">
                            <Badge variant="outline" className="text-[9px] mr-1">{s.action}</Badge>
                            {s.kind} <span className="font-medium">{s.name}</span>
                            {s.namespace && <span className="text-muted-foreground"> ({s.namespace})</span>}
                          </div>
                          {s.applied ? (
                            <Badge variant="secondary" className="text-[9px]">Added</Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] gap-1"
                              onClick={() => handleApplySuggestion(s, msg.content)}
                            >
                              <Plus className="h-3 w-3" />
                              Add
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t">
          {resourceContext && (
            <div className="px-3 pt-2 pb-1 flex items-center gap-2 bg-primary/5">
              <Sparkles className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[10px] text-muted-foreground flex-1 truncate">
                Asking about <span className="font-medium text-foreground">{resourceContext.kind}</span> &quot;{resourceContext.name}&quot;
                {resourceContext.namespace && <> in <span className="font-medium text-foreground">{resourceContext.namespace}</span></>}
              </span>
              <button onClick={() => setResourceContext(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
            </div>
          )}
          <div className="flex gap-2 p-3">
            <Input
              placeholder={resourceContext ? `Ask about this ${resourceContext.kind}...` : "Ask about security..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              className="text-xs h-9"
            />
            <Button size="sm" onClick={handleSend} disabled={streaming || !input.trim()} className="h-9 px-3">
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
