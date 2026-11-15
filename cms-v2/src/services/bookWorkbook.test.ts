import assert from 'assert';
import {
  buildBookTemplate,
  courseOptionLabel,
  planBookImport,
  readBookWorkbook,
  type BookTemplateBook,
  type BookTemplateCourse,
} from './bookWorkbook';

const courses: BookTemplateCourse[] = [
  { id: 4, name: 'FA1', isActive: true },
  { id: 5, name: 'FA1', isActive: true },
  { id: 9, name: 'Retired PM', isActive: false },
];

const books: BookTemplateBook[] = [
  {
    id: 1,
    title: 'FA1 Course Book',
    description: 'Study text',
    imageUrl: 'https://cdn.example/fa1.jpg',
    imageAltText: 'FA1 cover',
    currency: 'GBP',
    price: 40,
    discountedPrice: 20,
    isActive: true,
    courseId: 4,
  },
  {
    id: 2,
    title: 'Old kit',
    description: '',
    imageUrl: '',
    imageAltText: '',
    currency: 'GBP',
    price: 15,
    discountedPrice: null,
    isActive: false,
    courseId: 9,
  },
];

assert.equal(courseOptionLabel(courses[0], courses), 'FA1 (#4)');
assert.equal(courseOptionLabel(courses[2], courses), 'Retired PM');

const moved = planBookImport(books, courses, [
  {
    rowNumber: 2,
    title: 'FA1 Course Book',
    description: 'Study text',
    imageUrl: 'https://cdn.example/fa1.jpg',
    imageAltText: 'FA1 cover',
    currency: 'GBP',
    price: '40',
    discountedPrice: '',
    display: 'Yes',
    course: '',
  },
  {
    rowNumber: 3,
    title: 'MA1 Kit',
    description: 'New',
    imageUrl: '',
    imageAltText: '',
    currency: '',
    price: '18.5',
    discountedPrice: '9',
    display: '',
    course: 'FA1 (#4)',
  },
]);

assert.equal(moved.errors.length, 0);
assert.equal(moved.updates[0].courseId, null);
assert.equal(moved.updates[0].discountedPrice, null);
assert.equal(moved.creates[0].courseId, 4);
assert.equal(moved.creates[0].currency, 'GBP');
assert.equal(moved.creates[0].isActive, true);
assert.equal(moved.creates[0].price, 18.5);

const clash = planBookImport(books, courses, [
  {
    rowNumber: 2,
    title: 'Another book',
    description: '',
    imageUrl: '',
    imageAltText: '',
    currency: 'GBP',
    price: '10',
    discountedPrice: '',
    display: 'Yes',
    course: 'FA1 (#4)',
  },
]);
assert.equal(clash.errors[0].message, 'That course is already linked to another book.');

const kept = planBookImport(books, courses, [
  {
    rowNumber: 2,
    title: 'Old kit',
    description: '',
    imageUrl: '',
    imageAltText: '',
    currency: 'GBP',
    price: '15',
    discountedPrice: '',
    display: 'No',
    course: 'Retired PM',
  },
]);
assert.equal(kept.errors.length, 0);
assert.equal(kept.updates[0].courseId, 9);
assert.equal(kept.updates[0].isActive, false);

const twoNew = planBookImport([], courses, [
  {
    rowNumber: 2,
    title: 'Book A',
    description: '',
    imageUrl: '',
    imageAltText: '',
    currency: 'GBP',
    price: '10',
    discountedPrice: '',
    display: 'Yes',
    course: 'FA1 (#4)',
  },
  {
    rowNumber: 3,
    title: 'Book B',
    description: '',
    imageUrl: '',
    imageAltText: '',
    currency: 'GBP',
    price: '10',
    discountedPrice: '',
    display: 'Yes',
    course: 'FA1 (#4)',
  },
]);
assert.equal(twoNew.creates.length, 1);
assert.equal(twoNew.errors[0].message, 'That course is already linked to another book.');

const unknown = planBookImport(books, courses, [
  {
    rowNumber: 2,
    title: 'Loose book',
    description: '',
    imageUrl: '',
    imageAltText: '',
    currency: 'GBP',
    price: '10',
    discountedPrice: '',
    display: 'Yes',
    course: 'Not a course',
  },
]);
assert.equal(unknown.errors[0].message, 'Choose a course from the template list, or leave the cell blank.');

async function roundTrip(): Promise<void> {
  const buffer = await buildBookTemplate(books, courses);
  const rows = await readBookWorkbook(buffer);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, 'FA1 Course Book');
  assert.equal(rows[0].course, 'FA1 (#4)');
  assert.equal(rows[0].display, 'Yes');
  assert.equal(rows[1].course, 'Retired PM');
  const plan = planBookImport(books, courses, rows);
  assert.equal(plan.errors.length, 0);
  assert.equal(plan.creates.length, 0);
  assert.equal(plan.updates.length, 2);
  assert.equal(plan.updates[0].courseId, 4);
  assert.equal(plan.updates[0].discountedPrice, 20);
}

roundTrip().then(() => {
  console.log('book workbook tests passed');
}).catch(err => {
  console.error(err);
  throw err;
});
