import { UserModel } from '../user/user.schema';
import { TeamModel } from './team.schema';
import { OrgSnapshotModel } from './org-snapshot.schema';
import { writeAuditLog } from '../audit/audit.repo';

// ─── Utilities ────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Walk up the ancestor chain of `targetUserId` to check if `userId` exists. */
async function wouldCreateCycle(userId: string, reportingToId: string): Promise<boolean> {
    let current = reportingToId;
    const visited = new Set<string>();
    while (current) {
        if (current === userId) return true;
        if (visited.has(current)) break; // cycle in existing data — break
        visited.add(current);
        const u = await UserModel.findById(current).select('reportingTo').lean();
        if (!u || !u.reportingTo) break;
        current = String(u.reportingTo);
    }
    return false;
}

/** Recursively build a tree from flat members array */
function buildTree(members: any[], parentId: string | null): any[] {
    return members
        .filter((m) => String(m.reportingTo?._id ?? m.reportingTo ?? null) === String(parentId))
        .map((m) => ({ ...m, children: buildTree(members, String(m._id)) }));
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export const listTeams = async (organisationId: string) => {
    const teams = await TeamModel.find({ organisationId })
        .populate('leadId', 'name role avatarUrl')
        .populate('parentTeamId', 'name color')
        .lean();

    // Attach member counts
    const withCounts = await Promise.all(
        teams.map(async (t) => {
            const memberCount = await UserModel.countDocuments({ teamId: t._id, isDeleted: false, isActive: true });
            return { ...t, memberCount };
        }),
    );
    return { statusCode: 200, message: 'TEAMS FETCHED', data: withCounts };
};

export const createTeam = async (body: { name: string; description?: string; color?: string; icon?: string; leadId?: string; parentTeamId?: string }, currentUser: any) => {
    const slug = toSlug(body.name);
    const existing = await TeamModel.findOne({ organisationId: currentUser.organisationId, slug });
    if (existing) throw { statusCode: 409, message: 'A team with this name already exists' };

    const team = await TeamModel.create({
        organisationId: currentUser.organisationId,
        name: body.name, slug,
        description: body.description,
        color: body.color ?? '#0052CC',
        icon: body.icon,
        leadId: body.leadId || null,
        parentTeamId: body.parentTeamId || null,
        createdBy: currentUser._id,
    });

    await writeAuditLog({ actorId: String(currentUser._id), action: 'team.create', targetType: 'Team', targetId: String(team._id), organisationId: String(currentUser.organisationId), meta: { name: body.name } });
    return { statusCode: 201, message: 'TEAM CREATED', data: team };
};

export const updateTeam = async (teamId: string, body: { name?: string; description?: string; color?: string; icon?: string; leadId?: string; parentTeamId?: string }, currentUser: any) => {
    const team = await TeamModel.findById(teamId).lean();
    if (!team) throw { statusCode: 404, message: 'TEAM NOT FOUND' };

    const patch: Record<string, any> = {};
    if (body.name        !== undefined) { patch.name = body.name; patch.slug = toSlug(body.name); }
    if (body.description !== undefined) patch.description = body.description;
    if (body.color       !== undefined) patch.color = body.color;
    if (body.icon        !== undefined) patch.icon  = body.icon;
    if (body.leadId      !== undefined) patch.leadId = body.leadId || null;
    if (body.parentTeamId !== undefined) patch.parentTeamId = body.parentTeamId || null;

    const leadChanged = body.leadId !== undefined && String(team.leadId ?? '') !== String(body.leadId ?? '');

    const updated = await TeamModel.findByIdAndUpdate(teamId, { $set: patch }, { new: true }).lean();
    const action = leadChanged ? 'team.lead_changed' : 'team.update';
    await writeAuditLog({ actorId: String(currentUser._id), action, targetType: 'Team', targetId: teamId, organisationId: String(currentUser.organisationId), meta: patch });
    return { statusCode: 200, message: 'TEAM UPDATED', data: updated };
};

export const deleteTeam = async (teamId: string, currentUser: any) => {
    // Check for sub-teams
    const subTeams = await TeamModel.countDocuments({ parentTeamId: teamId });
    if (subTeams > 0) throw { statusCode: 409, message: 'Remove or reassign sub-teams before deleting this team' };

    await TeamModel.findByIdAndDelete(teamId);
    // Clear teamId on members
    await UserModel.updateMany({ teamId }, { $set: { teamId: null } });

    await writeAuditLog({ actorId: String(currentUser._id), action: 'team.delete', targetType: 'Team', targetId: teamId, organisationId: String(currentUser.organisationId), meta: {} });
    return { statusCode: 200, message: 'TEAM DELETED', data: null };
};

// ─── Org Chart ────────────────────────────────────────────────────────────────

export const getOrgChart = async (organisationId: string) => {
    const allMembers = await UserModel.find({ organisationId, isDeleted: false })
        .populate('teamId', 'name color')
        .select('name role jobTitle department avatarUrl reportingTo teamId isOrgRoot isActive')
        .lean();

    // Roots: isOrgRoot=true, OR fallback to those with no reportingTo
    const hasExplicitRoot = allMembers.some((m) => m.isOrgRoot);
    const roots = allMembers.filter((m) =>
        hasExplicitRoot ? m.isOrgRoot : !m.reportingTo,
    );

    const rootIds = new Set(roots.map((r) => String(r._id)));
    const unassigned = allMembers.filter(
        (m) => !m.isOrgRoot && !m.reportingTo && !rootIds.has(String(m._id)),
    );

    const tree = roots.map((root) => ({
        ...root,
        children: buildTree(allMembers, String(root._id)),
    }));

    return { statusCode: 200, message: 'ORG CHART FETCHED', data: { roots: tree, unassigned } };
};

// ─── Reporting relationships ──────────────────────────────────────────────────

export const updateReporting = async (
    userId: string,
    body: { reportingTo?: string | null; teamId?: string | null; isOrgRoot?: boolean },
    currentUser: any,
) => {
    const user = await UserModel.findById(userId);
    if (!user) throw { statusCode: 404, message: 'USER NOT FOUND' };

    const prev = { reportingTo: String(user.reportingTo ?? ''), teamId: String(user.teamId ?? ''), isOrgRoot: user.isOrgRoot };

    // Circular chain check
    if (body.reportingTo) {
        const hasCycle = await wouldCreateCycle(userId, body.reportingTo);
        if (hasCycle) throw { statusCode: 409, message: 'This would create a circular reporting chain.' };
    }

    // Single root enforcement
    if (body.isOrgRoot) {
        await UserModel.updateMany(
            { organisationId: user.organisationId, isOrgRoot: true, _id: { $ne: userId } },
            { $set: { isOrgRoot: false } },
        );
    }

    if (body.reportingTo !== undefined) user.reportingTo = body.reportingTo || null;
    if (body.teamId      !== undefined) user.teamId      = body.teamId || null;
    if (body.isOrgRoot   !== undefined) user.isOrgRoot   = body.isOrgRoot;
    await user.save();

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'member.reporting_changed',
        targetType: 'User',
        targetId: userId,
        organisationId: String(currentUser.organisationId),
        meta: { previous: prev, updated: { reportingTo: body.reportingTo, teamId: body.teamId, isOrgRoot: body.isOrgRoot } },
    });
    if (body.teamId !== undefined) {
        await writeAuditLog({ actorId: String(currentUser._id), action: 'member.team_assigned', targetType: 'User', targetId: userId, organisationId: String(currentUser.organisationId), meta: { teamId: body.teamId } });
    }

    return { statusCode: 200, message: 'REPORTING UPDATED', data: user };
};

