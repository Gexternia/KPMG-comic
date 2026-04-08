/* 
   Fuentes necesarias en index.html o index.css:
   - Google Fonts: Bangers (comic titles), Comic Neue (captions)
   - KPMGBold (ya la tienes)
   
   Agrega en <head> de index.html:
   <link href="https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@400;700&display=swap" rel="stylesheet">
*/
import React from 'react';
import { ComicPages } from '../types';
import { Printer, RefreshCcw } from 'lucide-react';
import { Button } from './Button';

const FANZINE_PAGE_5_SRC = '/fanzine/page-make-history-together.png';
const FANZINE_PAGE_6_SRC = '/fanzine/page-alumni-madrid.png';

const PRINT_PANEL_BG =
  'bg-[linear-gradient(155deg,#f2f6fd_0%,#e2eaf7_40%,#cfdcf0_100%)]';

interface ComicPrintViewProps {
  comic: ComicPages;
  onReset: () => void;
}

/* ─── Reusable Comic Text Overlay Components ─── */

/** Caption box — rectangular box at top or bottom of panel */
const CaptionBox: React.FC<{
  text: string;
  position?: 'top' | 'bottom';
  color?: string;
  bgColor?: string;
}> = ({ text, position = 'top', color = '#00338D', bgColor = 'rgba(255,255,255,0.95)' }) => {
  const posClass = position === 'top' 
    ? 'top-0 left-0 right-0' 
    : 'bottom-0 left-0 right-0';
  
  return (
    <div 
      className={`absolute ${posClass} z-20 mx-2 my-2`}
      style={{ pointerEvents: 'none' }}
    >
      <div 
        className="px-3 py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        style={{ 
          backgroundColor: bgColor,
          fontFamily: "'Comic Neue', cursive",
          color,
        }}
      >
        <p className="text-sm font-bold leading-tight uppercase tracking-wide">
          {text}
        </p>
      </div>
    </div>
  );
};

/** Speech bubble — oval with tail */
const SpeechBubble: React.FC<{
  text: string;
  position?: 'top' | 'bottom';
  tailDirection?: 'left' | 'center' | 'right';
}> = ({ text, position = 'bottom', tailDirection = 'center' }) => {
  const posClass = position === 'top' ? 'top-2' : 'bottom-4';
  const tailPos = tailDirection === 'left' ? 'left-6' : tailDirection === 'right' ? 'right-6' : 'left-1/2 -translate-x-1/2';
  const tailRotate = position === 'top' ? 'rotate-180 -top-3' : '-bottom-3';
  
  return (
    <div 
      className={`absolute ${posClass} left-3 right-3 z-20`}
      style={{ pointerEvents: 'none' }}
    >
      <div 
        className="relative bg-white border-2 border-black rounded-[50%] px-4 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        style={{ fontFamily: "'Comic Neue', cursive" }}
      >
        <p className="text-sm font-bold leading-tight text-center text-[#00338D]">
          {text}
        </p>
        {/* Tail */}
        <div className={`absolute ${tailPos} ${tailRotate}`}>
          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-white"
               style={{ filter: 'drop-shadow(0 2px 0 black)' }} />
        </div>
      </div>
    </div>
  );
};

/** Starburst / explosion shape for dramatic moments */
const StarburstCaption: React.FC<{
  text: string;
  position?: 'top' | 'center';
}> = ({ text, position = 'top' }) => {
  const posClass = position === 'top' ? 'top-2 left-2 right-2' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%]';
  
  return (
    <div 
      className={`absolute ${posClass} z-20`}
      style={{ pointerEvents: 'none' }}
    >
      <div 
        className="bg-[#FFD700] border-3 border-black px-4 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
        style={{ 
          fontFamily: "'Bangers', cursive",
          clipPath: 'polygon(50% 0%, 61% 11%, 75% 3%, 72% 18%, 88% 18%, 80% 30%, 95% 38%, 82% 45%, 92% 58%, 78% 58%, 82% 73%, 68% 67%, 62% 82%, 53% 72%, 42% 85%, 38% 72%, 25% 78%, 28% 63%, 12% 60%, 22% 50%, 8% 40%, 22% 35%, 12% 22%, 28% 22%, 22% 8%, 36% 15%, 42% 2%)',
        }}
      >
        <p className="text-lg font-bold leading-tight text-center text-[#00338D] uppercase py-3">
          {text}
        </p>
      </div>
    </div>
  );
};

