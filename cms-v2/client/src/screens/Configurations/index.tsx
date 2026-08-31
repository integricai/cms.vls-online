import { useState } from 'react';
import CoursePricing from '../CoursePricing';
import GeoPricingTab from './GeoPricingTab';
import QualificationOfferRulesTab from './QualificationOfferRulesTab';
import TutorsTab from './TutorsTab';

type Tab = 'tutors' | 'coursePricing' | 'offerRules' | 'geoPricing';

const TAB_LABELS: Record<Tab, string> = {
  tutors: 'Tutors',
  coursePricing: 'Course Pricing',
  offerRules: 'Offer Rules',
  geoPricing: 'Geo Pricing',
};

export default function Configurations() {
  const [tab, setTab] = useState<Tab>('tutors');

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Configurations</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Manage tutors, course pricing, qualification offer rules, and geo pricing.
        </p>
      </div>
      <div className="flex border-b border-slate-200 bg-white px-6">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`mr-1 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'tutors' && <TutorsTab />}
        {tab === 'coursePricing' && <CoursePricing embedded />}
        {tab === 'offerRules' && <QualificationOfferRulesTab />}
        {tab === 'geoPricing' && <GeoPricingTab />}
      </div>
    </div>
  );
}
