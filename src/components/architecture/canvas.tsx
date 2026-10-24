"use client";

import "@xyflow/react/dist/style.css";
import {
  BaseEdge,
  Background,
  type Edge,
  type EdgeProps,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  type Node,
  type NodeProps,
  NodeToolbar,
  Position,
  ReactFlow,
  useReactFlow,
} from "@xyflow/react";
import { createContext, memo, useContext, useEffect, useMemo } from "react";
import { EDGES, LANES, type ArchNode, type LaneId, NODES } from "@/lib/architecture";
import { cn } from "@/lib/utils";
import { NodeLogo } from "./node-logo";

// Fixed layout: five lanes left to right, Data & email along the bottom. Positions are hand-placed so the story
// reads left to right (people → app → agent → AI → PayPal) the way the journeys travel.
const LANE_W = 280;
const GUTTER = 70;
const LANE_X: Record<Exclude<LaneId, "data">, number> = { people: 0, web: LANE_W + GUTTER, agent: 2 * (LANE_W + GUTTER), ai: 3 * (LANE_W + GUTTER), paypal: 4 * (LANE_W + GUTTER) };
const NODE_W = 244;
const ROW = (r: number) => 84 + r * 104;
const LANE_H = ROW(5) + 4;
const DATA_Y = LANE_H + 44;
// Rows are chosen so straight lines run through empty rows: Ask → OpenAI along row 1, Reports → caps along row 2.
const SLOT: Record<string, [number, number]> = {
  tunde: [0, 0], donor: [0, 4],
  app: [0, 0], ask: [0, 1], reports: [0, 2], webhook: [0, 3],
  runfix: [0, 0], diagnose: [0, 3], note: [0, 4],
  openai: [0, 1], caps: [0, 2], fixfilter: [0, 3],
  subscriptions: [0, 0], events: [0, 4],
};
const DATA_X: Record<string, number> = { neon: LANE_X.web + 18, resend: LANE_X.agent + 18 };
// Lines that would cut through cards leave by a side and run down the gutter instead.
const ROUTE: Record<string, { sourceHandle: string; targetHandle: string }> = {
  "app-neon": { sourceHandle: "s-Left", targetHandle: "t-Left" },
  "ask-neon": { sourceHandle: "s-Left", targetHandle: "t-Left" },
  "webhook-neon": { sourceHandle: "s-Left", targetHandle: "t-Left" },
  "diagnose-neon": { sourceHandle: "s-Left", targetHandle: "t-Right" },
  "runfix-neon": { sourceHandle: "s-Left", targetHandle: "t-Right" },
  "runfix-note": { sourceHandle: "s-Right", targetHandle: "t-Right" },
  "resend-donor": { sourceHandle: "s-Top", targetHandle: "t-Right" },
  "events-webhook": { sourceHandle: "s-Bottom", targetHandle: "t-Bottom" },
  "donor-subs": { sourceHandle: "s-Top", targetHandle: "t-Top" },
  "diagnose-subs": { sourceHandle: "s-Bottom", targetHandle: "t-Bottom" },
  "tunde-reports": { sourceHandle: "s-Bottom", targetHandle: "t-Left" },
  "tunde-ask": { sourceHandle: "s-Bottom", targetHandle: "t-Left" },
};

export function position(n: ArchNode) {
  if (n.lane === "data") return { x: DATA_X[n.id], y: DATA_Y + 58 };
  return { x: LANE_X[n.lane] + (LANE_W - NODE_W) / 2, y: ROW(SLOT[n.id][1]) };
}

export type Look = "normal" | "lit" | "dim" | "visited";
export type CanvasState = {
  looks: Record<string, Look>;
  edgeLooks: Record<string, "normal" | "active" | "dim">;
  badges: Record<string, string>;
  call: { node: string; text: string } | null;
  selected: string | null;
};

const Pick = createContext<(id: string) => void>(() => {});

type ArchNodeData = { node: ArchNode; look: Look; badge?: string; call?: { text: string }; selected: boolean };
type LaneData = { title: string; blurb: string; count: number; width: number; height: number };

