import { Request, Response } from 'express';
import complianceService from './compliance.service';
import { ResponseHandler } from '../utils/responseHandler';

// validateToken sets req.currentUser — use a helper to avoid repeating the cast
const cu = (req: Request) => (req as any).currentUser;

export const initiateReview = async (req: Request, res: Response) => {
    const result = await complianceService.initiateAccessReview(req.body.projectId, req.body, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const listReviews = async (req: Request, res: Response) => {
    const result = await complianceService.listAccessReviews(req.query as any, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const getReview = async (req: Request, res: Response) => {
    const result = await complianceService.getAccessReview(req.params.id as string, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const recordDecision = async (req: Request, res: Response) => {
    const result = await complianceService.recordMemberDecision(req.params.id as string, req.params.userId as string, req.body, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const completeReview = async (req: Request, res: Response) => {
    const result = await complianceService.completeAccessReview(req.params.id as string, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

// Offboarding
export const initiateOffboarding = async (req: Request, res: Response) => {
    const result = await complianceService.initiateOffboarding(req.params.userId as string, req.body, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const listOffboarding = async (req: Request, res: Response) => {
    const result = await complianceService.listOffboarding(cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const getOffboarding = async (req: Request, res: Response) => {
    const result = await complianceService.getOffboarding(req.params.id as string, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const updateStep = async (req: Request, res: Response) => {
    const result = await complianceService.updateOffboardingStep(req.params.id as string, req.params.stepId as string, req.body, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const recordCredentialAction = async (req: Request, res: Response) => {
    const result = await complianceService.recordOffboardingCredentialAction(req.params.id as string, req.params.credId as string, req.body, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const completeOffboarding = async (req: Request, res: Response) => {
    const result = await complianceService.completeOffboarding(req.params.id as string, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

// Change Windows
export const listChangeWindows = async (req: Request, res: Response) => {
    const result = await complianceService.listChangeWindows(cu(req).organisationId);
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const createChangeWindow = async (req: Request, res: Response) => {
    const result = await complianceService.createChangeWindow(cu(req).organisationId, req.body, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const deleteChangeWindow = async (req: Request, res: Response) => {
    const result = await complianceService.deleteChangeWindow(req.params.id as string, cu(req).organisationId, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(null));
};

export const getHealth = async (req: Request, res: Response) => {
    const result = await complianceService.getComplianceHealth(cu(req).organisationId);
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const exportReport = async (req: Request, res: Response) => {
    const type = (req.query.type as string) || 'access_reviews';
    const result = await complianceService.exportComplianceReport(cu(req).organisationId, type);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
};

export const createApproval = async (req: Request, res: Response) => {
    const result = await complianceService.createApprovalRequest(cu(req).organisationId, req.body, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const listApprovals = async (req: Request, res: Response) => {
    const result = await complianceService.listApprovalRequests(cu(req).organisationId, req.query);
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export const respondApproval = async (req: Request, res: Response) => {
    const result = await complianceService.respondToApprovalRequest(req.params.id as string, cu(req).organisationId, req.body, cu(req));
    res.status(result.statusCode).json(new ResponseHandler(result.data));
};

export default {
    initiateReview, listReviews, getReview, recordDecision, completeReview,
    initiateOffboarding, listOffboarding, getOffboarding, updateStep, recordCredentialAction, completeOffboarding,
    listChangeWindows, createChangeWindow, deleteChangeWindow, getHealth, exportReport,
    createApproval, listApprovals, respondApproval
};
