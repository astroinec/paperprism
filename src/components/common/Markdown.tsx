"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkifyCitations } from "@/lib/shared/citations";
import { cn } from "@/lib/shared/utils";

export const Markdown = memo(function Markdown({
  text,
  onCite,
  className,
  streaming,
}: {
  text: string;
  onCite?: (paperIndex: number, page: number | null) => void;
  className?: string;
  streaming?: boolean;
}) {
  return (
    <div className={cn("prose-glass", streaming && "[&>*:last-child]:caret", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const m = href?.match(/^#cite-(\d+)-(\d+)$/);
            if (m) {
              return (
                <a
                  className="cite"
                  onClick={(e) => {
                    e.preventDefault();
                    onCite?.(Number(m[1]), Number(m[2]) || null);
                  }}
                  href={href}
                >
                  {children}
                </a>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {linkifyCitations(text)}
      </ReactMarkdown>
    </div>
  );
});
