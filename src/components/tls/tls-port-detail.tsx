"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FieldLabel } from "@/components/shared/field-label";
import { ResourceLink } from "@/components/shared/resource-link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Atom,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { KeyRound } from "lucide-react";
import type { TLSIPResult, TLSPortResult, TLSScanStatus } from "@/types";

interface TLSPortDetailProps {
  ipResult: TLSIPResult | null;
  portResult: TLSPortResult | null;
  open: boolean;
  onClose: () => void;
}

const strengthColor: Record<string, string> = {
  A: "bg-green-500/15 text-green-700",
  B: "bg-blue-500/15 text-blue-700",
  C: "bg-yellow-500/15 text-yellow-700",
  D: "bg-red-500/15 text-red-700",
};

const statusExplanations: Partial<Record<TLSScanStatus, string>> = {
  OK: "Port is open, TLS is configured, and cipher suites were successfully enumerated.",
  NO_TLS: "Port is open and accepting connections but is not using TLS encryption.",
  LOCALHOST_ONLY: "Port is bound to 127.0.0.1 and is only accessible locally within the pod.",
  FILTERED: "Port appears filtered, likely blocked by a network policy or firewall.",
  CLOSED: "Port is not listening / not accepting connections.",
  MTLS_REQUIRED: "Port requires mutual TLS (client certificate) to complete the handshake.",
  TIMEOUT: "Connection attempt timed out before a response was received.",
  NO_PORTS: "Pod declares no TCP ports in its container spec.",
  ERROR: "An error occurred during the scan of this port.",
};

function ComplianceBadge({ label, result }: { label: string; result?: { version: boolean; ciphers: boolean } }) {
  if (!result) return null;
  const ok = result.version && result.ciphers;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-24">{label}:</span>
      <div className="flex gap-1.5">
        <Badge
          variant="outline"
          className={`text-[10px] ${result.version ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"}`}
        >
          Version {result.version ? "✓" : "✗"}
        </Badge>
        <Badge
          variant="outline"
          className={`text-[10px] ${result.ciphers ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"}`}
        >
          Ciphers {result.ciphers ? "✓" : "✗"}
        </Badge>
      </div>
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-600" />
      )}
    </div>
  );
}