const ArchCard = memo(function ArchCard({ data }: NodeProps<Node<ArchNodeData>>) {
  const { node, look, badge, call, selected } = data;
  const pick = useContext(Pick);
  return (
    <>
      {(["Left", "Right", "Top", "Bottom"] as const).map((side) => (
        <span key={side}>
          <Handle id={`s-${side}`} type="source" position={Position[side]} className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
          <Handle id={`t-${side}`} type="target" position={Position[side]} className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
        </span>
      ))}
      <NodeToolbar isVisible={!!call} position={Position.Top} offset={10}>
        {call ? (
          <div className="flex max-w-[22rem] items-center gap-2.5 rounded-lg border bg-surface px-3 py-2 font-mono text-[0.72rem] shadow-soft">
            <span className="text-pretty">{call.text}</span>
          </div>
        ) : null}
      </NodeToolbar>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          pick(node.id);
        }}
        aria-label={`${node.title}: open details`}
        className={cn(
          "nodrag nopan flex w-[244px] cursor-pointer items-center gap-3 rounded-[10px] border bg-surface px-3 py-2.5 text-left shadow-soft transition-[opacity,box-shadow,border-color] duration-300 hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-focus",
          look === "dim" && "opacity-30",
          look === "lit" && "border-ink shadow-[0_0_0_3px_var(--paper-deep)]",
          look === "visited" && "border-ink/30",
          selected && "border-ink shadow-[0_0_0_3px_var(--paper-deep)]",
        )}
      >
        <NodeLogo logo={node.logo} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[0.85rem] font-semibold text-ink">
            <span className="truncate">{node.title}</span>
          </span>
          <span className="block truncate font-mono text-[0.68rem] text-muted-foreground">{node.sub}</span>
        </span>
      </button>
      {badge ? (
        <div className="mt-1.5 w-[244px] rounded-md border border-recovered/30 bg-recovered-tint px-2.5 py-1 text-[0.7rem] font-medium text-recovered">{badge}</div>
      ) : null}
    </>
  );
});

function LaneBox({ data }: NodeProps<Node<LaneData>>) {
  return (
    <div className="rounded-[14px] border border-line bg-paper-deep/60" style={{ width: data.width, height: data.height }}>
      <div className="flex items-start justify-between px-4 pt-3.5">
        <div>
          <p className="text-[0.9rem] font-semibold text-ink">{data.title}</p>
          <p className="text-[0.7rem] text-muted-foreground">{data.blurb}</p>
        </div>
        <span className="rounded-md border bg-surface px-1.5 font-mono text-[0.68rem] text-muted-foreground">{data.count}</span>
      </div>
    </div>
  );
}

type ArchEdgeData = { label: string; look: "normal" | "active" | "dim"; kind?: "flow" | "event" | "gate" };

