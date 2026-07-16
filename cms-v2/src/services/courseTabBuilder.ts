import type { ScrapedTabPanel } from '../../shared/migrationTypes';
import { parseTabPanelBlocks } from './coursePageScraper';

export type TemplateTabBlock = {
  blockType: string;
  eyebrow?: string;
  heading?: string;
  description?: string;
  paragraph?: string;
  bulletItems?: string;
  cards?: Array<{ icon: string; title: string; badge?: string; description: string }>;
  steps?: Array<{ icon: string; title: string; description: string }>;
};

export type TemplateCourseTab = {
  icon: string;
  label: string;
  blocks: TemplateTabBlock[];
};

function blokUid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export function buildTabBlocksFromPanel(
  tab: Pick<ScrapedTabPanel, 'label' | 'contentHtml' | 'contentText'>,
): Record<string, unknown>[] {
  const parsedBlocks = parseTabPanelBlocks(tab.contentHtml);
  return parsedBlocks.map(block => {
    const base: Record<string, unknown> = {
      _uid: blokUid(),
      component: 'course_tab_block',
      block_type: block.blockType,
    };

    if (block.blockType === 'panel-intro') {
      return {
        ...base,
        eyebrow: block.fields.eyebrow,
        heading: block.fields.heading,
        description: block.fields.description,
      };
    }

    if (block.blockType === 'bullets') {
      return { ...base, bullet_items: block.fields.bullet_items };
    }

    if (block.blockType === 'inc-cards' && block.fields.cards) {
      const cards = block.fields.cards.split('\n').map(line => {
        const [icon, title, description] = line.split('|');
        return {
          _uid: blokUid(),
          component: 'course_tab_card',
          icon: icon || '✅',
          title: title || '',
          description: description || '',
        };
      });
      return { ...base, cards };
    }

    if (block.blockType === 'steps' && block.fields.steps) {
      const steps = block.fields.steps.split('\n').map(line => {
        const [icon, title, description] = line.split('|');
        return {
          _uid: blokUid(),
          component: 'course_tab_step',
          icon: icon || '📅',
          title: title || '',
          description: description || '',
        };
      });
      return { ...base, steps };
    }

    return {
      ...base,
      heading: block.fields.heading || tab.label,
      paragraph: block.fields.paragraph || tab.contentText || tab.label,
    };
  });
}

export function buildTabBlocksFromTemplate(blocks: TemplateTabBlock[]): Record<string, unknown>[] {
  return blocks.map(block => {
    const base: Record<string, unknown> = {
      _uid: blokUid(),
      component: 'course_tab_block',
      block_type: block.blockType,
      eyebrow: block.eyebrow,
      heading: block.heading,
      description: block.description,
      paragraph: block.paragraph,
      bullet_items: block.bulletItems,
    };

    if (block.cards?.length) {
      return {
        ...base,
        cards: block.cards.map(card => ({
          _uid: blokUid(),
          component: 'course_tab_card',
          icon: card.icon,
          title: card.title,
          badge: card.badge,
          description: card.description,
        })),
      };
    }

    if (block.steps?.length) {
      return {
        ...base,
        steps: block.steps.map(step => ({
          _uid: blokUid(),
          component: 'course_tab_step',
          icon: step.icon,
          title: step.title,
          description: step.description,
        })),
      };
    }

    return base;
  });
}

export function buildCourseTabsBlok(
  tabs: Array<{ icon: string; label: string; blocks: Record<string, unknown>[] }>,
): Record<string, unknown> {
  return {
    _uid: blokUid(),
    component: 'course_tabs',
    tabs: tabs.map(tab => ({
      _uid: blokUid(),
      component: 'course_tab',
      icon: tab.icon,
      label: tab.label,
      blocks: tab.blocks,
    })),
  };
}

