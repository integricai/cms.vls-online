import { getCustomerById } from '../models/customer';
import { getCourseById } from '../models/course';
import {
  listClosedZenlerCourseIds,
  listOpenOrderIdsForCourse,
  recordCourseAccessClosure,
} from '../models/activeEnrollment';
import { getPaymentOrder, updateZenlerEnrollment } from '../models/paymentOrder';
import { getSaleById } from '../models/sale';
import { enrolledZenlerCourseIds, enrollmentStillOpen } from './activeEnrollmentRules';
import { unenrollStudentFromZenlerCourse } from './zenlerEnrollment';

export async function unenrollActiveCourse(input: {
  saleId: number;
  zenlerCourseId: string;
}): Promise<{ message: string }> {
  const zenlerCourseId = String(input.zenlerCourseId ?? '').trim();
  if (!/^\d+$/.test(zenlerCourseId)) {
    throw new Error('That course cannot be unenrolled');
  }

  const sale = await getSaleById(input.saleId);
  if (!sale) throw new Error('Enrolment not found');

  const order = await getPaymentOrder(sale.paymentOrderId);
  if (!order || order.status !== 'Paid') throw new Error('This enrolment is not active');

  const expiry = sale.expiryDate ? new Date(sale.expiryDate) : null;
  if (!expiry || Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
    throw new Error('This enrolment has already ended');
  }
  if (!enrollmentStillOpen(order.zenlerEnrollmentStatus)) {
    throw new Error('This enrolment is not active');
  }

  const saleCourse = sale.courseId ? await getCourseById(sale.courseId) : null;
  const papers = enrolledZenlerCourseIds({
    accessZenlerCourseIds: order.accessZenlerCourseIds,
    zenlerCourseId: order.zenlerCourseId,
    saleZenlerCourseId: saleCourse?.zenlerCourseId,
  });
  if (!papers.includes(zenlerCourseId)) {
    throw new Error('That course is not part of this enrolment');
  }

  const alreadyClosed = await listClosedZenlerCourseIds(order.id);
  if (alreadyClosed.includes(zenlerCourseId)) {
    throw new Error('This course is already unenrolled');
  }

  const customer = await getCustomerById(sale.customerId);
  const email = customer?.email
    ?? order.studentEmail
    ?? order.providerCustomerEmail
    ?? order.stripeCustomerEmail;

  const result = await unenrollStudentFromZenlerCourse({
    email,
    zenlerUserId: order.zenlerUserId ?? customer?.zenlerUserId,
    zenlerCourseId,
  });
  if (result.status !== 'unenrolled') {
    throw new Error(result.message || 'Could not unenrol this course');
  }

  const orderIds = new Set(await listOpenOrderIdsForCourse(sale.customerId, zenlerCourseId));
  orderIds.add(order.id);

  for (const orderId of orderIds) {
    await recordCourseAccessClosure(orderId, zenlerCourseId);
    const current = orderId === order.id ? order : await getPaymentOrder(orderId);
    if (!current) continue;

    const currentPapers = enrolledZenlerCourseIds({
      accessZenlerCourseIds: current.accessZenlerCourseIds,
      zenlerCourseId: current.zenlerCourseId,
    });
    const knownPapers = currentPapers.length > 0 ? currentPapers : [zenlerCourseId];
    const closed = new Set(await listClosedZenlerCourseIds(orderId));
    const remaining = knownPapers.filter((id) => !closed.has(id));
    const zenlerUserId = result.zenlerUserId ?? current.zenlerUserId;

    if (remaining.length === 0) {
      await updateZenlerEnrollment(orderId, {
        zenlerUserId,
        zenlerEnrollmentStatus: 'unenrolled',
      });
    } else if (result.zenlerUserId && !current.zenlerUserId) {
      await updateZenlerEnrollment(orderId, {
        zenlerUserId: result.zenlerUserId,
        zenlerEnrollmentStatus: current.zenlerEnrollmentStatus || 'enrolled',
      });
    }
  }

  return { message: result.message || 'Student unenrolled from this course' };
}
