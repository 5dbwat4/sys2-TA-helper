"use client";

import { useEffect, useRef, useState } from "react";

interface CameraBarcodeScannerProps {
  onDetected: (code: string) => void;
  isContinuous?: boolean;
  onClose?: () => void;
}

export default function CameraBarcodeScanner({
  onDetected,
  isContinuous = false,
  onClose,
}: CameraBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const nativeDetectorRef = useRef<any>(null);
  const zxingReaderRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  const [error, setError] = useState<string>("");
  const [lastScanned, setLastScanned] = useState<string>("");
  const lastScannedTimeRef = useRef<number>(0);
  const [scannerReady, setScannerReady] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [activeEngine, setActiveEngine] = useState<string>("初始化中...");
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [successFlash, setSuccessFlash] = useState<boolean>(false);

  // Audio & haptic vibration on detection
  const triggerFeedback = () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([80, 40, 80]);
      }
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 chime
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {}
  };

  const handleScannedResult = (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    const now = Date.now();
    // Debounce duplicate scans within 1.5 seconds
    if (text === lastScanned && now - lastScannedTimeRef.current < 1500) {
      return;
    }

    lastScannedTimeRef.current = now;
    setLastScanned(text);
    setSuccessFlash(true);
    triggerFeedback();

    setTimeout(() => {
      setSuccessFlash(false);
    }, 600);

    if (!isContinuous) {
      stopScanning();
    }

    onDetected(text);
  };

  // Toggle mobile flashlight if available
  const toggleTorch = async () => {
    try {
      if (!streamRef.current) return;
      const track = streamRef.current.getVideoTracks()[0];
      if (!track) return;
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn("Torch failed:", e);
    }
  };

  // Load self-hosted ZXing script if not present
  function loadZXing(): Promise<any> {
    if (typeof window !== "undefined" && (window as any).ZXing) {
      return Promise.resolve((window as any).ZXing);
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/zxing.min.js";
      script.onload = () => resolve((window as any).ZXing);
      script.onerror = () => reject(new Error("未能加载 /zxing.min.js 解码库"));
      document.head.appendChild(script);
    });
  }

  const stopScanning = () => {
    isScanningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    let isCancelled = false;

    async function initScanner() {
      try {
        setError("");
        setScannerReady(false);

        // 1. Initialize Native BarcodeDetector (Supported natively in iOS 17+, macOS Sonoma Safari, Chrome)
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          try {
            const allDesired = [
              "code_128",
              "code_39",
              "code_93",
              "ean_13",
              "ean_8",
              "itf",
              "codabar",
              "qr_code",
              "upc_a",
              "upc_e"
            ];
            let supported: string[] = allDesired;
            if (typeof (window as any).BarcodeDetector.getSupportedFormats === "function") {
              const deviceSupported: string[] = await (window as any).BarcodeDetector.getSupportedFormats();
              supported = allDesired.filter(f => deviceSupported.includes(f));
            }
            if (supported.length > 0) {
              nativeDetectorRef.current = new (window as any).BarcodeDetector({ formats: supported });
              setActiveEngine("原生 Vision 硬件加速 (60 FPS)");
            }
          } catch (e) {
            console.warn("BarcodeDetector init warning:", e);
          }
        }

        // 2. Load ZXing engine as secondary decoder
        let ZXing: any = null;
        try {
          ZXing = await loadZXing();
          if (ZXing) {
            const hints = new Map();
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
              ZXing.BarcodeFormat.CODE_128,
              ZXing.BarcodeFormat.CODE_39,
              ZXing.BarcodeFormat.CODE_93,
              ZXing.BarcodeFormat.EAN_13,
              ZXing.BarcodeFormat.EAN_8,
              ZXing.BarcodeFormat.UPC_A,
              ZXing.BarcodeFormat.UPC_E,
              ZXing.BarcodeFormat.ITF,
              ZXing.BarcodeFormat.CODABAR,
              ZXing.BarcodeFormat.QR_CODE,
            ]);
            hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

            const zxingReader = new ZXing.MultiFormatReader();
            zxingReader.setHints(hints);
            zxingReaderRef.current = zxingReader;

            if (!nativeDetectorRef.current) {
              setActiveEngine("ZXing 高精度增强引擎");
            } else {
              setActiveEngine("超强双引擎 (Vision硬件 + ZXing高对比度)");
            }
          }
        } catch (zxErr) {
          console.warn("ZXing fallback load warning:", zxErr);
        }

        if (isCancelled) return;

        // 3. Request high-resolution camera stream
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
        }

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Check torch support & continuous autofocus
        try {
          const track = stream.getVideoTracks()[0];
          const cap = (track as any).getCapabilities?.();
          if (cap && cap.torch) {
            setHasTorch(true);
          }
          if (cap && cap.focusMode && cap.focusMode.includes("continuous")) {
            await (track as any).applyConstraints({
              advanced: [{ focusMode: "continuous" }]
            });
          }
        } catch {}

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        video.autoplay = true;

        await video.play();

        // Wait until video has positive dimensions
        await new Promise<void>((resolve) => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            resolve();
          } else {
            const onPlaying = () => {
              video.removeEventListener("playing", onPlaying);
              resolve();
            };
            video.addEventListener("playing", onPlaying);
          }
        });

        if (isCancelled) return;
        setScannerReady(true);
        isScanningRef.current = true;

        // 4. Offscreen canvases for contrast enhancement & ROI cropping
        const cropCanvas = document.createElement("canvas");
        const cropCtx = cropCanvas.getContext("2d", { willReadFrequently: true });

        let frameCounter = 0;
        let lastScanTimestamp = 0;

        // Detection loop: sequential, runs every 60ms without frame pileup
        const runDetectionLoop = async () => {
          if (!isScanningRef.current) return;

          const now = performance.now();
          if (now - lastScanTimestamp >= 60 && video && !video.paused && !video.ended) {
            lastScanTimestamp = now;
            const vw = video.videoWidth;
            const vh = video.videoHeight;

            if (vw > 0 && vh > 0 && cropCtx) {
              frameCounter++;
              if (frameCounter % 5 === 0) {
                setFrameCount(frameCounter);
              }

              let detected = false;

              // PASS 1: Native BarcodeDetector directly on FULL VIDEO element
              // (Apple Vision framework handles full frame effortlessly at 60 FPS)
              if (nativeDetectorRef.current) {
                try {
                  const barcodes = await nativeDetectorRef.current.detect(video);
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    handleScannedResult(barcodes[0].rawValue);
                    detected = true;
                  }
                } catch {}
              }

              // PASS 2: If full video didn't catch it, crop central ROI with contrast enhancement
              if (!detected) {
                // Focus on center 85% width, 50% height
                const cropW = Math.floor(vw * 0.85);
                const cropH = Math.floor(vh * 0.50);
                const cropX = Math.floor((vw - cropW) / 2);
                const cropY = Math.floor((vh - cropH) / 2);

                if (cropCanvas.width !== cropW || cropCanvas.height !== cropH) {
                  cropCanvas.width = cropW;
                  cropCanvas.height = cropH;
                }

                // Apply high-contrast filter to make thin 1D barcode lines pop
                cropCtx.filter = "contrast(180%) brightness(105%) grayscale(100%)";
                cropCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

                // Pass 2A: Native BarcodeDetector on cropped high-contrast canvas
                if (nativeDetectorRef.current) {
                  try {
                    const barcodes = await nativeDetectorRef.current.detect(cropCanvas);
                    if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                      handleScannedResult(barcodes[0].rawValue);
                      detected = true;
                    }
                  } catch {}
                }

                // Pass 2B: ZXing on cropped high-contrast canvas using GlobalHistogramBinarizer
                if (!detected && zxingReaderRef.current && (window as any).ZXing) {
                  const ZX = (window as any).ZXing;
                  try {
                    const lum = new ZX.HTMLCanvasElementLuminanceSource(cropCanvas);
                    // Use GlobalHistogramBinarizer (superior for 1D barcodes compared to HybridBinarizer)
                    const BinarizerClass = ZX.GlobalHistogramBinarizer || ZX.HybridBinarizer;
                    const bitmap = new ZX.BinaryBitmap(new BinarizerClass(lum));
                    const result = zxingReaderRef.current.decode(bitmap);
                    if (result && result.getText()) {
                      handleScannedResult(result.getText());
                      detected = true;
                    }
                  } catch {
                    // Try inverted contrast (white bars on dark background or glare)
                    if (frameCounter % 2 === 0) {
                      try {
                        const lum = new ZX.HTMLCanvasElementLuminanceSource(cropCanvas);
                        const invLum = lum.invert();
                        const BinarizerClass = ZX.GlobalHistogramBinarizer || ZX.HybridBinarizer;
                        const invBitmap = new ZX.BinaryBitmap(new BinarizerClass(invLum));
                        const invResult = zxingReaderRef.current.decode(invBitmap);
                        if (invResult && invResult.getText()) {
                          handleScannedResult(invResult.getText());
                          detected = true;
                        }
                      } catch {}
                    }
                  }
                }
              }
            }
          }

          if (isScanningRef.current) {
            animFrameRef.current = requestAnimationFrame(runDetectionLoop);
          }
        };

        animFrameRef.current = requestAnimationFrame(runDetectionLoop);
      } catch (err: any) {
        console.error("Scanner setup error:", err);
        if (!isCancelled) {
          setError(
            err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
              ? "请在 Safari 或系统设置中允许本网站访问摄像头权限。"
              : "无法启动摄像头扫描: " + (err.message || "未知错误")
          );
        }
      }
    }

    initScanner();

    return () => {
      isCancelled = true;
      stopScanning();
    };
  }, []);

  // Handle manual high-res photo capture decoding
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingImage(true);
    setError("");

    try {
      const imgUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = async () => {
        try {
          let detectedText = "";

          // 1. Try Native BarcodeDetector on full image
          if (nativeDetectorRef.current) {
            try {
              const barcodes = await nativeDetectorRef.current.detect(img);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                detectedText = barcodes[0].rawValue;
              }
            } catch {}
          }

          // 2. Try ZXing with contrast boost
          if (!detectedText && (window as any).ZXing && zxingReaderRef.current) {
            const ZX = (window as any).ZXing;
            const offCanvas = document.createElement("canvas");
            offCanvas.width = img.naturalWidth || img.width;
            offCanvas.height = img.naturalHeight || img.height;
            const offCtx = offCanvas.getContext("2d");
            if (offCtx) {
              offCtx.filter = "contrast(180%) brightness(105%) grayscale(100%)";
              offCtx.drawImage(img, 0, 0);
              const lum = new ZX.HTMLCanvasElementLuminanceSource(offCanvas);
              const BinarizerClass = ZX.GlobalHistogramBinarizer || ZX.HybridBinarizer;
              try {
                const bitmap = new ZX.BinaryBitmap(new BinarizerClass(lum));
                const res = zxingReaderRef.current.decode(bitmap);
                if (res && res.getText()) {
                  detectedText = res.getText();
                }
              } catch {
                try {
                  const invBitmap = new ZX.BinaryBitmap(new BinarizerClass(lum.invert()));
                  const invRes = zxingReaderRef.current.decode(invBitmap);
                  if (invRes && invRes.getText()) {
                    detectedText = invRes.getText();
                  }
                } catch {}
              }
            }
          }

          if (detectedText) {
            handleScannedResult(detectedText);
          } else {
            setError("未能从拍摄的照片中解析出条形码，请确保对焦清晰并贴近条形码拍摄。");
          }
        } catch (decErr: any) {
          setError("未能识别条形码: " + decErr.message);
        } finally {
          URL.revokeObjectURL(imgUrl);
          setProcessingImage(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };

      img.onerror = () => {
        setError("无法读取拍摄的图片");
        setProcessingImage(false);
      };

      img.src = imgUrl;
    } catch (err: any) {
      setError("解析照片异常: " + err.message);
      setProcessingImage(false);
    }
  };

  return (
    <div className="dark-surface relative rounded-2xl overflow-hidden bg-black/95 border border-white/20 shadow-2xl flex flex-col items-center">
      {/* Viewfinder Window */}
      <div className="relative w-full aspect-[4/3] max-w-lg overflow-hidden flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />

        {/* Success recognition flash */}
        {successFlash && (
          <div className="absolute inset-0 bg-emerald-500/40 border-4 border-emerald-400 z-30 pointer-events-none animate-pulse flex items-center justify-center">
            <div className="px-5 py-2.5 rounded-2xl bg-black/80 text-emerald-300 font-mono font-bold text-lg shadow-2xl backdrop-blur-md flex items-center gap-2">
              <span>✓</span> {lastScanned}
            </div>
          </div>
        )}

        {/* Reticle / Scanning Guide Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[85%] h-[52%] border-2 border-emerald-400 rounded-2xl relative shadow-[0_0_35px_rgba(52,211,153,0.45)]">
            {/* Red Laser Scanning Line */}
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.9)]" />

            {/* Corner Indicators */}
            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br" />

            <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] bg-emerald-500/30 text-emerald-300 rounded font-semibold backdrop-blur-sm">
              对准开发板条形码
            </div>
            <div className="absolute bottom-2 left-2 px-2 py-0.5 text-[10px] text-zinc-300 bg-black/60 rounded backdrop-blur-sm font-mono">
              Code128 / Code39 / QR
            </div>
          </div>
        </div>

        {/* Top Control Bar inside camera view */}
        <div className="absolute top-3 inset-x-3 flex justify-between items-center z-10">
          <div className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-black/60 text-emerald-400 border border-emerald-500/30 backdrop-blur-md flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {frameCount > 0 ? `高速扫描: ${frameCount} 帧` : "启动中..."}
          </div>

          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md transition ${
                  torchOn
                    ? "bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] font-bold"
                    : "bg-black/60 text-zinc-200 border-white/20 hover:bg-black/80"
                }`}
              >
                {torchOn ? "🔦 关补光" : "🔦 开补光"}
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={() => {
                  stopScanning();
                  onClose();
                }}
                className="w-7 h-7 rounded-full bg-black/60 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center text-xs backdrop-blur-md transition"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Loading status */}
        {!scannerReady && !error && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center p-4 z-20">
            <div className="w-9 h-9 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium text-zinc-200">正在启动摄像头与硬件识别引擎...</p>
            <p className="text-xs text-zinc-400 mt-1">{activeEngine}</p>
          </div>
        )}

        {/* Processing photo status */}
        {processingImage && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center p-4 z-20">
            <div className="w-9 h-9 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium text-sky-200">正在高清解析拍摄照片中的条形码...</p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/90 p-5 flex flex-col items-center justify-center text-center z-20">
            <span className="text-3xl mb-2">⚠️</span>
            <p className="text-rose-400 text-sm font-semibold mb-2">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError("");
                window.location.reload();
              }}
              className="mt-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-zinc-200 border border-white/10"
            >
              重新尝试
            </button>
          </div>
        )}
      </div>

      {/* Bottom Status & Fallback Toolbar */}
      <div className="w-full p-3.5 bg-zinc-900/90 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 text-center sm:text-left">
          <div className="text-xs text-zinc-300 font-medium flex items-center justify-center sm:justify-start gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {activeEngine}
          </div>
          {lastScanned && (
            <div className="text-[11px] text-emerald-400 font-mono">
              已识别: <span className="font-bold">{lastScanned}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* High-res Photo Fallback */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoCapture}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-zinc-200 border border-white/15 transition flex items-center gap-1.5"
            title="遇到反光、弯曲或细小条码时，可直接拍照解析"
          >
            <span>📸</span> 拍照精准识别
          </button>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                stopScanning();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
