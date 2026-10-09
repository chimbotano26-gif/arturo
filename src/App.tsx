/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  IncidentRecord,
  FilterState,
  ActiveTab,
  PatrolUnit,
  ZonaType,
  TurnoType,
  ComisariaType,
  MesType,
} from './types';
import { INITIAL_PATROL_UNITS, SUBSECTORES_CONFIG } from './data/mockData';
import { soundManager } from './utils/audioAlert';
import {
  exportIncidentsToExcel,
  parseAndConvertExcelBuffer,
  parseExcelFile,
  transformRowsToIncidents,
} from './utils/excelHelper';
import { useEditableTitles } from './utils/useEditableTitles';
import { AuthProvider, useAuth } from './utils/authContext';
import { AdminAuthModal } from './components/AdminAuthModal';

// Components for the Municipal Dashboard
import { Header } from './components/Header';
import { LeftFilters } from './components/FiltersSidebar';
import { KpiCards } from './components/KpiCards';
import { VistaResumen } from './components/VistaResumen';
import { TacticalMapView } from './components/TacticalMapView';
import { MapErrorBoundary } from './components/MapErrorBoundary';
import { PlanOperativosView } from './components/PlanOperativosView';
import { ComparativoView } from './components/ComparativoView';
import { DetalleIncidenciasView } from './components/DetalleIncidenciasView';
import { DatabaseExcelHub } from './components/DatabaseExcelHub';

import { CustomTitlesProvider, useCustomTitles } from './context/CustomTitlesContext';

