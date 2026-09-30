import React from 'react';
import { SerenazgoLogo } from './SerenazgoLogo';
import { Shield, Code2, MapPin, Phone, Radio, Award } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-gradient-to-r from-[#061528] via-[#09203d] to-[#061528] border-t-2 border-cyan-800/60 text-slate-300 py-6 px-4 sm:px-8 mt-8 shadow-2xl">
      <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Identidad Institucional */}
        <div className="flex items-center gap-3.5">
          <div className="p-1 rounded-xl bg-cyan-950/80 border border-cyan-500/40 shadow-sm shrink-0">
            <SerenazgoLogo className="w-10 h-10 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-xs sm:text-sm tracking-wider uppercase">
                MUNICIPALIDAD DISTRITAL DE NUEVO CHIMBOTE
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                <Radio className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                Servicio Activo 24 Horas
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Subgerencia de Serenazgo y Seguridad Ciudadana &bull; Sistema Integrado de Gestión y Análisis de Patrullaje (SIG-SERENAZGO)
            </p>
            <p className="text-[10px] text-cyan-400/80 font-mono mt-0.5">
              Periodo Operativo Oficial: Enero 2023 – Agosto 2026 &bull; 9,571 Patrullajes Preventivos
            </p>
          </div>
        </div>

        {/* Créditos Obligatorios de Desarrollador */}
        <div className="flex items-center gap-2.5 bg-[#0b264a] px-4 py-2 rounded-xl border border-cyan-400/50 shadow-md">
          <div className="p-1.5 rounded-lg bg-cyan-900/60 text-cyan-300">
            <Code2 className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/90 block font-mono">
              Créditos de Desarrollador
            </span>
            <span className="text-xs sm:text-sm font-black text-white tracking-wide">
              Desarrollado por <strong className="text-cyan-300 underline decoration-cyan-400 underline-offset-2">Arturo David Rivero Onofre</strong>
            </span>
          </div>
        </div>

        {/* Información de Contacto y Emergencias */}
        <div className="flex flex-col items-center md:items-end text-center md:text-right gap-0.5 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <Phone className="w-3.5 h-3.5 text-amber-400" />
            <span>Central de Emergencias: (043) 313000</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Av. Central s/n, Plaza Mayor de Nuevo Chimbote &bull; Servicio 24 Horas
          </p>
          <p className="text-[10px] text-slate-500 font-mono">
            &copy; 2026 Municipalidad Distrital de Nuevo Chimbote. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
