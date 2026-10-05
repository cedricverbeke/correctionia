import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  content: string;
  className?: string;
}

function isLatex(text: string): boolean {
  return /\\(begin|end|frac|sqrt|sum|int|prod|alpha|beta|gamma|delta|epsilon|lambda|mu|pi|sigma|theta|infty|partial|nabla|cdot|times|div|leq|geq|neq|approx|equiv|subset|supset|in|notin|cup|cap|forall|exists|mathbb|mathcal|mathrm|mathbf|left|right|vec|hat|bar|dot|overline|underline|section|subsection|textbf|textit|emph|item|enumerate|equation|align|matrix|pmatrix|bmatrix|vmatrix|cases|array)/.test(text)
    || /\$[^$]+\$/.test(text)
    || /\$\$[^$]+\$\$/.test(text);
}

function renderLatexToHtml(text: string): string {
  // Split by display math ($$...$$) first, then inline math ($...$)
  const parts: string[] = [];
  let remaining = text;

  // Handle display math $$...$$
  const displayRegex = /\$\$([\s\S]+?)\$\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = displayRegex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderInlineMath(remaining.slice(lastIndex, match.index)));
    }
    try {
      parts.push(katex.renderToString(match[1], { displayMode: true, throwOnError: false }));
    } catch {
      parts.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < remaining.length) {
    parts.push(renderInlineMath(remaining.slice(lastIndex)));
  }

  return parts.join('');
}

function renderInlineMath(text: string): string {
  const parts: string[] = [];
  const inlineRegex = /\$([^$]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)));
    }
    try {
      parts.push(katex.renderToString(match[1], { displayMode: false, throwOnError: false }));
    } catch {
      parts.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)));
  }

  return parts.join('');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, '<br/>');
}

export function LatexRenderer({ content, className }: LatexRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (isLatex(content)) {
      // If it looks like full LaTeX document (has \begin{document} or no $ delimiters but has LaTeX commands),
      // try to render the whole thing as math
      let html: string;
      if (!content.includes('$') && /\\(frac|sqrt|sum|int|begin|alpha|beta|gamma|pi|sigma|infty)/.test(content)) {
        // Treat as display math if no $ delimiters but has LaTeX math commands
        try {
          html = katex.renderToString(content, { displayMode: true, throwOnError: false });
        } catch {
          html = escapeHtml(content);
        }
      } else {
        html = renderLatexToHtml(content);
      }
      containerRef.current.innerHTML = html;
    } else {
      // Plain text — just render with line breaks
      containerRef.current.textContent = content;
      containerRef.current.innerHTML = escapeHtml(content);
    }
  }, [content]);

  return <div ref={containerRef} className={className} />;
}
