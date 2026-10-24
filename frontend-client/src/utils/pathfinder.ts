import { Floor, RouteResponse } from '../types';

interface InternalNode {
  id: string;
  x: number;
  y: number;
  neighbors: { node: InternalNode; dist: number }[];
}

function euclideanDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x1 - x2, y1 - y2);
}

export function calculateClientRoute(
  floor: Floor,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  startName: string = 'Старт',
  endName: string = 'Финиш'
): RouteResponse {
  const { nodes, edges } = floor.graph;

  if (!nodes || nodes.length === 0) {
    const distPx = euclideanDist(fromX, fromY, toX, toY);
    const distMeters = Math.round(distPx * (floor.metersPerPixel || 0.05));
    return {
      totalDistanceMeters: distMeters,
      estimatedDurationSeconds: Math.max(10, Math.round(distMeters / 1.1)),
      legs: [{ floorId: floor.id, floorLevel: floor.level, points: [[fromX, fromY], [toX, toY]] }],
      panoramas: floor.panoramas.map(p => p.id).slice(0, 3),
      steps: [
        `Начните движение от: ${startName}`,
        `Следуйте по коридору ${distMeters} м`,
        `Вы прибыли: ${endName}`
      ]
    };
  }

  // 1. Построение графа смежности
  const nodeMap = new Map<string, InternalNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, { id: n.id, x: n.x, y: n.y, neighbors: [] });
  }

  for (const e of edges) {
    const u = nodeMap.get(e.fromId);
    const v = nodeMap.get(e.toId);
    if (u && v) {
      u.neighbors.push({ node: v, dist: e.lengthMeters });
      if (e.bidirectional) {
        v.neighbors.push({ node: u, dist: e.lengthMeters });
      }
    }
  }

  // 2. Поиск ближайших узлов к начальной и конечной координатам
  let startNode: InternalNode = nodes[0] as any;
  let minStartDist = Infinity;
  let endNode: InternalNode = nodes[0] as any;
  let minEndDist = Infinity;

  for (const n of nodes) {
    const dStart = euclideanDist(fromX, fromY, n.x, n.y);
    if (dStart < minStartDist) {
      minStartDist = dStart;
      startNode = nodeMap.get(n.id)!;
    }

    const dEnd = euclideanDist(toX, toY, n.x, n.y);
    if (dEnd < minEndDist) {
      minEndDist = dEnd;
      endNode = nodeMap.get(n.id)!;
    }
  }

  // 3. Алгоритм Дейкстры
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  for (const id of nodeMap.keys()) {
    distances.set(id, Infinity);
    previous.set(id, null);
    unvisited.add(id);
  }

  distances.set(startNode.id, 0);

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let shortest = Infinity;

    for (const id of unvisited) {
      const d = distances.get(id)!;
      if (d < shortest) {
        shortest = d;
        currentId = id;
      }
    }

    if (!currentId || shortest === Infinity || currentId === endNode.id) {
      break;
    }

    unvisited.delete(currentId);
    const current = nodeMap.get(currentId)!;

    for (const { node: neighbor, dist } of current.neighbors) {
      if (unvisited.has(neighbor.id)) {
        const alt = distances.get(currentId)! + dist;
        if (alt < distances.get(neighbor.id)!) {
          distances.set(neighbor.id, alt);
          previous.set(neighbor.id, currentId);
        }
      }
    }
  }

  // 4. Восстановление пути
  const pathNodeIds: string[] = [];
  let curr: string | null = endNode.id;

  while (curr) {
    pathNodeIds.unshift(curr);
    curr = previous.get(curr) || null;
    if (curr === startNode.id) {
      pathNodeIds.unshift(curr);
      break;
    }
  }

  // Если путь не сошелся (например изолированные компоненты)
  if (pathNodeIds.length === 0 || pathNodeIds[0] !== startNode.id) {
    pathNodeIds.length = 0;
    pathNodeIds.push(startNode.id, endNode.id);
  }

  // Формируем координаты полилинии
  const points: [number, number][] = [[fromX, fromY]];
  for (const id of pathNodeIds) {
    const n = nodeMap.get(id);
    if (n) {
      // избегаем дублирования одинаковых подряд координат
      const last = points[points.length - 1];
      if (!last || Math.hypot(last[0] - n.x, last[1] - n.y) > 5) {
        points.push([n.x, n.y]);
      }
    }
  }
  const lastPt = points[points.length - 1];
  if (!lastPt || Math.hypot(lastPt[0] - toX, lastPt[1] - toY) > 5) {
    points.push([toX, toY]);
  }

  // Расчет суммарной дистанции в метрах
  const mpp = floor.metersPerPixel || 0.05;
  let totalDistanceMeters = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalDistanceMeters += euclideanDist(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]) * mpp;
  }
  totalDistanceMeters = Math.max(5, Math.round(totalDistanceMeters));
  const estimatedDurationSeconds = Math.max(10, Math.round(totalDistanceMeters / 1.15));

  // Поиск ближайших панорам вдоль пути
  const routePanoramas: string[] = [];
  for (const pano of floor.panoramas) {
    for (const [px, py] of points) {
      if (euclideanDist(pano.x, pano.y, px, py) < 120) {
        if (!routePanoramas.includes(pano.id)) {
          routePanoramas.push(pano.id);
        }
        break;
      }
    }
  }

  // Человекочитаемые инструкции
  const steps: string[] = [
    `Начните движение от «${startName}»`,
    `Пройдите по коридору ~${Math.round(totalDistanceMeters * 0.6)} м`,
  ];
  if (totalDistanceMeters > 20) {
    steps.push(`Продолжайте движение прямо мимо центрального стенда ТТК`);
  }
  steps.push(`Подойдите к цели «${endName}»`);

  return {
    totalDistanceMeters,
    estimatedDurationSeconds,
    legs: [
      {
        floorId: floor.id,
        floorLevel: floor.level,
        points
      }
    ],
    panoramas: routePanoramas.length > 0 ? routePanoramas : floor.panoramas.map(p => p.id),
    steps
  };
}
