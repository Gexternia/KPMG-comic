/* 
   Nota: Debes agregar esto en index.css:
   @font-face {
     font-family: 'KPMGBold';
     src: url('/fonts/KPMGBold.woff2') format('woff2');
     font-weight: bold;
     font-style: normal;
   }
*/
import React from 'react';
import { ComicPages } from '../types';
import { Printer, RefreshCcw } from 'lucide-react';
import { Button } from './Button';

/** Páginas 5 y 6 del fanzine (no generadas por IA): gráficas de marca / evento */
const FANZINE_PAGE_5_SRC = '/fanzine/Imagen pagina 6.jpg';
const FANZINE_PAGE_6_SRC = '/fanzine/page-alumni-madrid.png';

/** Fondo detrás de viñetas IA con object-contain: lee como “marco” de marca, no como papel roto */
const PRINT_PANEL_BG =
  'bg-[linear-gradient(155deg,#f2f6fd_0%,#e2eaf7_40%,#cfdcf0_100%)]';

interface ComicPrintViewProps {
  comic: ComicPages;
  userName: string;
  onReset: () => void;
}

export const ComicPrintView: React.FC<ComicPrintViewProps> = ({ comic, userName, onReset }) => {
  const handlePrint = () => {
    window.print();
  };

  const userNameWords = userName.trim().split(/\s+/);
  const nameNeedsShrink = userNameWords.some(w => w.length > 10);
  const nameTextClass = nameNeedsShrink ? 'text-[28px]' : 'text-[34px]';

  return (
    <div className="h-screen w-full overflow-y-auto bg-gray-900 pb-20 print:!h-auto print:!min-h-0 print:!bg-white print:!p-0 print:!pb-0 print:!overflow-visible">
      
      {/* === HEADER / CONTROLS (Screen Only) === */}
      <div className="print:hidden sticky top-0 z-50 bg-[#1E49E2]/95 backdrop-blur-sm border-b-4 border-black p-4 shadow-lg">
        <div className="max-w-md mx-auto flex flex-col items-center space-y-3">
          <h1 className="text-white text-3xl comic-title tracking-wide drop-shadow-md text-center leading-none">
            ¡TU CÓMIC ESTÁ LISTO!
          </h1>
          <div className="w-full space-y-2">
            <div className="grid w-full grid-cols-2 gap-2">
              <Button onClick={onReset} variant="danger" className="w-full text-xs py-2 px-3 shadow-none border-2">
              <RefreshCcw className="mr-1 w-4 h-4" /> REINICIAR
              </Button>
              <Button onClick={handlePrint} variant="primary" className="w-full text-xs py-2 px-3 shadow-none border-2">
              <Printer className="mr-1 w-4 h-4" /> IMPRIMIR COMIC
              </Button>
            </div>
          </div>
          <p className="text-gray-400 text-xs text-center max-w-[250px]">
            Abajo ves la versión digital. Dale a imprimir para obtener el formato plegable A4.
          </p>
        </div>
      </div>

      {/* === DIGITAL READER (Screen Only - Vertical Scroll) === */}
      <div className="print:hidden w-full max-w-md mx-auto p-4 space-y-8 animate-fade-in">
        
        {/* Cover */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)] text-[#00338D]">
            <h3 className="comic-title text-center text-xl mb-2 uppercase break-words w-full px-2" style={{ letterSpacing: '-0.5px' }}>{userName} EN KPMG</h3>
            {comic.cover && <img src={comic.cover} className="w-full border-2 border-black" alt="Portada" />}
        </div>

        {/* Page 1 */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
            <span className="bg-black text-white px-2 font-bold text-xs">PÁGINA 1</span>
            {comic.p1 && <img src={comic.p1} className="w-full border-2 border-black mt-1" alt="P1" />}
            <div className="p-3 bg-[#0091DA] mt-2 border-2 border-black rounded-lg">
                <p className="font-comic font-bold text-sm text-white">"{comic.captions.p1}"</p>
            </div>
        </div>

        {/* Page 2 */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
            <span className="bg-black text-white px-2 font-bold text-xs">PÁGINA 2</span>
            {comic.p2 && <img src={comic.p2} className="w-full border-2 border-black mt-1" alt="P2" />}
            <div className="p-3 bg-[#00A3A1] mt-2 border-2 border-black rounded-lg">
                <p className="font-comic font-bold text-sm text-white">"{comic.captions.p2}"</p>
            </div>
        </div>

        {/* Page 3 */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
            <span className="bg-black text-white px-2 font-bold text-xs">PÁGINA 3</span>
            {comic.p3 && <img src={comic.p3} className="w-full border-2 border-black mt-1" alt="P3" />}
            <div className="p-3 bg-[#483698] mt-2 border-2 border-black rounded-lg">
                <p className="font-comic font-bold text-sm text-white">"{comic.captions.p3}"</p>
            </div>
        </div>

        {/* Page 4 */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
            <span className="bg-black text-white px-2 font-bold text-xs">PÁGINA 4</span>
            {comic.p4 && <img src={comic.p4} className="w-full border-2 border-black mt-1" alt="P4" />}
            <div className="p-3 bg-[#6D2077] mt-2 border-2 border-black rounded-lg">
                <p className="font-comic font-bold text-sm text-white">"{comic.captions.p4}"</p>
            </div>
        </div>

        {/* Page 5 & 6 (gráficas fijas, no IA) */}
        <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border-4 border-black p-2 flex flex-col">
                <span className="bg-black text-white px-2 font-bold text-xs w-fit">PÁGINA 5</span>
                <img
                  src={FANZINE_PAGE_5_SRC}
                  alt="Make History Together — KPMG"
                  className="w-full border-2 border-black mt-1 object-cover aspect-[3/4]"
                />
            </div>
            <div className="bg-white border-4 border-black p-2 flex flex-col">
                <span className="bg-black text-white px-2 font-bold text-xs w-fit">PÁGINA 6</span>
                <img
                  src={FANZINE_PAGE_6_SRC}
                  alt="Encuentro Alumni — KPMG"
                  className="w-full border-2 border-black mt-1 object-cover aspect-[3/4]"
                />
            </div>
        </div>

        {/* Back Cover */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)] text-[#00338D]">
            <h3 className="comic-title text-center text-xl mb-2">CONTRAPORTADA</h3>
            {comic.backCover && <img src={comic.backCover} className="w-full border-2 border-black" alt="Back" />}
            <h2 className="text-4xl comic-title text-center mt-6" style={{ fontFamily: "'KPMGBold', 'Arial Black', sans-serif" }}>FIN</h2>
        </div>

        <div className="h-10"></div>
      </div>


      {/* === PRINT LAYOUT (Hidden on Screen, Visible on Print) === */}
      {/* This uses the specific 8-panel zine layout (inverted top row) */}
      <div
        className="print-fanzine-layout hidden print:grid print:z-[100] print:box-border print:!bg-[#e8edf5]"
        style={{
          width: '297mm',
          height: '210mm',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          pageBreakAfter: 'avoid'
        }}
      >
        {/* 1. PORTADA — estira a la celda (fill) para quitar bandas arriba/abajo */}
        <div className={`min-h-0 min-w-0 border-r-2 border-b-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0 rotate-180`}>
          {comic.cover && (
            <img src={comic.cover} alt="Cover" className="print-ia-fill-height z-0" />
          )}
          <div className="absolute bottom-12 left-0 right-0 z-10 flex flex-col items-center pointer-events-none px-4 drop-shadow-[2px_2px_0_#000]" style={{ letterSpacing: nameNeedsShrink ? '-1.5px' : '-1px' }}>
            <h2 className={`${nameTextClass} text-white uppercase leading-[1.1] text-center w-full`} style={{ fontFamily: "'KPMGBold', 'Arial Black', sans-serif", WebkitTextStroke: '1px rgba(0,0,0,0.4)' }}>{userName}</h2>
            <h2 className="text-[41px] text-white uppercase leading-none text-center mt-0.5" style={{ fontFamily: "'KPMGBold', 'Arial Black', sans-serif", WebkitTextStroke: '1px rgba(0,0,0,0.4)' }}>EN KPMG</h2>
          </div>
        </div>

        {/* 2–3. Páginas 5 y 6: PNGs de marca */}
        <div className="min-h-0 min-w-0 border-r-2 border-b-2 border-black relative overflow-hidden bg-[#1E49E2] p-0 rotate-180">
            <img src={FANZINE_PAGE_6_SRC} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        </div>

        <div className="min-h-0 min-w-0 border-r-2 border-b-2 border-black relative overflow-hidden bg-[#1E49E2] p-0 rotate-180">
            <img src={FANZINE_PAGE_5_SRC} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        </div>

        {/* 4. CONTRAPORTADA IA */}
        <div className={`min-h-0 min-w-0 border-b-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0 rotate-180`}>
           {comic.backCover && (
             <img src={comic.backCover} alt="Back Cover" className="print-ia-fill-height z-0" />
           )}
           <div className="absolute inset-0 z-10 pointer-events-none bg-black/25 print:bg-black/20">
             <h2 className="absolute top-[75%] w-full text-center -translate-y-1/2 text-5xl comic-title text-white drop-shadow-[2px_2px_0_#000]" style={{ fontFamily: "'KPMGBold', 'Arial Black', sans-serif", WebkitTextStroke: '1px rgba(0,0,0,0.4)' }}>FIN</h2>
           </div>
        </div>

        {/* 5–8. Viñetas IA + captions */}
        <div className={`min-h-0 min-w-0 border-r-2 border-t-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0`}>
           {comic.p1 && <img src={comic.p1} alt="Page 1" className="print-ia-fill-height z-0" />}
           <div className="absolute top-1.5 left-5 right-1.5 z-10 bg-[#0091DA] border-2 border-black p-1.5 shadow-sm text-white">
                <p className="text-xs font-bold font-comic leading-tight">{comic.captions.p1}</p>
            </div>
        </div>

        <div className={`min-h-0 min-w-0 border-r-2 border-t-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0`}>
           {comic.p2 && <img src={comic.p2} alt="Page 2" className="print-ia-fill-height z-0" />}
           <div className="absolute bottom-4 left-1.5 right-1.5 z-10 bg-[#00A3A1] border-2 border-black p-1.5 shadow-sm text-white">
                <p className="text-xs font-bold font-comic leading-tight">{comic.captions.p2}</p>
            </div>
        </div>

        <div className={`min-h-0 min-w-0 border-r-2 border-t-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0`}>
           {comic.p3 && <img src={comic.p3} alt="Page 3" className="print-ia-fill-height z-0" />}
           <div className="absolute bottom-4 left-1.5 right-1.5 z-10 bg-[#483698] border-2 border-black p-1.5 shadow-sm text-white">
                <p className="text-xs font-bold font-comic leading-tight">{comic.captions.p3}</p>
            </div>
        </div>

        <div className={`min-h-0 min-w-0 border-l-0 border-t-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0`}>
           {comic.p4 && <img src={comic.p4} alt="Page 4" className="print-ia-fill-height z-0" />}
           <div className="absolute top-4 left-2 right-2 z-10 bg-[#6D2077] border-2 border-black p-1.5 shadow-sm text-white">
                <p className="text-xs font-bold font-comic leading-tight">{comic.captions.p4}</p>
            </div>
        </div>

         {/* Fold Guides */}
         <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-gray-400 opacity-50"></div>
         <div className="absolute top-1/2 left-0 w-full h-0 border-t-2 border-dashed border-gray-500"></div>
         <div className="absolute top-0 left-1/4 h-full w-0 border-l border-dashed border-gray-300"></div>
         <div className="absolute top-0 left-1/2 h-full w-0 border-l border-dashed border-gray-300"></div>
         <div className="absolute top-0 left-3/4 h-full w-0 border-l border-dashed border-gray-300"></div>
      </div>
    </div>
  );
};
