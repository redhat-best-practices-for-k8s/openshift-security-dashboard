"use client";

import { ResourceDetailSheet } from "@/components/shared/resource-detail-sheet";
import { ResourceLink } from "@/components/shared/resource-link";
import { Badge } from "@/components/ui/badge";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import type { ServiceAccountInfo } from "@/types";
import { FieldLabel } from "@/components/shared/field-label";
import { Shield, KeyRound, Box, Clock, AlertTriangle, Lock } from "lucide-react";

interface ServiceAccountDetailProps {
  sa: ServiceAccountInfo | null;
  onClose: () => void;
}

export function ServiceAccountDetail({ sa, onClose }: ServiceAccountDetailProps) {
  const { addChange } = useChangesStore();

  if (!sa) return null;

  const isAdmin = sa.clusterRoles.includes("cluster-admin");
  const aiContext = `Namespace: ${sa.namespace}, Roles: ${sa.roles.join(", ") || "none"}, ClusterRoles: ${sa.clusterRoles.join(", ") || "none"}, SCCs: ${sa.sccs.join(", ") || "none"}, Secrets: ${sa.secrets.length}, Pods: ${sa.podCount}`;

  const handleDelete = () => {
    addChange({
      id: generateChangeId(),
      action: "delete",
      resourceKind: "ServiceAccount",
      resourceName: sa.name,
      namespace: sa.namespace,
      before: {},
      after: null,
      description: `Delete ServiceAccount "${sa.name}" from "${sa.namespace}"`,
    });
    onClose();
  };

  return (
    <ResourceDetailSheet
      open={!!sa}
      onClose={onClose}
      title={sa.name}
      kind="ServiceAccount"
      namespace={sa.namespace}
      onDelete={handleDelete}
      aiContext={aiContext}
    >
      {isAdmin && (
        <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-xs flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          This service account has cluster-admin privileges
        </div>
      )}

      {/* Roles */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <Shield className="h-3 w-3" /> <FieldLabel term="Role">Roles</FieldLabel>
        </h4>
        {sa.roles.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {sa.roles.map((r) => (
              <ResourceLink key={r} kind="Role" name={r} namespace={sa.namespace} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">None</p>
        )}
      </div>

      {/* Cluster Roles */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <Shield className="h-3 w-3" /> <FieldLabel term="ClusterRole">Cluster Roles</FieldLabel>
        </h4>
        {sa.clusterRoles.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {sa.clusterRoles.map((r) => (
              <ResourceLink key={r} kind="ClusterRole" name={r} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">None</p>
        )}
      </div>

      {/* Secrets */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <KeyRound className="h-3 w-3" /> Secrets
        </h4>
        {sa.secrets.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {sa.secrets.map((s) => (
              <ResourceLink key={s} kind="Secret" name={s} namespace={sa.namespace} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">None</p>
        )}
      </div>

      {/* Available SCCs */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <Lock className="h-3 w-3" /> <FieldLabel term="AvailableSCCs">Available SCCs</FieldLabel>
        </h4>
        {sa.sccs.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {sa.sccs.map((scc) => {
              const isDangerous = ["privileged", "anyuid", "hostaccess", "hostmount-anyuid", "hostnetwork"].includes(scc);
              return (
                <div key={scc} className={isDangerous ? "ring-1 ring-red-500/30 rounded" : ""}>
                  <ResourceLink kind="SCC" name={scc} compact />
                  {isDangerous && (
                    <span className="text-[9px] text-red-500 ml-0.5">!</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">None (not OpenShift or no SCC access)</p>
        )}
      </div>

      {/* Pod Count */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <Box className="h-3 w-3" /> Pods Using This Account
        </h4>
        <Badge variant="outline" className="text-xs">{sa.podCount} pod{sa.podCount !== 1 ? "s" : ""}</Badge>
      </div>

      {/* Image Pull Secrets */}
      {sa.imagePullSecrets.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1.5"><FieldLabel term="ImagePullSecrets">Image Pull Secrets</FieldLabel></h4>
          <div className="flex flex-wrap gap-1">
            {sa.imagePullSecrets.map((s) => (
              <ResourceLink key={s} kind="Secret" name={s} namespace={sa.namespace} />
            ))}
          </div>
        </div>
      )}

      {/* Created */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <Clock className="h-3 w-3" /> Created
        </h4>
        <p className="text-xs text-muted-foreground">
          {sa.creationTimestamp ? new Date(sa.creationTimestamp).toLocaleDateString() : "Unknown"}
        </p>
      </div>
    </ResourceDetailSheet>
  );
}
