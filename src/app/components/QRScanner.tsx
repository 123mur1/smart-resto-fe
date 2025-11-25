"use client";

import { useEffect, useRef } from "react";
import QrScanner from "qr-scanner";

interface QRScannerProps {
  onScan: (data: string) => void;
}

/**
 * A live camera-based QR code scanner.
 * Uses the device's webcam to read student meal QR codes.
 */
export default function QRScanner({ onScan }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // Initialize QR scanner
    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        if (result?.data) {
          onScan(result.data);
        }
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
      }
    );

    scannerRef.current = scanner;
    scanner.start().catch((err) => console.error("QR Scanner Error:", err));

    // Cleanup on unmount
    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center">
      <video
        ref={videoRef}
        className="rounded-lg shadow-md border border-gray-300 w-full max-w-md"
      />
      <p className="text-sm text-gray-500 mt-2">
        Point your camera at a student’s QR code
      </p>
    </div>
  );
}
