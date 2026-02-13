"use client";

import { useState, useCallback } from "react";
import { useClusterStore } from "@/store/cluster-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Shield, AlertCircle } from "lucide-react";

export function KubeconfigUpload() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pasteContent, setPasteContent] = useState("");
  const store = useClusterStore();

  const handleUpload = useCallback(async (content: string) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("kubeconfigRaw", content);
      const res = await fetch("/api/kubeconfig", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      store.setAvailableContexts(data.contexts);
      store.setCurrentContext(data.currentContext);
      store.setKubeconfigLoaded(true);

      // Fetch namespaces
      const nsRes = await fetch(`/api/kubeconfig`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: data.currentContext }) });
      const nsData = await nsRes.json();
      if (nsData.namespaces) {
        store.setAvailableNamespaces(nsData.namespaces);
      }
    } catch {
      setError("Failed to connect. Please check your kubeconfig.");
    } finally {
      setLoading(false);
    }
  }, [store]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await handleUpload(text);
  }, [handleUpload]);

  const handlePaste = useCallback(async () => {
    if (!pasteContent.trim()) return;
    await handleUpload(pasteContent);
  }, [pasteContent, handleUpload]);

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Security Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Connect to your OpenShift or Kubernetes cluster to analyze its security posture.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="file">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="paste" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Paste Config
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="mt-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    id="kubeconfig-file"
                    disabled={loading}
                  />
                  <label htmlFor="kubeconfig-file" className="cursor-pointer">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">Drop your kubeconfig file here</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      or click to browse. Any filename is accepted -- content is validated automatically.
                    </p>
                  </label>
                </div>
              </TabsContent>

              <TabsContent value="paste" className="mt-4 space-y-3">
                <Textarea
                  placeholder="Paste your kubeconfig YAML content here..."
                  className="font-mono text-xs min-h-[200px]"
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  disabled={loading}
                />
                <Button
                  onClick={handlePaste}
                  disabled={loading || !pasteContent.trim()}
                  className="w-full"
                >
                  {loading ? "Connecting..." : "Connect to Cluster"}
                </Button>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="mt-4 flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">
                <strong>Security note:</strong> Your kubeconfig is processed entirely on your local machine. 
                It is sent to the local Next.js server process and never transmitted to any external service.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
