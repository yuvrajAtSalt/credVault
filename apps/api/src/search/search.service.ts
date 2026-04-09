import { ProjectModel } from '../project/project.schema';
import { UserModel } from '../user/user.schema';
import { CredentialModel } from '../credential/credential.schema';
import { EnvVariableModel } from '../env/envvariable.schema';
import { TeamModel } from '../org/team.schema';
import { resolvePermissionsSync } from '../utils/permissions';
import { EXECUTIVE_ROLES, ADMIN_ROLES } from '../utils/constants';

function canSeeAllProjects(role: string) {
    return [...EXECUTIVE_ROLES, ...ADMIN_ROLES].includes(role as any);
}

export const globalSearch = async (query: string, currentUser: any) => {
    if (!query || query.length < 2) return { statusCode: 200, message: 'Too short', data: [] };

    const orgId = String(currentUser.organisationId);
    const userId = String(currentUser._id);
    const role = currentUser.role;

    const [projects, users, credentials, envVars, teams] = await Promise.all([
        searchProjects(query, orgId, userId, role),
        searchUsers(query, orgId),
        searchCredentials(query, orgId, userId, role, currentUser),
        searchEnvVariables(query, orgId, userId, role),
        searchTeams(query, orgId),
    ]);

    const results = [
        ...projects.map(p => ({ type: 'project', id: p._id, title: p.name, subtitle: p.description, url: `/projects/${p._id}` })),
        ...users.map(u => ({ type: 'user', id: u._id, title: u.name, subtitle: u.email, url: `/settings/users` })),
        ... (credentials as any[]).map(c => ({ type: 'credential', id: c._id, title: c.label, subtitle: c.projectId?.name || 'Project', url: `/projects/${c.projectId?._id}` })),
        ... (envVars as any[]).map(e => ({ type: 'env', id: e._id, title: e.key, subtitle: e.projectId?.name || 'Project', url: `/projects/${e.projectId?._id}` })),
        ...teams.map(t => ({ type: 'team', id: t._id, title: t.name, subtitle: t.description, url: `/settings/teams` })),
    ];

    return {
        statusCode: 200,
        message: 'Search completed',
        data: results
    };
};

async function searchProjects(query: string, orgId: string, userId: string, role: string) {
    const filter: any = { organisationId: orgId, isDeleted: false, $text: { $search: query } };
    if (!canSeeAllProjects(role)) {
        filter['members.userId'] = userId;
    }
    return ProjectModel.find(filter).select('name description _id').limit(5).lean();
}

async function searchUsers(query: string, orgId: string) {
    return UserModel.find({ organisationId: orgId, isActive: true, $text: { $search: query } })
        .select('name email _id').limit(5).lean();
}

async function searchCredentials(query: string, orgId: string, userId: string, role: string, userDoc: any) {
    const permissions = resolvePermissionsSync(userDoc);
    
    let allowedProjectIds: string[] = [];
    if (!permissions.canSeeAllCredentials) {
        const myProjects = await ProjectModel.find({ 'members.userId': userId, organisationId: orgId, isDeleted: false }).select('_id').lean();
        allowedProjectIds = myProjects.map(p => String(p._id));
    }

    const filter: any = { 
        organisationId: orgId, 
        isDeleted: false, 
        $text: { $search: query } 
    };

    if (!permissions.canSeeAllCredentials && allowedProjectIds.length > 0) {
        filter.projectId = { $in: allowedProjectIds };
    } else if (!permissions.canSeeAllCredentials) {
        return [];
    }

    // Hide critical from regular contributors
    if (role !== 'SYSADMIN' && role !== 'MANAGER') { // Simplified check based on existing logic
         filter.sensitivityLevel = { $ne: 'critical' };
    }

    return CredentialModel.find(filter).populate('projectId', 'name _id').select('label projectId _id').limit(5).lean();
}

async function searchEnvVariables(query: string, orgId: string, userId: string, role: string) {
    let allowedProjectIds: string[] = [];
    if (!canSeeAllProjects(role)) {
        const myProjects = await ProjectModel.find({ 'members.userId': userId, organisationId: orgId, isDeleted: false }).select('_id').lean();
        allowedProjectIds = myProjects.map(p => String(p._id));
    }

    const filter: any = {
        organisationId: orgId,
        isDeleted: false,
        $text: { $search: query }
    };

    if (!canSeeAllProjects(role) && allowedProjectIds.length > 0) {
        filter.projectId = { $in: allowedProjectIds };
    } else if (!canSeeAllProjects(role)) {
        return [];
    }

    // NEVER return env values, only keys
    return EnvVariableModel.find(filter).populate('projectId', 'name _id').select('key projectId _id').limit(5).lean();
}

async function searchTeams(query: string, orgId: string) {
    return TeamModel.find({ organisationId: orgId, $text: { $search: query } })
        .select('name description _id').limit(5).lean();
}

export default { globalSearch };
