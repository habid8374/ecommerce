import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Barcode scanner that works across devices:
 *  - Uses the native BarcodeDetector API when available (Chrome Android/desktop).
 *  - Falls back to the ZXing library (loaded on-demand from a CDN) on browsers
 *    without it, notably iPhone / Safari.
 */
const ZXING_SRC = "https://cdn.jsdelivr.net/npm/@zxing/library@0.19.1/umd/index.min.js";

let zxingPromise = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (zxingPromise) return zxingPromise;
  zxingPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = ZXING_SRC;
    s.async = true;
    s.onload = () => resolve(window.ZXing);
    s.onerror = () => reject(new Error("No se pudo cargar el lector de códigos."));
    document.head.appendChild(s);
  });
  return zxingPromise;
}

export default function BarcodeScanner({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    let stream = null;
    let raf = null;
    let zxingReader = null;
    setError("");
    setLoading(true);

    const done = (code) => {
      if (cancelled) return;
      onDetected(code);
      cleanup();
      onClose();
    };

    const cleanup = () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (zxingReader) {
        try { zxingReader.reset(); } catch { /* noop */ }
      }
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };

    async function startNative() {
      const detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar"],
      });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (cancelled) return;
      const v = videoRef.current;
      v.srcObject = stream;
      await v.play();
      setLoading(false);
      const tick = async () => {
        if (cancelled) return;
        try {
          const codes = await detector.detect(v);
          if (codes && codes.length) return done(codes[0].rawValue);
        } catch { /* keep scanning */ }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    async function startZxing() {
      const ZXing = await loadZXing();
      if (cancelled) return;
      zxingReader = new ZXing.BrowserMultiFormatReader();
      let deviceId = null;
      try {
        const devices = await zxingReader.listVideoInputDevices();
        const back = devices.find((d) => /back|rear|tras|environment/i.test(d.label));
        deviceId = (back || devices[devices.length - 1])?.deviceId || null;
      } catch { /* labels may be hidden until permission granted */ }
      if (cancelled) return;
      setLoading(false);
      await zxingReader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
        if (result) done(result.getText());
      });
    }

    (async () => {
      try {
        if ("BarcodeDetector" in window) await startNative();
        else await startZxing();
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "No se pudo acceder a la cámara. Concede el permiso o escribe el código a mano.");
          setLoading(false);
        }
      }
    })();

    return cleanup;
  }, [open, onDetected, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escanear código de barras</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} className="mx-auto max-h-[60vh] w-full object-contain" muted playsInline autoPlay />
              {loading && (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                  Iniciando cámara...
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Apunta la cámara al código de barras. Se asignará automáticamente al detectarlo.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
