import { useCallback } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export default function ColorPicker({ value, onChange }: Props) {
  const safe = HEX_RE.test(value) ? value : '#ffffff';

  const handleText = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
  }, [onChange]);

  const handlePicker = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div className="flex gap-2 items-center">
      <input
        type="color"
        value={safe}
        onChange={handlePicker}
        className="h-9 w-10 cursor-pointer rounded-lg border border-slate-200 p-0.5"
      />
      <input
        type="text"
        value={value}
        onChange={handleText}
        maxLength={7}
        placeholder="#ffffff"
        className="input flex-1"
      />
    </div>
  );
}
