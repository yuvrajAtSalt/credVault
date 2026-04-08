import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { UserModel } from './src/user/user.schema';
import { OrganisationModel } from './src/organisation/organisation.schema';
import { VAULT_ROLES } from './src/utils/constants';

dotenv.config({ path: path.join(__dirname, '.env') });

const seed = async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/credvault';
    
    console.log(`Connecting to ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Clear existing
    await UserModel.deleteMany({});
    await OrganisationModel.deleteMany({});
    console.log('Cleared existing users and organisations.');

    // Create Organisation
    const org = await OrganisationModel.create({
        name: 'Cred Vault Inc.',
        slug: 'cred-vault',
    });
    console.log(`Created Organisation: ${org.name}`);

    const usersToCreate = [];
    let sysadminId = new mongoose.Types.ObjectId();

    // Create SYSADMIN first to use as createdBy for others
    const sysadmin = new UserModel({
        _id: sysadminId,
        organisationId: org._id,
        name: 'System Admin',
        email: 'sysadmin@credvault.com',
        password: 'Password123!',
        role: 'SYSADMIN',
        jobTitle: 'Super Administrator',
        department: 'IT',
        isActive: true,
        createdBy: sysadminId,
        updatedBy: sysadminId,
    });
    await sysadmin.save();
    console.log(`Created SYSADMIN: sysadmin@credvault.com`);
    usersToCreate.push(sysadmin);

    const rolesWithoutSysadmin = VAULT_ROLES.filter(r => r !== 'SYSADMIN');

    // Create one user per role
    for (const role of rolesWithoutSysadmin) {
        const user = new UserModel({
            organisationId: org._id,
            name: `${role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()} User`,
            email: `${role.toLowerCase()}@credvault.com`,
            password: 'Password123!',
            role: role,
            jobTitle: `Lead ${role}`,
            department: 'Engineering',
            isActive: true,
            createdBy: sysadminId,
            updatedBy: sysadminId,
        });
        await user.save();
        console.log(`Created ${role}: ${user.email}`);
        usersToCreate.push(user);
    }

    console.log('\n================ SEED COMPLETE ================');
    console.log('Logins (all passwords are: Password123!):');
    usersToCreate.forEach(u => {
        console.log(`- Role: ${u.role.padEnd(10)} | Email: ${u.email}`);
    });
    console.log('===============================================\n');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
};

seed().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});
