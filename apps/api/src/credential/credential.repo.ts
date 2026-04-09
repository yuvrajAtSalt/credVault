import { Types } from 'mongoose';
import { CredentialModel } from './credential.schema';

const credentialRepo = {
    // ── list visible for project ──────────────────────────────────────────────
    findByProject: (projectId: string) =>
        CredentialModel.find({ projectId, isDeleted: false })
            .populate('addedBy', 'name email role')
            .sort({ category: 1, createdAt: -1 })
            .lean(),

    // ── find by project + addedBy (own-only scope) ────────────────────────────
    findOwnByProject: (projectId: string, userId: string) =>
        CredentialModel.find({ projectId, isDeleted: false, addedBy: new Types.ObjectId(userId) as any })
            .populate('addedBy', 'name email role')
            .sort({ category: 1, createdAt: -1 })
            .lean(),

    // ── count all non-deleted by project ─────────────────────────────────────
    countByProject: (projectId: string) =>
        CredentialModel.countDocuments({ projectId, isDeleted: false }),

    // ── find one ──────────────────────────────────────────────────────────────
    findById: (id: string) =>
        CredentialModel.findOne({ _id: id, isDeleted: false })
            .populate('addedBy', 'name email role')
            .lean(),

    // ── create ────────────────────────────────────────────────────────────────
    create: (data: {
        projectId: string;
        organisationId: string;
        category: string;
        label: string;
        value: string;
        isSecret: boolean;
        environment: string;
        expiresAt?: Date;
        rotationReminderDays?: number;
        sensitivityLevel?: string;
        addedBy: string;
        addedByRole: string;
    }) => CredentialModel.create(data),

    // ── update (patch) ────────────────────────────────────────────────────────
    update: (id: string, patch: Partial<{
        label: string;
        value: string;
        isSecret: boolean;
        environment: string;
        lastEditedBy: Types.ObjectId;
        lastEditedAt: Date;
    }>) =>
        CredentialModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean(),

    // ── soft delete ───────────────────────────────────────────────────────────
    softDelete: (id: string) =>
        CredentialModel.findByIdAndUpdate(id, { $set: { isDeleted: true } }, { new: true }).lean(),
};

export default credentialRepo;
