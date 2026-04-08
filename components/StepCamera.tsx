import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check } from 'lucide-react';
import { Button } from './Button';

interface StepCameraProps {
  onCapture: (imageSrc: string) => void;
}

export const StepCamera: React.FC<StepCameraProps> = ({ onCapture }) => {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setImgSrc(imageSrc);
    }
  }, [webcamRef]);

  const retake = () => {
    setImgSrc(null);
  };

  const confirm = () => {
    if (imgSrc) {
      onCapture(imgSrc);
    }
  };

  const videoConstraints = {
    width: 720,
    height: 720,
    facingMode: "user"
  };

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 animate-fade-in">
      <h2 className="text-4xl md:text-5xl comic-title text-center mb-4 bg-white border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-[#00338D]">
        IDENTIFICA AL PROTAGONISTA
      </h2>
      
      <div className="relative border-8 border-black bg-black rounded-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        {imgSrc ? (
          <img src={imgSrc} alt="Captured" className="w-[400px] h-[400px] object-cover" />
        ) : (
          <Webcam
            audio={false}
            disablePictureInPicture={false}
            forceScreenshotSourceSize={false}
            imageSmoothing
            mirrored={false}
            onUserMedia={() => undefined}
            onUserMediaError={() => undefined}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.92}
            ref={webcamRef}
            videoConstraints={videoConstraints}
            className="w-[400px] h-[400px] object-cover"
          />
        )}
      </div>

      <div className="flex gap-4 mt-8">
        {!imgSrc ? (
          <Button onClick={capture} variant="primary">
            <Camera className="mr-2 w-6 h-6" /> TOMAR FOTO
          </Button>
        ) : (
          <>
            <Button onClick={retake} variant="secondary">
              <RefreshCw className="mr-2 w-6 h-6" /> REPETIR
            </Button>
            <Button onClick={confirm} variant="primary">
              <Check className="mr-2 w-6 h-6" /> CONTINUAR
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
