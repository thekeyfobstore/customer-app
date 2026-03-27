import React, { createContext, useContext, useEffect, useReducer, useCallback } from "react";
import { Customer, Appointment, Message, ServiceRecord, CloverOrder, FollowUp, DropInLocation, DayRoute } from "./types";
import {
  loadCustomers, saveCustomers,
  loadAppointments, saveAppointments,
  loadMessages, saveMessages,
  loadServiceRecords, saveServiceRecords,
  loadCloverOrders, saveCloverOrders,
  loadFollowUps, saveFollowUps,
  loadDropInLocations, saveDropInLocations,
  loadDayRoutes, saveDayRoutes,
} from "./storage";
import { migrateKeysToSecureStore } from "./secure-storage";

interface DataState {
  customers: Customer[];
  appointments: Appointment[];
  messages: Message[];
  serviceRecords: ServiceRecord[];
  cloverOrders: CloverOrder[];
  followUps: FollowUp[];
  dropInLocations: DropInLocation[];
  dayRoutes: DayRoute[];
  loading: boolean;
}

type DataAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_CUSTOMERS"; payload: Customer[] }
  | { type: "SET_APPOINTMENTS"; payload: Appointment[] }
  | { type: "SET_MESSAGES"; payload: Message[] }
  | { type: "SET_SERVICE_RECORDS"; payload: ServiceRecord[] }
  | { type: "SET_CLOVER_ORDERS"; payload: CloverOrder[] }
  | { type: "SET_FOLLOW_UPS"; payload: FollowUp[] }
  | { type: "SET_DROP_IN_LOCATIONS"; payload: DropInLocation[] }
  | { type: "SET_DAY_ROUTES"; payload: DayRoute[] }
  | { type: "ADD_CUSTOMER"; payload: Customer }
  | { type: "UPDATE_CUSTOMER"; payload: Customer }
  | { type: "DELETE_CUSTOMER"; payload: string }
  | { type: "ADD_APPOINTMENT"; payload: Appointment }
  | { type: "UPDATE_APPOINTMENT"; payload: Appointment }
  | { type: "DELETE_APPOINTMENT"; payload: string }
  | { type: "ADD_MESSAGES"; payload: Message[] }
  | { type: "IMPORT_CUSTOMERS"; payload: Customer[] }
  | { type: "ADD_SERVICE_RECORD"; payload: ServiceRecord }
  | { type: "ADD_CLOVER_ORDER"; payload: CloverOrder }
  | { type: "UPDATE_CLOVER_ORDER"; payload: CloverOrder }
  | { type: "ADD_FOLLOW_UP"; payload: FollowUp }
  | { type: "UPDATE_FOLLOW_UP"; payload: FollowUp }
  | { type: "DELETE_FOLLOW_UP"; payload: string }
  | { type: "ADD_DROP_IN_LOCATION"; payload: DropInLocation }
  | { type: "UPDATE_DROP_IN_LOCATION"; payload: DropInLocation }
  | { type: "DELETE_DROP_IN_LOCATION"; payload: string }
  | { type: "ADD_DAY_ROUTE"; payload: DayRoute }
  | { type: "UPDATE_DAY_ROUTE"; payload: DayRoute }
  | { type: "DELETE_DAY_ROUTE"; payload: string };

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_CUSTOMERS":
      return { ...state, customers: action.payload };
    case "SET_APPOINTMENTS":
      return { ...state, appointments: action.payload };
    case "SET_MESSAGES":
      return { ...state, messages: action.payload };
    case "SET_SERVICE_RECORDS":
      return { ...state, serviceRecords: action.payload };
    case "SET_CLOVER_ORDERS":
      return { ...state, cloverOrders: action.payload };
    case "SET_FOLLOW_UPS":
      return { ...state, followUps: action.payload };
    case "SET_DROP_IN_LOCATIONS":
      return { ...state, dropInLocations: action.payload };
    case "SET_DAY_ROUTES":
      return { ...state, dayRoutes: action.payload };
    case "ADD_CUSTOMER":
      return { ...state, customers: [...state.customers, action.payload] };
    case "UPDATE_CUSTOMER":
      return { ...state, customers: state.customers.map((c) => c.id === action.payload.id ? action.payload : c) };
    case "DELETE_CUSTOMER":
      return {
        ...state,
        customers: state.customers.filter((c) => c.id !== action.payload),
        appointments: state.appointments.filter((a) => a.customerId !== action.payload),
        messages: state.messages.filter((m) => m.customerId !== action.payload),
        serviceRecords: state.serviceRecords.filter((s) => s.customerId !== action.payload),
        cloverOrders: state.cloverOrders.filter((o) => o.customerId !== action.payload),
        followUps: state.followUps.filter((f) => f.customerId !== action.payload),
      };
    case "ADD_APPOINTMENT":
      return { ...state, appointments: [...state.appointments, action.payload] };
    case "UPDATE_APPOINTMENT":
      return { ...state, appointments: state.appointments.map((a) => a.id === action.payload.id ? action.payload : a) };
    case "DELETE_APPOINTMENT":
      return { ...state, appointments: state.appointments.filter((a) => a.id !== action.payload) };
    case "ADD_MESSAGES":
      return { ...state, messages: [...state.messages, ...action.payload] };
    case "IMPORT_CUSTOMERS": {
      const existingPhones = new Set(state.customers.map((c) => c.phone));
      const newCustomers = action.payload.filter((c) => !existingPhones.has(c.phone));
      return { ...state, customers: [...state.customers, ...newCustomers] };
    }
    case "ADD_SERVICE_RECORD":
      return { ...state, serviceRecords: [...state.serviceRecords, action.payload] };
    case "ADD_CLOVER_ORDER":
      return { ...state, cloverOrders: [...state.cloverOrders, action.payload] };
    case "UPDATE_CLOVER_ORDER":
      return { ...state, cloverOrders: state.cloverOrders.map((o) => o.id === action.payload.id ? action.payload : o) };
    case "ADD_FOLLOW_UP":
      return { ...state, followUps: [...state.followUps, action.payload] };
    case "UPDATE_FOLLOW_UP":
      return { ...state, followUps: state.followUps.map((f) => f.id === action.payload.id ? action.payload : f) };
    case "DELETE_FOLLOW_UP":
      return { ...state, followUps: state.followUps.filter((f) => f.id !== action.payload) };
    case "ADD_DROP_IN_LOCATION":
      return { ...state, dropInLocations: [...state.dropInLocations, action.payload] };
    case "UPDATE_DROP_IN_LOCATION":
      return { ...state, dropInLocations: state.dropInLocations.map((d) => d.id === action.payload.id ? action.payload : d) };
    case "DELETE_DROP_IN_LOCATION":
      return { ...state, dropInLocations: state.dropInLocations.filter((d) => d.id !== action.payload) };
    case "ADD_DAY_ROUTE":
      return { ...state, dayRoutes: [...state.dayRoutes, action.payload] };
    case "UPDATE_DAY_ROUTE":
      return { ...state, dayRoutes: state.dayRoutes.map((r) => r.id === action.payload.id ? action.payload : r) };
    case "DELETE_DAY_ROUTE":
      return { ...state, dayRoutes: state.dayRoutes.filter((r) => r.id !== action.payload) };
    default:
      return state;
  }
}

