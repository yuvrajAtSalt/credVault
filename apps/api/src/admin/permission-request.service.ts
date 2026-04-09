import { PermissionRequestModel } from './permission-request.schema';
import { UserModel } from '../user/user.schema';
import { writeAuditLog } from '../audit/audit.repo';
import adminService from './admin.service';

// ─── User submits a permission request ───────────────────────────────────────
export const submitRequest = async (body: any, currentUser: any) => {
    const { permission, reason, projectId } = body;

    const request = await PermissionRequestModel.create({
        organisationId: currentUser.organisationId,
        requestedBy:    currentUser._id,
        permission,
        reason,
        projectId: projectId || null,
        status: 'pending',
    });

    await writeAuditLog({
        actorId:        String(currentUser._id),
        action:         'permission_request.submitted',
        targetType:     'PermissionRequest',
        targetId:       String(request._id),
        organisationId: String(currentUser.organisationId),
        meta:           { permission, reason },
    });

    return { statusCode: 201, message: 'REQUEST SUBMITTED — YOUR ADMIN WILL REVIEW IT', data: request };
};

// ─── Sysadmin lists requests ──────────────────────────────────────────────────
export const listRequests = async (currentUser: any, query: any) => {
    const page  = Math.max(1, parseInt(query.page  || '1',  10));
    const limit = Math.min(100, parseInt(query.limit || '20', 10));
    const skip  = (page - 1) * limit;

    const filter: any = { organisationId: currentUser.organisationId };
    if (query.status && ['pending', 'approved', 'rejected'].includes(query.status)) {
        filter.status = query.status;
    }

    const [requests, total] = await Promise.all([
        PermissionRequestModel.find(filter)
            .populate('requestedBy', 'name email role avatarUrl')
            .populate('reviewedBy', 'name email')
            .populate('projectId', 'name color')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        PermissionRequestModel.countDocuments(filter),
    ]);

    return {
        statusCode: 200,
        message: 'REQUESTS FETCHED',
        data: { requests, total, page, limit, pages: Math.ceil(total / limit) },
    };
};

// ─── Sysadmin approves a request ─────────────────────────────────────────────
export const approveRequest = async (requestId: string, body: any, currentUser: any) => {
    const req = await PermissionRequestModel.findOne({
        _id: requestId, organisationId: currentUser.organisationId,
    });
    if (!req) throw { statusCode: 404, message: 'REQUEST NOT FOUND' };
    if (req.status !== 'pending') throw { statusCode: 409, message: 'REQUEST ALREADY REVIEWED' };

    // Apply the special permission grant to the user
    await adminService.grantPermission(String(req.requestedBy), {
        permission: req.permission,
        value:      true,
        reason:     req.reason,
        expiresAt:  body.expiresAt || null,
    }, currentUser);

    // Update request status
    req.status      = 'approved';
    req.reviewedBy  = currentUser._id;
    req.reviewNote  = body.reviewNote || '';
    req.reviewedAt  = new Date();
    req.expiresAt   = body.expiresAt || null;
    await req.save();

    await writeAuditLog({
        actorId:        String(currentUser._id),
        action:         'permission_request.approved',
        targetType:     'PermissionRequest',
        targetId:       requestId,
        organisationId: String(currentUser.organisationId),
        meta:           { permission: req.permission, expiresAt: body.expiresAt },
    });

    return { statusCode: 200, message: 'REQUEST APPROVED', data: req };
};

// ─── Sysadmin rejects a request ──────────────────────────────────────────────
export const rejectRequest = async (requestId: string, body: any, currentUser: any) => {
    if (!body.reviewNote?.trim()) throw { statusCode: 400, message: 'REVIEW NOTE IS REQUIRED FOR REJECTION' };

    const req = await PermissionRequestModel.findOne({
        _id: requestId, organisationId: currentUser.organisationId,
    });
    if (!req) throw { statusCode: 404, message: 'REQUEST NOT FOUND' };
    if (req.status !== 'pending') throw { statusCode: 409, message: 'REQUEST ALREADY REVIEWED' };

    req.status     = 'rejected';
    req.reviewedBy = currentUser._id;
    req.reviewNote = body.reviewNote;
    req.reviewedAt = new Date();
    await req.save();

    await writeAuditLog({
        actorId:        String(currentUser._id),
        action:         'permission_request.rejected',
        targetType:     'PermissionRequest',
        targetId:       requestId,
        organisationId: String(currentUser.organisationId),
        meta:           { permission: req.permission, reviewNote: body.reviewNote },
    });

    return { statusCode: 200, message: 'REQUEST REJECTED', data: req };
};

export default { submitRequest, listRequests, approveRequest, rejectRequest };
