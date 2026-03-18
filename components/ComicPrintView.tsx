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
import { ComicPages, UserData } from '../types';
import { Printer, RefreshCcw, BookOpen } from 'lucide-react';
import { Button } from './Button';

const KpmgLogo = () => (
  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-white">
    <img src="https://fontslogo.com/wp-content/uploads/2020/03/KPMG-Logo-Font.jpg" alt="KPMG Logo" className="w-full h-auto object-contain" />
  </div>
);

interface ComicPrintViewProps {
  comic: ComicPages;
  data: UserData;
  onReset: () => void;
}

export const ComicPrintView: React.FC<ComicPrintViewProps> = ({ comic, data, onReset }) => {
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-screen w-full overflow-y-auto bg-gray-900 pb-20">
      
      {/* === HEADER / CONTROLS (Screen Only) === */}
      <div className="print:hidden sticky top-0 z-50 bg-[#00338D]/95 backdrop-blur-sm border-b-4 border-black p-4 shadow-lg">
        <div className="max-w-md mx-auto flex flex-col items-center space-y-3">
          <h1 className="text-white text-3xl comic-title tracking-wide drop-shadow-md text-center leading-none">
            ¡TU CÓMIC ESTÁ LISTO!
          </h1>
          <div className="flex gap-3 w-full justify-center">
            <Button onClick={onReset} variant="danger" className="text-xs py-2 px-4 shadow-none border-2">
              <RefreshCcw className="mr-1 w-4 h-4" /> REINICIAR
            </Button>
            <Button onClick={handlePrint} variant="primary" className="text-xs py-2 px-4 shadow-none border-2">
              <Printer className="mr-1 w-4 h-4" /> IMPRIMIR FANZINE
            </Button>
          </div>
          <p className="text-gray-400 text-xs text-center max-w-[250px]">
            Abajo ves la versión digital. Dale a imprimir para obtener el formato plegable A4.
          </p>
        </div>
      </div>

      {/* === DIGITAL READER (Screen Only - Vertical Scroll) === */}
      <div className="print:hidden w-full max-w-md mx-auto p-4 space-y-8 animate-fade-in">
        
        {/* Cover */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
            <h3 className="comic-title text-center text-xl mb-2">PORTADA</h3>
            {comic.cover && <img src={comic.cover} className="w-full border-2 border-black" alt="Portada" />}
            <h2 className="text-3xl comic-title text-center mt-2 text-red-600" style={{ fontFamily: "'KPMGBold', 'Arial Black', sans-serif" }}>{`${data.userName.toUpperCase()} EN KPMG`}</h2>
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

        {/* Page 5 & 6 (Creative) */}
        <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border-4 border-black p-2 h-40 flex flex-col items-center justify-center text-center">
                <KpmgLogo />
            </div>
            <div className="bg-white border-4 border-black p-2 h-40 flex flex-col items-center justify-center text-center">
                <KpmgLogo />
            </div>
        </div>

        {/* Back Cover */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
            <h3 className="comic-title text-center text-xl mb-2">CONTRAPORTADA</h3>
            {comic.backCover && <img src={comic.backCover} className="w-full border-2 border-black" alt="Back" />}
            <h2 className="text-4xl comic-title text-center mt-2" style={{ fontFamily: "'KPMGBold', 'Arial Black', sans-serif" }}>FIN</h2>
        </div>

        <div className="h-10"></div>
      </div>


      {/* === PRINT LAYOUT (Hidden on Screen, Visible on Print) === */}
      {/* This uses the specific 8-panel zine layout (inverted top row) */}
      <div 
        className="hidden print:grid fixed inset-0 bg-white"
        style={{
          width: '297mm',
          height: '210mm',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          pageBreakAfter: 'avoid'
        }}
      >
        {/* 1. TOP LEFT: PORTADA (Inverted) */}
        <div className="border-r-2 border-b-2 border-black relative overflow-hidden flex flex-col items-center justify-center bg-blue-100 rotate-180">
          {comic.cover && <img src={comic.cover} alt="Cover" className="w-full h-full object-cover" />}
          <div className="absolute top-8 w-full text-center px-2">
            <h1 className="text-5xl comic-title text-red-600 drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] stroke-black leading-none" style={{ WebkitTextStroke: '1px black', fontFamily: "'KPMGBold', 'Arial Black', sans-serif" }}>
              {`${data.userName.toUpperCase()} EN KPMG`}
            </h1>
          </div>
          <div className="absolute bottom-2 right-2 bg-black text-white px-2 py-0.5 text-xs font-bold">#1</div>
        </div>

        {/* 2. TOP MID-LEFT: PAGE 6 (Blank Inverted) */}
        <div className="border-r-2 border-b-2 border-black relative overflow-hidden flex flex-col items-center justify-center bg-white rotate-180 p-4 text-center">
            <KpmgLogo />
            <div className="absolute bottom-1 right-1 text-[10px] font-bold bg-white px-1 border border-black">6</div>
        </div>

        {/* 3. TOP MID-RIGHT: PAGE 5 (Blank Inverted) */}
        <div className="border-r-2 border-b-2 border-black relative overflow-hidden flex flex-col items-center justify-center bg-white rotate-180 p-4 text-center">
             <KpmgLogo />
            <div className="absolute bottom-1 right-1 text-[10px] font-bold bg-white px-1 border border-black">5</div>
        </div>

        {/* 4. TOP RIGHT: BACK COVER (Inverted) */}
        <div className="border-b-2 border-black relative overflow-hidden flex flex-col items-center justify-center bg-[#00338D] rotate-180">
           {comic.backCover && <img src={comic.backCover} alt="Back Cover" className="w-full h-full object-cover opacity-80" />}
           <div className="absolute inset-0 flex items-center justify-center">
             <h2 className="text-6xl comic-title text-white drop-shadow-[3px_3px_0px_rgba(0,0,0,1)]" style={{ fontFamily: "'KPMGBold', 'Arial Black', sans-serif" }}>FIN</h2>
           </div>
        </div>

        {/* 5. BOTTOM LEFT: PAGE 1 */}
        <div className="border-r-2 border-t-2 border-black relative overflow-hidden flex flex-col items-center justify-center bg-white">
           {comic.p1 && <img src={comic.p1} alt="Page 1" className="w-full h-full object-cover" />}
           <div className="absolute top-2 left-2 right-2 bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-sm font-bold font-comic leading-tight">{comic.captions.p1}</p>
            </div>
           <div className="absolute bottom-1 right-1 text-[10px] font-bold bg-white px-1 border border-black">1</div>
        </div>

        {/* 6. BOTTOM MID-LEFT: PAGE 2 */}
        <div className="border-r-2 border-t-2 border-black relative overflow-hidden flex flex-col items-center justify-center bg-white">
           {comic.p2 && <img src={comic.p2} alt="Page 2" className="w-full h-full object-cover" />}
           <div className="absolute bottom-6 left-2 right-2 bg-[#E6F4F4] border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-sm font-bold font-comic leading-tight">{comic.captions.p2}</p>
            </div>
           <div className="absolute bottom-1 right-1 text-[10px] font-bold bg-white px-1 border border-black">2</div>
        </div>

        {/* 7. BOTTOM MID-RIGHT: PAGE 3 */}
        <div className="border-r-2 border-t-2 border-black relative overflow-hidden flex flex-col items-center justify-center bg-[#EEF0F8]">
           {comic.p3 && <img src={comic.p3} alt="Page 3" className="w-full h-full object-cover" />}
           <div className="absolute bottom-6 left-2 right-2 bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-sm font-bold font-comic leading-tight uppercase">{comic.captions.p3}</p>
            </div>
           <div className="absolute bottom-1 right-1 text-[10px] font-bold bg-white px-1 border border-black">3</div>
        </div>

        {/* 8. BOTTOM RIGHT: PAGE 4 */}
        <div className="border-l-0 border-t-2 border-black relative overflow-hidden flex flex-col items-center justify-center bg-[#00338D]">
           {comic.p4 && <img src={comic.p4} alt="Page 4" className="w-full h-full object-cover opacity-90" />}
           <div className="absolute top-6 left-4 right-4 bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-full">
                <p className="text-sm font-bold font-comic leading-tight text-center italic">"{comic.captions.p4}"</p>
            </div>
           <div className="absolute bottom-1 right-1 text-[10px] font-bold bg-white px-1 border border-black">4</div>
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
