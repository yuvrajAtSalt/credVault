import { ProjectModel } from './project.schema';
import { Types } from 'mongoose';

const projectRepo = {
    // ─── Find all projects for an org ─────────────────────────────────────────
    findAllByOrg: (organisationId: string) =>
        ProjectModel.find({ organisationId, isDeleted: false })
            .populate('members.userId', 'name email role avatarUrl')
            .populate('createdBy', 'name email role')
            .sort({ createdAt: -1 })
            .lean(),

    // ─── Find projects where user is a member ─────────────────────────────────
    findByMember: (organisationId: string, userId: string) =>
        ProjectModel.find({
            organisationId,
            isDeleted: false,
            'members.userId': new Types.ObjectId(userId) as any,
        })
            .populate('members.userId', 'name email role avatarUrl')
            .populate('createdBy', 'name email role')
            .sort({ createdAt: -1 })
            .lean(),

    // ─── Find by ID ───────────────────────────────────────────────────────────
    findById: (id: string) =>
        ProjectModel.findOne({ _id: id as any, isDeleted: false })
            .populate('members.userId', 'name email role avatarUrl jobTitle department')
            .populate('createdBy', 'name email role')
            .lean(),

    // ─── Create ───────────────────────────────────────────────────────────────
    create: (data: {
        organisationId: string;
        name: string;
        description?: string;
        color?: string;
        tags?: string[];
        status?: 'active' | 'archived' | 'planning';
        createdBy: string;
        members: { userId: any; addedBy: any; addedAt: Date }[];
    }) => ProjectModel.create(data as any),

    // ─── Update ───────────────────────────────────────────────────────────────
    update: (id: string, patch: Partial<{
        name: string;
        description: string;
        color: string;
        tags: string[];
        status: 'active' | 'archived' | 'planning';
    }>) =>
        ProjectModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean(),

    // ─── Soft delete (set isDeleted) ──────────────────────────────────────────
    softDelete: (id: string) =>
        ProjectModel.findByIdAndUpdate(id, { $set: { isDeleted: true } }, { new: true }).lean(),

    // ─── Archive ──────────────────────────────────────────────────────────────
    archive: (id: string) =>
        ProjectModel.findByIdAndUpdate(id, { $set: { status: 'archived' } }, { new: true }).lean(),

    // ─── Add member ───────────────────────────────────────────────────────────
    addMember: (projectId: string, userId: string, addedBy: string) =>
        ProjectModel.findByIdAndUpdate(
            projectId,
            {
                $push: {
                    members: {
                        userId: new Types.ObjectId(userId),
                        addedBy: new Types.ObjectId(addedBy),
                        addedAt: new Date(),
                    },
                },
            },
            { new: true },
        ).lean(),

    // ─── Remove member ────────────────────────────────────────────────────────
    removeMember: (projectId: string, userId: string) =>
        ProjectModel.findByIdAndUpdate(
            projectId,
            { $pull: { members: { userId: new Types.ObjectId(userId) } } },
            { new: true },
        ).lean(),

    // ─── Check membership ─────────────────────────────────────────────────────
    isMember: async (projectId: string, userId: string): Promise<boolean> => {
        const doc = await ProjectModel.exists({
            _id: projectId as any,
            'members.userId': new Types.ObjectId(userId) as any,
        });
        return !!doc;
    },

    // ─── Count for org ────────────────────────────────────────────────────────
    countByOrg: (organisationId: string) =>
        ProjectModel.countDocuments({ organisationId, isDeleted: false }),
};

export default projectRepo;
