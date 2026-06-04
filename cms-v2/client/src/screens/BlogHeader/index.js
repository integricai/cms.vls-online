import { jsx as _jsx } from "react/jsx-runtime";
import { HeaderEditor } from '../Header';
import { generateBlogHeaderHtml } from './generateHtml';
export default function BlogHeader() {
    return (_jsx(HeaderEditor, { title: "Blog Header", subtitle: "Blog page header with Zenler blog chrome cleanup", contentKey: "vls-blog-header-config", generateHtml: generateBlogHeaderHtml, commentName: "Blog Header", publicPublishPath: null }));
}
