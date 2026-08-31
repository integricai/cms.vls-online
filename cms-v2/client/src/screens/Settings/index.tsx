import { useState } from 'react';
import MenuManagement from '../MenuManagement';
import UserManagement from '../UserManagement';
import DiscountCodes from '../DiscountCodes';
import SitemapScreen from '../Sitemap';

type Tab = 'menu' | 'discountCodes' | 'sitemap' | 'payments' | 'users';

function PaymentsTab() {
  return (
    <div className="p-6">
      <h2 className="mb-1 text-sm font-bold text-slate-700">Payments</h2>
      <p className="text-xs text-slate-500">Payment gateway configuration coming soon.</p>
    </div>
  );
}

const TAB_LABELS: Record<Tab, string> = {
  menu: 'Menu Settings',
  discountCodes: 'Discount Codes',
  sitemap: 'Sitemap',
  payments: 'Payments',
  users: 'Users',
};

export default function Settings() {
  const [tab, setTab] = useState<Tab>('menu');

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Admin Settings</h1>
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
        {tab === 'menu' && <MenuManagement />}
        {tab === 'discountCodes' && <DiscountCodes />}
        {tab === 'sitemap' && <SitemapScreen />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'users' && <UserManagement />}
      </div>
    </div>
  );
}