export const bulkAssign = async (
    assignments: { userId: string; reportingTo?: string; teamId?: string }[],
    currentUser: any,
) => {
    let updated = 0;
    const errors: string[] = [];
    for (const a of assignments) {
        try {
            if (a.reportingTo) {
                const cycle = await wouldCreateCycle(a.userId, a.reportingTo);
                if (cycle) { errors.push(`${a.userId}: circular chain`); continue; }
            }
            await UserModel.findByIdAndUpdate(a.userId, {
                $set: {
                    ...(a.reportingTo !== undefined ? { reportingTo: a.reportingTo || null } : {}),
                    ...(a.teamId      !== undefined ? { teamId:      a.teamId || null }      : {}),
                },
            });
            updated++;
        } catch (e: any) {
            errors.push(`${a.userId}: ${e.message}`);
        }
    }
    return { statusCode: 200, message: 'BULK ASSIGN COMPLETE', data: { updated, errors } };
};

export const getReportingChain = async (userId: string) => {
    const chain: any[] = [];
    let current = userId;
    const visited = new Set<string>();
    while (current) {
        const u: any = await UserModel.findById(current).select('name role jobTitle reportingTo').lean();
        if (!u || visited.has(String(u._id))) break;
        visited.add(String(u._id));
        if (String(u._id) !== userId) chain.push({ _id: u._id, name: u.name, role: u.role, jobTitle: u.jobTitle });
        if (!u.reportingTo) break;
        current = String(u.reportingTo);
    }
    return { statusCode: 200, message: 'CHAIN FETCHED', data: { chain } };
};

// ─── Snapshots ────────────────────────────────────────────────────────────────

export const saveSnapshot = async (label: string, organisationId: string, currentUser: any) => {
    const { data: chart } = await getOrgChart(organisationId);
    const snap = await OrgSnapshotModel.create({
        organisationId,
        label,
        snapshot: chart,
        createdBy: currentUser._id,
    });
    await writeAuditLog({ actorId: String(currentUser._id), action: 'org.snapshot_saved', organisationId, meta: { label } });
    return { statusCode: 201, message: 'SNAPSHOT SAVED', data: snap };
};

export const listSnapshots = async (organisationId: string) => {
    const snaps = await OrgSnapshotModel.find({ organisationId })
        .populate('createdBy', 'name role')
        .sort({ createdAt: -1 })
        .select('-snapshot')
        .lean();
    return { statusCode: 200, message: 'SNAPSHOTS FETCHED', data: snaps };
};

export default { listTeams, createTeam, updateTeam, deleteTeam, getOrgChart, updateReporting, bulkAssign, getReportingChain, saveSnapshot, listSnapshots };
