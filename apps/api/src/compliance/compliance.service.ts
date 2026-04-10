import { AccessReviewModel, IAccessReviewDocument } from './access-review.schema';
import { OffboardingChecklistModel } from './offboarding.schema';
import { ChangeWindowModel } from './change-window.schema';
import { ApprovalRequestModel } from './approval-request.schema';
import { EnvVariableModel } from '../env/envvariable.schema';
import { UserModel } from '../user/user.schema';
import { ProjectModel } from '../project/project.schema';
import { CredentialModel } from '../credential/credential.schema';
import { OrganisationModel } from '../organisation/organisation.schema';
import { writeAuditLog } from '../audit/audit.repo';
import { BASE_PERMISSIONS, VaultRole } from '../utils/constants';
import { Types } from 'mongoose';

const DEFAULT_OFFBOARDING_STEPS = [
    { id: 'project_handover',    label: 'Hand over active projects',         description: 'Assign a successor manager for each active project this person manages.' },
    { id: 'credential_audit',    label: 'Audit owned credentials',           description: 'Review all credentials added by this employee. Decide to retain, reassign, or delete each.' },
    { id: 'revoke_project_access', label: 'Revoke all project memberships',  description: 'Remove this person from all active projects.' },
    { id: 'revoke_visibility',   label: 'Revoke residual visibility grants', description: 'Remove any remaining credential visibility grants.' },
    { id: 'revoke_special_perms', label: 'Revoke special permissions',       description: 'Cancel all active special permission grants.' },
    { id: 'deactivate_account',  label: 'Deactivate account',                description: 'Set account to inactive. This prevents login.' },
    { id: 'notify_team',         label: 'Notify relevant teams',            description: 'Inform project managers and team leads of the departure.' },
];

function resolveScopeSync(project: any, user: any): 'all' | 'own' {
    const role = user.role as VaultRole;
    const perms = BASE_PERMISSIONS[role];

    if (perms.isGod) return 'all';
    if (perms.canSeeAllCredentials) return 'all';

    const isManager = role === 'MANAGER';
    const isCreator = String(project.createdBy?._id ?? project.createdBy) === String(user._id);
    if (isManager && isCreator) return 'all';

    const grant = (project.visibilityGrants ?? []).find(
        (g: any) => String(g.grantedTo) === String(user._id),
    );
    if (grant?.scope === 'all') return 'all';

    return 'own';
}

// ─── Access Reviews ─────────────────────────────────────────────────────────────
export const initiateAccessReview = async (projectId: string, body: { dueDate?: string }, currentUser: any) => {
    const project = await ProjectModel.findById(projectId).populate('members.userId').lean();
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    const org = await OrganisationModel.findById(currentUser.organisationId).lean();
    if (!org) throw { statusCode: 404, message: 'ORGANISATION NOT FOUND' };

    const policy = (org as any).accessReviewPolicy || { frequencyDays: 90 };
    const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + policy.frequencyDays * 24 * 60 * 60 * 1000);

    const membersToReview = (project as any).members.map((m: any) => {
        const u = m.userId;
        if (!u) return null;
        return {
            userId: u._id,
            name: u.name,
            role: u.role,
            addedAt: m.addedAt,
            visibilityScope: resolveScopeSync(project, u),
            decision: 'pending',
        };
    }).filter(Boolean);

    const review = await AccessReviewModel.create({
        organisationId: currentUser.organisationId,
        projectId,
        initiatedBy: currentUser._id,
        status: 'pending',
        dueDate,
        reviewPeriodDays: policy.frequencyDays,
        membersToReview,
    });

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'access_review.initiated',
        targetType: 'Project',
        targetId: projectId,
        organisationId: String(currentUser.organisationId),
        meta: { reviewId: review._id, dueDate },
    });

    return { statusCode: 201, message: 'ACCESS REVIEW INITIATED', data: review };
};

