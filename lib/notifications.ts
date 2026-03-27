import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Appointment } from "./types";

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Request notification permissions */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("appointments", {
      name: "Appointment Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1E6BB8",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

/** Schedule a reminder notification for an appointment */
export async function scheduleAppointmentReminder(
  appointment: Appointment,
  customerName: string,
  minutesBefore: number = 30
): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  // Cancel any existing reminder for this appointment
  await cancelAppointmentReminder(appointment.id);

  const appointmentDate = new Date(`${appointment.date}T${appointment.time}`);
  const reminderDate = new Date(appointmentDate.getTime() - minutesBefore * 60 * 1000);

  // Don't schedule if the reminder time has already passed
  if (reminderDate <= new Date()) return null;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Upcoming Appointment",
      body: `${customerName} — ${appointment.service || "Appointment"} in ${minutesBefore} minutes`,
      data: { appointmentId: appointment.id, customerId: appointment.customerId },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
      channelId: Platform.OS === "android" ? "appointments" : undefined,
    } as any,
  });

  return identifier;
}

/** Cancel a scheduled reminder for an appointment */
export async function cancelAppointmentReminder(appointmentId: string): Promise<void> {
  if (Platform.OS === "web") return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.appointmentId === appointmentId) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/** Schedule reminders for all upcoming appointments */
export async function scheduleAllReminders(
  appointments: Appointment[],
  getCustomerName: (customerId: string) => string,
  minutesBefore: number = 30
): Promise<number> {
  if (Platform.OS === "web") return 0;

  const now = new Date();
  let count = 0;

  for (const apt of appointments) {
    if (apt.status !== "scheduled") continue;
    const aptDate = new Date(`${apt.date}T${apt.time}`);
    if (aptDate <= now) continue;

    const name = getCustomerName(apt.customerId);
    const id = await scheduleAppointmentReminder(apt, name, minutesBefore);
    if (id) count++;
  }

  return count;
}

/** Cancel all scheduled notifications */
export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