/** Cover title overlay */
const CoverTitle: React.FC<{ userName: string }> = ({ userName }) => (
  <div className="absolute top-0 left-0 right-0 z-20 pt-4" style={{ pointerEvents: 'none' }}>
    <div className="text-center">
      <h2 
        className="text-3xl md:text-4xl font-bold tracking-wider text-white uppercase"
        style={{ 
          fontFamily: "'Bangers', cursive",
          textShadow: '3px 3px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000',
          letterSpacing: '3px',
        }}
      >
        {userName.toUpperCase()} EN
      </h2>
      <h2 
        className="text-2xl md:text-3xl font-bold tracking-wider text-[#00A3A1]"
        style={{ 
          fontFamily: "'Bangers', cursive",
          textShadow: '2px 2px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000',
          letterSpacing: '4px',
        }}
      >
        KPMG
      </h2>
    </div>
  </div>
);

/** FIN overlay for back cover */
const FinOverlay: React.FC = () => (
  <div className="absolute inset-0 z-20 flex items-end justify-center pb-8" style={{ pointerEvents: 'none' }}>
    <h2 
      className="text-6xl font-bold text-white"
      style={{ 
        fontFamily: "'Bangers', cursive",
        textShadow: '4px 4px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000',
        letterSpacing: '8px',
      }}
    >
      FIN
    </h2>
  </div>
);


/* ─── Main Component ─── */