interface DataContextValue extends DataState {
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  importCustomers: (customers: Customer[]) => void;
  addAppointment: (appointment: Appointment) => void;
  updateAppointment: (appointment: Appointment) => void;
  deleteAppointment: (id: string) => void;
  addMessages: (messages: Message[]) => void;
  addServiceRecord: (record: ServiceRecord) => void;
  addCloverOrder: (order: CloverOrder) => void;
  updateCloverOrder: (order: CloverOrder) => void;
  addFollowUp: (followUp: FollowUp) => void;
  updateFollowUp: (followUp: FollowUp) => void;
  deleteFollowUp: (id: string) => void;
  addDropInLocation: (location: DropInLocation) => void;
  updateDropInLocation: (location: DropInLocation) => void;
  deleteDropInLocation: (id: string) => void;
  addDayRoute: (route: DayRoute) => void;
  updateDayRoute: (route: DayRoute) => void;
  deleteDayRoute: (id: string) => void;
  getCustomerById: (id: string) => Customer | undefined;
  getAppointmentsForCustomer: (customerId: string) => Appointment[];
  getMessagesForCustomer: (customerId: string) => Message[];
  getServiceRecordsForVehicle: (vehicleId: string) => ServiceRecord[];
  getServiceRecordsForCustomer: (customerId: string) => ServiceRecord[];
  getCloverOrdersForCustomer: (customerId: string) => CloverOrder[];
  getFollowUpsForCustomer: (customerId: string) => FollowUp[];
  getFollowUpsByArea: () => Record<string, FollowUp[]>;
  getAppointmentsForDate: (date: string) => Appointment[];
  getRouteForDate: (date: string) => DayRoute | undefined;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(dataReducer, {
    customers: [],
    appointments: [],
    messages: [],
    serviceRecords: [],
    cloverOrders: [],
    followUps: [],
    dropInLocations: [],
    dayRoutes: [],
    loading: true,
  });

