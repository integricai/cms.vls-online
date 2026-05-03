import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback } from 'react';
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export default function ColorPicker({ value, onChange }) {
    const safe = HEX_RE.test(value) ? value : '#ffffff';
    const handleText = useCallback((e) => {
        const v = e.target.value;
        onChange(v);
    }, [onChange]);
    const handlePicker = useCallback((e) => {
        onChange(e.target.value);
    }, [onChange]);
    return (_jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: safe, onChange: handlePicker, className: "h-9 w-10 cursor-pointer rounded-lg border border-slate-200 p-0.5" }), _jsx("input", { type: "text", value: value, onChange: handleText, maxLength: 7, placeholder: "#ffffff", className: "input flex-1" })] }));
}
