import heapq
import math
from typing import Dict, List, Tuple, Optional, Any

def euclidean_dist(x1: float, y1: float, x2: float, y2: float) -> float:
    return math.hypot(x2 - x1, y2 - y1)

def find_nearest_node(target_x: float, target_y: float, nodes: List[Dict[str, Any]]) -> Optional[str]:
    """Находит ближайший узел графа к указанной координате"""
    if not nodes:
        return None
    nearest_id = None
    min_dist = float("inf")
    for n in nodes:
        d = euclidean_dist(target_x, target_y, n["x"], n["y"])
        if d < min_dist:
            min_dist = d
            nearest_id = n["id"]
    return nearest_id

def astar_search(
    nodes_dict: Dict[str, Dict[str, Any]], 
    adjacency: Dict[str, List[Tuple[str, float]]], 
    start_id: str, 
    goal_id: str
) -> Optional[List[str]]:
    """
    Классический алгоритм A* поиска кратчайшего пути на графе
    """
    if start_id not in nodes_dict or goal_id not in nodes_dict:
        return None
    if start_id == goal_id:
        return [start_id]

    goal_node = nodes_dict[goal_id]
    
    # Priority Queue: (estimated_total_cost, current_node)
    open_heap = [(0.0, start_id)]
    g_score = {start_id: 0.0}
    came_from: Dict[str, str] = {}
    visited = set()

    while open_heap:
        _, current = heapq.heappop(open_heap)

        if current == goal_id:
            # Восстанавливаем путь
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.append(current)
            return path[::-1]

        if current in visited:
            continue
        visited.add(current)

        for neighbor, weight in adjacency.get(current, []):
            tentative_g = g_score[current] + weight
            if tentative_g < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                h = euclidean_dist(
                    nodes_dict[neighbor]["x"], nodes_dict[neighbor]["y"],
                    goal_node["x"], goal_node["y"]
                )
                f_score = tentative_g + h
                heapq.heappush(open_heap, (f_score, neighbor))

    return None

def calculate_indoor_route(floor_data: Dict[str, Any], from_x: float, from_y: float, to_x: float, to_y: float) -> Dict[str, Any]:
    """
    Рассчитывает полный маршрут внутри этажа
    """
    graph = floor_data.get("graph", {})
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    meters_per_pixel = floor_data.get("metersPerPixel", 0.05)

    nodes_dict = {n["id"]: n for n in nodes}
    
    # Построение списков смежности
    adj: Dict[str, List[Tuple[str, float]]] = {n["id"]: [] for n in nodes}
    for e in edges:
        u, v = e["fromId"], e["toId"]
        length = e.get("lengthMeters", 1.0)
        if u in adj and v in adj:
            adj[u].append((v, length))
            if e.get("bidirectional", True):
                adj[v].append((u, length))

    start_node_id = find_nearest_node(from_x, from_y, nodes)
    goal_node_id = find_nearest_node(to_x, to_y, nodes)

    path_points: List[List[float]] = [[from_x, from_y]]
    total_dist = 0.0

    if start_node_id and goal_node_id:
        node_path = astar_search(nodes_dict, adj, start_node_id, goal_node_id)
        if node_path:
            for n_id in node_path:
                n = nodes_dict[n_id]
                path_points.append([float(n["x"]), float(n["y"])])
    
    path_points.append([to_x, to_y])

    # Считаем итоговую длину пути
    for i in range(len(path_points) - 1):
        p1, p2 = path_points[i], path_points[i+1]
        pixel_dist = euclidean_dist(p1[0], p1[1], p2[0], p2[1])
        total_dist += pixel_dist * meters_per_pixel

    # Скорость пешехода ~ 1.2 м/с
    duration_s = max(5, int(total_dist / 1.2))

    return {
        "totalDistanceMeters": round(total_dist, 1),
        "estimatedDurationSeconds": duration_s,
        "legs": [{
            "floorId": floor_data.get("id", "floor-1"),
            "floorLevel": floor_data.get("level", 1),
            "points": path_points
        }],
        "steps": [
            f"Начало движения ({round(total_dist, 1)} м)",
            "Следуйте по размеченному коридору",
            "Вы прибыли в точку назначения"
        ]
    }
