import Field from './Field';

export type PaddingValue = {
  padTop?: number;
  padBot?: number;
  padBottom?: number;
  padLeft?: number;
  padRight?: number;
};

type PaddingKey = 'padTop' | 'padBot' | 'padBottom' | 'padLeft' | 'padRight';

interface Props<T extends PaddingValue> {
  value: T;
  onChange: (patch: Partial<T>) => void;
  min?: number;
  max?: number;
  columns?: 2 | 4;
  defaults?: Partial<Record<PaddingKey, number>>;
  bottomKey?: 'padBot' | 'padBottom';
}

export default function PaddingControl<T extends PaddingValue>({
  value,
  onChange,
  min = 0,
  max = 240,
  columns = 4,
  defaults = {},
  bottomKey = 'padBot',
}: Props<T>) {
  const fields: Array<{ key: PaddingKey; label: string }> = [
    { key: 'padTop', label: 'Top' },
    { key: bottomKey, label: 'Bottom' },
    { key: 'padLeft', label: 'Left' },
    { key: 'padRight', label: 'Right' },
  ];

  return (
    <div className={`grid ${columns === 4 ? 'grid-cols-4' : 'grid-cols-2'} gap-2`}>
      {fields.map(field => (
        <Field key={field.key} label={field.label}>
          <input
            type="number"
            className="input"
            min={min}
            max={max}
            value={Number(value[field.key] ?? defaults[field.key] ?? 0)}
            onChange={e => onChange({ [field.key]: Number(e.target.value) } as Partial<T>)}
          />
        </Field>
      ))}
    </div>
  );
}
