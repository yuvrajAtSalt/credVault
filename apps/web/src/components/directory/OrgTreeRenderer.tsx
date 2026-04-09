'use client';

import { useRef, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

interface OrgNodeData {
    _id: string;
    name: string;
    role: string;
    jobTitle?: string;
    department?: string;
    avatarUrl?: string;
    isOrgRoot?: boolean;
    teamId?: { name: string; color: string } | null;
    children: OrgNodeData[];
}

interface Props {
    roots: OrgNodeData[];
    unassigned?: OrgNodeData[];
    onSelect?: (node: OrgNodeData) => void;
    onReportingChange?: (userId: string, newManagerId: string) => void;
    editable?: boolean;
    highlightTeam?: string;    // team name to highlight
}

// ─── Single Node Card ─────────────────────────────────────────────────────────
function NodeCard({
    node, onSelect, editable, highlightTeam,
    dragging, onDragStart, onDragOver, onDrop,
}: {
    node: OrgNodeData;
    onSelect?: (n: OrgNodeData) => void;
    editable?: boolean;
    highlightTeam?: string;
    dragging: string | null;
    onDragStart: (id: string) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (targetId: string) => void;
}) {
    const teamColor = node.teamId?.color ?? '#DFE1E6';
    const isHighlighted = !highlightTeam || node.teamId?.name === highlightTeam;
    const isDraggingThis = dragging === node._id;

    return (
        <div
            draggable={editable}
            onDragStart={() => onDragStart(node._id)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(node._id)}
            onClick={() => onSelect?.(node)}
            style={{
                width: 164, minHeight: 88,
                background: '#fff',
                border: node.isOrgRoot ? '2px solid #0052CC' : '1px solid #DFE1E6',
                borderRadius: 8,
                padding: '10px 12px',
                cursor: editable ? 'grab' : 'pointer',
                boxShadow: isDraggingThis
                    ? '0 4px 12px rgba(0,82,204,0.2)'
                    : '0 1px 3px rgba(9,30,66,0.1)',
                opacity: !isHighlighted ? 0.35 : isDraggingThis ? 0.6 : 1,
                transition: 'box-shadow 120ms, opacity 200ms',
                position: 'relative',
                userSelect: 'none',
            }}
        >
            {node.isOrgRoot && (
                <span style={{ position: 'absolute', top: 5, right: 7, fontSize: 11 }} title="Org root">👑</span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Avatar name={node.name} src={node.avatarUrl} size="sm" />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#172B4D', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.name}
                    </p>
                    {node.jobTitle && (
                        <p style={{ fontSize: 10, color: '#5E6C84', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {node.jobTitle}
                        </p>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <Badge role={node.role as any} />
                {node.teamId && (
                    <span
                        title={node.teamId.name}
                        style={{ width: 8, height: 8, borderRadius: '50%', background: teamColor, flexShrink: 0 }}
                    />
                )}
            </div>
        </div>
    );
}

// ─── Tree level ───────────────────────────────────────────────────────────────
function TreeLevel({
    nodes, onSelect, editable, highlightTeam,
    dragging, onDragStart, onDragOver, onDrop, refs,
}: {
    nodes: OrgNodeData[];
    onSelect?: (n: OrgNodeData) => void;
    editable?: boolean;
    highlightTeam?: string;
    dragging: string | null;
    onDragStart: (id: string) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (targetId: string) => void;
    refs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
    return (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center', position: 'relative' }}>
            {nodes.map((node) => (
                <div
                    key={node._id}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}
                >
                    <div ref={(el) => { if (el) refs.current.set(node._id, el); }}>
                        <NodeCard
                            node={node}
                            onSelect={onSelect}
                            editable={editable}
                            highlightTeam={highlightTeam}
                            dragging={dragging}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                        />
                    </div>
                    {node.children.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 0 }}>
                            {/* Connector stem */}
                            <div style={{ width: 1, height: 24, background: '#DFE1E6' }} />
                            <TreeLevel
                                nodes={node.children}
                                onSelect={onSelect}
                                editable={editable}
                                highlightTeam={highlightTeam}
                                dragging={dragging}
                                onDragStart={onDragStart}
                                onDragOver={onDragOver}
                                onDrop={onDrop}
                                refs={refs}
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Main OrgTreeRenderer ─────────────────────────────────────────────────────
export function OrgTreeRenderer({ roots, unassigned = [], onSelect, onReportingChange, editable = false, highlightTeam }: Props) {
    const [scale, setScale]       = useState(1);
    const [dragging, setDragging] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [pendingDrop, setPending] = useState<{ from: string; to: string } | null>(null);
    const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const handleDragStart = (id: string) => setDragging(id);
    const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); };
    const handleDrop      = (targetId: string) => {
        if (!dragging || dragging === targetId) { setDragging(null); return; }
        setPending({ from: dragging, to: targetId });
        setDragging(null);
    };

    const confirmDrop = () => {
        if (pendingDrop && onReportingChange) onReportingChange(pendingDrop.from, pendingDrop.to);
        setPending(null);
    };

    const fromNode = pendingDrop ? findNode(roots, pendingDrop.from) : null;
    const toNode   = pendingDrop ? findNode(roots, pendingDrop.to)   : null;

    if (roots.length === 0) {
        return (
            <div style={{ padding: 48, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)' }}>
                    No org chart data yet. Set reporting relationships to build the tree.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Zoom controls */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
                <button onClick={() => setScale(s => Math.min(2, s + 0.15))} style={zoomBtn}>＋</button>
                <button onClick={() => setScale(s => Math.max(0.3, s - 0.15))} style={zoomBtn}>－</button>
                <button onClick={() => setScale(1)} style={{ ...zoomBtn, fontSize: 10 }}>Reset</button>
                <span style={{ fontSize: 11, color: 'var(--vault-ink-muted)', marginLeft: 4 }}>{Math.round(scale * 100)}%</span>
            </div>

            {/* Tree */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', paddingBottom: 32 }}>
                <div style={{ transformOrigin: 'top left', transform: `scale(${scale})`, transition: 'transform 200ms', display: 'inline-block', minWidth: '100%' }}>
                    <TreeLevel
                        nodes={roots}
                        onSelect={onSelect}
                        editable={editable}
                        highlightTeam={highlightTeam}
                        dragging={dragging}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        refs={nodeRefs}
                    />
                </div>
            </div>

            {/* Unassigned strip */}
            {unassigned.length > 0 && (
                <div style={{ marginTop: 32 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)', marginBottom: 10 }}>
                        Unassigned ({unassigned.length})
                    </p>
                    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '6px 0', flexWrap: 'wrap' }}>
                        {unassigned.map(u => (
                            <div
                                key={u._id}
                                draggable={editable}
                                onDragStart={() => handleDragStart(u._id)}
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(u._id)}
                                onClick={() => onSelect?.(u)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '6px 10px', background: 'var(--vault-surface)',
                                    border: '1px solid var(--vault-border)', borderRadius: 20,
                                    cursor: editable ? 'grab' : 'pointer', fontSize: 12,
                                    opacity: dragging === u._id ? 0.5 : 1,
                                }}
                            >
                                <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                                <span style={{ fontWeight: 600, color: 'var(--vault-ink)' }}>{u.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Drop confirmation */}
            {pendingDrop && (
                <div style={{
                    position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
                    background: '#172B4D', color: '#fff', padding: '14px 20px', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'flex', gap: 12, alignItems: 'center',
                    fontSize: 13, zIndex: 1000,
                }}>
                    <span>Move <strong>{fromNode?.name}</strong> to report to <strong>{toNode?.name}</strong>?</span>
                    <button
                        onClick={confirmDrop}
                        style={{ background: '#0052CC', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                        Confirm
                    </button>
                    <button
                        onClick={() => setPending(null)}
                        style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function findNode(nodes: OrgNodeData[], id: string): OrgNodeData | null {
    for (const n of nodes) {
        if (n._id === id) return n;
        const found = findNode(n.children, id);
        if (found) return found;
    }
    return null;
}

const zoomBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6,
    background: 'var(--vault-surface)', border: '1px solid var(--vault-border)',
    cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
