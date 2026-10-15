import React, { useEffect, useRef, useState, useCallback } from 'react';
import { soundManager } from '../utils/audioAlert';

interface IntroOverlayProps {
  onEnter?: () => void;
}

interface Particle {
  angle: number;
  radius: number;
  initialRadius: number;
  speed: number;
  curve: number;
  color: string;
  size: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({ onEnter }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [logoRevealed, setLogoRevealed] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);

  const hasEnteredRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  // Desvanecimiento suave y acceso al dashboard principal - EXCLUSIVO AL ESCUDO
  const handleDismiss = useCallback(() => {
    if (hasEnteredRef.current) return;
    hasEnteredRef.current = true;

    try {
      soundManager.playSuccess();
    } catch {
      // Ignorar errores de contexto de audio
    }

    setIsFadingOut(true);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setTimeout(() => {
      setIsVisible(false);
      document.body.style.overflow = 'unset';
      if (onEnter) onEnter();
    }, 500);
  }, [onEnter]);

  // Teclado opcional para accesibilidad (Escape, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [handleDismiss]);

  // Animación de partículas y ensamblado de una sola pasada
  useEffect(() => {
    document.body.style.overflow = 'hidden';

    // Cronograma:
    // 1.8s: Emerge el escudo con total nitidez
    const revealTimer = setTimeout(() => {
      setLogoRevealed(true);
    }, 1800);

    // 3.0s: Las partículas se detienen definitivamente y queda estático en espera del clic
    const finishTimer = setTimeout(() => {
      setAnimationFinished(true);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }, 3000);

    // Inicialización del canvas
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      let screenW = window.innerWidth;
      let screenH = window.innerHeight;

      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        screenW = window.innerWidth;
        screenH = window.innerHeight;
        canvas.width = screenW * dpr;
        canvas.height = screenH * dpr;
        canvas.style.width = `${screenW}px`;
        canvas.style.height = `${screenH}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      resize();
      window.addEventListener('resize', resize);

      // Fondo 100% negro puro absoluto (#000000)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, screenW, screenH);

      // Partículas EXCLUSIVAMENTE en azul eléctrico (#00d2ff, #0066ff) y blanco brillante
      const bluePalette = ['#00d2ff', '#0066ff', '#38bdf8', '#00e5ff', '#ffffff'];
      const numParticles = 240;
      const particles: Particle[] = [];
      const centerX = screenW / 2;
      const centerY = screenH / 2;
      const maxDist = Math.hypot(screenW, screenH) * 0.6;

      for (let i = 0; i < numParticles; i++) {
        const color = bluePalette[Math.floor(Math.random() * bluePalette.length)];
        const angle = Math.random() * Math.PI * 2;
        const radius = 120 + Math.random() * maxDist;
        const curve = (Math.random() > 0.5 ? 1 : -1) * (1.8 + Math.random() * 2.4);

        const startX = centerX + Math.cos(angle) * radius;
        const startY = centerY + Math.sin(angle) * radius;

        particles.push({
          angle,
          radius,
          initialRadius: radius,
          speed: 1.8 + Math.random() * 2.2,
          curve,
          color,
          size: 1.5 + Math.random() * 1.8,
          x: startX,
          y: startY,
          prevX: startX,
          prevY: startY,
        });
      }

      const startTime = performance.now();

      const loop = (currentTime: number) => {
        if (hasEnteredRef.current) return;

        const elapsed = (currentTime - startTime) / 1000;
        const curCenterX = window.innerWidth / 2;
        const curCenterY = window.innerHeight / 2;

        // Limpieza con estela en negro puro absoluto (#000000)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        if (elapsed < 2.0) {
          // Fase 1: Partículas azules y blancas convergiendo hacia el centro
          const progress = elapsed / 2.0;

          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.prevX = p.x;
            p.prevY = p.y;

            p.angle += p.curve * 0.018;
            p.radius *= Math.max(0.04, 1 - (0.02 + progress * 0.035));

            p.x = curCenterX + Math.cos(p.angle) * p.radius;
            p.y = curCenterY + Math.sin(p.angle) * p.radius;

            // Cola de cometa
            ctx.beginPath();
            ctx.moveTo(p.prevX, p.prevY);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.color;
            ctx.stroke();

            // Cabeza brillante
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.9, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }

          animationFrameRef.current = requestAnimationFrame(loop);
        } else if (elapsed >= 2.0 && elapsed < 3.0) {
          // Fase 2: Fusión suave en el centro mientras se revela el escudo nítido
          const fusionProgress = elapsed - 2.0;

          for (let i = 0; i < particles.length; i += 2) {
            const p = particles[i];
            p.prevX = p.x;
            p.prevY = p.y;
            p.x += (curCenterX - p.x) * 0.2;
            p.y += (curCenterY - p.y) * 0.2;

            ctx.beginPath();
            ctx.moveTo(p.prevX, p.prevY);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(0.5, p.size * (1 - fusionProgress));
            ctx.stroke();
          }

          animationFrameRef.current = requestAnimationFrame(loop);
        } else {
          // Fase 3: Detención total y canvas 100% negro
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        }
      };

      animationFrameRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.warn('Canvas fallback:', err);
      setLogoRevealed(true);
      setAnimationFinished(true);
    }

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(finishTimer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      id="intro-overlay"
      className={`fixed inset-0 z-50 bg-[#000000] flex flex-col items-center justify-center p-6 cursor-default select-none overflow-hidden transition-opacity duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* 1. Canvas de Partículas sobre fondo negro puro (sin interacción de clic en el fondo) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none z-10"
      />

      {/* 2. Resplandor radial ÚNICAMENTE azul/cian detrás de la insignia (cero rojo) */}
      {logoRevealed && (
        <div className="absolute w-[320px] h-[320px] sm:w-[460px] sm:h-[460px] rounded-full bg-[radial-gradient(circle,rgba(0,210,255,0.22)_0%,rgba(0,102,255,0.1)_45%,transparent_70%)] blur-3xl animate-pulse pointer-events-none z-20" />
      )}

      {/* 3. Escudo Oficial Nítido Centrado con Título Superior */}
      <div
        className={`relative z-30 flex flex-col items-center justify-center text-center transition-all duration-700 ease-out pointer-events-none ${
          logoRevealed
            ? 'opacity-100 scale-100 blur-0'
            : 'opacity-0 scale-90 blur-sm'
        }`}
      >
        {/* Título superior institucional con tipografía limpia y brillante */}
        <div className="mb-4 text-center space-y-1">
          <p className="text-[10px] sm:text-xs font-black tracking-[0.25em] text-cyan-300 uppercase">
            Municipalidad Distrital de Nuevo Chimbote
          </p>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-[0.18em] text-white uppercase drop-shadow-[0_2px_12px_rgba(0,210,255,0.4)]">
            SUB GERENCIA DE SERENAZGO
          </h1>
          <p className="text-[10px] sm:text-xs font-medium tracking-wider text-slate-400 uppercase">
            Centro de Operaciones &bull; Seguridad Ciudadana
          </p>
        </div>

        {/* 4. INSIGNIA OFICIAL: EVENTO DE CLIC RESTRINGIDO EXCLUSIVAMENTE AQUÍ */}
        <div
          onClick={handleDismiss}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleDismiss();
            }
          }}
          className="relative group transition-all duration-500 hover:scale-105 cursor-pointer pointer-events-auto"
          title="Haz clic en la insignia para ingresar al sistema de Serenazgo"
        >
          {/* Halo sutil azul cian al pasar el ratón */}
          <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl group-hover:bg-cyan-300/40 transition-all duration-500 pointer-events-none" />

          {/* Imagen oficial con nitidez 100% y brillo azul */}
          <img
            src="/logo_serenazgo.png"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src.includes('logo_serenazgo.png')) {
                target.src = '/logo-serenazgo.png';
              } else if (target.src.includes('logo-serenazgo.png')) {
                target.src = '/logo.png';
              }
            }}
            alt="Insignia Oficial de Serenazgo Nuevo Chimbote"
            className="w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 object-contain drop-shadow-[0_0_35px_rgba(0,210,255,0.7)] group-hover:drop-shadow-[0_0_55px_rgba(0,210,255,1)] transition-all duration-500"
          />
        </div>

        {/* Indicador de clic cuando está estático */}
        {animationFinished && (
          <p
            onClick={handleDismiss}
            className="mt-5 text-[11px] font-bold text-cyan-400/80 tracking-widest uppercase animate-pulse pointer-events-auto cursor-pointer hover:text-white transition-colors"
          >
            &bull; Haz clic en la insignia para ingresar &bull;
          </p>
        )}
      </div>
    </div>
  );
};
