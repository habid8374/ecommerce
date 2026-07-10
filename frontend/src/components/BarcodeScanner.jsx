import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Barcode scanner using the browser's native BarcodeDetector API (Chrome on
 * Android/desktop). No external dependency. Falls back to a clear message when
 * unsupported (e.g. iOS Safari) so the user can type the code manually.
 */
export default function BarcodeScanner({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    let stream = null;
    let raf = null;
    setError("");

    if (!("BarcodeDetector" in window)) {
      setError(
        "Tu navegador no soporta la lectura de código de barras. Usa Chrome en Android, o escribe el código a mano."
      );
      return undefined;
    }

    const detector = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar"],
    });

    const stop = () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        const tick = async () => {
          if (cancelled) return;
          try {
            const codes = await detector.detect(v);
            if (codes && codes.length) {
              onDetected(codes[0].rawValue);
              stop();
              onClose();
              return;
            }
          } catch {
            /* keep scanning */
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setError("No se pudo acceder a la cámara. Concede el permiso o escribe el código a mano.");
      }
    })();

    return stop;
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
            <div className="overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} className="mx-auto max-h-[60vh] w-full object-contain" muted playsInline />
            </div>
            <p className="text-xs text-muted-foreground">
              Apunta la cámara al código de barras del producto. Se asignará automáticamente al detectarlo.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
