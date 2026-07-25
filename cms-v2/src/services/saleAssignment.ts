import type { Sale, SaleAcceptPreview } from '../../shared/types';
import {
  assignSaleToTutor,
  getSaleById,
  getSaleDetailForInvite,
} from '../models/sale';
import {
  getInviteByToken,
  markInviteAccepted,
} from '../models/saleTutorInvite';
import { getTutorById, listActiveTutorsForCourse } from '../models/tutor';

/**
 * Auto-assign the course's tutor after payment.
 * Each course has a single teacher — no claim-invite emails.
 */
export async function autoAssignCourseTutorForSale(sale: Sale): Promise<Sale | null> {
  if (sale.tutorId) return sale;

  const tutors = await listActiveTutorsForCourse(sale.courseId);
  if (tutors.length === 0) {
    console.warn(`[sale-assign] No active tutor linked to course ${sale.courseId} for sale ${sale.id}`);
    return null;
  }
  if (tutors.length > 1) {
    console.warn(
      `[sale-assign] Course ${sale.courseId} has ${tutors.length} active tutors; assigning first (${tutors[0]!.name}) for sale ${sale.id}`,
    );
  }

  const tutor = tutors[0]!;
  const assigned = await assignSaleToTutor({
    saleId: sale.id,
    tutorId: tutor.id,
    commissionPercent: tutor.commissionPercent,
    assignmentStatus: 'Assigned',
  });

  if (!assigned) {
    console.warn(`[sale-assign] Could not auto-assign tutor ${tutor.id} for sale ${sale.id}`);
    return null;
  }

  return assigned;
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
