export type HoldType = 'hand' | 'foot' | 'start' | 'end' | 'unassigned';

export interface Board {
  id: string;
  name: string;
  image_url: string | null;
  user_id: string | null;
  image_width: number | null;
  image_height: number | null;
  created_at: string;
}

export interface Hold {
  id: string;
  board_id: string;
  x_center: number;
  y_center: number;
  width: number;
  height: number;
  confidence: number | null;
}

export type BoardWithHolds = Board & { holds: Hold[] };

export interface Route {
  id: string;
  board_id: string | null;
  user_id: string | null;
  name: string;
  grade: string | null;
  created_at: string | null;
}

export interface RouteHold {
  route_id: string;
  hold_id: string;
  type: HoldType | null;
}

export type RouteHoldInsert = RouteHold;

export interface CompleteRouteHold {
  route_id: string;
  hold_id: string;
  type: HoldType | null;
  hold: Hold;
}

export interface UserProfile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  default_board_id: string | null;
}

export type User = UserProfile;
