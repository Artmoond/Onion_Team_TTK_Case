import {
  useEditorStore,
  useSelectedPanorama,
  useSelectedPoint,
  useSelectedRoom,
  useSelectedStair,
  useSelectedWall,
} from '../../store/editorStore';
import { FloorProperties } from '../editor/FloorProperties';
import { RoomProperties } from '../editor/RoomProperties';
import { StairProperties } from '../editor/StairProperties';
import { WallProperties } from '../editor/WallProperties';
import { PanoramaProperties } from '../panoramas/PanoramaProperties';
import { PointProperties } from '../points/PointProperties';

export function PropertiesPanel() {
  const point = useSelectedPoint();
  const wall = useSelectedWall();
  const room = useSelectedRoom();
  const stair = useSelectedStair();
  const panorama = useSelectedPanorama();
  const selection = useEditorStore((state) => state.selection);

  let content;
  if (point) content = <PointProperties />;
  else if (wall) content = <WallProperties />;
  else if (stair) content = <StairProperties />;
  else if (room) content = <RoomProperties />;
  else if (panorama) content = <PanoramaProperties panorama={panorama} />;
  else content = <FloorProperties />;

  return (
    <aside className="z-10 flex w-80 shrink-0 flex-col border-l border-slate-800 bg-slate-900">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {selection ? 'Свойства объекта' : 'Этаж и проект'}
        </span>
        {selection && (
          <button className="text-[9px] font-semibold text-slate-500 hover:text-slate-300" onClick={() => useEditorStore.getState().select(null)}>
            снять выбор
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">{content}</div>
    </aside>
  );
}