export const listAccessReviews = async (query: { status?: string; projectId?: string; page?: string; limit?: string }, currentUser: any) => {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const filter: any = { organisationId: currentUser.organisationId };
    if (query.status) filter.status = query.status;
    if (query.projectId) filter.projectId = new Types.ObjectId(query.projectId);

    const [reviews, total] = await Promise.all([
        AccessReviewModel.find(filter)
            .populate('projectId', 'name color')
            .populate('initiatedBy', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        AccessReviewModel.countDocuments(filter),
    ]);

    return {
        statusCode: 200,
        message: 'ACCESS REVIEWS FETCHED',
        data: { reviews, total, page, limit, pages: Math.ceil(total / limit) },
    };
};

export const getAccessReview = async (reviewId: string, currentUser: any) => {
    const review = await AccessReviewModel.findOne({ _id: reviewId, organisationId: currentUser.organisationId })
        .populate('projectId', 'name color')
        .populate('initiatedBy', 'name')
        .populate('membersToReview.userId', 'name email avatarUrl')
        .populate('membersToReview.decidedBy', 'name')
        .lean();
    
    if (!review) throw { statusCode: 404, message: 'ACCESS REVIEW NOT FOUND' };
    return { statusCode: 200, message: 'ACCESS REVIEW FETCHED', data: review };
};

export const recordMemberDecision = async (reviewId: string, userId: string, body: { decision: 'approved' | 'removed'; note?: string }, currentUser: any) => {
    const review = await AccessReviewModel.findOne({ _id: reviewId, organisationId: currentUser.organisationId });
    if (!review) throw { statusCode: 404, message: 'ACCESS REVIEW NOT FOUND' };
    if (review.status === 'completed') throw { statusCode: 400, message: 'CANNOT MODIFY COMPLETED REVIEW' };

    const member = review.membersToReview.find(m => String(m.userId) === userId);
    if (!member) throw { statusCode: 404, message: 'MEMBER NOT FOUND IN REVIEW' };

    member.decision = body.decision;
    member.note = body.note;
    member.decidedBy = currentUser._id;
    member.decidedAt = new Date();

    if (review.status === 'pending') review.status = 'in_progress';

    // If decision is 'removed', actually remove the member from the project
    if (body.decision === 'removed') {
        await ProjectModel.updateOne(
            { _id: review.projectId as any },
            { $pull: { members: { userId: new Types.ObjectId(userId) } } } as any
        );
        
        // Also revoke visibility grants if any
        await ProjectModel.updateOne(
            { _id: review.projectId as any },
            { $pull: { visibilityGrants: { grantedTo: new Types.ObjectId(userId) } } } as any
        );

        await writeAuditLog({
            actorId: String(currentUser._id),
            action: 'member.remove',
            targetType: 'Project',
            targetId: String(review.projectId),
            organisationId: String(currentUser.organisationId),
            meta: { userId, reason: 'access_review_removal', reviewId },
        });
    }

    await review.save();

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'access_review.member_decision',
        targetType: 'AccessReview',
        targetId: reviewId,
        organisationId: String(currentUser.organisationId),
        meta: { userId, decision: body.decision },
    });

    return { statusCode: 200, message: 'DECISION RECORDED', data: review };
};

export const completeAccessReview = async (reviewId: string, currentUser: any) => {
    const review = await AccessReviewModel.findOne({ _id: reviewId, organisationId: currentUser.organisationId });
    if (!review) throw { statusCode: 404, message: 'ACCESS REVIEW NOT FOUND' };

    const pendingCount = review.membersToReview.filter(m => m.decision === 'pending').length;
    if (pendingCount > 0) throw { statusCode: 400, message: `CANNOT COMPLETE REVIEW: ${pendingCount} DECISIONS PENDING` };

    review.status = 'completed';
    review.completedAt = new Date();
    await review.save();

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'access_review.completed',
        targetType: 'AccessReview',
        targetId: reviewId,
        organisationId: String(currentUser.organisationId),
    });

    return { statusCode: 200, message: 'ACCESS REVIEW COMPLETED', data: review };
};

