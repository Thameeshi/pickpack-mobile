// ===== USER TYPES =====
export type UserRole = 'superadmin' | 'supervisor' | 'driver';
export type AccountStatus = 'pending' | 'approved' | 'suspended' | 'rejected';
export type Language = 'en' | 'si' | 'ta';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  displayName?: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  language: Language;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  // Driver-specific
  licenseNumber?: string;
  vehicleType?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  // Supervisor-specific
  department?: string;
  employeeId?: string;
}

export interface Driver {
  uid: string;
  email: string;
  name?: string;
  displayName: string;
  phoneNumber: string;
  role: 'driver';
  status: AccountStatus;
  location?: LocationData;
  vehicleType?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

// ===== TASK TYPES =====
export type TaskStatus = 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'arrived' | 'delivered' | 'failed';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id?: string;
  pickupLocation: string;
  deliveryLocation: string;
  recipientName: string;
  recipientPhone: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedDriverId?: string;
  assignedDriverName?: string;
  supervisorId: string;
  supervisorName?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  proofOfDeliveryUrl?: string;
  signatureUrl?: string;
  deliveryDocumentUrl?: string;
  deliveryOtp?: string;
  qrCode?: string;
  routeId?: string;
  tripId?: string;
  offlineSynced?: boolean;
  scannedAt?: number;
  odometerAtDelivery?: number;
  // Driver acceptance
  driverAccepted?: boolean;
  acceptedAt?: number;
  rejectedReason?: string;
  assignedAt?: number;         // When task was assigned to driver
  approvalDeadline?: number;   // 30-min deadline for driver to accept/reject
  // Timestamps
  arrivedAt?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  itemCount?: number;
  estimatedDeliveryTime?: string;
  // Delivery confirmation
  recipientConfirmedName?: string;
}

export interface TaskCreatePayload {
  pickupLocation: string;
  deliveryLocation: string;
  recipientName: string;
  recipientPhone: string;
  description?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  supervisorId: string;
  supervisorName?: string;
  priority: TaskPriority;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  itemCount?: number;
  estimatedDeliveryTime?: string;
}

// ===== TRIP SESSION TYPES =====
export type TripStatus = 'active' | 'completed' | 'cancelled';

export interface TripSession {
  id?: string;
  driverId: string;
  driverName: string;
  status: TripStatus;
  // Odometer
  startOdometer: number;
  endOdometer?: number;
  totalDistance?: number;
  // Timestamps
  startTime: number;
  endTime?: number;
  // Linked data
  taskIds: string[];
  fuelExpenseIds: string[];
  // Route breadcrumbs
  routeBreadcrumbs: LocationData[];
  // Summary
  totalFuelCost?: number;
  totalFuelLitres?: number;
  deliveriesCompleted?: number;
  deliveriesFailed?: number;
}

// ===== LOCATION TYPES =====
export interface LocationData {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp?: number;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export interface DirectionsRoute {
  points: Array<{ latitude: number; longitude: number }>;
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
}

// ===== FUEL & ODOMETER TYPES =====
export type FuelType = 'petrol' | 'diesel';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected';
export type OdometerType = 'start_of_day' | 'end_of_day' | 'fuel_stop' | 'delivery' | 'trip_start' | 'trip_end';

export interface FuelExpense {
  id?: string;
  driverId: string;
  driverName: string;
  tripId?: string;
  date: string;
  fuelType: FuelType;
  litres: number;
  costPerLitre: number;
  totalCost: number;
  odometerReading: number;
  stationName?: string;
  stationLocation?: LocationData;
  receiptUrl?: string;
  status: ExpenseStatus;
  approvedBy?: string;
  notes?: string;
  createdAt: number;
}

export interface OdometerReading {
  id?: string;
  driverId: string;
  driverName?: string;
  taskId?: string;
  tripId?: string;
  reading: number;
  photoUrl?: string;
  type: OdometerType;
  location?: LocationData;
  timestamp: number;
  verified: boolean;
}

// ===== CHAT TYPES =====
export interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  senderRole: 'supervisor' | 'driver';
  text: string;
  timestamp: number;
  readBy: string[];
  type: 'text' | 'image' | 'location';
  imageUrl?: string;
}

// ===== ROUTE TYPES =====
export type RouteStatus = 'planned' | 'in_progress' | 'completed';

export interface RouteStop {
  taskId: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
}

export interface Route {
  id?: string;
  driverUid: string;
  supervisorId: string;
  date: string;
  stops: RouteStop[];
  optimisedOrder: number[];
  totalDistanceKm: number;
  totalEtaMinutes: number;
  status: RouteStatus;
  createdAt: number;
}

// ===== REPORT TYPES =====
export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface DriverReport {
  id?: string;
  driverId: string;
  driverName: string;
  date: string;
  period: ReportPeriod;
  deliveriesCompleted: number;
  deliveriesFailed: number;
  avgCompletionMinutes: number;
  totalDistanceKm: number;
  fuelConsumedLitres: number;
  fuelCostTotal: number;
  onTimeRate: number;
  exceptions: Array<{ taskId: string; reason: string; timestamp: number }>;
  generatedAt: number;
}

// ===== NOTIFICATION TYPES =====
export type NotificationType =
  | 'task_assigned'
  | 'task_accepted'
  | 'task_rejected'
  | 'task_completed'
  | 'trip_started'
  | 'trip_completed'
  | 'fuel_submitted'
  | 'fuel_approved'
  | 'fuel_rejected'
  | 'chat_message'
  | 'approval'
  | 'general';

export interface AppNotification {
  id?: string;
  recipientId: string;
  senderId?: string;
  senderName?: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, string>;
  read: boolean;
  createdAt: number;
}

// ===== OFFLINE QUEUE =====
export interface OfflineQueueItem {
  id: string;
  collection: string;
  docId?: string;
  action: 'create' | 'update';
  data: Record<string, unknown>;
  createdAt: number;
  synced: boolean;
}

// ===== CONSTANTS =====
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  arrived: 'Arrived',
  delivered: 'Delivered',
  failed: 'Failed',
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  'pending', 'assigned', 'accepted', 'in_progress', 'arrived', 'delivered',
];

export const ROLES = {
  SUPERADMIN: 'superadmin' as UserRole,
  SUPERVISOR: 'supervisor' as UserRole,
  DRIVER: 'driver' as UserRole,
};
