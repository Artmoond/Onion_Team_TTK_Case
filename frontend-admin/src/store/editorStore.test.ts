import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './editorStore';

function reset() {
  useEditorStore.getState().clearProject();
}

describe('editor store history', () => {
  beforeEach(reset);

  it('creates a project with one floor and adds points', () => {
    const store = useEditorStore.getState();
    store.createProject('Тест', 'test');
    const state = useEditorStore.getState();
    expect(state.venue?.floors).toHaveLength(1);
    expect(state.activeFloorId).toBe(state.venue?.floors[0].id);

    useEditorStore.getState().addPoint('wifi', 100, 200);
    const withPoint = useEditorStore.getState();
    expect(withPoint.venue?.floors[0].points).toHaveLength(1);
    expect(withPoint.venue?.floors[0].points[0].category).toBe('wifi');
    expect(withPoint.venue?.floors[0].points[0].wifi?.security).toBe('WPA2');
    expect(withPoint.selection?.kind).toBe('point');
  });

  it('undoes and redoes a live drag transaction as one step', () => {
    useEditorStore.getState().createProject('Тест', 'test');
    useEditorStore.getState().addPoint('info', 100, 200);
    const pointId = useEditorStore.getState().selection!.id;

    const store = useEditorStore.getState();
    store.beginTransaction();
    store.updatePoint(pointId, { x: 300, y: 400 }, false);
    store.commitTransaction();

    let state = useEditorStore.getState();
    expect(state.venue?.floors[0].points[0].x).toBe(300);
    state.undo();
    state = useEditorStore.getState();
    expect(state.venue?.floors[0].points[0].x).toBe(100);
    state.redo();
    state = useEditorStore.getState();
    expect(state.venue?.floors[0].points[0].x).toBe(300);
  });

  it('keeps last floor and confirms floor switching', () => {
    useEditorStore.getState().createProject('Тест', 'test');
    useEditorStore.getState().addFloor();
    let state = useEditorStore.getState();
    expect(state.venue?.floors).toHaveLength(2);
    const secondFloorId = state.venue!.floors[1].id;
    expect(state.activeFloorId).toBe(secondFloorId);

    state.deleteFloor(secondFloorId);
    state = useEditorStore.getState();
    expect(state.venue?.floors).toHaveLength(1);
    state.deleteFloor(state.venue!.floors[0].id);
    state = useEditorStore.getState();
    expect(state.venue?.floors).toHaveLength(1);
  });

  it('recalculates wall lengths when scale changes', () => {
    useEditorStore.getState().createProject('Тест', 'test');
    const floorId = useEditorStore.getState().activeFloorId!;
    useEditorStore.getState().addWall(0, 0, 100, 0);
    let state = useEditorStore.getState();
    expect(state.venue?.floors[0].walls?.[0].lengthMeters).toBe(5);

    state.setFloorScale(floorId, 0.1);
    state = useEditorStore.getState();
    expect(state.venue?.floors[0].walls?.[0].lengthMeters).toBe(10);
  });

  it('adds stairs and updates their properties', () => {
    useEditorStore.getState().createProject('Тест', 'test');
    useEditorStore.getState().addStair(100, 100, 300, 100);
    let state = useEditorStore.getState();
    expect(state.venue?.floors[0].stairs).toHaveLength(1);
    expect(state.selection?.kind).toBe('stair');
    const stairId = state.selection!.id;
    expect(state.venue?.floors[0].stairs?.[0].name).toBe('Лестница 1');

    state.updateStair(stairId, { width: 80, direction: 'up' });
    state = useEditorStore.getState();
    expect(state.venue?.floors[0].stairs?.[0]).toMatchObject({ width: 80, direction: 'up' });
  });

  it('links stairs between floors and clears links on delete', () => {
    useEditorStore.getState().createProject('Тест', 'test');
    const firstFloorId = useEditorStore.getState().activeFloorId!;
    useEditorStore.getState().addStair(100, 100, 300, 100);
    const firstStairId = useEditorStore.getState().selection!.id;

    useEditorStore.getState().addFloor();
    const secondFloorId = useEditorStore.getState().activeFloorId!;
    useEditorStore.getState().addStair(100, 100, 300, 100);
    const secondStairId = useEditorStore.getState().selection!.id;

    useEditorStore.getState().linkStairs(firstStairId, secondStairId);
    let state = useEditorStore.getState();
    const firstStair = state.venue?.floors.find((floor) => floor.id === firstFloorId)?.stairs?.[0];
    const secondStair = state.venue?.floors.find((floor) => floor.id === secondFloorId)?.stairs?.[0];
    expect(firstStair).toMatchObject({ targetFloorId: secondFloorId, targetStairId: secondStairId });
    expect(secondStair).toMatchObject({ targetFloorId: firstFloorId, targetStairId: firstStairId });

    state.deleteStair(secondStairId);
    state = useEditorStore.getState();
    expect(state.venue?.floors.find((floor) => floor.id === firstFloorId)?.stairs?.[0].targetStairId).toBeUndefined();
    expect(state.venue?.floors.find((floor) => floor.id === firstFloorId)?.stairs?.[0].targetFloorId).toBeUndefined();
  });

  it('creates a reciprocal stair on the target floor', () => {
    useEditorStore.getState().createProject('Тест', 'test');
    const firstFloorId = useEditorStore.getState().activeFloorId!;
    useEditorStore.getState().addStair(100, 100, 300, 100);
    const firstStairId = useEditorStore.getState().selection!.id;

    useEditorStore.getState().addFloor();
    const secondFloorId = useEditorStore.getState().activeFloorId!;
    const createdId = useEditorStore.getState().createLinkedStair(firstStairId, secondFloorId);
    expect(createdId).toBeTruthy();

    const state = useEditorStore.getState();
    const firstStair = state.venue?.floors.find((floor) => floor.id === firstFloorId)?.stairs?.[0];
    const createdStair = state.venue?.floors.find((floor) => floor.id === secondFloorId)?.stairs?.[0];
    expect(firstStair).toMatchObject({
      targetFloorId: secondFloorId,
      targetStairId: createdId,
      direction: 'up',
    });
    expect(createdStair).toMatchObject({
      targetFloorId: firstFloorId,
      targetStairId: firstStairId,
      direction: 'down',
    });
  });

  it('clears stair links when a floor or its objects are removed', () => {
    useEditorStore.getState().createProject('Тест', 'test');
    const firstFloorId = useEditorStore.getState().activeFloorId!;
    useEditorStore.getState().addStair(100, 100, 300, 100);
    const firstStairId = useEditorStore.getState().selection!.id;

    useEditorStore.getState().addFloor();
    const secondFloorId = useEditorStore.getState().activeFloorId!;
    const createdId = useEditorStore.getState().createLinkedStair(firstStairId, secondFloorId)!;

    useEditorStore.getState().clearFloorObjects(firstFloorId);
    let state = useEditorStore.getState();
    expect(state.venue?.floors.find((floor) => floor.id === firstFloorId)?.stairs).toHaveLength(0);
    expect(
      state.venue?.floors.find((floor) => floor.id === secondFloorId)?.stairs?.find((stair) => stair.id === createdId)
    ).toMatchObject({ targetFloorId: undefined, targetStairId: undefined });

    useEditorStore.getState().setActiveFloor(firstFloorId);
    useEditorStore.getState().addStair(100, 100, 300, 100);
    const newFirstStairId = useEditorStore.getState().selection!.id;
    useEditorStore.getState().linkStairs(newFirstStairId, createdId);
    useEditorStore.getState().deleteFloor(secondFloorId);
    state = useEditorStore.getState();
    expect(state.venue?.floors[0].stairs?.[0]?.targetStairId).toBeUndefined();
  });
});