// ─── Offboarding ──────────────────────────────────────────────────────────────
export const initiateOffboarding = async (targetUserId: string, body: { targetDate: string }, currentUser: any) => {
    const user = await UserModel.findById(targetUserId).lean();
    if (!user) throw { statusCode: 404, message: 'USER NOT FOUND' };

    const existing = await OffboardingChecklistModel.findOne({ userId: targetUserId, status: 'in_progress' });
    if (existing) throw { statusCode: 400, message: 'OFFBOARDING ALREADY IN PROGRESS FOR THIS USER' };

    // Fetch all credentials added by this user
    const userCreds = await CredentialModel.find({
        organisationId: currentUser.organisationId,
        addedBy: targetUserId,
        isDeleted: false
    }).populate('projectId', 'name').lean();

    const credentialAudit = (userCreds as any[]).map(c => ({
        credentialId: c._id,
        projectName: c.projectId?.name || 'Unknown Project',
        label: c.label,
        category: c.category,
        action: 'pending'
    }));

    const checklist = await OffboardingChecklistModel.create({
        organisationId: currentUser.organisationId,
        userId: targetUserId,
        initiatedBy: currentUser._id,
        targetDate: new Date(body.targetDate),
        status: 'in_progress',
        steps: DEFAULT_OFFBOARDING_STEPS.map(s => ({ ...s, status: 'pending' })),
        credentialAudit
    });

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'offboarding.initiated',
        targetType: 'User',
        targetId: targetUserId,
        organisationId: String(currentUser.organisationId),
        meta: { checklistId: checklist._id, targetDate: body.targetDate }
    });

    return { statusCode: 201, message: 'OFFBOARDING INITIATED', data: checklist };
};

export const listOffboarding = async (currentUser: any) => {
    const checklists = await OffboardingChecklistModel.find({ organisationId: currentUser.organisationId })
        .populate('userId', 'name email avatarUrl')
        .populate('initiatedBy', 'name')
        .sort({ createdAt: -1 })
        .lean();

    return { statusCode: 200, message: 'OFFBOARDING CHECKLISTS FETCHED', data: checklists };
};

export const getOffboarding = async (id: string, currentUser: any) => {
    const checklist = await OffboardingChecklistModel.findOne({ _id: id, organisationId: currentUser.organisationId })
        .populate('userId', 'name email avatarUrl role')
        .populate('initiatedBy', 'name')
        .populate('steps.completedBy', 'name')
        .populate('credentialAudit.actionBy', 'name')
        .populate('credentialAudit.assigneeId', 'name')
        .lean();

    if (!checklist) throw { statusCode: 404, message: 'OFFBOARDING CHECKLIST NOT FOUND' };
    return { statusCode: 200, message: 'OFFBOARDING CHECKLIST FETCHED', data: checklist };
};

export const updateOffboardingStep = async (checklistId: string, stepId: string, body: { status: 'completed' | 'skipped'; note?: string }, currentUser: any) => {
    const checklist = await OffboardingChecklistModel.findOne({ _id: checklistId, organisationId: currentUser.organisationId });
    if (!checklist) throw { statusCode: 404, message: 'CHECKLIST NOT FOUND' };

    const step = checklist.steps.find(s => s.id === stepId);
    if (!step) throw { statusCode: 404, message: 'STEP NOT FOUND' };

    step.status = body.status;
    step.note = body.note;
    step.completedBy = currentUser._id;
    step.completedAt = new Date();

    // Logic for specific steps
    if (stepId === 'deactivate_account' && body.status === 'completed') {
        await UserModel.updateOne({ _id: checklist.userId }, { isActive: false });
        
        await writeAuditLog({
            actorId: String(currentUser._id),
            action: 'user.deactivated',
            targetType: 'User',
            targetId: String(checklist.userId),
            organisationId: String(currentUser.organisationId),
            meta: { reason: 'offboarding' }
        });
    }

    if (stepId === 'revoke_project_access' && body.status === 'completed') {
        await ProjectModel.updateMany(
            { 'members.userId': checklist.userId } as any,
            { $pull: { members: { userId: checklist.userId } } } as any
        );
    }

    if (stepId === 'revoke_visibility' && body.status === 'completed') {
        await ProjectModel.updateMany(
            { 'visibilityGrants.grantedTo': checklist.userId } as any,
            { $pull: { visibilityGrants: { grantedTo: checklist.userId } } } as any
        );
    }

    await checklist.save();

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'offboarding.step_completed',
        targetType: 'OffboardingChecklist',
        targetId: checklistId,
        organisationId: String(currentUser.organisationId),
        meta: { stepId, status: body.status }
    });

    return { statusCode: 200, message: 'STEP UPDATED', data: checklist };
};

