"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Drag-and-drop intake slot. Upload stages the file; we then kick off
// classification for each created row and refresh when done.
export default function UploadTray() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setBusy(`Feeding ${list.length} document${list.length > 1 ? "s" : ""} into the slot…`);
      try {
        const form = new FormData();
        list.forEach((f) => form.append("files", f));
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "upload failed");
        if (data.rejected?.length) {
          alert(`Skipped (PDF/JPG/PNG only): ${data.rejected.join(", ")}`);
        }
        setBusy("Reading & classifying… (Claude is squinting at your scan)");
        await Promise.all(
          (data.created as string[]).map((id) =>
            fetch("/api/classify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            })
          )
        );
        router.refresh();
      } catch (err) {
        alert(String(err));
      } finally {
        setBusy(null);
      }
    },
    [router]
  );

  return (
    <div
      className={`border-2 border-dashed p-4 text-center transition-colors cursor-pointer ${
        dragOver ? "border-tab bg-paper-dark" : "border-faded"
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      {busy ? (
        <p className="mono text-sm animate-pulse">{busy}</p>
      ) : (
        <p className="mono text-sm">
          <span className="typewriter text-base">DOCUMENT SLOT</span>
          <br />
          drop PDFs / photos here, or click to browse
        </p>
      )}
    </div>
  );
}
