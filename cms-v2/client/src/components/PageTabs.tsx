export type PageTab = {
  id: string;
  label: string;
};

export default function PageTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: PageTab[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (tabs.length < 2) return null;

  return (
    <div className="flex shrink-0 border-b border-slate-200 bg-white px-6">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`mr-1 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            value === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