export const recordOffboardingCredentialAction = async (checklistId: string, credId: string, body: { action: 'retain' | 'reassign' | 'delete'; assigneeId?: string }, currentUser: any) => {
    const checklist = await OffboardingChecklistModel.findOne({ _id: checklistId, organisationId: currentUser.organisationId });
    if (!checklist) throw { statusCode: 404, message: 'CHECKLIST NOT FOUND' };

    const item = checklist.credentialAudit.find(c => String(c.credentialId) === credId);
    if (!item) throw { statusCode: 404, message: 'CREDENTIAL NOT FOUND IN AUDIT' };

    item.action = body.action;
    item.actionBy = currentUser._id;
    item.assigneeId = body.assigneeId ? new Types.ObjectId(body.assigneeId) : null;

    if (body.action === 'reassign' && body.assigneeId) {
        await CredentialModel.updateOne({ _id: credId }, { addedBy: body.assigneeId });
    } else if (body.action === 'delete') {
        await CredentialModel.updateOne({ _id: credId }, { isDeleted: true, deletedAt: new Date() });
    }

    await checklist.save();

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'offboarding.credential_action',
        targetType: 'OffboardingChecklist',
        targetId: checklistId,
        organisationId: String(currentUser.organisationId),
        meta: { credentialId: credId, action: body.action }
    });

    return { statusCode: 200, message: 'CREDENTIAL ACTION RECORDED', data: checklist };
};

export const completeOffboarding = async (id: string, currentUser: any) => {
    const checklist = await OffboardingChecklistModel.findOne({ _id: id, organisationId: currentUser.organisationId });
    if (!checklist) throw { statusCode: 404, message: 'CHECKLIST NOT FOUND' };

    const pendingSteps = checklist.steps.filter(s => s.status === 'pending' && s.id !== 'notify_team').length;
    if (pendingSteps > 0) throw { statusCode: 400, message: `CANNOT COMPLETE: ${pendingSteps} STEPS REMAINING` };

    const pendingCreds = checklist.credentialAudit.filter(c => c.action === 'pending').length;
    if (pendingCreds > 0) throw { statusCode: 400, message: `CANNOT COMPLETE: ${pendingCreds} CREDENTIALS PENDING AUDIT` };

    checklist.status = 'completed';
    await checklist.save();

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'offboarding.completed',
        targetType: 'OffboardingChecklist',
        targetId: id,
        organisationId: String(currentUser.organisationId),
    });

    return { statusCode: 200, message: 'OFFBOARDING COMPLETED', data: checklist };
};

// ─── Change Windows ───────────────────────────────────────────────────────

export const listChangeWindows = async (organisationId: string) => {
    const windows = await ChangeWindowModel.find({ organisationId }).lean();
    return { statusCode: 200, data: windows };
};

export const createChangeWindow = async (organisationId: string, data: any, currentUser: any) => {
    const window = await ChangeWindowModel.create({
        ...data,
        organisationId,
    });

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'compliance.window_create',
        organisationId,
        meta: { name: window.name },
    });

    return { statusCode: 201, data: window };
};

export const deleteChangeWindow = async (id: string, organisationId: string, currentUser: any) => {
    const window = await ChangeWindowModel.findOneAndDelete({ _id: id, organisationId });
    if (!window) throw { statusCode: 404, message: 'Window not found' };

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'compliance.window_delete',
        organisationId,
        meta: { name: window.name },
    });

    return { statusCode: 200, message: 'WINDOW DELETED' };
};

export const validateMutationAllowed = async (organisationId: string, projectId?: string) => {
    const windows = await ChangeWindowModel.find({ organisationId, isActive: true }).lean();
    if (windows.length === 0) return true;

    const now = new Date();

    for (const window of windows) {
        if (projectId && window.excludedProjectIds?.some(id => String(id) === String(projectId))) {
            return true;
        }

        try {
            const fmt = new Intl.DateTimeFormat('en-US', {
                timeZone: window.timezone || 'UTC',
                hour12: false,
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
            });

            const parts = fmt.formatToParts(now);
            const getPart = (p: string) => parts.find(x => x.type === p)?.value;

            const dayShort = getPart('weekday'); 
            const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
            const schemaDay = dayMap[dayShort || ''];

            if (window.dayOfWeek.includes(schemaDay)) {
                const currentH = parseInt(getPart('hour') || '0', 10);
                const currentM = parseInt(getPart('minute') || '0', 10);
                const currentTimeVal = currentH * 60 + currentM;

                const [startH, startM] = window.startTime.split(':').map(Number);
                const [endH, endM] = window.endTime.split(':').map(Number);
                const startTimeVal = startH * 60 + startM;
                const endTimeVal = endH * 60 + endM;

                if (currentTimeVal >= startTimeVal && currentTimeVal <= endTimeVal) {
                    return true;
                }
            }
        } catch (e) { console.error('Timezone check failed:', e); }
    }
    return false;
};

