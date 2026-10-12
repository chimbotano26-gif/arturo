import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
} from 'lucide-react';
import { IncidentRecord, MesType } from '../types';
import { MESES_LIST } from '../data/mockData';
import {
  getMonthlyReportData,
  exportMonthlyReportExcel,
  exportMonthlyReportLandscapePDF,
} from '../utils/reportGenerator';
import html2canvas from 'html2canvas';

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: IncidentRecord[];
  allRecords: IncidentRecord[];
  initialMes?: MesType | null;
}

const MESES_DIAS_2026: Record<string, number> = {
  ENERO: 31,
  FEBRERO: 28,
  MARZO: 31,
  ABRIL: 30,
  MAYO: 31,
  JUNIO: 30,
  JULIO: 31,
  AGOSTO: 31,
  SETIEMBRE: 30,
  OCTUBRE: 31,
  NOVIEMBRE: 30,
  DICIEMBRE: 31,
};

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({
  isOpen,
  onClose,
  records,
  allRecords,
  initialMes = 'SETIEMBRE',
}) => {
  const [selectedMes, setSelectedMes] = useState<MesType>(initialMes || 'SETIEMBRE');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lista de meses que tienen registros en la base (ENE a OCT)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const recs = allRecords.length > 0 ? allRecords : records;
    recs.forEach((r) => {
      if (r.mes) set.add(r.mes.toUpperCase());
    });
    return MESES_LIST.filter(
      (m) => set.has(m) || m === 'SETIEMBRE' || m === 'OCTUBRE'
    );
  }, [allRecords, records]);

  // Sincronizar initialMes cuando se abre el modal
  React.useEffect(() => {
    if (initialMes) setSelectedMes(initialMes);
  }, [initialMes]);

  const reportData = useMemo(() => {
    const base = allRecords.length > 0 ? allRecords : records;
    return getMonthlyReportData(base, allRecords, selectedMes);
  }, [allRecords, records, selectedMes]);

  if (!isOpen) return null;

  // Formato de periodo oficial: "Desde el 01 de [Mes] del 2026 Hasta el [Fin] de [Mes] de 2026"
  const mesCapitalizado =
    selectedMes.charAt(0) + selectedMes.slice(1).toLowerCase();
  const finDeMes = MESES_DIAS_2026[selectedMes] || 30;
  const subtituloPeriodo = `Desde el 01 de ${mesCapitalizado} del 2026 Hasta el ${finDeMes} de ${mesCapitalizado} de 2026`;

  // TOTALIDAD DE CONFLICTOS DEL MES (Sin filtro Top 10)
  // Ordenados de mayor a menor según la tabla y el gráfico de barras horizontales
  const displayRows = reportData.rows;
  const chartRows = reportData.rows;

  const totalRowsCount = displayRows.length;

  // Cálculo de escala X para el gráfico de barras horizontales
  const maxChartVal = chartRows[0]?.total || 10;
  const xAxisMax = Math.ceil((maxChartVal * 1.15) / 50) * 50 || 100;
  const xSteps = 5;
  const xGridValues = Array.from({ length: xSteps + 1 }, (_, i) => Math.round((xAxisMax / xSteps) * i));

  // Geometría del gráfico de barras horizontales en SVG
  const svgWidth = 860;
  const svgHeight = 670;
  const chartMarginLeft = 245; // Margen amplio para que nombres largos se lean completos y rectos
  const chartMarginRight = 55;  // Espacio para que el número al final de la barra quepa
  const chartMarginTop = 25;
  const chartMarginBottom = 30;

  const plotAreaWidth = svgWidth - chartMarginLeft - chartMarginRight;
  const plotAreaHeight = svgHeight - chartMarginTop - chartMarginBottom;

  const rowHeight = plotAreaHeight / Math.max(1, totalRowsCount);
  const barHeight = Math.max(7, Math.min(14, rowHeight * 0.72));

  const handleExportExcel = () => {
    exportMonthlyReportExcel(reportData);
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      // 1. Espera de 450ms para confirmar que DOM, fuentes, SVG y estilos estén 100% renderizados
      await new Promise((resolve) => setTimeout(resolve, 450));

      if (sheetRef.current) {
        // 2. Captura con html2canvas en modo horizontal Landscape A4 nítido (scale: 2.2)
        const canvas = await html2canvas(sheetRef.current, {
          scale: 2.2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 1400,
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        exportMonthlyReportLandscapePDF(reportData, imgData, canvas.width, canvas.height);
      } else {
        exportMonthlyReportLandscapePDF(reportData);
      }
    } catch (err) {
      console.warn('Error generando PDF horizontal con captura, usando fallback vectorial:', err);
      exportMonthlyReportLandscapePDF(reportData);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-3 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-100 text-slate-800 w-full max-w-[1460px] max-h-[98vh] rounded-2xl border-2 border-blue-900 shadow-2xl flex flex-col overflow-hidden">
        {/* ========================================================================= */}
        {/* BARRA SUPERIOR DE ACCIONES Y CONTROLES                                    */}
        {/* ========================================================================= */}
        <div className="px-4 py-2 bg-gradient-to-r from-[#07172e] via-[#0b2447] to-[#124270] text-white flex flex-wrap items-center justify-between gap-3 border-b-2 border-cyan-500/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-cyan-500/20 rounded-lg border border-cyan-400/40">
              <FileText className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black tracking-wide uppercase">
                  FICHA OFICIAL DE INCIDENCIAS &bull; {selectedMes} 2026
                </h2>
                <span className="text-[10px] bg-cyan-400 text-slate-950 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                  TODAS LAS ATENCIONES ({reportData.rows.length}) &bull; BARRAS HORIZONTALES
                </span>
              </div>
              <p className="text-[10.5px] text-cyan-200/90 font-medium">
                Municipalidad Distrital de Nuevo Chimbote &bull; Subgerencia de Seguridad Ciudadana
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-modal-export-excel"
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.02] active:scale-95"
              title="Descargar Ficha en Excel (.xlsx) con la totalidad de incidencias y gráfico"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel (.xlsx)</span>
            </button>

            <button
              id="btn-modal-export-pdf"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              title="Descargar Ficha en PDF horizontal (Landscape A4) en 1 sola hoja con nitidez alta"
            >
              <FileText className="w-4 h-4" />
              <span>{isExportingPDF ? 'Generando PDF (1 Hoja)...' : 'Exportar PDF'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-2.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-colors"
              title="Imprimir Ficha Horizontal"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors ml-1"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SELECTOR DE MESES RÁPIDO (ENE A OCT)                                      */}
        {/* ========================================================================= */}
        <div className="bg-white border-b border-slate-300 px-4 py-1.5 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0 shadow-xs">
          <span className="text-[11px] font-black text-slate-700 uppercase shrink-0 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-700" />
            <span>Mes:</span>
          </span>
          <div className="flex items-center gap-1.5">
            {availableMonths.map((m) => {
              const isSelected = selectedMes === m;
              const short = m === 'SETIEMBRE' ? 'SET' : m.slice(0, 3);
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMes(m)}
                  className={`px-3 py-1 rounded text-[11px] font-bold uppercase transition-all whitespace-nowrap border ${
                    isSelected
                      ? 'bg-blue-800 text-white border-blue-900 shadow-md font-black ring-2 ring-cyan-400 scale-[1.02]'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-blue-50 hover:text-blue-900'
                  }`}
                >
                  {short}
                </button>
              );
            })}
          </div>
          <span className="ml-auto text-[11px] text-slate-500 font-medium hidden sm:inline">
            Total atenciones en {selectedMes}:{' '}
            <strong className="text-blue-900 font-mono font-bold">
              {reportData.totalMes.toLocaleString()}
            </strong>
          </span>
        </div>

        {/* ========================================================================= */}
        {/* CONTENEDOR DE LA FICHA EN FORMATO HORIZONTAL 2 COLUMNAS (1 SOLA HOJA A4)  */}
        {/* ========================================================================= */}
        <div className="p-2 sm:p-3 overflow-auto flex-1 flex justify-center items-start bg-slate-200/70">
          <div
            id="monthly-report-landscape-sheet"
            ref={sheetRef}
            className="bg-white text-slate-900 rounded-lg shadow-xl border border-slate-300 px-4 py-3 flex flex-row gap-4"
            style={{
              width: '1240px',
              minWidth: '1240px',
              height: '760px',
              minHeight: '760px',
              maxHeight: '760px',
              boxSizing: 'border-box',
            }}
          >
            {/* =================================================================== */}
            {/* COLUMNA IZQUIERDA (36% DE ANCHO): TABLA COMPACTA DE TODAS LAS FILAS */}
            {/* =================================================================== */}
            <div className="w-[36%] flex flex-col justify-between shrink-0 h-full">
              <div>
                {/* 1. Encabezado Oficial Institucional */}
                <div className="mb-1.5 pb-1 border-b-2 border-[#0B2447] text-left">
                  <h3 className="text-[11px] font-black text-[#07172E] uppercase tracking-wide leading-tight font-sans">
                    MUNICIPALIDAD DISTRITAL DE NUEVO CHIMBOTE
                  </h3>
                  <h4 className="text-[9.5px] font-bold text-[#124270] uppercase tracking-tight mt-0.5">
                    SUBGERENCIA DE SEGURIDAD CIUDADANA
                  </h4>
                </div>

                {/* 2. Tabla Oficial con las 35 filas que caben sin desbordar */}
                <table className="w-full text-left border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-[#0B2447] text-white text-[8px] font-black uppercase tracking-wider">
                      <th className="py-1 px-1.5 border-r border-blue-900/80">
                        CONFLICTOS MAS COMUNES
                      </th>
                      <th className="py-1 px-1 text-center w-[18%] border-r border-blue-900/80">
                        TOTALE
                      </th>
                      <th className="py-1 px-1 text-center w-[16%]">
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((r) => (
                      <tr key={r.incidencia} className="border-b border-slate-200/90">
                        {/* Columna 1: Fondo azul oscuro, texto blanco sin recortes innecesarios */}
                        <td
                          className="bg-[#1B3A6B] text-white font-bold text-[7px] uppercase border-r border-blue-900/40 tracking-tight leading-[1.0] py-[0.8px] px-1.5 truncate max-w-[190px]"
                          title={r.incidencia}
                        >
                          {r.incidencia}
                        </td>
                        {/* Columna 2: Fondo blanco, texto centrado */}
                        <td className="bg-white text-slate-900 font-black font-mono text-center text-[7.2px] border-r border-slate-300 py-[0.8px] px-1">
                          {r.total.toLocaleString()}
                        </td>
                        {/* Columna 3: % respecto al total del mes */}
                        <td className="bg-white text-slate-800 font-bold font-mono text-center text-[7px] py-[0.8px] px-1">
                          {r.porcentaje.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#0B2447]">
                      {/* Fila final: TOTAL DE INCIDENCIAS con suma total y 100% */}
                      <td className="py-1 px-1.5 bg-[#0B2447] text-white font-black text-[8px] uppercase border-r border-blue-900">
                        TOTAL DE INCIDENCIAS
                      </td>
                      <td className="py-1 px-1 bg-white text-[#0B2447] font-black font-mono text-center text-[8.5px] border-r border-slate-300">
                        {reportData.totalMes.toLocaleString()}
                      </td>
                      <td className="py-1 px-1 bg-white text-[#0B2447] font-black font-mono text-center text-[8.5px]">
                        100%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Sub-pie informativo de la tabla */}
              <div className="pt-1 border-t border-slate-200 text-[8.5px] text-slate-500 font-semibold flex items-center justify-between">
                <span>
                  Totalidad: <strong>{displayRows.length}</strong> conflictos registrados
                </span>
                <span className="font-mono text-blue-900 font-bold">
                  {reportData.porcentajeAnual}% anual distrital
                </span>
              </div>
            </div>

            {/* =================================================================== */}
            {/* COLUMNA DERECHA (64% DE ANCHO): GRÁFICO DE BARRAS HORIZONTALES      */}
            {/* =================================================================== */}
            <div className="w-[64%] flex flex-col justify-between flex-1 h-full">
              {/* 1. Título principal oficial */}
              <div className="text-center mb-1">
                <h2 className="text-[12.5px] font-black text-[#0B2447] uppercase tracking-wide leading-snug">
                  EN LOS PRINCIPALES CONFLICTOS MAS COMUNES DE LA JURISDICCION
                </h2>
                {/* 2. Subtítulo de periodo exacto */}
                <p className="text-[10.5px] font-black text-slate-700 mt-0.5">
                  {subtituloPeriodo}
                </p>
              </div>

              {/* 3. Gráfico de Barras Horizontales (SVG exacto y ordenado de mayor a menor) */}
              <div className="w-full bg-white border border-slate-200 rounded-lg p-2 shadow-xs flex flex-col justify-between flex-1">
                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-full"
                    style={{ maxHeight: '610px', display: 'block' }}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* Fondo blanco limpio */}
                    <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#ffffff" />

                    {/* Líneas de cuadrícula verticales grises y números en eje X superior e inferior */}
                    {xGridValues.map((val) => {
                      const x = chartMarginLeft + (val / xAxisMax) * plotAreaWidth;
                      return (
                        <g key={val}>
                          <line
                            x1={x}
                            y1={chartMarginTop}
                            x2={x}
                            y2={chartMarginTop + plotAreaHeight}
                            stroke="#e2e8f0"
                            strokeWidth="1"
                            strokeDasharray={val === 0 ? '0' : '3 3'}
                          />
                          {/* Etiqueta numérica del eje X abajo */}
                          <text
                            x={x}
                            y={chartMarginTop + plotAreaHeight + 14}
                            textAnchor="middle"
                            fontSize="8"
                            fill="#64748b"
                            fontWeight="600"
                            fontFamily="sans-serif"
                          >
                            {val.toLocaleString()}
                          </text>
                        </g>
                      );
                    })}

                    {/* Eje Y base continuo vertical */}
                    <line
                      x1={chartMarginLeft}
                      y1={chartMarginTop}
                      x2={chartMarginLeft}
                      y2={chartMarginTop + plotAreaHeight}
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                    />

                    {/* Eje X inferior continuo horizontal */}
                    <line
                      x1={chartMarginLeft}
                      y1={chartMarginTop + plotAreaHeight}
                      x2={chartMarginLeft + plotAreaWidth}
                      y2={chartMarginTop + plotAreaHeight}
                      stroke="#94a3b8"
                      strokeWidth="1"
                    />

                    {/* BARRAS HORIZONTALES: Nombres rectos a la izquierda y número al final de la barra */}
                    {chartRows.map((r, idx) => {
                      const yCenter = chartMarginTop + idx * rowHeight + rowHeight / 2;
                      const barY = yCenter - barHeight / 2;
                      const barWidth = Math.max(3, (r.total / xAxisMax) * plotAreaWidth);
                      const barEndX = chartMarginLeft + barWidth;

                      // Nombres largos se leen completos, con ligero ajuste si es excepcionalmente extenso
                      const labelText =
                        r.incidencia.length > 34
                          ? r.incidencia.slice(0, 33) + '…'
                          : r.incidencia;

                      return (
                        <g key={r.incidencia} className="transition-all">
                          {/* Nombre del conflicto en texto horizontal, recto y alineado a la derecha del margen */}
                          <text
                            x={chartMarginLeft - 7}
                            y={yCenter + 2.8}
                            textAnchor="end"
                            fontSize="7.5"
                            fontWeight="700"
                            fill="#1e293b"
                            fontFamily="sans-serif"
                          >
                            {labelText}
                            <title>{r.incidencia}</title>
                          </text>

                          {/* Barra horizontal azul */}
                          <rect
                            x={chartMarginLeft}
                            y={barY}
                            width={barWidth}
                            height={barHeight}
                            fill="#1E40AF"
                            rx="1.5"
                          >
                            <title>{`${r.incidencia}: ${r.total.toLocaleString()} atenciones (${r.porcentaje.toFixed(2)}%)`}</title>
                          </rect>

                          {/* Valor numérico exacto justo al final de la barra */}
                          <text
                            x={barEndX + 5}
                            y={yCenter + 2.8}
                            textAnchor="start"
                            fontSize="7.5"
                            fontWeight="800"
                            fill="#0B2447"
                            fontFamily="sans-serif"
                          >
                            {r.total.toLocaleString()}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Leyenda y pie del gráfico */}
                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-500 font-semibold shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-[#1E40AF] rounded-xs inline-block" />
                    <span className="text-slate-700 font-bold">
                      Todas las {chartRows.length} incidencias registradas en {selectedMes} 2026 (Ordenadas de mayor a menor)
                    </span>
                  </div>
                  <span className="font-mono text-slate-400">
                    Fuente: Libro Digital de Ocurrencias Serenazgo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