  const refreshData = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    await migrateKeysToSecureStore();
    const [customers, appointments, messages, serviceRecords, cloverOrders, followUps, dropInLocations, dayRoutes] = await Promise.all([
      loadCustomers(),
      loadAppointments(),
      loadMessages(),
      loadServiceRecords(),
      loadCloverOrders(),
      loadFollowUps(),
      loadDropInLocations(),
      loadDayRoutes(),
    ]);
    dispatch({ type: "SET_CUSTOMERS", payload: customers });
    dispatch({ type: "SET_APPOINTMENTS", payload: appointments });
    dispatch({ type: "SET_MESSAGES", payload: messages });
    dispatch({ type: "SET_SERVICE_RECORDS", payload: serviceRecords });
    dispatch({ type: "SET_CLOVER_ORDERS", payload: cloverOrders });
    dispatch({ type: "SET_FOLLOW_UPS", payload: followUps });
    dispatch({ type: "SET_DROP_IN_LOCATIONS", payload: dropInLocations });
    dispatch({ type: "SET_DAY_ROUTES", payload: dayRoutes });
    dispatch({ type: "SET_LOADING", payload: false });
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Persist on changes
  useEffect(() => { if (!state.loading) saveCustomers(state.customers); }, [state.customers, state.loading]);
  useEffect(() => { if (!state.loading) saveAppointments(state.appointments); }, [state.appointments, state.loading]);
  useEffect(() => { if (!state.loading) saveMessages(state.messages); }, [state.messages, state.loading]);
  useEffect(() => { if (!state.loading) saveServiceRecords(state.serviceRecords); }, [state.serviceRecords, state.loading]);
  useEffect(() => { if (!state.loading) saveCloverOrders(state.cloverOrders); }, [state.cloverOrders, state.loading]);
  useEffect(() => { if (!state.loading) saveFollowUps(state.followUps); }, [state.followUps, state.loading]);
  useEffect(() => { if (!state.loading) saveDropInLocations(state.dropInLocations); }, [state.dropInLocations, state.loading]);
  useEffect(() => { if (!state.loading) saveDayRoutes(state.dayRoutes); }, [state.dayRoutes, state.loading]);

