"use client";

import { ResourceDetailSheet } from "@/components/shared/resource-detail-sheet";
import { ResourceLink } from "@/components/shared/resource-link";
import { Badge } from "@/components/ui/badge";
import type { SecretInfo } from "@/types";
import { FieldLabel } from "@/components/shared/field-label";
import { KeyRound, Clock, UserCheck, Box } from "lucide-react";

interface SecretDetailProps {
  secret: SecretInfo | null;
  onClose: () => void;
}

function daysSince(timestamp?: string): number | null {
  if (!timestamp) return null;
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24));
}

export function SecretDetail({ secret, onClose }: SecretDetailProps) {
  if (!secret) return null;

  const days = daysSince(secret.creationTimestamp);
  const aiContext = `Type: ${secret.type}, Keys: ${secret.keys.join(", ") || "none"}, Linked SAs: ${secret.linkedServiceAccounts.join(", ") || "none"}, Linked Pods: ${secret.linkedPods.join(", ") || "none"}`;

  return (
    <ResourceDetailSheet
      open={!!secret}
      onClose={onClose}
      title={secret.name}
      kind="Secret"
      namespace={secret.namespace}
      aiContext={aiContext}
    >
      {/* Type */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5"><FieldLabel term="SecretType">Type</FieldLabel></h4>
        <Badge variant="outline" className="text-xs">{secret.type}</Badge>
      </div>

      {/* Keys */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <KeyRound className="h-3 w-3" /> <FieldLabel term="SecretKeys">Keys</FieldLabel>
        </h4>
        {secret.keys.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {secret.keys.map((k) => (
              <Badge key={k} variant="outline" className="text-[10px] font-mono">{k}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No keys (empty secret)</p>
        )}
      </div>

      {/* Age */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <Clock className="h-3 w-3" /> Age
        </h4>
        <p className="text-xs">
          {days !== null ? `${days} days` : "Unknown"}
          {secret.creationTimestamp && (
            <span className="text-muted-foreground ml-2">
              (created {new Date(secret.creationTimestamp).toLocaleDateString()})
            </span>
          )}
          {days !== null && days > 365 && (
            <Badge variant="outline" className="text-[9px] ml-2 text-yellow-600 border-yellow-500/30">Older than 1 year</Badge>
          )}
        </p>
      </div>

      {/* Linked Service Accounts */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <UserCheck className="h-3 w-3" /> Linked Service Accounts
        </h4>
        {secret.linkedServiceAccounts.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {secret.linkedServiceAccounts.map((sa) => (
              <ResourceLink key={sa} kind="ServiceAccount" name={sa} namespace={secret.namespace} compact />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">None</p>
        )}
      </div>

      {/* Linked Pods */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <Box className="h-3 w-3" /> Linked Pods
        </h4>
        {secret.linkedPods.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {secret.linkedPods.map((pod) => (
              <ResourceLink key={pod} kind="Pod" name={pod} namespace={secret.namespace} compact />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">None</p>
        )}
      </div>

      {/* Labels */}
      {secret.labels && Object.keys(secret.labels).length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Labels</h4>
          <div className="flex flex-wrap gap-1">
            {Object.entries(secret.labels).map(([k, v]) => (
              <Badge key={k} variant="outline" className="text-[9px] font-mono">{k}={v}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="p-2.5 rounded-md bg-muted/50 border text-[10px] text-muted-foreground">
        For security, secret values are never displayed or transmitted to the browser.
      </div>
    </ResourceDetailSheet>
  );
}
