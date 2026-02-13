"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FieldLabel } from "@/components/shared/field-label";
import type { TLSSecurityProfile } from "@/types";

interface TLSConfigPanelProps {
  config: TLSSecurityProfile;
}

function ProfileSection({
  title,
  profileType,
  minTLS,
  ciphers,
}: {
  title: string;
  profileType?: string;
  minTLS?: string;
  ciphers?: string[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            <FieldLabel term="TLSProfile">Profile Type</FieldLabel>
          </span>
          <Badge variant="outline" className="font-mono text-xs">
            {profileType || "Not set"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            <FieldLabel term="TLSVersion">Min TLS Version</FieldLabel>
          </span>
          <Badge
            variant="outline"
            className={`font-mono text-xs ${
              minTLS?.includes("1.3")
                ? "bg-green-500/10 text-green-700"
                : minTLS?.includes("1.2")
                  ? "bg-blue-500/10 text-blue-700"
                  : "bg-yellow-500/10 text-yellow-700"
            }`}
          >
            {minTLS || "Default"}
          </Badge>
        </div>
        {ciphers && ciphers.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground block mb-1">
              <FieldLabel term="TLSCipher">
                Allowed Ciphers ({ciphers.length})
              </FieldLabel>
            </span>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {ciphers.map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px] font-mono">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TLSConfigPanel({ config }: TLSConfigPanelProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">
        <FieldLabel term="TLSProfile">Cluster TLS Security Configuration</FieldLabel>
      </h3>
      <div className="grid gap-4 md:grid-cols-3">
        <ProfileSection
          title="Ingress Controller"
          profileType={config.ingress_controller?.type}
          minTLS={config.ingress_controller?.min_tls_version}
          ciphers={config.ingress_controller?.ciphers}
        />
        <ProfileSection
          title="API Server"
          profileType={config.api_server?.type}
          minTLS={config.api_server?.min_tls_version}
          ciphers={config.api_server?.ciphers}
        />
        <ProfileSection
          title="Kubelet"
          profileType={undefined}
          minTLS={config.kubelet_config?.tls_min_version}
          ciphers={config.kubelet_config?.tls_cipher_suites}
        />
      </div>
    </div>
  );
}
