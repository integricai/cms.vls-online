import type { Sale, SaleAcceptPreview } from '../../shared/types';
import {
  assignSaleToTutor,
  getSaleById,
  getSaleDetailForInvite,
} from '../models/sale';
import {
  createSaleTutorInvite,
  getInviteByToken,
  markInviteAccepted,
  markInviteEmailed,
} from '../models/saleTutorInvite';
import { getTutorById, listActiveTutorsForCourse } from '../models/tutor';
import { sendTutorSaleClaimInvite } from './saleEmails';

function appBaseUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export async function inviteTutorsForSale(sale: Sale): Promise<{ invited: number; emailed: number }> {
  const detail = await getSaleDetailForInvite(sale.id);
  if (!detail) return { invited: 0, emailed: 0 };

  const tutors = await listActiveTutorsForCourse(sale.courseId);
  let invited = 0;
  let emailed = 0;

  for (const tutor of tutors) {
    const invite = await createSaleTutorInvite({
      saleId: sale.id,
      tutorId: tutor.id,
    });
    invited += 1;

    if (!tutor.email) continue;

    try {
      const acceptUrl = `${appBaseUrl()}/accept-sale?token=${encodeURIComponent(invite.token)}`;
      const sent = await sendTutorSaleClaimInvite({
        to: tutor.email,
        tutorName: tutor.name,
        courseName: detail.courseName || 'Course',
        studentFirstName: detail.studentFirstName,
        amount: sale.amount,
        currency: sale.currency,
        soldAt: sale.soldAt instanceof Date ? sale.soldAt : new Date(sale.soldAt),
        acceptUrl,
      });
      if (sent) {
        await markInviteEmailed(invite.id);
        emailed += 1;
      }
    } catch (err) {
      console.error(`[sale-invite] Failed to email tutor ${tutor.id} for sale ${sale.id}`, err);
    }
  }

  return { invited, emailed };
}

export async function previewSaleAccept(token: string): Promise<SaleAcceptPreview> {
  const invite = await getInviteByToken(token);
  if (!invite) {
    return {
      saleId: 0,
      courseName: null,
      studentFirstName: null,
      amount: 0,
      currency: 'GBP',
      soldAt: new Date(),
      tutorName: null,
      status: 'invalid',
    };
  }

  const detail = await getSaleDetailForInvite(invite.saleId);
  if (!detail) {
    return {
      saleId: invite.saleId,
      courseName: null,
      studentFirstName: null,
      amount: 0,
      currency: 'GBP',
      soldAt: new Date(),
      tutorName: invite.tutorName,
      status: 'invalid',
    };
  }

  const expiresAt = invite.expiresAt instanceof Date ? invite.expiresAt : new Date(invite.expiresAt);
  if (expiresAt.getTime() < Date.now() && !detail.sale.tutorId) {
    return {
      saleId: detail.sale.id,
      courseName: detail.courseName,
      studentFirstName: detail.studentFirstName,
      amount: detail.sale.amount,
      currency: detail.sale.currency,
      soldAt: detail.sale.soldAt,
      tutorName: invite.tutorName,
      status: 'expired',
    };
  }

  if (detail.sale.tutorId) {
    const assigned = detail.sale.tutorId === invite.tutorId
      ? invite.tutorName
      : (await getTutorById(detail.sale.tutorId))?.name ?? null;
    return {
      saleId: detail.sale.id,
      courseName: detail.courseName,
      studentFirstName: detail.studentFirstName,
      amount: detail.sale.amount,
      currency: detail.sale.currency,
      soldAt: detail.sale.soldAt,
      tutorName: invite.tutorName,
      status: 'already_assigned',
      assignedTutorName: assigned,
    };
  }

  return {
    saleId: detail.sale.id,
    courseName: detail.courseName,
    studentFirstName: detail.studentFirstName,
    amount: detail.sale.amount,
    currency: detail.sale.currency,
    soldAt: detail.sale.soldAt,
    tutorName: invite.tutorName,
    status: 'available',
  };
}

export async function acceptSaleInvite(token: string): Promise<{
  ok: boolean;
  error?: string;
  sale?: Sale;
}> {
  const invite = await getInviteByToken(token);
  if (!invite) return { ok: false, error: 'Invalid or unknown invite link' };

  const expiresAt = invite.expiresAt instanceof Date ? invite.expiresAt : new Date(invite.expiresAt);
  if (expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'This invite link has expired' };
  }

  const sale = await getSaleById(invite.saleId);
  if (!sale) return { ok: false, error: 'Sale not found' };

  if (sale.tutorId) {
    if (sale.tutorId === invite.tutorId) {
      return { ok: true, sale };
    }
    return { ok: false, error: 'This sale has already been accepted by another tutor' };
  }

  const assigned = await assignSaleToTutor({
    saleId: sale.id,
    tutorId: invite.tutorId,
    commissionPercent: invite.tutorCommissionPercent,
    assignmentStatus: 'Assigned',
  });

  if (!assigned) {
    return { ok: false, error: 'This sale has already been accepted by another tutor' };
  }

  await markInviteAccepted(invite.id);
  return { ok: true, sale: assigned };
}

export async function adminAssignSale(saleId: number, tutorId: number): Promise<{
  ok: boolean;
  error?: string;
  sale?: Sale;
}> {
  const sale = await getSaleById(saleId);
  if (!sale) return { ok: false, error: 'Sale not found' };
  if (sale.tutorId) return { ok: false, error: 'Sale is already assigned to a tutor' };

  const tutor = await getTutorById(tutorId);
  if (!tutor || !tutor.isActive) return { ok: false, error: 'Tutor not found or inactive' };

  const assigned = await assignSaleToTutor({
    saleId,
    tutorId,
    commissionPercent: tutor.commissionPercent,
    assignmentStatus: 'AdminAssigned',
  });

  if (!assigned) {
    return { ok: false, error: 'Sale is already assigned to a tutor' };
  }

  return { ok: true, sale: assigned };
}
