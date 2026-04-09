import { renderPasswordReset } from './templates/PasswordReset';
import { renderWelcomeNewUser } from './templates/WelcomeNewUser';
import { renderProjectInvite } from './templates/ProjectInvite';
import { renderProjectRemoved } from './templates/ProjectRemoved';
import { renderPermissionGranted } from './templates/PermissionGranted';
import { renderCredentialExpiringSoon } from './templates/CredentialExpiringSoon';
import { renderAccountLocked } from './templates/AccountLocked';

export const templates = {
    PasswordReset: renderPasswordReset,
    WelcomeNewUser: renderWelcomeNewUser,
    ProjectInvite: renderProjectInvite,
    ProjectRemoved: renderProjectRemoved,
    PermissionGranted: renderPermissionGranted,
    CredentialExpiringSoon: renderCredentialExpiringSoon,
    AccountLocked: renderAccountLocked,
};