  const addCustomer = useCallback((c: Customer) => dispatch({ type: "ADD_CUSTOMER", payload: c }), []);
  const updateCustomer = useCallback((c: Customer) => dispatch({ type: "UPDATE_CUSTOMER", payload: c }), []);
  const deleteCustomer = useCallback((id: string) => dispatch({ type: "DELETE_CUSTOMER", payload: id }), []);
  const importCustomers = useCallback((cs: Customer[]) => dispatch({ type: "IMPORT_CUSTOMERS", payload: cs }), []);
  const addAppointment = useCallback((a: Appointment) => dispatch({ type: "ADD_APPOINTMENT", payload: a }), []);
  const updateAppointment = useCallback((a: Appointment) => dispatch({ type: "UPDATE_APPOINTMENT", payload: a }), []);
  const deleteAppointment = useCallback((id: string) => dispatch({ type: "DELETE_APPOINTMENT", payload: id }), []);
  const addMessages = useCallback((ms: Message[]) => dispatch({ type: "ADD_MESSAGES", payload: ms }), []);
  const addServiceRecord = useCallback((r: ServiceRecord) => dispatch({ type: "ADD_SERVICE_RECORD", payload: r }), []);
  const addCloverOrder = useCallback((o: CloverOrder) => dispatch({ type: "ADD_CLOVER_ORDER", payload: o }), []);
  const updateCloverOrder = useCallback((o: CloverOrder) => dispatch({ type: "UPDATE_CLOVER_ORDER", payload: o }), []);
  const addFollowUp = useCallback((f: FollowUp) => dispatch({ type: "ADD_FOLLOW_UP", payload: f }), []);
  const updateFollowUp = useCallback((f: FollowUp) => dispatch({ type: "UPDATE_FOLLOW_UP", payload: f }), []);
  const deleteFollowUp = useCallback((id: string) => dispatch({ type: "DELETE_FOLLOW_UP", payload: id }), []);
  const addDropInLocation = useCallback((l: DropInLocation) => dispatch({ type: "ADD_DROP_IN_LOCATION", payload: l }), []);
  const updateDropInLocation = useCallback((l: DropInLocation) => dispatch({ type: "UPDATE_DROP_IN_LOCATION", payload: l }), []);
  const deleteDropInLocation = useCallback((id: string) => dispatch({ type: "DELETE_DROP_IN_LOCATION", payload: id }), []);
  const addDayRoute = useCallback((r: DayRoute) => dispatch({ type: "ADD_DAY_ROUTE", payload: r }), []);
  const updateDayRoute = useCallback((r: DayRoute) => dispatch({ type: "UPDATE_DAY_ROUTE", payload: r }), []);
  const deleteDayRoute = useCallback((id: string) => dispatch({ type: "DELETE_DAY_ROUTE", payload: id }), []);

  const getCustomerById = useCallback(
    (id: string) => state.customers.find((c) => c.id === id),
    [state.customers]
  );

  const getAppointmentsForCustomer = useCallback(
    (customerId: string) =>
      state.appointments
        .filter((a) => a.customerId === customerId)
        .sort((a, b) => new Date(b.date + "T" + b.time).getTime() - new Date(a.date + "T" + a.time).getTime()),
    [state.appointments]
  );

  const getMessagesForCustomer = useCallback(
    (customerId: string) =>
      state.messages
        .filter((m) => m.customerId === customerId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [state.messages]
  );

  const getServiceRecordsForVehicle = useCallback(
    (vehicleId: string) =>
      state.serviceRecords
        .filter((s) => s.vehicleId === vehicleId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [state.serviceRecords]
  );

  const getServiceRecordsForCustomer = useCallback(
    (customerId: string) =>
      state.serviceRecords
        .filter((s) => s.customerId === customerId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [state.serviceRecords]
  );

  const getCloverOrdersForCustomer = useCallback(
    (customerId: string) =>
      state.cloverOrders
        .filter((o) => o.customerId === customerId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [state.cloverOrders]
  );

  const getFollowUpsForCustomer = useCallback(
    (customerId: string) =>
      state.followUps.filter((f) => f.customerId === customerId),
    [state.followUps]
  );

  const getFollowUpsByArea = useCallback(() => {
    const grouped: Record<string, FollowUp[]> = {};
    for (const f of state.followUps.filter((f) => f.status === "pending" || f.status === "contacted")) {
      if (!grouped[f.area]) grouped[f.area] = [];
      grouped[f.area].push(f);
    }
    return grouped;
  }, [state.followUps]);

  const getAppointmentsForDate = useCallback(
    (date: string) =>
      state.appointments
        .filter((a) => a.date === date)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [state.appointments]
  );

  const getRouteForDate = useCallback(
    (date: string) => state.dayRoutes.find((r) => r.date === date),
    [state.dayRoutes]
  );

  return (
    <DataContext.Provider
      value={{
        ...state,
        addCustomer, updateCustomer, deleteCustomer, importCustomers,
        addAppointment, updateAppointment, deleteAppointment,
        addMessages,
        addServiceRecord,
        addCloverOrder, updateCloverOrder,
        addFollowUp, updateFollowUp, deleteFollowUp,
        addDropInLocation, updateDropInLocation, deleteDropInLocation,
        addDayRoute, updateDayRoute, deleteDayRoute,
        getCustomerById,
        getAppointmentsForCustomer, getMessagesForCustomer,
        getServiceRecordsForVehicle, getServiceRecordsForCustomer,
        getCloverOrdersForCustomer,
        getFollowUpsForCustomer, getFollowUpsByArea,
        getAppointmentsForDate, getRouteForDate,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
