'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { VaultRole } from '@/lib/constants';

interface OrgTreeNode {
    _id: string;
    name: string;
    role: VaultRole;
    jobTitle?: string;
    department?: string;
    email?: string;
    avatarUrl?: string;
    projectCount?: number;
    children: OrgTreeNode[];
}

interface Props {
    node: OrgTreeNode;
    onSelect: (node: OrgTreeNode) => void;
    depth?: number;
}

export function OrgNode({ node, onSelect, depth = 0 }: Props) {
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className={`org-node${depth > 0 ? ' org-node--child' : ''}`}>
            {/* Node card */}
            <div
                className="org-node__card"
                onClick={() => onSelect(node)}
                title={`${node.email ?? ''}${node.department ? ' · ' + node.department : ''}`}
            >
                <Avatar name={node.name} src={node.avatarUrl} size="sm" />
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.name}
                    </p>
                    {node.jobTitle && (
                        <p style={{ fontSize: 10, color: 'var(--vault-ink-muted)', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {node.jobTitle}
                        </p>
                    )}
                </div>
                <Badge role={node.role} />
            </div>

            {/* Children */}
            {hasChildren && (
                <div className="org-children">
                    {node.children.map((child) => (
                        <OrgNode key={child._id} node={child} onSelect={onSelect} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}