export function TLSPortDetail({ ipResult, portResult, open, onClose }: TLSPortDetailProps) {
  if (!ipResult || !portResult) return null;

  const pr = portResult;
  const pod = ipResult.pod;
  const comp = ipResult.openshift_component;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Port {pr.port} on {pod?.Name || ipResult.ip}
          </SheetTitle>
          <SheetDescription>
            {pr.service ? `Service: ${pr.service}` : `IP: ${ipResult.ip}`}
            {pr.protocol ? ` · ${pr.protocol}` : ""}
            {ipResult.node ? ` · Node: ${ipResult.node}` : ""}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          <div className="space-y-4 py-4">
            {/* Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  <FieldLabel term="TLSScanStatus">Status</FieldLabel>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    pr.status === "OK"
                      ? "bg-green-500/15 text-green-700"
                      : pr.status === "NO_TLS"
                        ? "bg-red-500/15 text-red-700"
                        : "bg-yellow-500/15 text-yellow-700"
                  }`}
                >
                  {pr.status}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {statusExplanations[pr.status] || pr.reason || ""}
                </p>
                {pr.reason && pr.reason !== statusExplanations[pr.status] && (
                  <p className="text-xs text-muted-foreground italic">{pr.reason}</p>
                )}
              </CardContent>
            </Card>

            {/* Handshake Details */}
            {pr.handshake && (pr.handshake.key_exchange_group || pr.handshake.signature_algorithm || pr.handshake.alpn_protocol) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4" />
                    Handshake Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  {pr.handshake.key_exchange_group && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Key Exchange</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium">{pr.handshake.key_exchange_group}</span>
                        {pr.handshake.key_exchange_bits && (
                          <span className="text-muted-foreground">({pr.handshake.key_exchange_bits} bits)</span>
                        )}
                        {pr.handshake.is_pqc && (
                          <Badge variant="outline" className="text-[9px] bg-purple-500/15 text-purple-700 border-purple-300">
                            PQC
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {pr.handshake.signature_algorithm && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signature Algorithm</span>
                      <span className="font-mono">{pr.handshake.signature_algorithm}</span>
                    </div>
                  )}
                  {pr.handshake.alpn_protocol && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ALPN Protocol</span>
                      <span className="font-mono">{pr.handshake.alpn_protocol}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quantum Ready */}
            {pr.status === "OK" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    <FieldLabel term="QuantumReady">Quantum Ready</FieldLabel>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pr.handshake?.is_pqc ? (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-purple-700">PQC Active</p>
                        <p className="text-xs text-muted-foreground">
                          Negotiated <span className="font-mono font-medium">{pr.handshake.key_exchange_group}</span> — a post-quantum hybrid key exchange.
                          This connection is protected against quantum computing attacks.
                        </p>
                      </div>
                    </div>
                  ) : pr.quantum_ready ? (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-700">TLS 1.3 Capable</p>
                        <p className="text-xs text-muted-foreground">
                          Supports TLS 1.3, which enables PQC key exchange.
                          {pr.handshake?.key_exchange_group
                            ? ` Currently negotiating ${pr.handshake.key_exchange_group} (classical). PQC requires server-side OpenSSL 3.5+ with ML-KEM support.`
                            : " PQC will activate when the server's OpenSSL supports ML-KEM groups."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ShieldX className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-sm font-medium text-red-600">Not Quantum Ready</p>
                        <p className="text-xs text-muted-foreground">
                          No TLS 1.3 support detected. TLS 1.2 and below cannot negotiate PQC key exchange.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pod Info */}
            {pod && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pod</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <ResourceLink kind="Pod" name={pod.Name} namespace={pod.Namespace} compact />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Namespace</span>
                    <span>{pod.Namespace}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Image</span>
                    <span className="font-mono text-[10px] truncate max-w-[250px]">{pod.Image}</span>
                  </div>
                  {ipResult.node && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Node</span>
                      <span className="font-mono text-[10px]">{ipResult.node}</span>
                    </div>
                  )}
                  {pr.container_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        <FieldLabel term="ContainerID">Container ID</FieldLabel>
                      </span>
                      <span className="font-mono text-[10px] truncate max-w-[250px]">{pr.container_id}</span>
                    </div>
                  )}
                  {pod.Containers && pod.Containers.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Containers</span>
                      <span>{pod.Containers.join(", ")}</span>
                    </div>
                  )}
                  {pr.container_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Listening Container</span>
                      <span className="font-medium">{pr.container_name}</span>
                    </div>
                  )}
                  {pr.process_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Process</span>
                      <span className="font-mono">{pr.process_name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Node info if no pod */}
            {!pod && ipResult.node && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Node</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Node Name</span>
                    <span className="font-mono">{ipResult.node}</span>
                  </div>
                  {pr.container_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        <FieldLabel term="ContainerID">Container ID</FieldLabel>
                      </span>
                      <span className="font-mono text-[10px] truncate max-w-[250px]">{pr.container_id}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* OpenShift Component */}
            {comp && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">OpenShift Component</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Component</span>
                    <span>{comp.component}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Maintainer</span>
                    <span>{comp.maintainer_component}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Listen Address */}
            {pr.listen_address && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    <FieldLabel term="ListenAddress">Listen Address</FieldLabel>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="font-mono text-xs">{pr.listen_address}</span>
                </CardContent>
              </Card>
            )}

            {/* TLS Details */}
            {pr.tls_versions && pr.tls_versions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    <FieldLabel term="TLSVersion">TLS Versions</FieldLabel>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {pr.tls_versions.map((v) => (
                      <Badge
                        key={v}
                        variant="outline"
                        className={`text-xs font-mono ${
                          v.includes("1.3")
                            ? "bg-green-500/10 text-green-700"
                            : v.includes("1.2")
                              ? "bg-blue-500/10 text-blue-700"
                              : "bg-yellow-500/10 text-yellow-700"
                        }`}
                      >
                        {v}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ciphers */}
            {pr.tls_ciphers && pr.tls_ciphers.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    <FieldLabel term="TLSCipher">
                      Cipher Suites ({pr.tls_ciphers.length})
                    </FieldLabel>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {pr.tls_ciphers.map((cipher) => {
                      const grade = pr.tls_cipher_strength?.[cipher] || "?";
                      const isT13 = grade === "A" && cipher.startsWith("TLS_");
                      return (
                        <div
                          key={cipher}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="font-mono truncate mr-2 flex items-center gap-1">
                            {cipher}
                            {isT13 && (
                              <span title="TLS 1.3 - Quantum capable">
                                <Atom className="h-3 w-3 text-green-600 shrink-0" />
                              </span>
                            )}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${strengthColor[grade] || ""}`}
                          >
                            {grade}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Compliance */}
            {(pr.ingress_tls_config_compliance ||
              pr.api_server_tls_config_compliance ||
              pr.kubelet_tls_config_compliance) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    <FieldLabel term="TLSProfile">TLS Config Compliance</FieldLabel>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <ComplianceBadge label="Ingress" result={pr.ingress_tls_config_compliance} />
                  <ComplianceBadge label="API Server" result={pr.api_server_tls_config_compliance} />
                  <ComplianceBadge label="Kubelet" result={pr.kubelet_tls_config_compliance} />
                </CardContent>
              </Card>
            )}

            {/* Error */}
            {pr.error && (
              <Card className="border-destructive/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Error
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs font-mono whitespace-pre-wrap text-destructive/80">
                    {pr.error}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
