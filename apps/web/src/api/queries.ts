import { api } from '@/lib/api';
import type {
  Board,
  BoardWithHolds,
  CompleteRouteHold,
  HoldType,
  Route,
  RouteHold,
  RouteHoldInsert,
  UserProfile,
} from '@/lib/db_types';

export async function getUserBoards(): Promise<Board[]> {
  return api.get<Board[]>('/api/boards');
}

export async function getBoardById(id: string): Promise<Board> {
  return api.get<Board>(`/api/boards/${id}`);
}

export async function getBoardWithHolds(boardId: string | null): Promise<BoardWithHolds | null> {
  if (!boardId) return null;
  return api.get<BoardWithHolds>(`/api/boards/${boardId}`);
}

export async function getUserProfile(): Promise<UserProfile | null> {
  // The API creates the profile row on first call (replaces the old trigger).
  return api.get<UserProfile>('/api/user');
}

export async function uploadBoardAndDetect(name: string, image: File): Promise<BoardWithHolds> {
  const form = new FormData();
  form.append('name', name);
  form.append('image', image);
  return api.postForm<BoardWithHolds>('/api/boards', form);
}

export async function getUserRoutes(): Promise<Route[]> {
  return api.get<Route[]>('/api/routes');
}

export async function getRouteDetailsById(routeId: string | undefined): Promise<Route | null> {
  if (!routeId) return null;
  return api.get<Route>(`/api/routes/${routeId}`);
}

export async function getRouteHoldsById(id: string | undefined): Promise<RouteHold[]> {
  if (!id) return [];
  return api.get<RouteHold[]>(`/api/routes/${id}/holds`);
}

export async function getCompleteRoute(id: string | undefined): Promise<CompleteRouteHold[]> {
  if (!id) return [];
  return api.get<CompleteRouteHold[]>(`/api/routes/${id}/complete`);
}

export async function saveRoute(
  boardId: string,
  routeName: string,
  routeGrade: string,
): Promise<Route> {
  return api.post<Route>('/api/routes', {
    board_id: boardId,
    name: routeName,
    grade: routeGrade,
  });
}

export async function updateRoute(
  routeId: string,
  routeName: string,
  routeGrade: string,
): Promise<Route> {
  return api.put<Route>(`/api/routes/${routeId}`, {
    name: routeName,
    grade: routeGrade,
  });
}

export async function deleteRoute(routeId: string): Promise<void> {
  await api.delete(`/api/routes/${routeId}`);
}

export async function deleteRouteHolds(routeId: string): Promise<void> {
  await api.delete(`/api/routes/${routeId}/holds`);
}

export async function addRouteHolds(payload: RouteHoldInsert[]): Promise<void> {
  if (payload.length === 0) return;
  const routeId = payload[0].route_id;
  await api.post(`/api/routes/${routeId}/holds`, {
    holds: payload.map((h) => ({ hold_id: h.hold_id, type: h.type as HoldType })),
  });
}

export async function updateUserDefaultBoard(boardId: string | null): Promise<void> {
  await api.patch('/api/user', { default_board_id: boardId });
}
