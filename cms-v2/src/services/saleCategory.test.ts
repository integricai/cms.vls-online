import assert from 'node:assert/strict';
import { saleCategoryAssignsTutor, saleCategoryForOrder } from './saleCategory';

assert.equal(saleCategoryForOrder({ optionType: 'BPP Book', courseTitle: 'FA1 Course Book' }), 'BPP Book');
assert.equal(saleCategoryForOrder({ optionType: 'Custom payment', courseTitle: 'Extra fee' }), 'Payment Order');
assert.equal(saleCategoryForOrder({
  optionType: 'Custom / Resit offer',
  courseName: 'FA1',
}), 'Discount Order');
assert.equal(saleCategoryForOrder({
  optionType: 'Six months',
  courseName: 'FA1 Complete Study Notes',
}), 'Notes');
assert.equal(saleCategoryForOrder({
  courseName: 'FA1',
  coursePageUrl: '/courses/acca-recording-financial-transactions-fa1-notes',
}), 'Notes');
assert.equal(saleCategoryForOrder({ courseName: 'FA1', coursePageUrl: '/courses/fa1' }), 'Course');
assert.equal(saleCategoryAssignsTutor('Course'), true);
assert.equal(saleCategoryAssignsTutor('Notes'), true);
assert.equal(saleCategoryAssignsTutor('BPP Book'), false);
assert.equal(saleCategoryAssignsTutor('Payment Order'), false);
assert.equal(saleCategoryAssignsTutor('Discount Order'), false);

console.log('sale category tests passed');
