"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImageUp, Loader2, Trash2, Undo2 } from "lucide-react";
import { clsx } from "clsx";
import { secondaryButtonClass } from "./styles";

interface Props {
  /** Form field prefix: the picker submits `<name>File`, and `<name>Remove=1` when the current image is removed. */
  name: string;
  label: string;
  hint?: string;
  /** Image already on file, shown until replaced or removed. */
  currentUrl?: string | null;
  /** Longest side after resizing, in pixels. */
  maxDimension: number;
  shape?: "circle" | "rect";
}

const JPEG_QUALITY = 0.85;

/** Downscales to `maxDimension` and re-encodes as JPEG; keeps the original when that would not make it smaller. */
async function shrinkImage(file: File, maxDimension: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return file;
  // JPEG has no alpha: paint white first so transparent PNG areas do not turn black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

/**
 * Image picker for forms that submit with `new FormData(form)`: the chosen file is resized in the browser and put
 * back into the file input, so the server action receives the smaller file with no extra wiring.
 */
export default function ImageUploadField({ name, label, hint, currentUrl, maxDimension, shape = "rect" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const clearPicked = () => {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
  };

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const picked = input.files?.[0];
    setError(null);
    if (!picked) return clearPicked();
    if (!picked.type.startsWith("image/")) {
      setError("Choose an image file (JPEG, PNG or WebP)");
      return clearPicked();
    }

    setProcessing(true);
    try {
      const file = await shrinkImage(picked, maxDimension);
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      setPreview(URL.createObjectURL(file));
      setRemoved(false);
    } catch {
      setError("This image could not be read. Try a JPEG or PNG.");
      clearPicked();
    } finally {
      setProcessing(false);
    }
  };

  const shown = preview ?? (removed ? null : (currentUrl ?? null));

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-700">{label}</p>
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            "shrink-0 overflow-hidden border border-slate-200 bg-surface-muted grid place-items-center",
            shape === "circle" ? "w-16 h-16 rounded-full" : "w-24 h-16 rounded-lg"
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt={`${label} preview`} className={clsx("w-full h-full", shape === "circle" ? "object-cover" : "object-contain")} />
          ) : (
            <ImageUp className="w-5 h-5 text-slate-400" aria-hidden />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <label
            className={clsx(
              secondaryButtonClass,
              "inline-flex items-center gap-1.5 cursor-pointer text-xs py-1.5 px-3 focus-within:ring-2 focus-within:ring-brand-600/30 focus-within:border-brand-600"
            )}
          >
            {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <ImageUp className="w-3.5 h-3.5" aria-hidden />}
            {shown ? "Replace" : "Choose image"}
            <span className="sr-only"> for {label}</span>
            <input
              ref={inputRef}
              type="file"
              name={`${name}File`}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleChange}
              disabled={processing}
              aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
              aria-invalid={error ? true : undefined}
              className="sr-only"
            />
          </label>
          {preview && (
            <button type="button" onClick={clearPicked} className={clsx(secondaryButtonClass, "inline-flex items-center gap-1.5 text-xs py-1.5 px-3")}>
              <Undo2 className="w-3.5 h-3.5" aria-hidden /> {currentUrl && !removed ? "Keep current" : "Clear"}
            </button>
          )}
          {!preview && currentUrl && (
            <button
              type="button"
              onClick={() => setRemoved((value) => !value)}
              aria-pressed={removed}
              className={clsx(secondaryButtonClass, "inline-flex items-center gap-1.5 text-xs py-1.5 px-3")}
            >
              {removed ? <Undo2 className="w-3.5 h-3.5" aria-hidden /> : <Trash2 className="w-3.5 h-3.5" aria-hidden />}
              {removed ? "Undo remove" : "Remove"}
            </button>
          )}
        </div>
      </div>
      {removed && !preview && <input type="hidden" name={`${name}Remove`} value="1" />}
      {hint && (
        <p id={hintId} className="text-[11px] text-slate-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[11px] font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
