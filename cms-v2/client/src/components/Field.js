import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Field({ label, hint, children, className = '' }) {
    return (_jsxs("div", { className: `mb-3 ${className}`, children: [_jsxs("label", { className: "field-label", children: [label, hint && _jsx("span", { className: "field-hint", children: hint })] }), children] }));
}
