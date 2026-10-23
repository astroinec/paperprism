"use client";

import { ExternalLink } from "lucide-react";
import { Modal } from "@/components/glass/overlay";
import { Button } from "@/components/glass";
import { fmt, usePrefs } from "@/lib/client/prefs";

export function PdfViewer({ paperId, title, page, onClose }: { paperId: string | null; title?: string; page?: number | null; onClose: () => void }) {
  const { d } = usePrefs();
  const src = paperId ? `/api/papers/${paperId}/file#page=${page ?? 1}` : "";
  return (
    <Modal
      open={!!paperId}
      onClose={onClose}
      width="max-w-6xl"
      title={
        <span className="flex items-center gap-2">
          <span className="line-clamp-1">{title}</span>
          {page ? <span className="shrink-0 text-sm font-normal text-muted">· {fmt(d.ws.cell.page, { n: page })}</span> : null}
        </span>
      }
      footer={
        <a href={src} target="_blank" rel="noreferrer">
          <Button size="sm" icon={<ExternalLink className="size-3.5" />}>
            {d.common.open}
          </Button>
        </a>
      }
    >
      {paperId && <iframe key={src} src={src} className="h-[72vh] w-full rounded-2xl border border-line bg-white" title="pdf" />}
    </Modal>
  );
}