function ArchLine({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<Edge<ArchEdgeData>>) {
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 14 });
  const look = data?.look ?? "normal";
  const gate = data?.kind === "gate";
  // Events from outside Lifeline only appear when a journey or a hovered part uses them.
  if (data?.kind === "event" && look !== "active") return null;
  const color = look === "active" ? "var(--ink)" : gate ? "var(--caution)" : "#9aa1a9";
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={`url(#arrow-${look === "active" ? "active" : gate ? "gate" : "normal"})`}
        style={{ stroke: color, strokeWidth: look === "active" ? 2.2 : 1.3, strokeDasharray: data?.kind === "event" && look !== "active" ? "5 4" : undefined, opacity: look === "dim" ? 0.18 : 1, transition: "opacity 300ms, stroke 300ms" }}
      />
      {look === "active" ? (
        <circle r="5" fill="var(--brand)" stroke="white" strokeWidth="2">
          <animateMotion dur="1.6s" repeatCount="indefinite" path={path} />
        </circle>
      ) : null}
      {look === "active" || gate ? (
      <EdgeLabelRenderer>
        <div
          className={cn(
            "nodrag nopan pointer-events-none absolute rounded-full border px-2 py-0.5 text-[0.66rem] whitespace-nowrap transition-opacity duration-300",
            look === "active" ? "border-ink/20 bg-surface font-medium text-ink" : gate ? "border-caution/40 bg-caution-tint text-caution" : "bg-surface text-muted-foreground",
            look === "dim" && "opacity-20",
          )}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {data?.label}
        </div>
      </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const nodeTypes = { arch: ArchCard, lane: LaneBox };
/** Room for the playback bar along the bottom. */
export const FIT = { padding: { top: "28px", right: "28px", bottom: "110px", left: "28px" } } as const;
const edgeTypes = { arch: ArchLine };

/** Picks the sides an edge leaves and enters by, from where its two ends sit. */
function sides(from: ArchNode, to: ArchNode) {
  const a = position(from);
  const b = position(to);
  if (to.lane === "data" && from.lane !== "data") return { sourceHandle: "s-Bottom", targetHandle: "t-Top" };
  if (Math.abs(a.x - b.x) < 40) return a.y < b.y ? { sourceHandle: "s-Bottom", targetHandle: "t-Top" } : { sourceHandle: "s-Top", targetHandle: "t-Bottom" };
  return a.x < b.x ? { sourceHandle: "s-Right", targetHandle: "t-Left" } : { sourceHandle: "s-Left", targetHandle: "t-Right" };
}

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

/** Re-fits the map whenever the space around it changes (a side panel opening or closing). */
function AutoFit({ layout }: { layout: string }) {
  const flow = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => flow.fitView({ ...FIT, duration: 300 }), 240);
    return () => clearTimeout(t);
  }, [layout, flow]);
  return null;
}

export function ArchCanvas({ state, layout, onSelect, onHover }: { state: CanvasState; layout: string; onSelect: (id: string | null) => void; onHover: (id: string | null) => void }) {
  const nodes = useMemo<Node[]>(() => {
    const lanes: Node[] = LANES.map((l) => {
      const count = NODES.filter((n) => n.lane === l.id).length;
      const box = l.id === "data" ? { x: LANE_X.web, y: DATA_Y, width: LANE_X.paypal + LANE_W - LANE_X.web, height: 150 } : { x: LANE_X[l.id], y: 0, width: LANE_W, height: LANE_H };
      return { id: `lane-${l.id}`, type: "lane", position: { x: box.x, y: box.y }, data: { title: l.title, blurb: l.blurb, count, width: box.width, height: box.height }, draggable: false, selectable: false, focusable: false, zIndex: -1 };
    });
    const cards: Node[] = NODES.map((n) => ({
      id: n.id,
      type: "arch",
      position: position(n),
      draggable: false,
      data: { node: n, look: state.looks[n.id] ?? "normal", badge: state.badges[n.id], call: state.call?.node === n.id ? { text: state.call.text } : undefined, selected: state.selected === n.id },
    }));
    return [...lanes, ...cards];
  }, [state]);

  const edges = useMemo<Edge[]>(
    () => EDGES.map((e) => ({ id: e.id, source: e.from, target: e.to, type: "arch", ...(ROUTE[e.id] ?? sides(byId[e.from], byId[e.to])), data: { label: e.label, look: state.edgeLooks[e.id] ?? "normal", kind: e.kind } })),
    [state],
  );

  return (
    <Pick.Provider value={onSelect}>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={FIT}
      minZoom={0.35}
      maxZoom={1.8}
      nodesConnectable={false}
      nodesDraggable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      onPaneClick={() => onSelect(null)}
      onNodeMouseEnter={(_, n) => n.type === "arch" && onHover(n.id)}
      onNodeMouseLeave={() => onHover(null)}
      className="bg-paper"
    >
      <svg aria-hidden className="absolute size-0">
        <defs>
          {[["normal", "#9aa1a9"], ["active", "var(--ink)"], ["gate", "var(--caution)"]].map(([k, c]) => (
            <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={c} />
            </marker>
          ))}
        </defs>
      </svg>
      <Background gap={22} size={1.2} color="#e2dbd0" />
      <AutoFit layout={layout} />
    </ReactFlow>
    </Pick.Provider>
  );
}
