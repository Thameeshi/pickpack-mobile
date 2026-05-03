// ===== USER TYPES =====
export type UserRole = 'superadmin' | 'supervisor' | 'driver';
export type AccountStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  displayName?: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  language: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  licenseNumber?: string;
  vehicleType?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
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
  driverAccepted?: boolean;
  acceptedAt?: number;
  rejectedReason?: string;
  arrivedAt?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  itemCount?: number;
  estimatedDeliveryTime?: string;
  recipientConfirmedName?: string;
}

// ===== TRIP SESSION TYPES =====
export type TripStatus = 'active' | 'completed' | 'cancelled';

export interface TripSession {
  id?: string;
  driverId: string;
  driverName: string;
  status: TripStatus;
  startOdometer: number;
  endOdometer?: number;
  totalDistance?: number;
  startTime: number;
  endTime?: number;
  taskIds: string[];
  fuelExpenseIds: string[];
  routeBreadcrumbs: LocationData[];
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

// ===== FUEL & ODOMETER TYPES =====
export type FuelType = 'petrol' | 'diesel';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

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