// ─── Health Dashboard ────────────────────────────────────────────────────

export const getComplianceHealth = async (organisationId: string) => {
    const projects = await ProjectModel.find({ organisationId, status: 'active' }).lean();
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const projectHealth = await Promise.all(projects.map(async (project) => {
        const overdueReviews = await AccessReviewModel.countDocuments({
            projectId: project._id,
            status: 'overdue'
        });

        const expiringVars = await EnvVariableModel.countDocuments({
            projectId: project._id,
            isDeleted: false,
            expiresAt: { $gt: now, $lt: thirtyDaysFromNow }
        });

        const expiringCreds = await CredentialModel.countDocuments({
            projectId: project._id,
            expiresAt: { $gt: now, $lt: thirtyDaysFromNow }
        });

        let score = 100;
        score -= (overdueReviews * 20);
        score -= (expiringVars * 5);
        score -= (expiringCreds * 5);
        if (score < 0) score = 0;

        return {
            projectId: project._id,
            projectName: project.name,
            color: project.color,
            score,
            overdueReviews,
            expiringItems: expiringVars + expiringCreds,
            lastReviewDate: (project as any).lastAccessReviewAt
        };
    }));

    const totalOverdue = projectHealth.reduce((sum, p) => sum + p.overdueReviews, 0);
    const totalExpiring = projectHealth.reduce((sum, p) => sum + p.expiringItems, 0);
    const avgScore = projectHealth.length > 0 
        ? Math.round(projectHealth.reduce((sum, p) => sum + p.score, 0) / projectHealth.length)
        : 100;

    return {
        statusCode: 200,
        message: 'COMPLIANCE HEALTH FETCHED',
        data: {
            summary: {
                avgScore,
                totalOverdue,
                totalExpiring,
                totalProjects: projects.length
            },
            projects: projectHealth.sort((a, b) => a.score - b.score)
        }
    };
};

// ─── Compliance Reports ───────────────────────────────────────────────────────

export const exportComplianceReport = async (organisationId: string, type: string) => {
    if (type === 'access_reviews') {
        const reviews = await AccessReviewModel.find({ organisationId, status: 'completed' })
            .populate('projectId', 'name')
            .populate('membersToReview.userId', 'name email')
            .populate('membersToReview.decidedBy', 'name')
            .lean();

        const headers = ['Project', 'User', 'Email', 'Decision', 'Decision By', 'Decision Date', 'Review Completed At'];
        const rows = reviews.flatMap((r: any) => 
            r.membersToReview.map((m: any) => [
                r.projectId.name,
                m.name || m.userId?.name || 'Unknown',
                m.userId?.email || 'N/A',
                m.decision,
                m.decidedBy?.name || 'N/A',
                m.decidedAt ? new Date(m.decidedAt).toISOString() : 'N/A',
                new Date(r.completedAt).toISOString()
            ].join(','))
        );

        return {
            content: [headers.join(','), ...rows].join('\n'),
            contentType: 'text/csv',
            filename: `access_review_report_${new Date().toISOString().split('T')[0]}.csv`
        };
    }

    if (type === 'change_log') {
        const { AuditLogModel } = await import('../audit/audit.schema');
        const logs = await AuditLogModel.find({ 
            organisationId, 
            action: { $in: ['envvar.create', 'envvar.edit', 'envvar.delete', 'environment.create', 'environment.delete'] } 
        }).populate('actorId', 'name email').sort({ createdAt: -1 }).limit(1000).lean();

        const headers = ['Timestamp', 'Actor', 'Action', 'Target Type', 'Target ID', 'Meta'];
        const rows = logs.map((l: any) => [
            l.createdAt.toISOString(),
            l.actorId?.name || 'System',
            l.action,
            l.targetType,
            l.targetId,
            JSON.stringify(l.meta).replace(/"/g, '""')
        ].map(val => `"${val}"`).join(','));

        return {
            content: [headers.join(','), ...rows].join('\n'),
            contentType: 'text/csv',
            filename: `change_log_report_${new Date().toISOString().split('T')[0]}.csv`
        };
    }

    throw { statusCode: 400, message: 'Invalid report type' };
};

// ─── Approval Requests (Two-Person Rule) ──────────────────────────────────
export const createApprovalRequest = async (organisationId: string, body: { projectId: string; credentialId: string; reason: string }, currentUser: any) => {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour window

    const request = await ApprovalRequestModel.create({
        organisationId,
        projectId: body.projectId,
        credentialId: body.credentialId,
        requesterId: currentUser._id,
        reason: body.reason,
        status: 'pending',
        expiresAt
    });

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'compliance.approval_request_created',
        organisationId,
        targetType: 'Credential',
        targetId: body.credentialId,
        meta: { requestId: request._id }
    });

    return { statusCode: 201, data: request };
};

