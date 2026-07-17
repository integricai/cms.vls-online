import {
  coerceBlokRichtextFields,
  isStoryblokRichtextDoc,
  plainTextToStoryblokRichtext,
  toStoryblokRichtext,
} from './storyblokRichtext';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const existingDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Already rich' }] }],
};

assert(isStoryblokRichtextDoc(existingDoc), 'doc detection');
assert(toStoryblokRichtext(existingDoc) === existingDoc, 'pass through existing doc');

const single = plainTextToStoryblokRichtext('Hello world');
assert(single.type === 'doc', 'single paragraph doc type');
assert(single.content[0]?.type === 'paragraph', 'single paragraph type');
assert(single.content[0]?.content?.[0]?.text === 'Hello world', 'single paragraph text');

const multi = plainTextToStoryblokRichtext('First para.\n\nSecond para.');
assert(multi.content.length === 2, 'multi paragraph count');
assert(multi.content[1]?.content?.[0]?.text === 'Second para.', 'second paragraph text');

const coerced = coerceBlokRichtextFields('course_introduction', {
  _uid: 'abc',
  component: 'course_introduction',
  title: 'Overview',
  paragraph_1: 'Intro one',
  paragraph_2: 'Intro two',
});
assert(isStoryblokRichtextDoc(coerced.paragraph_1), 'coerce paragraph_1');
assert(isStoryblokRichtextDoc(coerced.paragraph_2), 'coerce paragraph_2');
assert(coerced.title === 'Overview', 'leave non-richtext fields');

const hero = coerceBlokRichtextFields('course_hero', {
  _uid: 'abc',
  component: 'course_hero',
  heading: 'AFM',
  description: 'Course description',
});
assert(isStoryblokRichtextDoc(hero.description), 'coerce course_hero description');

console.log('storyblokRichtext.test.ts: all assertions passed');