export const ComicPrintView: React.FC<ComicPrintViewProps> = ({ comic, onReset }) => {
  
  const handlePrint = () => window.print();

  return (
    <div className="h-screen w-full overflow-y-auto bg-gray-900 pb-20 print:!h-auto print:!min-h-0 print:!bg-white print:!p-0 print:!pb-0 print:!overflow-visible">
      
      {/* === HEADER / CONTROLS (Screen Only) === */}
      <div className="print:hidden sticky top-0 z-50 bg-[#1E49E2]/95 backdrop-blur-sm border-b-4 border-black p-4 shadow-lg">
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

      {/* === DIGITAL READER (Screen Only) === */}
      <div className="print:hidden w-full max-w-md mx-auto p-4 space-y-8 animate-fade-in">
        
        {/* Cover */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
          <h3 className="comic-title text-center text-xl mb-2 text-[#00338D]">PORTADA</h3>
          <div className="relative border-2 border-black overflow-hidden">
            {comic.cover && <img src={comic.cover} className="w-full" alt="Portada" />}
            <CoverTitle userName={comic.captions.p1 ? comic.captions.p1.split(' ')[0] : 'HÉROE'} />
          </div>
        </div>

        {/* Panel 1 */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
          <span className="bg-black text-white px-2 font-bold text-xs">PÁGINA 1</span>
          <div className="relative border-2 border-black mt-1 overflow-hidden">
            {comic.p1 && <img src={comic.p1} className="w-full" alt="P1" />}
            <CaptionBox text={comic.captions.p1} position="top" />
          </div>
        </div>

        {/* Panel 2 */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
          <span className="bg-black text-white px-2 font-bold text-xs">PÁGINA 2</span>
          <div className="relative border-2 border-black mt-1 overflow-hidden">
            {comic.p2 && <img src={comic.p2} className="w-full" alt="P2" />}
            <SpeechBubble text={comic.captions.p2} position="bottom" tailDirection="left" />
          </div>
        </div>

        {/* Panel 3 */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
          <span className="bg-black text-white px-2 font-bold text-xs">PÁGINA 3</span>
          <div className="relative border-2 border-black mt-1 overflow-hidden">
            {comic.p3 && <img src={comic.p3} className="w-full" alt="P3" />}
            <CaptionBox text={comic.captions.p3} position="bottom" bgColor="rgba(255,215,0,0.95)" />
          </div>
        </div>

        {/* Panel 4 */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
          <span className="bg-black text-white px-2 font-bold text-xs">PÁGINA 4</span>
          <div className="relative border-2 border-black mt-1 overflow-hidden">
            {comic.p4 && <img src={comic.p4} className="w-full" alt="P4" />}
            <StarburstCaption text={comic.captions.p4} position="top" />
          </div>
        </div>

        {/* Pages 5 & 6 (static brand assets) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white border-4 border-black p-2 flex flex-col">
            <span className="bg-black text-white px-2 font-bold text-xs w-fit">PÁGINA 5</span>
            <img src={FANZINE_PAGE_5_SRC} alt="Make History Together" className="w-full border-2 border-black mt-1 object-cover aspect-[3/4]" />
          </div>
          <div className="bg-white border-4 border-black p-2 flex flex-col">
            <span className="bg-black text-white px-2 font-bold text-xs w-fit">PÁGINA 6</span>
            <img src={FANZINE_PAGE_6_SRC} alt="Encuentro Alumni" className="w-full border-2 border-black mt-1 object-cover aspect-[3/4]" />
          </div>
        </div>

        {/* Back Cover */}
        <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
          <h3 className="comic-title text-center text-xl mb-2 text-[#00338D]">CONTRAPORTADA</h3>
          <div className="relative border-2 border-black overflow-hidden">
            {comic.backCover && <img src={comic.backCover} className="w-full" alt="Back" />}
            <FinOverlay />
          </div>
        </div>

        <div className="h-10"></div>
      </div>


      {/* === PRINT LAYOUT (Hidden on Screen, Visible on Print) === */}
      <div
        className="print-fanzine-layout hidden print:grid print:fixed print:inset-0 print:z-[100] print:box-border print:!bg-[#e8edf5]"
        style={{
          width: '100vw',
          height: '100vh',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          pageBreakAfter: 'avoid'
        }}
      >
        {/* 1. PORTADA */}
        <div className={`min-h-0 min-w-0 border-r-2 border-b-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0 rotate-180`}>
          {comic.cover && (
            <img src={comic.cover} alt="Cover" className="print-ia-fill-height z-0" />
          )}
          <div className="absolute bottom-2 right-2 z-10 bg-black text-white px-2 py-0.5 text-xs font-bold">#1</div>
        </div>

        {/* 2–3. Brand pages */}
        <div className="min-h-0 min-w-0 border-r-2 border-b-2 border-black relative overflow-hidden bg-[#1E49E2] p-0 rotate-180">
          <img src={FANZINE_PAGE_6_SRC} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute bottom-1 right-1 z-10 text-[10px] font-bold bg-white px-1 border border-black text-[#00338D]">6</div>
        </div>
        <div className="min-h-0 min-w-0 border-r-2 border-b-2 border-black relative overflow-hidden bg-[#1E49E2] p-0 rotate-180">
          <img src={FANZINE_PAGE_5_SRC} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute bottom-1 right-1 z-10 text-[10px] font-bold bg-white px-1 border border-black text-[#00338D]">5</div>
        </div>

        {/* 4. CONTRAPORTADA */}
        <div className={`min-h-0 min-w-0 border-b-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0 rotate-180`}>
           {comic.backCover && (
             <img src={comic.backCover} alt="Back Cover" className="print-ia-fill-height z-0" />
           )}
           <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none bg-black/25 print:bg-black/20">
             <h2 className="text-5xl comic-title text-white drop-shadow-[2px_2px_0_#000]" style={{ fontFamily: "'KPMGBold', 'Arial Black', sans-serif", WebkitTextStroke: '1px rgba(0,0,0,0.4)' }}>FIN</h2>
           </div>
        </div>

        {/* 5–8. Comic panels with HTML overlays */}
        {/* Panel 1 */}
        <div className={`min-h-0 min-w-0 border-r-2 border-t-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0`}>
          {comic.p1 && <img src={comic.p1} alt="Page 1" className="print-ia-fill-height z-0" />}
          <div className="absolute top-1 left-1 right-1 z-10 bg-white/95 border-2 border-black px-2 py-1 shadow-[1px_1px_0_0_rgba(0,0,0,1)]">
            <p className="text-[10px] font-bold leading-tight uppercase" style={{ fontFamily: "'Comic Neue', cursive", color: '#00338D' }}>{comic.captions.p1}</p>
          </div>
          <div className="absolute bottom-1 right-1 z-10 text-[10px] font-bold bg-white px-1 border border-black text-[#00338D]">1</div>
        </div>

        {/* Panel 2 */}
        <div className={`min-h-0 min-w-0 border-r-2 border-t-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0`}>
          {comic.p2 && <img src={comic.p2} alt="Page 2" className="print-ia-fill-height z-0" />}
          {/* Speech bubble style */}
          <div className="absolute bottom-5 left-1 right-1 z-10">
            <div className="bg-white border-2 border-black rounded-[50%] px-3 py-1.5 shadow-[1px_1px_0_0_rgba(0,0,0,1)] relative">
              <p className="text-[10px] font-bold leading-tight text-center" style={{ fontFamily: "'Comic Neue', cursive", color: '#00338D' }}>{comic.captions.p2}</p>
              <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" style={{ filter: 'drop-shadow(0 1px 0 black)' }} />
            </div>
          </div>
          <div className="absolute bottom-1 right-1 z-10 text-[10px] font-bold bg-white px-1 border border-black text-[#00338D]">2</div>
        </div>

        {/* Panel 3 */}
        <div className={`min-h-0 min-w-0 border-r-2 border-t-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0`}>
          {comic.p3 && <img src={comic.p3} alt="Page 3" className="print-ia-fill-height z-0" />}
          <div className="absolute bottom-5 left-1 right-1 z-10 border-2 border-black px-2 py-1 shadow-[1px_1px_0_0_rgba(0,0,0,1)]" style={{ backgroundColor: 'rgba(255,215,0,0.95)' }}>
            <p className="text-[10px] font-bold leading-tight uppercase text-center" style={{ fontFamily: "'Comic Neue', cursive", color: '#00338D' }}>{comic.captions.p3}</p>
          </div>
          <div className="absolute bottom-1 right-1 z-10 text-[10px] font-bold bg-white px-1 border border-black text-[#00338D]">3</div>
        </div>

        {/* Panel 4 */}
        <div className={`min-h-0 min-w-0 border-l-0 border-t-2 border-black relative overflow-hidden ${PRINT_PANEL_BG} p-0`}>
          {comic.p4 && <img src={comic.p4} alt="Page 4" className="print-ia-fill-height z-0" />}
          {/* Starburst-ish for print (simplified to rounded box) */}
          <div className="absolute top-2 left-1 right-1 z-10 bg-[#FFD700] border-2 border-black px-2 py-1.5 shadow-[2px_2px_0_0_rgba(0,0,0,1)] rounded-sm">
            <p className="text-[11px] font-bold leading-tight text-center uppercase" style={{ fontFamily: "'Bangers', cursive", color: '#00338D', letterSpacing: '1px' }}>"{comic.captions.p4}"</p>
          </div>
          <div className="absolute bottom-1 right-1 z-10 text-[10px] font-bold bg-white px-1 border border-black text-[#00338D]">4</div>
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
