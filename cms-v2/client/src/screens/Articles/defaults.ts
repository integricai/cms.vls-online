import type { ArticleGroup, ArticleSection } from '../../types/cms';
import { normalize } from '../../utils/text';

export function defaultArticleGroups(): ArticleGroup[] {
  return [
    { title: 'Pricing', short: 'Pricing', color: '#1f6fbf', articles: [
      { code: '1', title: 'Pricing 1: Theoretical aspects', desc: 'Deals with the theoretical aspects of pricing strategy and price elasticity.', url: 'https://www.accaglobal.com/uk/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/pricing-1.html' },
      { code: '2', title: 'Pricing 2: Practical aspects', desc: 'Practical pricing approaches including market-based and cost-plus pricing.', url: 'https://www.accaglobal.com/middle-east/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/pricing-2.html' },
    ] },
    { title: 'Performance measurement', short: 'Performance', color: '#138a72', articles: [
      { code: 'BS', title: 'Balanced scorecard', desc: 'How the balanced scorecard achieves sustained financial success and long-term shareholder value.', url: 'https://www.accaglobal.com/lk/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/balanced-scorecard.html' },
      { code: 'PE', title: 'Tackling performance evaluation questions', desc: 'Advice on successfully tackling performance evaluation as a regularly examined requirement.', url: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/performance-measurement.html' },
      { code: 'BB', title: 'Building blocks of performance management', desc: 'Reviews the Building Block model and applies it to an exam-based scenario.', url: 'https://www.accaglobal.com/uk/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/buildblocks.html' },
      { code: 'DC', title: 'Decentralisation and performance measurement', desc: 'Focuses on a classic performance question combining financial and non-financial analysis.', url: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/performance-measurement.html' },
    ] },
    { title: 'Costing techniques', short: 'Costing', color: '#6047d7', articles: [
      { code: 'RC', title: 'Relevant costs', desc: 'Any cost relevant to a decision - definition, types, and exam application.', url: 'https://www.accaglobal.com/ca/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/relevant-costs.html' },
      { code: 'ABC', title: 'Activity-based costing', desc: 'How ABC investigates what causes costs and uses that information for costing purposes.', url: 'https://www.accaglobal.com/in/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/ABC.html' },
      { code: 'TC', title: 'Target costing and lifecycle costing', desc: 'Explanation of target and lifecycle costing with examples of when to use each technique.', url: 'https://www.accaglobal.com/pk/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/target-lifestyle.html' },
      { code: 'TP', title: 'Transfer pricing', desc: 'Why transfer pricing matters, general principles, and approach to exam questions.', url: 'https://www.accaglobal.com/uk/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/transfer-pricing.html' },
      { code: 'EMA', title: 'Environmental management accounting', desc: 'Issues businesses face in managing environmental costs and methods for accounting for them.', url: 'https://www.accaglobal.com/us/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/Env-MA.html' },
      { code: 'TA1', title: 'Throughput accounting - Part 1', desc: 'Basic principles of the theory of constraints and throughput accounting.', url: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/throughput-constraints1.html' },
      { code: 'TA2', title: 'Throughput accounting - Part 2', desc: 'The five focusing steps of the theory of constraints with practical examples.', url: 'https://www.accaglobal.com/gb/en/student/acca-qual-student-journey/qual-resource/acca-qualification/f5/technical-articles/throughput-constraints2.html' },
    ] },
    { title: 'Budgeting', short: 'Budgeting', color: '#d89a1d', articles: [
      { code: '1', title: 'All about budgeting - Part 1', desc: 'Flexible, activity-based, rolling, zero-based, and beyond budgeting approaches.', url: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/budgeting1.html' },
      { code: '2', title: 'All about budgeting - Part 2', desc: 'Continuation of budgeting approaches with worked examples.', url: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/budgeting2.html' },
      { code: '3', title: 'All about budgeting - Part 3', desc: 'Further coverage of budgeting methods and exam technique.', url: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/budgeting3.html' },
      { code: '4', title: 'All about budgeting - Part 4', desc: 'Advanced budgeting topics including beyond budgeting and rolling forecasts.', url: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/budgeting4.html' },
      { code: '5', title: 'All about budgeting - Part 5', desc: 'Final part covering the practical application of budgeting in organisations.', url: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/budgeting5.html' },
      { code: 'IZ', title: 'Incremental vs ZBB in the public sector', desc: 'Critical evaluation of incremental budgeting vs zero-based budgeting approaches.', url: 'https://www.accaglobal.com/ca/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/comparing-budgeting-techniques.html' },
    ] },
    { title: 'Decision-making techniques', short: 'Decision-making', color: '#0d1f3c', articles: [
      { code: 'CVP', title: 'Cost-volume-profit analysis', desc: 'How CVP analysis helps a business find its break-even point and model profitability.', url: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/CVP-analysis.htm.html' },
      { code: 'LP', title: 'Linear programming', desc: 'A simple worked example illustrating the linear programming decision-making technique.', url: 'https://www.accaglobal.com/middle-east/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/linear-programming.html' },
      { code: 'DT', title: 'Decision trees', desc: 'Step-by-step approach to decision trees with a simple example to guide you through.', url: 'https://www.accaglobal.com/uk/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/decision-trees.htm.html' },
    ] },
    { title: 'Big data & information systems', short: 'Big Data', color: '#c46b2b', articles: [
      { code: 'BD1', title: 'Big data 1: What is big data?', desc: 'Introduction to big data as part of the Performance Management syllabus.', url: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/what-is-big-data.html' },
      { code: 'BD2', title: 'Big data 2: How companies use big data', desc: 'Real-life examples of big data use for performance management and measurement.', url: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/how-companies-use-big-data.html' },
      { code: 'IS', title: 'Information systems', desc: 'A topic needed for all sections of the PM exam and regularly overlooked by students.', url: 'https://www.accaglobal.com/pk/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/info-systems.html' },
    ] },
    { title: 'Risk & uncertainty', short: 'Risk', color: '#b33a5b', articles: [
      { code: 'RU', title: 'The risks of uncertainty', desc: 'Risk, probability and potential outcomes - decision-making under uncertainty.', url: 'https://www.accaglobal.com/gb/en/student/acca-qual-student-journey/qual-resource/acca-qualification/f5/technical-articles/the-risks-of-uncertainty.html' },
      { code: 'LE', title: 'The learning rate and learning effect', desc: 'History of the learning curve effect and how future exam questions may test it.', url: 'https://www.accaglobal.com/ubcs/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/the-learning-rate-and-learning-effect.html' },
    ] },
  ];
}

export function defaultArticleSection(): ArticleSection {
  return {
    id: `ags-${Date.now().toString(36)}`,
    name: 'PM Article Groups',
    paperCode: 'PM',
    paperTitle: 'Performance Management',
    theme: '#0d1f3c',
    hubUrl: 'https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles.html',
    headingStyle: normalize('Pricing', 'articleGroupTitle'),
    bodyStyle: normalize('Article descriptions use this formatting.', 'articleGroupBody'),
    rowTitleStyle: normalize('Pricing 1: Theoretical aspects', 'articleGroupRowTitle'),
    notice: normalize('All article content is copyright of the original publisher, ACCA UK. Links open directly on the ACCA global website. VLS provides these links to help students access official ACCA academic resources.', 'articleGroupNotice'),
    groups: defaultArticleGroups(),
  };
}
