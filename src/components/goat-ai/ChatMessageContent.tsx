import React from "react";

interface ChatMessageContentProps {
  content: string;
  isUser?: boolean;
}

/**
 * Clean and safe message renderer for GIA Web Chat.
 * Parses headings, bullet lists, bold text, key-values and paragraphs
 * without raw markdown markup leaking to the UI.
 */
export const ChatMessageContent: React.FC<ChatMessageContentProps> = ({ content, isUser }) => {
  if (!content) return null;

  if (isUser) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  // Split content by paragraphs / line blocks
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let currentList: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`${keyPrefix}_list`} className="my-2.5 space-y-1.5 pl-1 text-xs">
          {currentList.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-primary font-bold select-none">•</span>
              <span className="flex-1 leading-relaxed">{renderInlineFormatted(item)}</span>
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    // Empty lines
    if (!line) {
      flushList(`line_${index}`);
      return;
    }

    // Horizontal rules (--- or ___)
    if (/^[-*_]{3,}$/.test(line)) {
      flushList(`line_${index}`);
      elements.push(<hr key={`hr_${index}`} className="my-3 border-border/50" />);
      return;
    }

    // Headings (### Title, ## Title, # Title)
    const headingMatch = line.match(/^#{1,4}\s+(.*)$/);
    if (headingMatch) {
      flushList(`line_${index}`);
      const title = headingMatch[1];
      elements.push(
        <h4
          key={`h_${index}`}
          className="font-display font-bold text-sm text-foreground mt-3 mb-1.5 flex items-center gap-1.5"
        >
          {renderInlineFormatted(title)}
        </h4>
      );
      return;
    }

    // Bullet items (• item, - item, * item, · item)
    const bulletMatch = line.match(/^([•*·\-])\s+(.*)$/);
    if (bulletMatch) {
      currentList.push(bulletMatch[2]);
      return;
    }

    // Regular line / paragraph
    flushList(`line_${index}`);
    elements.push(
      <p key={`p_${index}`} className="my-1.5 leading-relaxed">
        {renderInlineFormatted(line)}
      </p>
    );
  });

  flushList("final");

  return <div className="space-y-1">{elements}</div>;
};

/**
 * Formats inline bold (**text** or *text*), monospace (`code`), and key-values (Label: value)
 */
function renderInlineFormatted(text: string): React.ReactNode {
  // Replace **bold** with <strong>
  // We split by regex tokens
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={i} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(1, -1)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-surface border border-border/60 font-mono text-[11px] text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
