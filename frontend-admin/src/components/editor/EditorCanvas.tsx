import Konva from 'konva';
import { Crosshair, Focus, Footprints, Minus, MousePointer2, Plus, Ruler } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Circle, Group, Image as KonvaImage, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva';
import { POINT_TYPES } from '../../config/pointTypes';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { useActiveFloor, useEditorStore } from '../../store/editorStore';
import type { RoomPoint } from '../../types/venue';
import {
  calibration,
  clamp,
  pixelDistance,
  pointsBounds,
  stairCorners,
  stairLengthMeters,
  stairStepLines,
  stairWidthMeters,
} from '../../utils/geometry';

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

function useContainerSize(ref: RefObject<HTMLDivElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function useCanvasImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    let cancelled = false;
    const element = new window.Image();
    element.onload = () => {
      if (!cancelled) setImage(element);
    };
    element.onerror = () => {
      if (!cancelled) setImage(null);
    };
    element.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return image;
}

function hexAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}

export function EditorCanvas() {
  const floor = useActiveFloor();
  const venue = useEditorStore((state) => state.venue);
  const tool = useEditorStore((state) => state.tool);
  const pointCategory = useEditorStore((state) => state.pointCategory);
  const selection = useEditorStore((state) => state.selection);
  const select = useEditorStore((state) => state.select);
  const addPoint = useEditorStore((state) => state.addPoint);
  const addWall = useEditorStore((state) => state.addWall);
  const addStair = useEditorStore((state) => state.addStair);
  const addRoom = useEditorStore((state) => state.addRoom);
  const updatePoint = useEditorStore((state) => state.updatePoint);
  const updateWall = useEditorStore((state) => state.updateWall);
  const updateStair = useEditorStore((state) => state.updateStair);
  const updatePanorama = useEditorStore((state) => state.updatePanorama);
  const setFloorScale = useEditorStore((state) => state.setFloorScale);
  const setTool = useEditorStore((state) => state.setTool);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const commitTransaction = useEditorStore((state) => state.commitTransaction);
  const showToast = useEditorStore((state) => state.showToast);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const deletePoint = useEditorStore((state) => state.deletePoint);
  const deleteWall = useEditorStore((state) => state.deleteWall);
  const deleteStair = useEditorStore((state) => state.deleteStair);
  const deleteRoom = useEditorStore((state) => state.deleteRoom);
  const deletePanorama = useEditorStore((state) => state.deletePanorama);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const size = useContainerSize(containerRef);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [wallStart, setWallStart] = useState<RoomPoint | null>(null);
  const [stairStart, setStairStart] = useState<RoomPoint | null>(null);
  const [cursor, setCursor] = useState<RoomPoint | null>(null);
  const [roomDraft, setRoomDraft] = useState<RoomPoint[]>([]);
  const [calibrationPoints, setCalibrationPoints] = useState<RoomPoint[]>([]);
  const [calibrationMeters, setCalibrationMeters] = useState('');
  const [spaceHeld, setSpaceHeld] = useState(false);

  const planUrl = useAssetUrl(floor?.planUrl, floor?.planAsset?.id);
  const planImage = useCanvasImage(planUrl);

  const fitToScreen = useCallback(() => {
    const state = useEditorStore.getState();
    const target = state.venue?.floors.find((item) => item.id === state.activeFloorId);
    if (!target || !size.width || !size.height) return;
    const padding = 56;
    const scale = Math.min((size.width - padding * 2) / target.width, (size.height - padding * 2) / target.height);
    const safeScale = clamp(scale, 0.05, 8);
    setViewport({
      scale: safeScale,
      x: (size.width - target.width * safeScale) / 2,
      y: (size.height - target.height * safeScale) / 2,
    });
  }, [size.width, size.height]);

  useEffect(() => {
    fitToScreen();
  }, [floor?.id, floor?.width, floor?.height, fitToScreen]);

  useEffect(() => {
    setWallStart(null);
    setStairStart(null);
    setRoomDraft([]);
    setCursor(null);
    setCalibrationPoints([]);
    setCalibrationMeters('');
  }, [tool, floor?.id]);

  const finishRoom = useCallback(() => {
    if (roomDraft.length >= 3) {
      const cleaned = roomDraft.filter((point, index) => {
        if (index === 0) return true;
        const previous = roomDraft[index - 1];
        return pixelDistance(point.x, point.y, previous.x, previous.y) > 2;
      });
      if (cleaned.length >= 3) addRoom(cleaned);
      else showToast('error', 'Помещение должно содержать минимум 3 различные вершины');
    } else {
      showToast('info', 'Добавьте минимум 3 вершины помещения');
    }
    setRoomDraft([]);
  }, [addRoom, roomDraft, showToast]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }
      if (event.code === 'Space') {
        setSpaceHeld(true);
        event.preventDefault();
        return;
      }
      if (event.key === 'Escape') {
        setWallStart(null);
        setStairStart(null);
        setRoomDraft([]);
        setCalibrationPoints([]);
        setCalibrationMeters('');
        setTool('select');
      }
      if (event.key === 'Enter') {
        if (tool === 'wall') setWallStart(null);
        if (tool === 'room' && roomDraft.length >= 3) finishRoom();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selection) {
        event.preventDefault();
        if (selection.kind === 'point') deletePoint(selection.id);
        if (selection.kind === 'wall') deleteWall(selection.id);
        if (selection.kind === 'stair') deleteStair(selection.id);
        if (selection.kind === 'room') deleteRoom(selection.id);
        if (selection.kind === 'panorama') deletePanorama(selection.id);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', up);
    };
  }, [selection, roomDraft, finishRoom, undo, redo, setTool, deletePoint, deleteWall, deleteStair, deleteRoom, deletePanorama, tool]);

  const pointerPosition = (): RoomPoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const point = stage.getRelativePointerPosition();
    if (!point) return null;
    return { x: Math.round(point.x), y: Math.round(point.y) };
  };


  if (!floor || !venue) {
    return <div className="flex h-full items-center justify-center text-xs text-slate-500">Нет активного этажа</div>;
  }

  const isPanning = tool === 'pan' || spaceHeld;

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (event.evt.button !== 0) return;
    const stage = event.target.getStage();
    if (!stage || event.target !== stage) return;
    const point = pointerPosition();
    if (!point) return;

    if (tool === 'point') {
      addPoint(pointCategory, point.x, point.y);
      return;
    }
    if (tool === 'wall') {
      if (!wallStart) {
        setWallStart(point);
        showToast('info', 'Начало стены задано', 'Кликните вторую точку. Цепочка завершается Enter или двойным кликом.');
      } else {
        const distance = pixelDistance(wallStart.x, wallStart.y, point.x, point.y);
        if (distance > 1) {
          addWall(wallStart.x, wallStart.y, point.x, point.y);
          setWallStart(point);
        } else {
          setWallStart(null);
        }
      }
      return;
    }
    if (tool === 'stairs') {
      if (!stairStart) {
        setStairStart(point);
        showToast('info', 'Начало лестницы задано', 'Кликните конец марша');
      } else {
        if (pixelDistance(stairStart.x, stairStart.y, point.x, point.y) > 1) {
          addStair(stairStart.x, stairStart.y, point.x, point.y);
        }
        setStairStart(null);
      }
      return;
    }
    if (tool === 'room') {
      setRoomDraft((draft) => [...draft, point]);
      return;
    }
    if (tool === 'calibrate') {
      if (calibrationPoints.length === 0) {
        setCalibrationPoints([point]);
        showToast('info', 'Первая точка задана', 'Кликните вторую точку известного отрезка');
      } else {
        setCalibrationPoints([calibrationPoints[0], point]);
      }
      return;
    }
    if (tool === 'select') {
      select(null);
    }
  };

  const handleStageMouseMove = () => {
    if ((tool === 'wall' && wallStart) || (tool === 'stairs' && stairStart) || (tool === 'room' && roomDraft.length > 0)) {
      setCursor(pointerPosition());
    }
  };

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = viewport.scale;
    const world = {
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale,
    };
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const nextScale = clamp(oldScale * (direction > 0 ? 1.1 : 1 / 1.1), 0.05, 8);
    setViewport({
      scale: nextScale,
      x: pointer.x - world.x * nextScale,
      y: pointer.y - world.y * nextScale,
    });
  };

  const zoomBy = (factor: number) => {
    const center = { x: size.width / 2, y: size.height / 2 };
    const world = { x: (center.x - viewport.x) / viewport.scale, y: (center.y - viewport.y) / viewport.scale };
    const nextScale = clamp(viewport.scale * factor, 0.05, 8);
    setViewport({ scale: nextScale, x: center.x - world.x * nextScale, y: center.y - world.y * nextScale });
  };

  const calibrationPixels =
    calibrationPoints.length === 2 ? pixelDistance(calibrationPoints[0].x, calibrationPoints[0].y, calibrationPoints[1].x, calibrationPoints[1].y) : 0;

  const applyCalibration = () => {
    const meters = Number(calibrationMeters);
    const nextScale = calibration(calibrationPixels, meters);
    if (!nextScale) {
      showToast('error', 'Укажите положительную длину в метрах');
      return;
    }
    setFloorScale(floor.id, Number(nextScale.toFixed(6)));
    setCalibrationPoints([]);
    setCalibrationMeters('');
    setTool('select');
    showToast('success', 'Масштаб обновлён', `${nextScale.toFixed(4)} м/px · длины стен пересчитаны`);
  };

  const wallDraftPoints = wallStart && cursor ? [wallStart.x, wallStart.y, cursor.x, cursor.y] : [];
  const stairDraft =
    stairStart && cursor
      ? { x1: stairStart.x, y1: stairStart.y, x2: cursor.x, y2: cursor.y, width: 40 }
      : null;
  const stairDraftCorners = stairDraft ? stairCorners(stairDraft) : null;
  const stairDraftSteps = stairDraft ? stairStepLines(stairDraft) : [];
  const roomDraftPoints = [...roomDraft, ...(cursor && tool === 'room' && roomDraft.length > 0 ? [cursor] : [])].flatMap((point) => [point.x, point.y]);
  const calibrationDraftPoints = [...calibrationPoints, ...(calibrationPoints.length === 1 && cursor ? [cursor] : [])].flatMap((point) => [point.x, point.y]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,#334155_1px,transparent_0)] [background-size:24px_24px]" />
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          draggable={isPanning}
          onDragEnd={(event) => {
            if (event.target === stageRef.current) setViewport((current) => ({ ...current, x: event.target.x(), y: event.target.y() }));
          }}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onDblClick={() => {
            if (tool === 'room') finishRoom();
            if (tool === 'wall') setWallStart(null);
          }}
          style={{ cursor: isPanning ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
        >
          <Layer listening={false}>
            <Rect x={0} y={0} width={floor.width} height={floor.height} fill={planImage ? '#f8fafc' : '#0b1220'} stroke="#334155" strokeWidth={2} />
            {!planImage &&
              Array.from({ length: Math.ceil(floor.width / 100) + 1 }).map((_, index) => (
                <Line key={`vx-${index}`} points={[index * 100, 0, index * 100, floor.height]} stroke="#1e293b" strokeWidth={1} />
              ))}
            {!planImage &&
              Array.from({ length: Math.ceil(floor.height / 100) + 1 }).map((_, index) => (
                <Line key={`hy-${index}`} points={[0, index * 100, floor.width, index * 100]} stroke="#1e293b" strokeWidth={1} />
              ))}
            {planImage && <KonvaImage image={planImage} x={0} y={0} width={floor.width} height={floor.height} opacity={1} />}
          </Layer>

          <Layer>
            {floor.rooms?.map((room) => {
              const selected = selection?.kind === 'room' && selection.id === room.id;
              const bounds = pointsBounds(room.points);
              return (
                <Group
                  key={room.id}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    select({ kind: 'room', id: room.id });
                  }}
                >
                  <Line
                    points={room.points.flatMap((point) => [point.x, point.y])}
                    closed
                    fill={hexAlpha(room.color ?? '#0ea5e9', '22')}
                    stroke={room.color ?? '#0ea5e9'}
                    strokeWidth={selected ? 3 : 1.5}
                    dash={selected ? undefined : [6, 4]}
                    hitStrokeWidth={10}
                  />
                  {bounds && (
                    <Text
                      x={bounds.x}
                      y={bounds.y + bounds.height / 2 - 9}
                      width={bounds.width}
                      align="center"
                      text={room.name}
                      fontSize={Math.max(10, 16 / viewport.scale)}
                      fontStyle="bold"
                      fill={planImage ? '#0f172a' : '#e2e8f0'}
                      listening={false}
                    />
                  )}
                </Group>
              );
            })}
          </Layer>

          <Layer>
            {floor.stairs?.map((stair) => {
              const selected = selection?.kind === 'stair' && selection.id === stair.id;
              const corners = stairCorners(stair);
              if (!corners) return null;
              const steps = stairStepLines(stair);
              const centerX = (stair.x1 + stair.x2) / 2;
              const centerY = (stair.y1 + stair.y2) / 2;
              const axisAngle = Math.atan2(stair.y2 - stair.y1, stair.x2 - stair.x1);
              const arrowAngle = stair.direction === 'down' ? axisAngle + Math.PI : axisAngle;
              const arrowSize = 13 / viewport.scale;
              const arrowPoints = [
                centerX + Math.cos(arrowAngle) * arrowSize,
                centerY + Math.sin(arrowAngle) * arrowSize,
                centerX + Math.cos(arrowAngle + 2.5) * arrowSize,
                centerY + Math.sin(arrowAngle + 2.5) * arrowSize,
                centerX + Math.cos(arrowAngle - 2.5) * arrowSize,
                centerY + Math.sin(arrowAngle - 2.5) * arrowSize,
              ];
              return (
                <Group key={stair.id}>
                  <Line
                    points={corners.flatMap((point) => [point.x, point.y])}
                    closed
                    fill={hexAlpha(selected ? '#f59e0b' : '#f59e0b', selected ? '35' : '18')}
                    stroke={selected ? '#fbbf24' : '#b45309'}
                    strokeWidth={selected ? 2.5 : 1.5}
                    hitStrokeWidth={12}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      select({ kind: 'stair', id: stair.id });
                    }}
                  />
                  {steps.map((line, index) => (
                    <Line
                      key={`${stair.id}-step-${index}`}
                      points={[line[0].x, line[0].y, line[1].x, line[1].y]}
                      stroke={selected ? '#fbbf24' : '#b45309'}
                      strokeWidth={1}
                      opacity={0.8}
                      listening={false}
                    />
                  ))}
                  <Line
                    points={arrowPoints}
                    closed
                    fill={selected ? '#fbbf24' : '#92400e'}
                    listening={false}
                  />
                  <Text
                    x={centerX - 80}
                    y={centerY + stair.width / 2 + 4 / viewport.scale}
                    width={160}
                    align="center"
                    text={`${stair.name} · ${stairLengthMeters(stair, floor.metersPerPixel)} м`}
                    fontSize={Math.max(8, 11 / viewport.scale)}
                    fontStyle="bold"
                    fill={planImage ? '#0f172a' : '#fde68a'}
                    listening={false}
                  />
                  {selected && (
                    <>
                      <Circle
                        x={stair.x1}
                        y={stair.y1}
                        radius={7 / viewport.scale}
                        fill="#fbbf24"
                        stroke="#0f172a"
                        strokeWidth={2 / viewport.scale}
                        draggable
                        onDragStart={() => beginTransaction()}
                        onDragMove={(event) => {
                          updateStair(stair.id, { x1: event.target.x(), y1: event.target.y() }, false);
                        }}
                        onDragEnd={(event) => {
                          updateStair(stair.id, { x1: Math.round(event.target.x()), y1: Math.round(event.target.y()) }, false);
                          commitTransaction();
                        }}
                      />
                      <Circle
                        x={stair.x2}
                        y={stair.y2}
                        radius={7 / viewport.scale}
                        fill="#fbbf24"
                        stroke="#0f172a"
                        strokeWidth={2 / viewport.scale}
                        draggable
                        onDragStart={() => beginTransaction()}
                        onDragMove={(event) => {
                          updateStair(stair.id, { x2: event.target.x(), y2: event.target.y() }, false);
                        }}
                        onDragEnd={(event) => {
                          updateStair(stair.id, { x2: Math.round(event.target.x()), y2: Math.round(event.target.y()) }, false);
                          commitTransaction();
                        }}
                      />
                      <Label x={centerX} y={centerY - stair.width / 2 - 26 / viewport.scale}>
                        <Tag fill="#b45309" cornerRadius={3 / viewport.scale} />
                        <Text
                          text={`${stairWidthMeters(stair, floor.metersPerPixel)} м`}
                          padding={4 / viewport.scale}
                          fontSize={11 / viewport.scale}
                          fill="#ffffff"
                        />
                      </Label>
                    </>
                  )}
                </Group>
              );
            })}
          </Layer>

          <Layer>
            {floor.walls?.map((wall) => {
              const selected = selection?.kind === 'wall' && selection.id === wall.id;
              return (
                <Group key={wall.id}>
                  <Line
                    points={[wall.x1, wall.y1, wall.x2, wall.y2]}
                    stroke={selected ? '#0891b2' : '#334155'}
                    strokeWidth={wall.thickness ?? 4}
                    lineCap="round"
                    hitStrokeWidth={16}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      select({ kind: 'wall', id: wall.id });
                    }}
                  />
                  {selected && (
                    <>
                      <Circle
                        x={wall.x1}
                        y={wall.y1}
                        radius={7 / viewport.scale}
                        fill="#22d3ee"
                        stroke="#0f172a"
                        strokeWidth={2 / viewport.scale}
                        draggable
                        onDragStart={() => beginTransaction()}
                        onDragMove={(event) => {
                          updateWall(wall.id, { x1: event.target.x(), y1: event.target.y() }, false);
                        }}
                        onDragEnd={(event) => {
                          updateWall(wall.id, { x1: Math.round(event.target.x()), y1: Math.round(event.target.y()) }, false);
                          commitTransaction();
                        }}
                      />
                      <Circle
                        x={wall.x2}
                        y={wall.y2}
                        radius={7 / viewport.scale}
                        fill="#22d3ee"
                        stroke="#0f172a"
                        strokeWidth={2 / viewport.scale}
                        draggable
                        onDragStart={() => beginTransaction()}
                        onDragMove={(event) => {
                          updateWall(wall.id, { x2: event.target.x(), y2: event.target.y() }, false);
                        }}
                        onDragEnd={(event) => {
                          updateWall(wall.id, { x2: Math.round(event.target.x()), y2: Math.round(event.target.y()) }, false);
                          commitTransaction();
                        }}
                      />
                      <Label x={(wall.x1 + wall.x2) / 2} y={(wall.y1 + wall.y2) / 2 - 26 / viewport.scale}>
                        <Tag fill="#0891b2" cornerRadius={3 / viewport.scale} />
                        <Text text={`${wall.lengthMeters} м`} padding={4 / viewport.scale} fontSize={12 / viewport.scale} fill="#ffffff" />
                      </Label>
                    </>
                  )}
                </Group>
              );
            })}
          </Layer>

          <Layer>
            {floor.panoramas.map((panorama) => {
              const linked = floor.points.find((point) => point.panoramaId === panorama.id);
              const selected = selection?.kind === 'panorama' && selection.id === panorama.id;
              return (
                <Group
                  key={panorama.id}
                  x={panorama.x}
                  y={panorama.y - (linked ? 34 : 0)}
                  draggable={tool === 'select' && !spaceHeld}
                  onDragStart={() => {
                    select({ kind: 'panorama', id: panorama.id });
                    beginTransaction();
                  }}
                  onDragMove={(event) => updatePanorama(panorama.id, { x: event.target.x(), y: event.target.y() + (linked ? 34 : 0) }, false)}
                  onDragEnd={(event) => {
                    updatePanorama(panorama.id, { x: Math.round(event.target.x()), y: Math.round(event.target.y()) + (linked ? 34 : 0) }, false);
                    commitTransaction();
                  }}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    select({ kind: 'panorama', id: panorama.id });
                  }}
                >
                  <Rect width={34} height={24} offsetX={17} offsetY={12} cornerRadius={5} fill="#7c3aed" stroke={selected ? '#e9d5ff' : '#c4b5fd'} strokeWidth={selected ? 2 : 1} />
                  <Text width={34} height={24} offsetX={17} offsetY={12} align="center" verticalAlign="middle" text="360" fontSize={9} fontStyle="bold" fill="#ffffff" listening={false} />
                </Group>
              );
            })}
          </Layer>

          <Layer>
            {floor.points.map((point) => {
              const type = POINT_TYPES[point.category];
              const selected = selection?.kind === 'point' && selection.id === point.id;
              const radius = selected ? 17 : 14;
              return (
                <Group
                  key={point.id}
                  x={point.x}
                  y={point.y}
                  draggable={tool === 'select' && !spaceHeld}
                  onDragStart={() => {
                    select({ kind: 'point', id: point.id });
                    beginTransaction();
                  }}
                  onDragMove={(event) => updatePoint(point.id, { x: event.target.x(), y: event.target.y() }, false)}
                  onDragEnd={(event) => {
                    updatePoint(point.id, { x: Math.round(event.target.x()), y: Math.round(event.target.y()) }, false);
                    commitTransaction();
                  }}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    select({ kind: 'point', id: point.id });
                  }}
                >
                  <Circle radius={radius + 5} fill={type.color} opacity={selected ? 0.25 : 0.12} listening={false} />
                  <Circle radius={radius} fill={type.color} stroke={selected ? '#22d3ee' : '#ffffff'} strokeWidth={selected ? 3 : 2} shadowColor="#000000" shadowBlur={6} shadowOpacity={0.5} />
                  <Text
                    width={radius * 2}
                    height={radius * 2}
                    offsetX={radius}
                    offsetY={radius}
                    align="center"
                    verticalAlign="middle"
                    text={type.shortLabel}
                    fontSize={type.shortLabel.length > 2 ? 8 : 10}
                    fontStyle="bold"
                    fill="#ffffff"
                    listening={false}
                  />
                  {selected && <Circle radius={radius + 9} stroke="#22d3ee" strokeWidth={1.5 / viewport.scale} dash={[5, 4]} listening={false} />}
                  <Text
                    x={-60}
                    y={radius + 5}
                    width={120}
                    align="center"
                    text={point.name}
                    fontSize={Math.max(8, 11 / viewport.scale)}
                    fontStyle="bold"
                    fill={planImage ? '#0f172a' : '#e2e8f0'}
                    listening={false}
                  />
                </Group>
              );
            })}
          </Layer>

          <Layer listening={false}>
            {wallDraftPoints.length > 0 && <Line points={wallDraftPoints} stroke="#22d3ee" strokeWidth={2 / viewport.scale} dash={[8 / viewport.scale, 5 / viewport.scale]} />}
            {wallStart && <Circle x={wallStart.x} y={wallStart.y} radius={5 / viewport.scale} fill="#22d3ee" />}
            {stairDraftCorners && (
              <Line
                points={stairDraftCorners.flatMap((point) => [point.x, point.y])}
                closed
                fill={hexAlpha('#f59e0b', '25')}
                stroke="#fbbf24"
                strokeWidth={2 / viewport.scale}
                dash={[6 / viewport.scale, 4 / viewport.scale]}
              />
            )}
            {stairDraftSteps.map((line, index) => (
              <Line
                key={`stair-draft-${index}`}
                points={[line[0].x, line[0].y, line[1].x, line[1].y]}
                stroke="#fbbf24"
                strokeWidth={1 / viewport.scale}
                opacity={0.8}
              />
            ))}
            {stairStart && <Circle x={stairStart.x} y={stairStart.y} radius={5 / viewport.scale} fill="#fbbf24" />}
            {roomDraftPoints.length > 0 && <Line points={roomDraftPoints} stroke="#0ea5e9" strokeWidth={2 / viewport.scale} dash={[8 / viewport.scale, 5 / viewport.scale]} closed={false} />}
            {roomDraft.map((point, index) => (
              <Circle key={`${point.x}-${point.y}-${index}`} x={point.x} y={point.y} radius={4 / viewport.scale} fill="#0ea5e9" />
            ))}
            {calibrationDraftPoints.length > 0 && <Line points={calibrationDraftPoints} stroke="#f59e0b" strokeWidth={2 / viewport.scale} dash={[8 / viewport.scale, 5 / viewport.scale]} />}
            {calibrationPoints.map((point, index) => (
              <Circle key={`cal-${index}`} x={point.x} y={point.y} radius={6 / viewport.scale} fill="#f59e0b" />
            ))}
          </Layer>
        </Stage>
      )}

      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 p-1 text-slate-300 shadow-xl backdrop-blur">
        <button className="rounded p-1.5 hover:bg-slate-800" onClick={() => zoomBy(1.2)} title="Приблизить">
          <Plus className="h-4 w-4" />
        </button>
        <button className="rounded p-1.5 hover:bg-slate-800" onClick={() => zoomBy(1 / 1.2)} title="Отдалить">
          <Minus className="h-4 w-4" />
        </button>
        <button className="rounded p-1.5 hover:bg-slate-800" onClick={fitToScreen} title="Вписать план">
          <Focus className="h-4 w-4" />
        </button>
        <span className="w-12 text-center font-mono text-[10px] text-slate-500">{Math.round(viewport.scale * 100)}%</span>
      </div>

      <div className="absolute right-3 top-3 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-right shadow-xl backdrop-blur">
        <div className="text-[10px] font-bold text-white">{floor.name}</div>
        <div className="font-mono text-[9px] text-slate-500">
          {floor.width} × {floor.height} px · {floor.metersPerPixel} м/px
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-[10px] text-slate-400 backdrop-blur">
        {tool === 'select' ? (
          <MousePointer2 className="h-3.5 w-3.5" />
        ) : tool === 'pan' ? (
          <Crosshair className="h-3.5 w-3.5" />
        ) : tool === 'stairs' ? (
          <Footprints className="h-3.5 w-3.5" />
        ) : (
          <Ruler className="h-3.5 w-3.5" />
        )}
        {tool === 'select' && 'Перетаскивайте точки, стены и лестницы. Ctrl+Z — отмена.'}
        {tool === 'pan' && 'Перетаскивайте холст. Колесо — масштаб.'}
        {tool === 'point' && `Клик по плану добавит точку «${POINT_TYPES[pointCategory].label}».`}
        {tool === 'wall' &&
          (wallStart
            ? 'Клик — следующая стена от этой точки. Enter или двойной клик — завершить, Esc — выйти.'
            : 'Кликните начало стены.')}
        {tool === 'stairs' &&
          (stairStart ? 'Кликните конец марша. Esc — отмена.' : 'Кликните начало лестницы, затем её конец.')}
        {tool === 'room' && (roomDraft.length ? `Вершин: ${roomDraft.length}. Двойной клик или Enter — завершить.` : 'Кликайте по вершинам помещения.')}
        {tool === 'calibrate' && (calibrationPoints.length === 0 ? 'Кликните первую точку известного отрезка.' : 'Кликните вторую точку известного отрезка.')}
      </div>

      {tool === 'room' && roomDraft.length >= 3 && (
        <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-sky-700/60 bg-slate-900/95 px-3 py-2 shadow-xl">
          <span className="text-[10px] text-slate-300">Вершин: {roomDraft.length}</span>
          <button className="btn-primary py-1" onClick={finishRoom}>
            Завершить помещение
          </button>
          <button className="btn py-1" onClick={() => setRoomDraft([])}>
            Сбросить
          </button>
        </div>
      )}

      {calibrationPoints.length === 2 && (
        <div className="absolute bottom-16 left-1/2 w-80 -translate-x-1/2 rounded-xl border border-amber-700/60 bg-slate-900/95 p-3 shadow-2xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Калибровка масштаба</div>
          <div className="mt-1 text-[10px] text-slate-400">
            Пиксельная длина: <span className="font-mono text-slate-200">{calibrationPixels.toFixed(1)} px</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              autoFocus
              type="number"
              min="0"
              step="0.01"
              className="field"
              placeholder="Реальная длина, м"
              value={calibrationMeters}
              onChange={(event) => setCalibrationMeters(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyCalibration();
              }}
            />
            <button className="btn-primary shrink-0" onClick={applyCalibration}>
              Применить
            </button>
          </div>
          <p className="mt-1.5 text-[9px] text-slate-500">Все длины стен этажа будут пересчитаны по новому масштабу.</p>
        </div>
      )}
    </div>
  );
}
