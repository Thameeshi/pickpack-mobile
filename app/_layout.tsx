import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DriverLocationTracker } from '../src/components/DriverLocationTracker';

export default function RootLayout() {
  return (
    <>
      <DriverLocationTracker />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        {/* Driver screens */}
        <Stack.Screen name="driver/dashboard" />
        <Stack.Screen name="driver/taskDetails" />
        <Stack.Screen name="driver/proofOfDelivery" />
        <Stack.Screen name="driver/map" />
        <Stack.Screen name="driver/odometer" />
        <Stack.Screen name="driver/fuelExpense" />
        <Stack.Screen name="driver/fuelHistory" />
        <Stack.Screen name="driver/chat" />
        <Stack.Screen name="driver/qrScanner" />
        <Stack.Screen name="driver/profile" />
        <Stack.Screen name="driver/tripStart" />
        <Stack.Screen name="driver/tripEnd" />
        <Stack.Screen name="driver/notifications" />
        {/* Supervisor screens */}
        <Stack.Screen name="supervisor/dashboard" />
        <Stack.Screen name="supervisor/assignTask" />
        <Stack.Screen name="supervisor/driverTracking" />
        <Stack.Screen name="supervisor/fuelApprovals" />
        <Stack.Screen name="supervisor/chatList" />
        <Stack.Screen name="supervisor/chat" />
        <Stack.Screen name="supervisor/profile" />
        <Stack.Screen name="supervisor/approvals" />
        <Stack.Screen name="supervisor/notifications" />
        <Stack.Screen name="supervisor/driverDetails" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
