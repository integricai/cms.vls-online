import SalesTab from './SalesTab';

export default function Sales() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Sales</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Course sales, tutor claims, and commission tracking.
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        <SalesTab />
      </div>
    </div>
  );
}