export const listApprovalRequests = async (organisationId: string, filter: any = {}) => {
    const requests = await ApprovalRequestModel.find({ organisationId, ...filter })
        .populate('credentialId', 'label category')
        .populate('requesterId', 'name email')
        .populate('projectId', 'name')
        .sort({ createdAt: -1 })
        .lean();
    return { statusCode: 200, data: requests };
};

export const respondToApprovalRequest = async (requestId: string, organisationId: string, body: { status: 'approved' | 'rejected'; note?: string }, currentUser: any) => {
    const request = await ApprovalRequestModel.findOne({ _id: requestId, organisationId });
    if (!request) throw { statusCode: 404, message: 'Request not found' };

    if (String(request.requesterId) === String(currentUser._id)) {
        throw { statusCode: 403, message: 'You cannot approve your own request (Two-Person Rule)' };
    }

    if (request.status !== 'pending') {
        throw { statusCode: 400, message: 'Request is no longer pending' };
    }

    request.status = body.status;
    request.approverId = currentUser._id;
    request.decisionAt = new Date();
    request.decisionNote = body.note;
    await request.save();

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: `compliance.approval_${body.status}`,
        organisationId,
        targetType: 'ApprovalRequest',
        targetId: requestId,
        meta: { requesterId: request.requesterId }
    });

    return { statusCode: 200, message: `REQUEST ${body.status.toUpperCase()}`, data: request };
};

export const sendWeeklyComplianceDigest = async () => {
    const { OrganisationModel } = await import('../organisation/organisation.schema');
    const orgs = await OrganisationModel.find({ isDeleted: false });

    console.log(`[ComplianceDigest] Starting weekly digest for ${orgs.length} organisations...`);

    for (const org of orgs) {
        try {
            const orgId = String(org._id);
            const health = await getComplianceHealth(orgId);
            const pendingReviews = await AccessReviewModel.countDocuments({ organisationId: orgId, status: 'pending' });
            const activeWindows = await ChangeWindowModel.countDocuments({ organisationId: orgId, isActive: true });

            // In a real app, this would trigger an email/notification
            console.log(`[ComplianceDigest] ${org.name}: Health=${health.data.summary.avgScore}, PendingReviews=${pendingReviews}, ChangeWindows=${activeWindows}`);
            
            await writeAuditLog({
                actorId: 'system',
                action: 'compliance.digest_sent',
                organisationId: orgId,
                targetType: 'Organisation',
                targetId: orgId,
                meta: { health: health.data.summary.avgScore, pendingReviews }
            });
        } catch (err) {
            console.error(`[ComplianceDigest] Failed for org ${org.name}:`, err);
        }
    }
};

export default { 
    initiateAccessReview, listAccessReviews, getAccessReview, recordMemberDecision, completeAccessReview,
    initiateOffboarding, listOffboarding, getOffboarding, updateOffboardingStep, recordOffboardingCredentialAction, completeOffboarding,
    listChangeWindows, createChangeWindow, deleteChangeWindow, validateMutationAllowed, getComplianceHealth, exportComplianceReport,
    createApprovalRequest, listApprovalRequests, respondToApprovalRequest, sendWeeklyComplianceDigest
};
