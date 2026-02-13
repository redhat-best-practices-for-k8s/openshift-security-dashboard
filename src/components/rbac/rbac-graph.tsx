"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RBACData } from "@/types";

const nodeColors: Record<string, string> = {
  User: "#3b82f6",
  Group: "#8b5cf6",
  ServiceAccount: "#14b8a6",
  Role: "#f59e0b",
  ClusterRole: "#ef4444",
};

function buildGraph(data: RBACData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeIds = new Set<string>();

  const addNode = (id: string, label: string, type: string, namespace?: string) => {
    if (nodeIds.has(id)) return;
    nodeIds.add(id);
    nodes.push({
      id,
      position: { x: 0, y: 0 },
      data: {
        label: (
          <div className="text-xs text-center">
            <div className="text-[10px] font-medium opacity-70">{type}</div>
            <div className="font-semibold">{label}</div>
            {namespace && <div className="text-[10px] opacity-50">{namespace}</div>}
          </div>
        ),
      },
      style: {
        background: `${nodeColors[type] || "#6b7280"}15`,
        border: `2px solid ${nodeColors[type] || "#6b7280"}`,
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
        minWidth: "100px",
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
  };

  // Process all bindings
  const allBindings = [...data.roleBindings, ...data.clusterRoleBindings];

  // Limit for readability
  const bindingsToShow = allBindings.slice(0, 50);

  bindingsToShow.forEach((binding, index) => {
    const roleId = `${binding.roleRef.kind}:${binding.roleRef.name}`;
    addNode(roleId, binding.roleRef.name, binding.roleRef.kind);

    binding.subjects.forEach((subject) => {
      const subjectId = `${subject.kind}:${subject.namespace || ""}:${subject.name}`;
      addNode(subjectId, subject.name, subject.kind, subject.namespace);

      edges.push({
        id: `${subjectId}->${binding.name}->${roleId}`,
        source: subjectId,
        target: roleId,
        label: binding.namespace || "cluster",
        style: { stroke: "#64748b", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        labelStyle: { fontSize: "9px", fill: "#94a3b8" },
      });
    });
  });

  // Auto-layout: subjects left, roles right
  const subjects = nodes.filter((n) => {
    const type = n.id.split(":")[0];
    return ["User", "Group", "ServiceAccount"].includes(type);
  });
  const roles = nodes.filter((n) => {
    const type = n.id.split(":")[0];
    return ["Role", "ClusterRole"].includes(type);
  });

  subjects.forEach((node, i) => {
    node.position = { x: 50, y: i * 80 };
  });
  roles.forEach((node, i) => {
    node.position = { x: 500, y: i * 80 };
  });

  return { nodes, edges };
}

interface RBACGraphProps {
  data: RBACData;
  onNodeClick?: (nodeId: string) => void;
}

export function RBACGraph({ data, onNodeClick }: RBACGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildGraph(data), [data]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  return (
    <div className="h-[600px] border rounded-lg overflow-hidden bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ animated: false }}
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          style={{ height: 100, width: 150 }}
        />
      </ReactFlow>
    </div>
  );
}
