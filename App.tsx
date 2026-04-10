import React, { useState } from 'react';
import { StepCamera } from './components/StepCamera';
import { StepForm } from './components/StepForm';
import { ComicPrintView } from './components/ComicPrintView';
import { AppStep, UserData, ComicPages } from './types';
import { generateComicBook } from './services/geminiService';
import { Button } from './components/Button';
import { Loader2, Zap } from 'lucide-react';

const INITIAL_DATA: UserData = {
  photo: null,
  userName: '',
  worstMoment: '',
  bestMoment: ''
};

function App() {
  const [step, setStep] = useState<AppStep>(AppStep.WELCOME);
  const [userData, setUserData] = useState<UserData>(INITIAL_DATA);
  const [comicPages, setComicPages] = useState<ComicPages | null>(null);
  const [loadingText, setLoadingText] = useState("Entintando las viñetas...");

  const handleCapture = (imageSrc: string) => {
    setUserData(prev => ({ ...prev, photo: imageSrc }));
    setStep(AppStep.FORM);
  };

  const handleFormSubmit = async (data: Partial<UserData>) => {
    const completeData = { ...userData, ...data };
    setUserData(completeData);
    setStep(AppStep.GENERATING);

    // Dynamic Loading Texts (Spanish)
    const msgs = [
      "Diseñando la portada...", 
      "Creando al villano...", 
      "Añadiendo sombras dramáticas...", 
      "Coloreando la victoria...", 
      "Imprimiendo los diálogos...",
      "Casi listo..."
    ];
    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % msgs.length;
      setLoadingText(msgs[msgIdx]);
    }, 2500);

    try {
      const pages = await generateComicBook(completeData);
      setComicPages(pages);
      setStep(AppStep.PREVIEW);
    } catch (error) {
      console.error(error);
      alert("Error al generar el cómic. Por favor intenta de nuevo. " + (error instanceof Error ? error.message : ""));
      setStep(AppStep.FORM);
    } finally {
      clearInterval(interval);
    }
  };

  const handleReset = () => {
    setUserData(INITIAL_DATA);
    setComicPages(null);
    setStep(AppStep.WELCOME);
  };

  // Render Logic
  const renderStep = () => {
    switch (step) {
      case AppStep.WELCOME:
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center space-y-8 animate-fade-in text-white">
            <h1 className="text-6xl md:text-8xl comic-title text-white">
              MAKE YOUR HISTORY
            </h1>
            <p className="text-xl md:text-3xl font-bold max-w-2xl bg-white border-4 border-black p-4 md:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transform -rotate-1 text-[#00338D]">
              ¡Convierte tu historia en KPMG en un cómic único!
            </p>
            <div className="pt-8 w-full px-4 max-w-md md:max-w-none">
              <Button
                variant="cta"
                onClick={() => setStep(AppStep.CAMERA)}
                className="w-full md:w-auto text-lg md:text-2xl px-6 md:px-12 py-4 md:py-6 flex justify-center items-center"
              >
                COMENZAR{' '}
                <Zap className="ml-2 w-6 h-6 md:w-8 md:h-8 fill-yellow-400 text-yellow-400 flex-shrink-0" />
              </Button>
            </div>

            {/* Decorative Elements */}
            <div className="hidden md:block fixed top-10 left-10 w-32 h-32 bg-[#00A3A1] rounded-full border-4 border-black opacity-20 pointer-events-none" />
            <div className="hidden md:block fixed bottom-10 right-10 w-48 h-48 bg-[#1E49E2] rotate-12 border-4 border-black opacity-20 pointer-events-none" />
          </div>
        );

      case AppStep.CAMERA:
        return (
          <div className="h-screen w-screen bg-dots bg-[length:20px_20px] text-white">
            <StepCamera onCapture={handleCapture} />
          </div>
        );

      case AppStep.FORM:
        return (
          <div className="h-screen w-screen bg-dots overflow-y-auto py-10 text-white">
            <StepForm initialData={userData} onSubmit={handleFormSubmit} />
          </div>
        );

      case AppStep.GENERATING:
        return (
          <div className="flex flex-col items-center justify-center h-screen bg-[#1E49E2] text-white p-4 text-center">
            <Loader2 className="w-24 h-24 animate-spin text-yellow-400 mb-8" />
            <h2 className="text-4xl comic-title animate-pulse mb-4">
              LA IA ESTÁ DIBUJANDO TU DESTINO...
            </h2>
            <p className="text-2xl font-mono text-cyan-400">
              {loadingText}
            </p>
          </div>
        );

      case AppStep.PREVIEW:
        if (!comicPages) return null;
        return (
          <ComicPrintView comic={comicPages} onReset={handleReset} />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#1E49E2] bg-[radial-gradient(#ffffff11_1px,transparent_1px)] bg-[length:20px_20px] print:!min-h-0 print:!bg-white print:[background-image:none]">
      {renderStep()}
    </div>
  );
}

export default App;
