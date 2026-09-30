import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { IncidentRecord, TurnoType, ZonaType } from '../types';
import { Flame, Layers, MapPin, Eye, Compass, Shield, Filter, Sparkles, Radio } from 'lucide-react';
import {
  NUEVO_CHIMBOTE_DISTRICT_BOUNDARY,
  PACIFIC_COASTLINE,
  TACTICAL_ROAD_NETWORK,
  TACTICAL_SECTORS_BOUNDARIES,
  TACTICAL_LANDMARKS,
} from '../data/nuevoChimboteVectorMap';
import { GoogleMapsTacticalView } from './GoogleMapsTacticalView';

interface HeatmapViewProps {
  records: IncidentRecord[];
  onSelectIncident?: (incident: IncidentRecord) => void;
}

export const HeatmapView: React.FC<HeatmapViewProps> = ({ records, onSelectIncident }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const vectorGroupRef = useRef<L.LayerGroup | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  const [mapEngine, setMapEngine] = useState<'LEAFLET' | 'GOOGLE_MAPS'>('LEAFLET');
  const [mapMode, setMapMode] = useState<'heat' | 'markers' | 'hybrid'>('hybrid');
  const [thermalAnimation, setThermalAnimation] = useState(true);
  const [filterTurno, setFilterTurno] = useState<TurnoType | 'TODOS'>('TODOS');
  const [filterZona, setFilterZona] = useState<ZonaType | 'TODOS'>('TODOS');
  const [tileLayerType, setTileLayerType] = useState<'vector' | 'dark' | 'streets'>('vector');

  // Filter records based on in-map quick toggles
  const mapRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterTurno !== 'TODOS' && r.turno !== filterTurno) return false;
      if (filterZona !== 'TODOS' && r.zona !== filterZona) return false;
      return true;
    });
  }, [records, filterTurno, filterZona]);

  // Initialize Leaflet map with Vector Base
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        console.warn('HeatmapView cleanup notice:', e);
      }
      mapInstanceRef.current = null;
    }

    try {
      // Center on Plaza Mayor de Nuevo Chimbote (-9.1264, -78.5303)
      const map = L.map(container, {
        center: [-9.1264, -78.5303],
        zoom: 14,
        minZoom: 11,
        maxZoom: 18,
      });

      // Layer Group 1: Base Vectorial Táctica Nativa (Garantiza mapa visible sin pantalla negra)
      const vGroup = L.layerGroup().addTo(map);
      vectorGroupRef.current = vGroup;

      // Layer Group 2: Focos de Calor e Incidencias
      const dynGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = dynGroup;

      mapInstanceRef.current = map;

      // Invalidate size immediately
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          // ignore
        }
      }, 100);
    } catch (err) {
      console.warn('HeatmapView Leaflet init catch:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('HeatmapView unmount notice:', e);
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Render Vector Base: Calles, Perímetro, Costanera y 16 Subsectores
  useEffect(() => {
    const map = mapInstanceRef.current;
    const vGroup = vectorGroupRef.current;
    if (!map || !vGroup) return;

    vGroup.clearLayers();

    // 1. Perímetro General
    const perimeter = L.polygon(NUEVO_CHIMBOTE_DISTRICT_BOUNDARY, {
      color: '#06b6d4',
      weight: 1.8,
      dashArray: '5, 8',
      fillColor: '#07152b',
      fillOpacity: 0.08,
      interactive: false,
    });
    vGroup.addLayer(perimeter);

    // 2. Línea Costera y Mar del Pacífico
    const ocean = L.polygon(
      [
        [-9.085, -78.565],
        [-9.165, -78.565],
        ...[...PACIFIC_COASTLINE].reverse(),
        [-9.085, -78.565],
      ],
      {
        color: '#0284c7',
        weight: 1,
        fillColor: '#030c18',
        fillOpacity: 0.7,
        interactive: false,
      }
    );
    vGroup.addLayer(ocean);

    const coast = L.polyline(PACIFIC_COASTLINE, {
      color: '#38bdf8',
      weight: 2.5,
      opacity: 0.8,
      interactive: false,
    });
    vGroup.addLayer(coast);

    // 3. 16 Subsectores Polígonos
    TACTICAL_SECTORS_BOUNDARIES.forEach((sec) => {
      const poly = L.polygon(sec.coords, {
        color: sec.color,
        weight: 1.2,
        dashArray: '3, 6',
        fillColor: sec.color,
        fillOpacity: 0.08,
      });
      poly.bindTooltip(
        `<div class="text-[11px] font-bold text-white bg-slate-950/90 p-1.5 rounded border border-cyan-500">
          <strong>${sec.id}</strong>: ${sec.nombre}
        </div>`,
        { sticky: true }
      );
      vGroup.addLayer(poly);
    });

    // 4. Red de Avenidas Principales
    TACTICAL_ROAD_NETWORK.forEach((road) => {
      const isTrunk = road.tipo === 'TRUNK';
      const line = L.polyline(road.coords, {
        color: isTrunk ? '#38bdf8' : '#06b6d4',
        weight: isTrunk ? 3.5 : 2,
        opacity: isTrunk ? 0.85 : 0.65,
        className: isTrunk ? 'tactical-road-glow' : '',
      });
      line.bindTooltip(`🛣️ ${road.nombre}`, { sticky: true });
      vGroup.addLayer(line);
    });

    // 5. Landmarks Principales
    TACTICAL_LANDMARKS.forEach((lm) => {
      const icon = L.divIcon({
        html: `<div class="px-1.5 py-0.5 rounded text-[8px] font-bold border border-cyan-400 bg-slate-950/90 text-cyan-200 shadow whitespace-nowrap">📍 ${lm.nombre}</div>`,
        className: 'custom-heat-landmark',
        iconSize: [100, 20],
        iconAnchor: [50, 10],
      });
      const marker = L.marker([lm.lat, lm.lng], { icon });
      marker.on('click', () => map.flyTo([lm.lat, lm.lng], 16));
      vGroup.addLayer(marker);
    });
  }, []);

  // Update Tile Layer when toggle changed
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    if (tileLayerType === 'vector') {
      // 100% Vectorial, Zero dependencias externas
      return;
    }

    const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const tile = L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    tile.bringToBack();
  }, [tileLayerType]);

  // Update Points and Heat Circles on mapRecords change or mapMode change
  useEffect(() => {
    if (!mapInstanceRef.current || !layersGroupRef.current) return;

    layersGroupRef.current.clearLayers();

    // Color mapper for incident severity
    const getColor = (inc: string) => {
      const up = inc.toUpperCase();
      if (up.includes('ROBO') || up.includes('AGRES') || up.includes('ALLANAMIENTO')) return '#ef4444'; // Red
      if (up.includes('DROGA') || up.includes('ALCOHOL') || up.includes('SOSPECH')) return '#f59e0b'; // Amber
      if (up.includes('AUXILIO') || up.includes('MEDIC')) return '#10b981'; // Green
      if (up.includes('VEHICUL') || up.includes('ACCIDENT')) return '#3b82f6'; // Blue
      return '#8b5cf6'; // Violet for other
    };

    // 1. Group points geographically to create Heat clusters
    const clusterMap: Record<string, { lat: number; lng: number; count: number; name: string }> = {};

    mapRecords.forEach((r) => {
      const key = `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
      if (!clusterMap[key]) {
        clusterMap[key] = { lat: r.lat, lng: r.lng, count: 0, name: r.subsector };
      }
      clusterMap[key].count++;
    });

    // Draw Heatmap Circles con Gradiente Térmico / Termográfico Dinámico y Fluido
    if (mapMode === 'heat' || mapMode === 'hybrid') {
      Object.values(clusterMap).forEach((cluster) => {
        // Radio estrictamente calibrado al cuadrante/calle real (28m a 65m en vez de 280m gigantescos)
        const radius = Math.min(65, Math.max(26, Math.sqrt(cluster.count) * 4.2));
        const opacity = Math.min(0.85, 0.35 + (cluster.count / 60) * 0.5);

        // Capa 1: Difusión térmica externa (Efecto FLIR infrarrojo)
        const outerThermalAura = L.circle([cluster.lat, cluster.lng], {
          radius: radius,
          fillColor: cluster.count > 25 ? '#ef4444' : cluster.count > 12 ? '#f97316' : '#06b6d4',
          fillOpacity: opacity * 0.35,
          stroke: false,
          className: thermalAnimation ? 'animate-thermal-pulse' : '',
        });

        // Capa 2: Zona media térmica naranja/ámbar
        const midThermalAura = L.circle([cluster.lat, cluster.lng], {
          radius: radius * 0.65,
          fillColor: cluster.count > 25 ? '#f97316' : '#eab308',
          fillOpacity: opacity * 0.6,
          stroke: false,
        });

        // Capa 3: Núcleo ardiente incandescente (Rojo / Blanco térmico)
        const coreThermalAura = L.circle([cluster.lat, cluster.lng], {
          radius: radius * 0.32,
          fillColor: cluster.count > 25 ? '#dc2626' : '#fb923c',
          fillOpacity: Math.min(0.95, opacity * 0.9),
          stroke: true,
          color: '#ffffff',
          weight: 0.8,
        });

        outerThermalAura.bindTooltip(
          `<div style="font-family: inherit; font-size: 11px; padding: 4px; background: #07162b; color: #fff; border-radius: 4px; border: 1px solid #f97316;">
            <strong>🔥 Foco Térmico:</strong> ${cluster.name || 'Sector'}<br/>
            <span style="color: #38bdf8;">Densidad: ${cluster.count} atenciones registradas</span>
          </div>`,
          { sticky: true, opacity: 0.95 }
        );

        layersGroupRef.current?.addLayer(outerThermalAura);
        layersGroupRef.current?.addLayer(midThermalAura);
        layersGroupRef.current?.addLayer(coreThermalAura);
      });
    }

    // Draw Markers / Pins
    if (mapMode === 'markers' || mapMode === 'hybrid') {
      // Sample or render all (limit to 350 on dense map to keep 60fps)
      const visibleMarkers = mapRecords.slice(0, 300);

      visibleMarkers.forEach((r) => {
        const color = getColor(r.tipoIncidencia);

        const circleMarker = L.circleMarker([r.lat, r.lng], {
          radius: 5.5,
          fillColor: color,
          color: '#ffffff',
          weight: 1.5,
          opacity: 0.9,
          fillOpacity: 0.85,
        });

        const popupContent = `
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 220px;">
            <div style="background: #092c53; color: #38bdf8; font-weight: 800; padding: 4px 8px; border-radius: 4px; font-size: 11px; margin-bottom: 6px; display: flex; justify-content: space-between;">
              <span>${r.codigo || r.id}</span>
              <span style="color: #ffffff; text-transform: uppercase;">${r.turno}</span>
            </div>
            <div style="font-weight: 800; color: #ffffff; font-size: 13px; margin-bottom: 4px;">
              ${r.tipoIncidencia}
            </div>
            <div style="color: #cbd5e1; font-size: 11px; margin-bottom: 4px;">
              📍 <strong>${r.ubicacion}</strong>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; color: #94a3b8; background: rgba(15,23,42,0.6); padding: 5px; border-radius: 4px; margin-bottom: 6px;">
              <div><strong>Sector:</strong> ${r.subsector} (${r.zona})</div>
              <div><strong>Comisaría:</strong> ${r.comisaria}</div>
              <div><strong>Fecha:</strong> ${r.fecha} ${r.hora}</div>
              <div><strong>Estado:</strong> <span style="color: #4ade80;">${r.estado}</span></div>
            </div>
            ${r.patrullero ? `<div style="font-size: 10px; color: #93c5fd;">🚔 ${r.patrullero}</div>` : ''}
          </div>
        `;

        circleMarker.bindPopup(popupContent);
        circleMarker.on('click', () => {
          onSelectIncident?.(r);
        });

        layersGroupRef.current?.addLayer(circleMarker);
      });
    }
  }, [mapRecords, mapMode, onSelectIncident]);

  const recenterMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([-9.1264, -78.5303], 14, { animate: true });
    }
  };

  if (mapEngine === 'GOOGLE_MAPS') {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="bg-white rounded-lg border-2 border-slate-300 shadow-sm p-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Motor de Mapa:</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-300 text-xs font-bold">
              <button
                onClick={() => setMapEngine('GOOGLE_MAPS')}
                className="px-2.5 py-1 rounded bg-[#124270] text-white shadow"
              >
                Google Maps API Oficial
              </button>
              <button
                onClick={() => setMapEngine('LEAFLET')}
                className="px-2.5 py-1 rounded text-slate-600 hover:text-slate-900"
              >
                Visor Térmico FLIR Leaflet
              </button>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Plataforma Oficial Google Maps • Cobertura Nuevo Chimbote
          </span>
        </div>
        <GoogleMapsTacticalView
          records={records}
          patrolUnits={[]}
          onSelectIncident={onSelectIncident}
          onSwitchToLeaflet={() => setMapEngine('LEAFLET')}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-3 min-w-0 h-full">
      {/* Top Map Bar Controls */}
      <div className="bg-white rounded-lg border-2 border-slate-300 shadow-sm p-3 flex flex-wrap items-center justify-between gap-3 text-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-[#0f3460] uppercase tracking-wide">
                MAPA DE CALOR TÉRMICO &bull; NUEVO CHIMBOTE
              </h2>
              {thermalAnimation && (
                <span className="text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  ANIMACIÓN FLUIDA ACTIVA
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Efecto termográfico dinámico y estricto • <span className="font-bold text-blue-700">{mapRecords.length}</span> atenciones
            </p>
          </div>
        </div>

        {/* Filters and mode pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Engine Switch */}
          <button
            onClick={() => setMapEngine('GOOGLE_MAPS')}
            className="px-2.5 py-1 rounded bg-[#0f3460] hover:bg-[#164882] text-white text-xs font-bold flex items-center gap-1 shadow transition-colors"
            title="Cambiar a Google Maps con capa táctica"
          >
            <MapPin className="w-3.5 h-3.5 text-cyan-300" />
            <span>Google Maps</span>
          </button>

          {/* Thermal Animation Toggle */}
          <button
            onClick={() => setThermalAnimation(!thermalAnimation)}
            className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors flex items-center gap-1 ${
              thermalAnimation
                ? 'bg-rose-600 text-white border-rose-700 shadow'
                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
            }`}
            title="Activar/Desactivar efecto térmico pulsante fluido"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{thermalAnimation ? 'Efecto Térmico ON' : 'Efecto Térmico OFF'}</span>
          </button>

          {/* Map Mode Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-300 text-xs font-bold">
            <button
              onClick={() => setMapMode('hybrid')}
              className={`px-2.5 py-1 rounded transition-colors ${
                mapMode === 'hybrid' ? 'bg-[#124270] text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Híbrido
            </button>
            <button
              onClick={() => setMapMode('heat')}
              className={`px-2.5 py-1 rounded transition-colors ${
                mapMode === 'heat' ? 'bg-[#124270] text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Calor
            </button>
            <button
              onClick={() => setMapMode('markers')}
              className={`px-2.5 py-1 rounded transition-colors ${
                mapMode === 'markers' ? 'bg-[#124270] text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Puntos
            </button>
          </div>

          {/* Turno Filter */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-300 text-xs font-bold">
            {(['TODOS', 'MAÑANA', 'TARDE', 'NOCHE'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterTurno(t)}
                className={`px-2 py-1 rounded transition-colors ${
                  filterTurno === t ? 'bg-[#185e94] text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Base Layer Switch */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-300 text-xs font-bold">
            <button
              onClick={() => setTileLayerType('vector')}
              className={`px-2 py-1 rounded transition-colors ${
                tileLayerType === 'vector' ? 'bg-[#185e94] text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Capa Vectorial Táctica Nativa (Sin dependencias externas)"
            >
              Vector Nativo
            </button>
            <button
              onClick={() => setTileLayerType('dark')}
              className={`px-2 py-1 rounded transition-colors ${
                tileLayerType === 'dark' ? 'bg-[#185e94] text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="OpenStreetMap Táctico Nocturno"
            >
              OSM Táctico
            </button>
            <button
              onClick={() => setTileLayerType('streets')}
              className={`px-2 py-1 rounded transition-colors ${
                tileLayerType === 'streets' ? 'bg-[#185e94] text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="OpenStreetMap Estándar"
            >
              Callejero
            </button>
          </div>

          {/* Recenter */}
          <button
            onClick={recenterMap}
            className="px-2.5 py-1 rounded bg-[#0f3460] hover:bg-[#164882] text-white text-xs font-bold flex items-center gap-1 shadow transition-colors"
            title="Centrar en Plaza Mayor de Nuevo Chimbote"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-300" />
            <span>Centrar</span>
          </button>
        </div>
      </div>

      {/* Main Map Container */}
      <div className="relative flex-1 min-h-[500px] w-full rounded-lg border-2 border-cyan-800/80 shadow-md overflow-hidden bg-[#071324] tactical-grid-bg">
        <div
          ref={mapContainerRef}
          className={`w-full h-full min-h-[500px] z-10 tactical-grid-bg ${
            tileLayerType === 'dark' ? 'dark-tactical-tiles' : ''
          }`}
        />

        {/* Floating Map Legend */}
        <div className="absolute bottom-4 left-4 z-20 bg-[#0c1f38]/90 backdrop-blur-md border border-cyan-800/80 rounded-lg p-3 text-white text-xs shadow-xl max-w-xs">
          <div className="font-black text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-1.5 text-[11px]">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Leyenda de Puntos Críticos</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 shrink-0"></span>
              <span>Robo, Hurto o Agresión Física</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>
              <span>Consumo Drogas/Alcohol, Sospechosos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
              <span>Auxilio Médico / Apoyo al Ciudadano</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0"></span>
              <span>Incidentes Vehiculares / Tránsito</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-cyan-900/60 text-[10px] text-slate-300">
              <span className="w-3 h-3 rounded-full bg-red-600/40 border border-red-500 shrink-0"></span>
              <span>Zona Roja de Alta Recurrencia (Calor)</span>
            </div>
          </div>
        </div>

        {/* Hotspots Quick Guide in Nuevo Chimbote */}
        <div className="absolute top-4 right-4 z-20 hidden md:block bg-[#0c1f38]/90 backdrop-blur-md border border-cyan-800/80 rounded-lg p-2.5 text-white text-xs shadow-xl">
          <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-1">
            Sectores de Mayor Frecuencia
          </div>
          <div className="flex flex-col gap-1 text-[11px] text-slate-200">
            <div>🔥 <strong>S2BA:</strong> Plaza Mayor / Av. Pacífico (437 op.)</div>
            <div>🔥 <strong>S1BA:</strong> Buenos Aires I y II (324 op.)</div>
            <div>🔥 <strong>S6BA:</strong> Bellamar I y II (232 op.)</div>
            <div>🔥 <strong>S3BA:</strong> Urb. Bruce / Los Héroes (211 op.)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