export function defaultCourseTabsTemplate(): TemplateCourseTab[] {
  return [
    {
      icon: '📦',
      label: 'Course Package',
      blocks: [
        {
          blockType: 'panel-intro',
          eyebrow: "WHAT'S INCLUDED",
          heading: 'Everything you need to pass',
          description:
            'Your course package gives you complete access to all the resources, support, and tools you need to study effectively and pass your exam.',
        },
        {
          blockType: 'inc-cards',
          cards: [
            { icon: '🎬', title: 'Lecture Videos', badge: '38 hrs', description: 'Complete syllabus coverage with professional HD lecture videos you can watch at your own pace.' },
            { icon: '📚', title: 'Complete study notes', description: 'Comprehensive, printable study notes structured exactly to the syllabus.' },
            { icon: '✅', title: 'Chapter quizzes', description: 'Chapter-by-chapter quizzes to test your understanding before moving on.' },
            { icon: '🎯', title: 'Live sessions', description: 'Pre-exam live online sessions for additional practice (recordings available).' },
            { icon: '📝', title: 'Question videos', badge: '24 hrs', description: 'Extensive worked examples walking through past exam questions step by step.' },
            { icon: '📱', title: 'Customized study plan', description: 'Personalized study plan with mobile app to track your daily progress.' },
            { icon: '💬', title: 'Tutor support', description: 'Active tutor support over WhatsApp groups — ask questions and get answers fast.' },
            { icon: '📊', title: 'Mock exam', description: 'Final mock exam with detailed feedback to prepare you for the real thing.' },
          ],
        },
      ],
    },
    {
      icon: '🎓',
      label: 'After Enrolment',
      blocks: [
        {
          blockType: 'panel-intro',
          eyebrow: 'GETTING STARTED',
          heading: 'What happens after you enrol',
          description: 'Follow these steps to get the most out of your course from day one.',
        },
        {
          blockType: 'steps',
          steps: [
            { icon: '🔓', title: 'Access course resources', description: 'Once you enrol, log in and go to My Courses to access all materials immediately.' },
            { icon: '📅', title: 'Build your study plan', description: 'Use the customized study planner to map out your revision schedule.' },
            { icon: '💬', title: 'Join your tutor group', description: 'Connect with your tutor and classmates on WhatsApp for fast support.' },
            { icon: '📝', title: 'Track your progress', description: 'Complete lessons, quizzes and progress tests to stay on track for exam day.' },
            { icon: '🎯', title: 'Sit your mock exam', description: 'Take the final mock under exam conditions and review the debrief with your tutor.' },
          ],
        },
      ],
    },
    {
      icon: '📋',
      label: 'Exam Info',
      blocks: [
        {
          blockType: 'heading-para',
          heading: 'Exam format',
          paragraph:
            'The ACCA SBR exam is a 4-hour case-study paper assessing your ability to apply IFRS standards, group accounting and professional judgement to complex scenarios.',
        },
        {
          blockType: 'bullets',
          bulletItems: 'Computer-based exam (CBE)\n4 hours duration\n100 marks total\nSection A: 2 compulsory case-study questions\nSection B: 2 from 3 optional questions',
        },
      ],
    },
    {
      icon: '💡',
      label: 'Study Tips',
      blocks: [
        {
          blockType: 'panel-intro',
          eyebrow: 'EXAM SUCCESS',
          heading: 'How to get the most from this course',
          description: 'Structured study habits make the difference between knowing the syllabus and passing the exam.',
        },
        {
          blockType: 'inc-cards',
          cards: [
            { icon: '⏰', title: 'Study consistently', description: 'Short daily sessions beat last-minute cramming — aim for 1–2 hours per day.' },
            { icon: '📝', title: 'Practice under timed conditions', description: 'Use question videos and mocks to build speed and exam technique.' },
            { icon: '🔄', title: 'Review weak areas', description: 'Revisit topics where quiz scores are low before moving to new modules.' },
          ],
        },
      ],
    },
  ];
}
