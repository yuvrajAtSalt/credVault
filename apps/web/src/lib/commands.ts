export interface CommandItem {
    id: string;
    label: string;
    icon?: string;
    route?: string;
    action?: () => void;
    requireRole?: string[];
    permissionKey?: string;
}

export const staticCommands: CommandItem[] = [
    { id: 'go-dashboard', label: 'Go to Dashboard', icon: '🏠', route: '/dashboard' },
    { id: 'go-projects', label: 'Go to Projects', icon: '📁', route: '/projects' },
    { id: 'new-project', label: 'Create New Project', icon: '➕', route: '/projects/new', permissionKey: 'canCreateProject' },
    { id: 'go-settings', label: 'Go to Settings', icon: '⚙️', route: '/settings/general', requireRole: ['SYSADMIN', 'MANAGER'] },
    { id: 'go-users', label: 'Manage Users', icon: '👥', route: '/settings/users', requireRole: ['SYSADMIN', 'MANAGER'] },
    { id: 'new-user', label: 'Invite User', icon: '👤', route: '/settings/users?action=new', requireRole: ['SYSADMIN', 'MANAGER'] },
    { id: 'go-teams', label: 'Manage Teams', icon: '🏢', route: '/settings/teams', requireRole: ['SYSADMIN', 'MANAGER'] },
    { id: 'go-audit', label: 'Audit Logs', icon: '📄', route: '/settings/audit', requireRole: ['SYSADMIN'] },
    { id: 'go-profile', label: 'My Profile', icon: '🧑', route: '/settings/profile' },
];
