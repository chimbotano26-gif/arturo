/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
import { generateInitialRecords, INITIAL_PATROL_UNITS, SUBSECTORES_CONFIG } from './data/mockData';
import { soundManager } from './utils/audioAlert';
import { exportIncidentsToExcel } from './utils/excelHelper';
import { useEditableTitles } from './utils/useEditableTitles';
import { AuthProvider, useAuth } from './utils/authContext';
import { AdminAuthModal } from './components/AdminAuthModal';

// Components for the Municipal Dashboard
import { Header } from './components/Header';
import { LeftFilters, RightActions } from './components/FiltersSidebar';
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
import { RotateCcw, Save, HardDrive, Upload, FileSpreadsheet, Database } from 'lucide-react';
import { SaveConfirmationToast } from './components/SaveConfirmationToast';
import {
  saveAllDataToStorage,
  loadSavedRecordsFromStorage,
} from './utils/persistenceHelper';

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
  // 1. Database records state (persisted permanently so user doesn't have to re-enter data)
  const [records, setRecords] = useState<IncidentRecord[]>(() => {
    const saved = loadSavedRecordsFromStorage();
    if (saved.records && saved.records.length > 0) {
      return saved.records;
    }
    return generateInitialRecords();
  });

  const [isCustomDataLoaded, setIsCustomDataLoaded] = useState<boolean>(() => {
    const saved = loadSavedRecordsFromStorage();
    return saved.isCustom;
  });

  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => {
    const saved = loadSavedRecordsFromStorage();
    return saved.lastSaved;
  });

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

  // Background sync as safety net
  useEffect(() => {
    try {
      if (isCustomDataLoaded) {
        localStorage.setItem('serenazgo_nch_records', JSON.stringify(records));
        localStorage.setItem('serenazgo_nch_is_custom', 'true');
      }
    } catch {
      // Quota exceeded handling
    }
  }, [records, isCustomDataLoaded]);

  // When tab is changed to MAPA_CALOR, set centerMode to 'MAPA'
  useEffect(() => {
    if (activeTab === 'MAPA_CALOR') {
      setCenterMode('MAPA');
    }
  }, [activeTab]);

  // 6. Filter calculation (Strictly bounded to Nuevo Chimbote)
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Demarcación Territorial Estricta: Solo subsectores oficiales de Nuevo Chimbote
      if (!SUBSECTORES_CONFIG[r.subsector]) {
        return false;
      }
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
          r.ubicacion.toLowerCase().includes(q) ||
          (r.columna1 && r.columna1.toLowerCase().includes(q)) ||
          (r.observacion && r.observacion.toLowerCase().includes(q)) ||
          r.tipoIncidencia.toLowerCase().includes(q) ||
          r.subsector.toLowerCase().includes(q) ||
          (r.efectivo ? r.efectivo.toLowerCase().includes(q) : false) ||
          (r.codigo ? r.codigo.toLowerCase().includes(q) : false);
        if (!match) return false;
      }
      return true;
    });
  }, [records, filters]);

  // Handlers for Data Hub - Protected with requireAdmin
  const handleOpenExcelModal = () => {
    requireAdmin('Carga o modificación de la Base de Datos Excel', () => {
      setIsExcelModalOpen(true);
    });
  };

  const handleOpenNewIncident = () => {
    requireAdmin('Registro de Nuevo Operativo o Incidencia', () => {
      setIsNewIncidentOpen(true);
    });
  };

  // Central Save Changes Handler
  const handleSaveChanges = () => {
    const res = saveAllDataToStorage(records);
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
  };

  const handleDataImported = (newRecords: IncidentRecord[], append: boolean) => {
    requireAdmin('Guardar datos importados en el sistema', () => {
      let updated: IncidentRecord[];
      if (append) {
        updated = [...records, ...newRecords];
      } else {
        updated = newRecords;
      }
      setRecords(updated);
      setIsCustomDataLoaded(true);
      const res = saveAllDataToStorage(updated);
      if (res.success) {
        setLastSavedAt(res.timestamp);
        setHasUnsavedChanges(false);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 4000);
      }
      soundManager.playSuccess();
      setIsSaveToastOpen(true);
      setActiveTab('VISTA_RESUMEN');
    });
  };

  const handleResetToDefault = () => {
    requireAdmin('Restablecer base de datos a valores oficiales', () => {
      localStorage.removeItem('serenazgo_nch_records');
      localStorage.removeItem('serenazgo_nch_is_custom');
      localStorage.removeItem('serenazgo_nch_last_saved');
      setRecords(generateInitialRecords());
      setIsCustomDataLoaded(false);
      setLastSavedAt(null);
      setHasUnsavedChanges(false);
      setFilters(INITIAL_FILTERS);
      soundManager.playClick();
    });
  };

  const handleDeleteRecord = (id: string) => {
    requireAdmin('Eliminar registro de incidencia', () => {
      const updated = records.filter((r) => r.id !== id);
      setRecords(updated);
      saveAllDataToStorage(updated);
      setHasUnsavedChanges(false);
      soundManager.playClick();
    });
  };

  const handleAddIncident = (newRec: IncidentRecord) => {
    requireAdmin('Registrar nueva incidencia en la base de datos', () => {
      const updated = [newRec, ...records];
      setRecords(updated);
      setIsCustomDataLoaded(true);
      const res = saveAllDataToStorage(updated);
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
        onSaveChanges={handleSaveChanges}
        onOpenExcelModal={handleOpenExcelModal}
        hasUnsavedChanges={hasUnsavedChanges}
        lastSavedAt={lastSavedAt}
        justSaved={justSaved}
      />

      {/* Main Container */}
      <main className="flex-1 p-2 sm:p-3 flex flex-col max-w-[1920px] w-full mx-auto">
        {/* MAIN DASHBOARD: 3-Column Layout with Center Switching between 7 Charts and Map in the Middle */}
        {isMainDashboardTab && (
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Left Filter Sidebar */}
            <LeftFilters
              filters={filters}
              onFilterChange={setFilters}
              onResetFilters={handleResetFilters}
            />

            {/* Center Area: KPI Cards + Status Bar + (7 Iconic Charts OR Heatmap in the middle) */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              {/* 4 Iconic KPI Cards with Editable Titles */}
              <KpiCards
                filteredRecords={filteredRecords}
                totalRecordsCount={records.length}
                titles={titles}
                onUpdateTitle={updateTitle}
              />

              {/* Barra de Estado Oficial */}
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

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Botón Rápido Subir Excel en Barra de Estado */}
                  <button
                    type="button"
                    onClick={handleOpenExcelModal}
                    className="text-[11px] font-bold px-2.5 py-1 rounded flex items-center gap-1.5 transition-all shadow-xs bg-blue-700 hover:bg-blue-600 text-white active:scale-95 border border-blue-500/50"
                    title="Subir archivo Excel oficial (.xlsx / .xls) para alimentar el sistema"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-200" />
                    <span>Subir Excel</span>
                  </button>

                  {/* Acceso a Base de Datos Completa */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('BD')}
                    className="text-[11px] font-bold px-2.5 py-1 rounded flex items-center gap-1.5 transition-all shadow-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 active:scale-95"
                    title="Ver tabla completa y explorador de Base de Datos"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ver Base de Datos</span>
                  </button>

                  {/* Botón Rápido Guardar Cambios en Barra de Estado */}
                  <button
                    type="button"
                    onClick={handleSaveChanges}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded flex items-center gap-1.5 transition-all shadow-xs ${
                      hasUnsavedChanges
                        ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse ring-1 ring-amber-400'
                        : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                    }`}
                    title="Guardar todos los registros y cambios en el sistema para que no sea necesario volver a meter datos"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{hasUnsavedChanges ? 'Guardar Cambios Pendientes' : 'Guardar Cambios'}</span>
                  </button>

                  {isCustomTitles && (
                    <button
                      type="button"
                      onClick={resetTitles}
                      className="text-[11px] text-rose-700 hover:text-rose-900 font-bold flex items-center gap-1 hover:underline ml-1"
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
            </div>

            {/* Right Action Sidebar: BOTONES DE ACCIÓN + INCIDENCIA */}
            <RightActions
              filters={filters}
              onFilterChange={setFilters}
              onResetFilters={handleResetFilters}
              onExportPdf={() => setIsReportModalOpen(true)}
              onExportExcel={handleExportExcel}
              onOpenHeatmap={() => {
                setCenterMode('MAPA');
                setActiveTab('MAPA_CALOR');
              }}
              onOpenAlerts={() => setIsAlertsModalOpen(true)}
              onOpenExcelModal={() => setIsExcelModalOpen(true)}
              onSaveChanges={handleSaveChanges}
              hasUnsavedChanges={hasUnsavedChanges}
              isHeatmapActive={centerMode === 'MAPA'}
              onToggleView={() => {
                setCenterMode((prev) => (prev === 'GRAFICOS' ? 'MAPA' : 'GRAFICOS'));
              }}
              onResetTitles={isCustomTitles ? resetTitles : undefined}
            />
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