// Modals
import { ExcelUploadModal } from './components/ExcelUploadModal';
import { NewIncidentModal } from './components/NewIncidentModal';
import { ReportPrintModal } from './components/ReportPrintModal';
import { AlertsModal } from './components/AlertsModal';
import { Footer } from './components/Footer';
import { RotateCcw, Save, HardDrive, Upload, FileSpreadsheet, Database, Trash2, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { SaveConfirmationToast } from './components/SaveConfirmationToast';
import {
  saveAllDataToStorage,
  clearAllSavedData,
} from './utils/persistenceHelper';

// Reset completo inmediato de memoria y caché antes de inicializar la aplicación
try {
  localStorage.clear();
} catch (e) {
  console.warn('localStorage.clear notice:', e);
}
try {
  clearAllSavedData();
} catch (e) {
  console.warn('clearAllSavedData notice:', e);
}

const INITIAL_FILTERS: FilterState = {
  zonas: [],
  comisarias: [],
  turnos: [],
  meses: [],
  incidencias: [],
  searchQuery: '',
};

function DashboardInner() {
  const { requireAdmin } = useAuth();

  // 1. Database records state: En espera de que el usuario suba la base de datos (20,635 filas) o se lea de /public/base_de_datos.xlsx
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(true);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [isCustomDataLoaded, setIsCustomDataLoaded] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [justSaved, setJustSaved] = useState<boolean>(false);
  const [isSaveToastOpen, setIsSaveToastOpen] = useState<boolean>(false);

  // Patrol Units Live State
  const [patrolUnits] = useState<PatrolUnit[]>(INITIAL_PATROL_UNITS);

  // 2. Active Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('VISTA_RESUMEN');

  // Center display mode: either 'GRAFICOS' (the 7 charts) or 'MAPA' (the tactical heatmap in the middle)
  const [centerMode, setCenterMode] = useState<'GRAFICOS' | 'MAPA'>('GRAFICOS');

  // 3. Editable Dashboard Titles & Custom Texts (auto-saved on change)
  const { titles, updateTitle, resetTitles, isCustomTitles } = useEditableTitles();

  // 4. Filters
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // 5. Modals
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isNewIncidentOpen, setIsNewIncidentOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  // Carga inicial directa desde el archivo estático en /public si está presente, sin usar datos en caché
  const loadOfficialFile = async () => {
    setIsLoadingFile(true);
    setFileLoadError(null);

    // Reset completo de datos en memoria y caché
    try {
      localStorage.clear();
    } catch {
      // Ignore
    }
    try {
      await clearAllSavedData();
    } catch {
      // Ignore
    }

    try {
      // Prioriza 'base_de_datos.xlsx' y 'base_de_datos.csv'
      const candidates = [
        '/base_de_datos.xlsx',
        '/base_de_datos.csv',
        '/public/base_de_datos.xlsx',
        '/public/base_de_datos.csv',
      ];

      let res: Response | null = null;
      let usedPath = '';

      for (const path of candidates) {
        try {
          const attempt = await fetch(path);
          if (attempt.ok) {
            res = attempt;
            usedPath = path;
            break;
          }
        } catch {
          // Continúa
        }
      }

      if (res && res.ok) {
        const buffer = await res.arrayBuffer();
        const parsedRecords = parseAndConvertExcelBuffer(buffer);

        if (parsedRecords && parsedRecords.length > 0) {
          const cleanFileName = usedPath.split('/').pop()?.replace(/%20/g, ' ') || 'base_de_datos.xlsx';
          setRecords(parsedRecords);
          setIsCustomDataLoaded(true);
          setLastSavedAt(`${cleanFileName} (${parsedRecords.length.toLocaleString()} registros)`);
          setFilters(INITIAL_FILTERS);
          setIsLoadingFile(false);
          return;
        }
      }

      // Si no está presente, la aplicación queda en espera de que el usuario suba la base de datos (20,635 filas)
      setRecords([]);
      setIsCustomDataLoaded(false);
      setLastSavedAt(null);
      setIsLoadingFile(false);
    } catch (err: unknown) {
      console.warn('Lectura automática no disponible, en espera de subida manual:', err);
      setRecords([]);
      setIsCustomDataLoaded(false);
      setIsLoadingFile(false);
    }
  };

  useEffect(() => {
    loadOfficialFile();
  }, []);

  // Carga manual directa de archivo seleccionado por el usuario
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsLoadingFile(true);
      const parsed = await parseExcelFile(file);
      const incidents = transformRowsToIncidents(parsed.rawRows, parsed.detectedMapping);
      if (incidents.length === 0) {
        throw new Error('No se detectaron registros válidos en el archivo.');
      }
      setRecords(incidents);
      setIsCustomDataLoaded(true);
      setLastSavedAt(`${file.name} (${incidents.length.toLocaleString()} registros)`);
      setFilters(INITIAL_FILTERS);
      soundManager.playSuccess();
      setIsSaveToastOpen(true);
      setIsLoadingFile(false);
    } catch (err: unknown) {
      alert('Error procesando archivo: ' + (err instanceof Error ? err.message : 'Error desconocido'));
      setIsLoadingFile(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  useEffect(() => {
    loadOfficialFile();
  }, []);

  // When tab is changed to MAPA_CALOR, set centerMode to 'MAPA'
  useEffect(() => {
    if (activeTab === 'MAPA_CALOR') {
      setCenterMode('MAPA');
    }
  }, [activeTab]);

  // 6. Filter calculation (Flexible and inclusive of all imported records)
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Zona filter
      if (filters.zonas.length > 0 && !filters.zonas.includes(r.zona)) {
        return false;
      }
      // Comisaría filter
      if (filters.comisarias.length > 0 && !filters.comisarias.includes(r.comisaria)) {
        return false;
      }
      // Turno filter
      if (filters.turnos.length > 0 && !filters.turnos.includes(r.turno)) {
        return false;
      }
      // Mes filter
      if (filters.meses.length > 0 && !filters.meses.includes(r.mes)) {
        return false;
      }
      // Incidencia filter
      if (filters.incidencias.length > 0 && !filters.incidencias.includes(r.tipoIncidencia)) {
        return false;
      }
      // Search query (checking Columna1 and Observacion as well)
      if (filters.searchQuery.trim() !== '') {
        const q = filters.searchQuery.toLowerCase();
        const match =
          (r.ubicacion && r.ubicacion.toLowerCase().includes(q)) ||
          (r.lugar && r.lugar.toLowerCase().includes(q)) ||
          (r.columna1 && r.columna1.toLowerCase().includes(q)) ||
          (r.observacion && r.observacion.toLowerCase().includes(q)) ||
          (r.tipoIncidencia && r.tipoIncidencia.toLowerCase().includes(q)) ||
          (r.subsector && r.subsector.toLowerCase().includes(q)) ||
          (r.efectivo ? r.efectivo.toLowerCase().includes(q) : false) ||
          (r.codigo ? r.codigo.toLowerCase().includes(q) : false);
        if (!match) return false;
      }
      return true;
    });
  }, [records, filters]);

  // Handlers for Data Hub
  const handleOpenExcelModal = () => {
    setIsExcelModalOpen(true);
  };

  const handleOpenNewIncident = () => {
    requireAdmin('Registro de Nuevo Operativo o Incidencia', () => {
      setIsNewIncidentOpen(true);
    });
  };

  // Central Save Changes Handler (IndexedDB powered, avoiding quota limits)
  const handleSaveChanges = async () => {
    try {
      const res = await saveAllDataToStorage(records, titles);
      if (res.success) {
        setLastSavedAt(res.timestamp);
        setHasUnsavedChanges(false);
        setIsCustomDataLoaded(true);
        setJustSaved(true);
        soundManager.playSuccess();
        setIsSaveToastOpen(true);
        setTimeout(() => {
          setJustSaved(false);
        }, 4000);
      } else {
        alert('Error al guardar datos: ' + (res.error || 'Almacenamiento no disponible'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al guardar';
      alert('Error al guardar datos: ' + msg);
    }
  };

  // Al presionar "Subir Excel", el sistema sobrescribe y reemplaza por completo cualquier dato anterior
  const handleDataImported = async (newRecords: IncidentRecord[], _append?: boolean) => {
    setRecords(newRecords);
    setIsCustomDataLoaded(true);
    setFilters(INITIAL_FILTERS); // Reset filters so all new records are visible immediately
    try {
      const res = await saveAllDataToStorage(newRecords, titles);
      if (res.success) {
        setLastSavedAt(res.timestamp);
        setHasUnsavedChanges(false);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 4000);
      }
    } catch (err) {
      console.warn('Error guardando en almacenamiento:', err);
    }
    soundManager.playSuccess();
    setIsSaveToastOpen(true);
    setActiveTab('VISTA_RESUMEN');
  };

  // Limpiar toda la memoria guardada en el navegador y dejar la app lista para un archivo nuevo
  const handleClearAllData = async () => {
    await clearAllSavedData();
    setRecords([]);
    setIsCustomDataLoaded(false);
    setLastSavedAt(null);
    setHasUnsavedChanges(false);
    setFilters(INITIAL_FILTERS);
    soundManager.playClick();
    setIsExcelModalOpen(true); // Abre inmediatamente el asistente para cargar el archivo nuevo
  };

  const handleResetToDefault = () => {
    requireAdmin('Restablecer base de datos a valores del archivo oficial', async () => {
      await loadOfficialFile();
      soundManager.playClick();
    });
  };

  const handleDeleteRecord = (id: string) => {
    requireAdmin('Eliminar registro de incidencia', async () => {
      const updated = records.filter((r) => r.id !== id);
      setRecords(updated);
      await saveAllDataToStorage(updated, titles);
      setHasUnsavedChanges(false);
      soundManager.playClick();
    });
  };

  const handleAddIncident = (newRec: IncidentRecord) => {
    requireAdmin('Registrar nueva incidencia en la base de datos', async () => {
      const updated = [newRec, ...records];
      setRecords(updated);
      setIsCustomDataLoaded(true);
      const res = await saveAllDataToStorage(updated, titles);
      if (res.success) {
        setLastSavedAt(res.timestamp);
        setHasUnsavedChanges(false);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 4000);
      }
      soundManager.playSuccess();
      setIsSaveToastOpen(true);
    });
  };

  const handleExportExcel = () => {
    exportIncidentsToExcel(filteredRecords, `Atenciones_Serenazgo_NuevoChimbote_${new Date().toISOString().slice(0, 10)}.xlsx`);
    soundManager.playSuccess();
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    soundManager.playClick();
  };

  const isMainDashboardTab = activeTab === 'VISTA_RESUMEN' || activeTab === 'MAPA_CALOR';

  return (
    <div className="min-h-screen bg-[#d5dde5] text-slate-900 flex flex-col font-sans select-none antialiased relative">
      {/* Marca de Agua Translúcida Oficial Serenazgo de Fondo (Acelerado por GPU para scroll fluido) */}
      <div
        className="fixed inset-0 pointer-events-none select-none z-0 flex items-center justify-center overflow-hidden will-change-transform"
        style={{ opacity: 0.04, transform: 'translateZ(0)' }}
      >
        <img
          src="/logo-serenazgo.svg"
          alt=""
          className="w-[680px] h-[680px] max-w-[85vw] max-h-[85vh] object-contain grayscale contrast-125"
        />
      </div>

      {/* Top Municipal Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'MAPA_CALOR') {
            setCenterMode('MAPA');
          } else if (tab === 'VISTA_RESUMEN') {
            setCenterMode('GRAFICOS');
          }
        }}
      />

      {/* Main Container */}
      <main className="flex-1 p-2 sm:p-4 flex flex-col w-full">
        {/* MAIN DASHBOARD: Full-Width 2-Column Layout with Left Filters & Expanded Central Dashboard */}
        {isMainDashboardTab && (
          <div className="flex flex-col lg:flex-row gap-3 w-full">
            {/* Left Filter Sidebar */}
            <LeftFilters
              filters={filters}
              onFilterChange={setFilters}
              onResetFilters={handleResetFilters}
            />

            {/* Center Area: Si no hay registros aún, muestra la pantalla de espera de subida */}
            <div className="flex-1 flex flex-col gap-2 min-w-0 w-full">
              {records.length === 0 && !isLoadingFile ? (
                <div className="bg-gradient-to-b from-[#0b1f3b] via-[#0d274c] to-[#07162c] rounded-xl border-2 border-cyan-500/60 shadow-2xl p-6 sm:p-10 flex flex-col items-center justify-center text-center text-white my-auto min-h-[560px]">
                  {/* Badge de estado */}
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-300 text-xs font-mono font-bold mb-4 shadow-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span>EN ESPERA DE BASE DE DATOS ACTUALIZADA (20,635 FILAS)</span>
                  </div>

                  <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 border-2 border-cyan-400/50 flex items-center justify-center text-cyan-300 mb-4 shadow-[0_0_25px_rgba(6,182,212,0.25)]">
                    <FileSpreadsheet className="w-10 h-10" />
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-wider max-w-xl">
                    Central de Monitoreo y Operativos Serenazgo
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-xl mt-2 leading-relaxed">
                    Se ha ejecutado un <strong className="text-emerald-300 font-bold">reset completo de memoria y caché</strong> (localStorage e IndexedDB limpios, sin datos mockeados anteriores). La aplicación está a la espera de que suba la base de datos actualizada para indexar sus 20,635 filas.
                  </p>

                  {/* Acciones principales */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 w-full max-w-md">
                    <button
                      type="button"
                      id="btn-upload-waiting-primary"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-xs sm:text-sm uppercase tracking-wide shadow-xl flex items-center justify-center gap-2.5 transition-transform active:scale-95 cursor-pointer border border-emerald-300"
                    >
                      <Upload className="w-5 h-5 text-emerald-100" />
                      <span>Subir Base de Datos (.xlsx / .csv)</span>
                    </button>

                    <button
                      type="button"
                      id="btn-check-public-waiting"
                      onClick={loadOfficialFile}
                      className="w-full sm:w-auto py-3 px-4 rounded-xl bg-[#0f2d52] hover:bg-[#163e70] border border-cyan-600/70 text-cyan-200 font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                      title="Intentar leer directamente /public/base_de_datos.xlsx si ya lo colocó en la carpeta"
                    >
                      <RefreshCw className="w-4 h-4 text-cyan-400" />
                      <span>Leer /public/base_de_datos.xlsx</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-4 flex items-center gap-1.5 font-mono">
                    <span>💡 También puede usar la pestaña</span>
                    <button
                      onClick={() => setActiveTab('BD')}
                      className="text-cyan-300 underline font-bold hover:text-white"
                    >
                      BD / EXCEL
                    </button>
                    <span>o el asistente de carga</span>
                  </p>
                </div>
              ) : (
                <>
                  {/* 4 Iconic KPI Cards with Editable Titles */}
                  <KpiCards
                    filteredRecords={filteredRecords}
                    totalRecordsCount={records.length}
                    titles={titles}
                    onUpdateTitle={updateTitle}
                  />

                  {/* Barra de Estado Oficial Limpia */}
                  <div className="bg-white rounded-lg border-2 border-slate-300 shadow-sm px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>
                        Base de Datos Activa: Mostrando <strong className="font-black text-blue-900 font-mono">{filteredRecords.length.toLocaleString()}</strong> de{' '}
                        <strong className="font-mono">{records.length.toLocaleString()}</strong> registros oficiales
                      </span>
                      {lastSavedAt && (
                        <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 font-mono ml-1 font-semibold">
                          <HardDrive className="w-3 h-3 text-emerald-600" />
                          <span>Guardado: {lastSavedAt}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 hover:underline"
                        title="Subir o actualizar base de datos"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Actualizar BD</span>
                      </button>

                      {isCustomTitles && (
                        <button
                          type="button"
                          onClick={resetTitles}
                          className="text-[11px] text-rose-700 hover:text-rose-900 font-bold flex items-center gap-1 hover:underline ml-2"
                          title="Restablecer todos los títulos modificados a los originales"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restablecer títulos</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* CENTER CONTENT: Either 7 Charts OR Map in the Middle */}
                  {centerMode === 'GRAFICOS' ? (
                    <VistaResumen
                      records={filteredRecords}
                      allRecords={records}
                      selectedMes={filters.meses.length === 1 ? filters.meses[0] : null}
                      titles={titles}
                      onUpdateTitle={updateTitle}
                      onSelectMes={(m) => setFilters((prev) => ({ ...prev, meses: m ? [m] : [] }))}
                      onSelectSubsector={(s) => setFilters((prev) => ({ ...prev, searchQuery: s }))}
                      onSelectTurno={(t) => setFilters((prev) => ({ ...prev, turnos: [t as TurnoType] }))}
                      onSelectZona={(z) => setFilters((prev) => ({ ...prev, zonas: [z as ZonaType] }))}
                      onSelectComisaria={(c) => setFilters((prev) => ({ ...prev, comisarias: [c as ComisariaType] }))}
                      onSelectDia={(d) => setFilters((prev) => ({ ...prev, searchQuery: d }))}
                      onNavigateToHeatmap={() => {
                        setCenterMode('MAPA');
                        setActiveTab('MAPA_CALOR');
                      }}
                      onNavigateToDetails={() => setActiveTab('DETALLE_INCIDENCIAS')}
                      onNavigateToPlanes={() => setActiveTab('PLAN_OPERATIVOS')}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col min-h-[680px] rounded-lg overflow-hidden border-2 border-[#124270] shadow-xl bg-slate-950">
                      <MapErrorBoundary fallbackTitle="Radar GIS Municipal y Mapa de Calor">
                        <TacticalMapView
                          records={filteredRecords}
                          patrolUnits={patrolUnits}
                          onSelectIncident={() => {}}
                          onDispatchUnit={(unitId, loc) => {
                            soundManager.playEmergency();
                            alert(`¡Unidad ${unitId} despachada hacia ${loc}! Notificación enviada a la tripulación.`);
                          }}
                        />
                      </MapErrorBoundary>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Other secondary views if accessed directly */}
        {activeTab === 'PLAN_OPERATIVOS' && <PlanOperativosView />}

        {activeTab === 'COMPARATIVO' && <ComparativoView records={filteredRecords} />}

        {activeTab === 'DETALLE_INCIDENCIAS' && (
          <DetalleIncidenciasView
            records={filteredRecords}
            onDeleteRecord={handleDeleteRecord}
            onViewOnMap={(r) => {
              setFilters((prev) => ({ ...prev, searchQuery: r.codigo || r.id }));
              setCenterMode('MAPA');
              setActiveTab('MAPA_CALOR');
            }}
            onSaveChanges={handleSaveChanges}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
          />
        )}

        {activeTab === 'BD' && (
          <DatabaseExcelHub
            records={filteredRecords}
            isCustomDataLoaded={isCustomDataLoaded}
            onDataImported={handleDataImported}
            onResetToDefault={handleResetToDefault}
            onDeleteRecord={handleDeleteRecord}
            onViewOnMap={(r) => {
              setFilters((prev) => ({ ...prev, searchQuery: r.codigo || r.id }));
              setCenterMode('MAPA');
              setActiveTab('MAPA_CALOR');
            }}
            onSaveChanges={handleSaveChanges}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
            onOpenUploadModal={handleOpenExcelModal}
          />
        )}
      </main>

      {/* Footer Oficial con Créditos de Desarrollador */}
      <Footer />

      {/* Notificación de Confirmación de Guardado Permanente */}
      <SaveConfirmationToast
        isOpen={isSaveToastOpen}
        onClose={() => setIsSaveToastOpen(false)}
        recordsCount={records.length}
        records={records}
        lastSavedAt={lastSavedAt}
        titles={titles}
      />

      {/* Input de archivo nativo directo */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls,.csv"
        onChange={handleDirectFileUpload}
        className="hidden"
      />

      {/* Modals */}
      <ExcelUploadModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onDataImported={handleDataImported}
        onResetToDefault={handleResetToDefault}
        isCustomDataLoaded={isCustomDataLoaded}
        currentCount={records.length}
      />

      <NewIncidentModal
        isOpen={isNewIncidentOpen}
        onClose={() => setIsNewIncidentOpen(false)}
        onAddIncident={handleAddIncident}
      />

      <ReportPrintModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        records={filteredRecords}
        totalRecordsCount={records.length}
      />

      <AlertsModal
        isOpen={isAlertsModalOpen}
        onClose={() => setIsAlertsModalOpen(false)}
        onNavigateToHeatmap={() => {
          setCenterMode('MAPA');
          setActiveTab('MAPA_CALOR');
        }}
      />

      {/* Modal de Confirmación para Limpiar Datos / Resetear */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1f3b] border-2 border-rose-500/70 rounded-xl max-w-md w-full p-5 text-white shadow-2xl flex flex-col gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-rose-300">
                  ¿Limpiar Datos y Resetear Memoria?
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Esta acción vaciará por completo la base de datos guardada en el navegador.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-700/60">
              La base de datos actual se eliminará por completo para que puedas subir tu nuevo archivo Excel 100% limpio, sin mezclas de datos ni registros antiguos.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-cyan-900/60">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsClearConfirmOpen(false);
                  await handleClearAllData();
                }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-black text-xs uppercase tracking-wide shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Limpiar y Resetear Todo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay mientras se procesa el archivo Excel oficial de /public */}
      {isLoadingFile && (
        <div className="fixed inset-0 z-50 bg-[#071322]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="relative mb-5">
            <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Database className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <h2 className="text-lg sm:text-xl font-black uppercase text-cyan-200 tracking-wider">
            Cargando Base de Datos Oficial
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mt-2 font-medium leading-relaxed">
            Indexando registros de <strong className="text-white font-mono">base_de_datos.xlsx</strong> (o <strong className="text-white font-mono">base_de_datos.csv</strong>)...
          </p>
          <div className="mt-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-xs text-cyan-300 font-mono shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Alimentando componentes, KPIs, gráficos y mapa de calor</span>
          </div>
        </div>
      )}

      {/* Error banner si fallara la carga */}
      {fileLoadError && !isLoadingFile && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md bg-rose-950/95 border-2 border-rose-500 text-white p-4 rounded-xl shadow-2xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Error cargando base de datos</span>
          </div>
          <p className="text-xs text-rose-200">{fileLoadError}</p>
          <button
            type="button"
            onClick={loadOfficialFile}
            className="self-end px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {/* Admin Authentication & RBAC Modal */}
      <AdminAuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CustomTitlesProvider>
        <DashboardInner />
      </CustomTitlesProvider>
    </AuthProvider>
  );
}
