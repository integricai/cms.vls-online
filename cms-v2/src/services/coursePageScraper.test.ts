import { mapScrapedCourseIntroduction } from './buildCourseTemplateContent';
import { parseCourseDescriptionFromHtml } from './coursePageScraper';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const AFM_DESCRIPTION_HTML = `
<!-- Left Hero Section ends here -->
<div>
  <p style="font-family:'Poppins',sans-serif;font-size:25px;font-weight:700;color:#204280;">
    ACCA AFM Exam Paper Overview
  </p>
  <div data-content="1">
    <p class="dynamic-text">ACCA AFM Exam Paper Overview</p>
    <p class="dynamic-text">
      This course is for ACCA Strategic Professional students who want advanced financial management preparation.
      It prepares students for the ACCA AFM Advanced Financial Management exam.
    </p>
  </div>
  <h2 style="font-family:'Poppins',sans-serif;font-size:25px;font-weight:700;color:#204280;">
    ACCA AFM Exam Syllabus
  </h2>
  <p>
    The ACCA AFM syllabus covers a wide range of advanced topics, including financial strategy,
    advanced investment appraisal, mergers and acquisitions, corporate restructuring,
    treasury and risk management, and international financial management.
  </p>
  <h2 style="font-family:'Poppins',sans-serif;font-size:25px;font-weight:700;color:#204280;">
    ACCA AFM Exam Structure
  </h2>
  <p>
    The ACCA AFM exam structure consists of a 3-hour and 15-minute computer-based exam that assesses
    both technical knowledge and professional skills.
  </p>
  <h2 style="font-family:'Poppins',sans-serif;font-size:25px;font-weight:700;color:#204280;">
    How to Pass the ACCA AFM Exam?
  </h2>
  <p>
    Effective ACCA AFM exam preparation requires a combination of strong technical knowledge and
    practical exam technique.
  </p>
</div>
<div data-vctabs="1"><div>tabs</div></div>
`;

const desc = parseCourseDescriptionFromHtml(AFM_DESCRIPTION_HTML);
assert(Boolean(desc), 'AFM description should be parsed');
assert(desc!.source === 'zenler', 'AFM description should use zenler parser');
assert(desc!.introBold === 'ACCA AFM Exam Paper Overview', 'first heading should be captured');
assert(
  desc!.introP1.includes('Strategic Professional'),
  'overview body should be introP1',
);
assert(
  desc!.bodyText.includes('ACCA AFM Exam Syllabus'),
  'section 2 heading should be in bodyText',
);
assert(
  desc!.bodyText.includes('ACCA AFM Exam Structure'),
  'section 3 heading should be in bodyText',
);
assert(
  desc!.bodyText.includes('How to Pass the ACCA AFM Exam'),
  'section 4 heading should be in bodyText',
);
assert(
  desc!.bodyText.includes('syllabus covers a wide range'),
  'section 2 body should be in bodyText',
);
assert(
  desc!.bodyText.includes('exam structure consists'),
  'section 3 body should be in bodyText',
);
assert(
  desc!.bodyText.includes('Effective ACCA AFM exam preparation'),
  'section 4 body should be in bodyText',
);

const mapped = mapScrapedCourseIntroduction(desc);
assert(Boolean(mapped), 'mapped introduction should exist');
assert(
  mapped!.paragraph1.includes('Strategic Professional'),
  'paragraph_1 should contain overview body',
);
assert(
  mapped!.paragraph2.includes('Exam Syllabus'),
  'paragraph_2 should contain syllabus section',
);
assert(
  mapped!.paragraph2.includes('Exam Structure'),
  'paragraph_2 should contain structure section',
);
assert(
  mapped!.paragraph2.includes('How to Pass'),
  'paragraph_2 should contain how-to-pass section',
);
assert(
  !mapped!.paragraph1.includes('Exam Syllabus'),
  'paragraph_1 should not contain later sections',
);

console.log('coursePageScraper.test.ts: all assertions passed');
