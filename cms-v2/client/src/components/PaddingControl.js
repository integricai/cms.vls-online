import { jsx as _jsx } from "react/jsx-runtime";
import Field from './Field';
export default function PaddingControl({ value, onChange, min = 0, max = 240, columns = 4, defaults = {}, bottomKey = 'padBot', }) {
    const fields = [
        { key: 'padTop', label: 'Top' },
        { key: bottomKey, label: 'Bottom' },
        { key: 'padLeft', label: 'Left' },
        { key: 'padRight', label: 'Right' },
    ];
    return (_jsx("div", { className: `grid ${columns === 4 ? 'grid-cols-4' : 'grid-cols-2'} gap-2`, children: fields.map(field => (_jsx(Field, { label: field.label, children: _jsx("input", { type: "number", className: "input", min: min, max: max, value: Number(value[field.key] ?? defaults[field.key] ?? 0), onChange: e => onChange({ [field.key]: Number(e.target.value) }) }) }, field.key))) }));
}
