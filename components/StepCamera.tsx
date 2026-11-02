import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check, SwitchCamera } from 'lucide-react';
import { Button } from './Button';

interface StepCameraProps {
  onCapture: (imageSrc: string) => void;
}

function getCameraErrorMessage(error: string | DOMException): string {
  const name = typeof error === 'string' ? '' : error.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Necesitamos permiso para usar la cámara. Actívalo en el navegador y pulsa Reintentar.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No encontramos ninguna cámara en este dispositivo.';
  }
  if (name === 'NotReadableError') {
    return 'La cámara está siendo usada por otra aplicación. Ciérrala y pulsa Reintentar.';
  }
  return 'No pudimos abrir la cámara. Comprueba que la página se abre con HTTPS y pulsa Reintentar.';
}

export const StepCamera: React.FC<StepCameraProps> = ({ onCapture }) => {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        setCameraError('No pudimos tomar la foto. Pulsa Reintentar.');
        return;
      }
      setImgSrc(imageSrc);
    }
  }, [webcamRef]);

  const retryCamera = () => {
    setCameraError(null);
    setCameraReady(false);
    setCameraAttempt(prev => prev + 1);
  };

  const retake = () => {
    setImgSrc(null);
    setCameraReady(false);
  };

  const confirm = () => {
    if (imgSrc) {
      onCapture(imgSrc);
    }
  };

  const toggleCamera = () => {
    setCameraReady(false);
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const videoConstraints = {
    width: 720,
    height: 720,
    facingMode: facingMode
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4 space-y-6 animate-fade-in">
      <h2 className="text-3xl md:text-5xl comic-title text-center mb-4 bg-white border-4 border-black px-4 md:px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-[#00338D] max-w-[90vw]">
        IDENTIFICA AL PROTAGONISTA
      </h2>
      
      <div className="relative border-4 md:border-8 border-black bg-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden w-[90vw] md:w-[400px] aspect-square max-w-[400px]">
        {imgSrc ? (
          <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
        ) : cameraError ? (
          <div role="alert" className="flex items-center justify-center w-full h-full p-6 text-center text-white font-bold text-lg">
            {cameraError}
          </div>
        ) : (
          <Webcam
            key={cameraAttempt}
            audio={false}
            disablePictureInPicture={false}
            forceScreenshotSourceSize={false}
            imageSmoothing
            mirrored={facingMode === "user"}
            onUserMedia={() => setCameraReady(true)}
            onUserMediaError={(error) => setCameraError(getCameraErrorMessage(error))}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.92}
            ref={webcamRef}
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover aspect-square"
          />
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-6 md:mt-8 w-[90vw] md:w-auto max-w-[400px]">
        {cameraError && !imgSrc ? (
          <Button onClick={retryCamera} variant="primary" className="flex-1 flex justify-center !py-3 md:!py-4">
            <RefreshCw className="mr-2 w-6 h-6" /> REINTENTAR
          </Button>
        ) : !imgSrc ? (
          <>
            <Button onClick={capture} disabled={!cameraReady} variant="primary" className="flex-1 flex justify-center !py-3 md:!py-4 disabled:opacity-50">
              <Camera className="mr-2 w-6 h-6" /> TOMAR FOTO
            </Button>
            <Button onClick={toggleCamera} variant="secondary" className="flex-none flex justify-center !py-3 md:!py-4" title="Cambiar cámara">
              <SwitchCamera className="w-6 h-6" />
            </Button>
          </>
        ) : (
          <>
            <Button onClick={retake} variant="secondary" className="flex-1 flex justify-center !py-3 md:!py-4">
              <RefreshCw className="mr-2 w-6 h-6" /> REPETIR
            </Button>
            <Button onClick={confirm} variant="primary" className="flex-1 flex justify-center !py-3 md:!py-4">
              <Check className="mr-2 w-6 h-6" /> CONTINUAR
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
