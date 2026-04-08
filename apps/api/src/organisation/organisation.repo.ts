import { OrganisationModel } from './organisation.schema';
import { IOrganisationSchema } from './organisation.types';

export const findOrgBySlug = (slug: string) =>
    OrganisationModel.findOne({ slug, isDeleted: { $ne: true } }).exec();

export const findOrgById = (id: string) =>
    OrganisationModel.findById(id).exec();

export const countOrgs = () =>
    OrganisationModel.countDocuments({ isDeleted: { $ne: true } });

export const insertOrg = async (data: Partial<IOrganisationSchema>) => {
    const org = new OrganisationModel(data);
    await org.save();
    return org;
};

export default { findOrgBySlug, findOrgById, countOrgs, insertOrg };
