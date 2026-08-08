import type { Translations } from '../i18n/translations';
import {
  KB_MARKER_ICON_URL,
  QUESTION_MARKER_ICON_URL,
  type FixedMarkerType,
  type FixedRoutePoint,
} from '../types/routes';
import {
  EXTRACT_PMC_ICON_URL,
  EXTRACT_SCAV_ICON_URL,
  type MapExtractMarker,
} from '../utils/mapExtracts';
import {
  type FixedLayerId,
  type FixedLayerVisibility,
  fixedMarkerLayerId,
} from '../hooks/useFixedLayerVisibility';
import { EyeToggleButton } from './EyeToggleButton';

const DEFAULT_PIN_ICON_URL = '/markers/default-pin.svg';

interface LayerMeta {
  id: FixedLayerId;
  iconUrl: string;
  title: string;
}

function layersPresent(
  fixedPoints: FixedRoutePoint[],
  extracts: MapExtractMarker[],
  t: Translations,
): LayerMeta[] {
  const present = new Set<FixedLayerId>();
  for (const point of fixedPoints) {
    present.add(fixedMarkerLayerId(point.markerType as FixedMarkerType | undefined));
  }
  for (const extract of extracts) {
    if (extract.faction === 'scav') present.add('extract-scav');
    else if (extract.faction === 'pmc') present.add('extract-pmc');
    else {
      present.add('extract-pmc');
      present.add('extract-scav');
    }
  }

  const all: LayerMeta[] = [
    { id: 'default', iconUrl: DEFAULT_PIN_ICON_URL, title: t.adminMarkerTypeDefault },
    { id: 'kb', iconUrl: KB_MARKER_ICON_URL, title: t.adminMarkerTypeKb },
    { id: 'question', iconUrl: QUESTION_MARKER_ICON_URL, title: t.adminMarkerTypeQuestion },
    { id: 'extract-pmc', iconUrl: EXTRACT_PMC_ICON_URL, title: t.routesExtractPmc },
    { id: 'extract-scav', iconUrl: EXTRACT_SCAV_ICON_URL, title: t.routesExtractScav },
  ];

  return all.filter((layer) => present.has(layer.id));
}

interface FixedLayerTogglesProps {
  fixedPoints: FixedRoutePoint[];
  extracts: MapExtractMarker[];
  visibility: FixedLayerVisibility;
  onToggle: (layer: FixedLayerId) => void;
  t: Translations;
}

export function FixedLayerToggles({
  fixedPoints,
  extracts,
  visibility,
  onToggle,
  t,
}: FixedLayerTogglesProps) {
  const layers = layersPresent(fixedPoints, extracts, t);
  if (layers.length === 0) return null;

  return (
    <div className="fixed-layer-toggles" role="group" aria-label={t.routesFixedLayers}>
      {layers.map((layer) => {
        const visible = visibility[layer.id];
        return (
          <div
            key={layer.id}
            className={`fixed-layer-toggle${visible ? '' : ' is-off'}`}
            title={layer.title}
          >
            <img
              className="fixed-layer-toggle-icon"
              src={layer.iconUrl}
              alt=""
              draggable={false}
            />
            <span className="fixed-layer-toggle-label">{layer.title}</span>
            <EyeToggleButton
              visible={visible}
              labelShow={t.routesShowLayer(layer.title)}
              labelHide={t.routesHideLayer(layer.title)}
              onToggle={() => onToggle(layer.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
