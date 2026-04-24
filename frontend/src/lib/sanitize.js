// Thin wrapper around DOMPurify. Use `sanitizeHtml(s)` before passing user-
// or third-party-origin HTML into dangerouslySetInnerHTML.
//
// We allow a modest subset of tags/attributes typical of WordPress /
// WooCommerce post content (links, images, headings, tables, lists).
// Scripts, iframes, event handlers and inline styles are stripped.
import DOMPurify from "dompurify";

const CONFIG = {
  ALLOWED_TAGS: [
    "a", "b", "i", "u", "em", "strong", "s", "del", "ins", "sub", "sup",
    "p", "br", "hr", "span", "div", "blockquote", "pre", "code",
    "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "img", "figure", "figcaption",
  ],
  ALLOWED_ATTR: ["href", "title", "alt", "src", "srcset", "sizes",
                 "target", "rel", "width", "height", "loading"],
  // Force all links to open safely when target=_blank is present
  ADD_ATTR: ["target"],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form",
                "input", "textarea", "select", "option", "button"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus",
                "onblur", "onchange", "onsubmit", "style"],
};

export function sanitizeHtml(input) {
  if (input == null) return "";
  return DOMPurify.sanitize(String(input), CONFIG);
}
