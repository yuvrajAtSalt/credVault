import { Response } from 'express';

// For a multi-instance deployment, replace this map over to a Redis Pub/Sub implementation
const connections = new Map<string, Response>();

export function registerSSEConnection(userId: string, res: Response): void {
    connections.set(userId, res);
    
    res.on('close', () => {
        if (connections.get(userId) === res) {
            connections.delete(userId);
        }
    });
}

export function removeSSEConnection(userId: string): void {
    const res = connections.get(userId);
    if (res) {
        res.end();
        connections.delete(userId);
    }
}

export interface SSEEvent {
    type: 'notification_count' | 'new_notification' | 'credential_expiry_warning' | 'project_updated';
    data: any;
}

export function pushToUser(userId: string, event: SSEEvent): void {
    const res = connections.get(userId);
    if (res) {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    }
}

export function pushToMultipleUsers(userIds: string[], event: SSEEvent): void {
    userIds.forEach((id) => pushToUser(id, event));
}
