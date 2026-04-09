import { Router } from 'express';
import complianceController from './compliance.controller';

const router = Router();

// Access Reviews
router.post('/access-reviews/initiate',    complianceController.initiateReview);
router.get('/access-reviews',             complianceController.listReviews);
router.get('/access-reviews/:id',         complianceController.getReview);
router.patch('/access-reviews/:id/members/:userId', complianceController.recordDecision);
router.post('/access-reviews/:id/complete', complianceController.completeReview);

// Offboarding
router.post('/offboarding/initiate/:userId', complianceController.initiateOffboarding);
router.get('/offboarding',                  complianceController.listOffboarding);
router.get('/offboarding/:id',              complianceController.getOffboarding);
router.patch('/offboarding/:id/steps/:stepId', complianceController.updateStep);
router.patch('/offboarding/:id/credentials/:credId', complianceController.recordCredentialAction);
router.post('/offboarding/:id/complete',    complianceController.completeOffboarding);

// Change Windows
router.get('/change-windows', complianceController.listChangeWindows);
router.post('/change-windows', complianceController.createChangeWindow);
router.delete('/change-windows/:id', complianceController.deleteChangeWindow);

// Health & Reports
router.get('/health',         complianceController.getHealth);
router.get('/reports/export',  complianceController.exportReport);

// Approval Requests
router.post('/approvals',       complianceController.createApproval);
router.get('/approvals',        complianceController.listApprovals);
router.patch('/approvals/:id',  complianceController.respondApproval);

export default { path: '/api/v1', router };
