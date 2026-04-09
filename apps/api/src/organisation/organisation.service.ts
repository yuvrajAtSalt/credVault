import { OrganisationModel } from './organisation.schema';

export const getOrgById = (orgId: string) =>
    OrganisationModel.findById(orgId).lean().exec();

export const updateOrg = (orgId: string, data: { name?: string; logoUrl?: string; hierarchy?: string[] }) =>
    OrganisationModel.findByIdAndUpdate(orgId, { $set: data }, { new: true }).lean().exec();

export default { getOrgById, updateOrg };
