import React, { createContext, useContext, useEffect, useReducer, useCallback } from "react";
import { Customer, Appointment, Message } from "./types";
import {
  loadCustomers,
  saveCustomers,
  loadAppointments,
  saveAppointments,
  loadMessages,
  saveMessages,
} from "./storage";

interface DataState {
  customers: Customer[];
  appointments: Appointment[];
  messages: Message[];
  loading: boolean;
}

type DataAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_CUSTOMERS"; payload: Customer[] }
  | { type: "SET_APPOINTMENTS"; payload: Appointment[] }
  | { type: "SET_MESSAGES"; payload: Message[] }
  | { type: "ADD_CUSTOMER"; payload: Customer }
  | { type: "UPDATE_CUSTOMER"; payload: Customer }
  | { type: "DELETE_CUSTOMER"; payload: string }
  | { type: "ADD_APPOINTMENT"; payload: Appointment }
  | { type: "UPDATE_APPOINTMENT"; payload: Appointment }
  | { type: "DELETE_APPOINTMENT"; payload: string }
  | { type: "ADD_MESSAGES"; payload: Message[] }
  | { type: "IMPORT_CUSTOMERS"; payload: Customer[] };

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
    case "ADD_CUSTOMER":
      return { ...state, customers: [...state.customers, action.payload] };
    case "UPDATE_CUSTOMER":
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    case "DELETE_CUSTOMER":
      return {
        ...state,
        customers: state.customers.filter((c) => c.id !== action.payload),
        appointments: state.appointments.filter((a) => a.customerId !== action.payload),
        messages: state.messages.filter((m) => m.customerId !== action.payload),
      };
    case "ADD_APPOINTMENT":
      return { ...state, appointments: [...state.appointments, action.payload] };
    case "UPDATE_APPOINTMENT":
      return {
        ...state,
        appointments: state.appointments.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      };
    case "DELETE_APPOINTMENT":
      return {
        ...state,
        appointments: state.appointments.filter((a) => a.id !== action.payload),
      };
    case "ADD_MESSAGES":
      return { ...state, messages: [...state.messages, ...action.payload] };
    case "IMPORT_CUSTOMERS": {
      const existingPhones = new Set(state.customers.map((c) => c.phone));
      const newCustomers = action.payload.filter((c) => !existingPhones.has(c.phone));
      return { ...state, customers: [...state.customers, ...newCustomers] };
    }
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
  getCustomerById: (id: string) => Customer | undefined;
  getAppointmentsForCustomer: (customerId: string) => Appointment[];
  getMessagesForCustomer: (customerId: string) => Message[];
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(dataReducer, {
    customers: [],
    appointments: [],
    messages: [],
    loading: true,
  });

  const refreshData = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    const [customers, appointments, messages] = await Promise.all([
      loadCustomers(),
      loadAppointments(),
      loadMessages(),
    ]);
    dispatch({ type: "SET_CUSTOMERS", payload: customers });
    dispatch({ type: "SET_APPOINTMENTS", payload: appointments });
    dispatch({ type: "SET_MESSAGES", payload: messages });
    dispatch({ type: "SET_LOADING", payload: false });
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Persist on changes
  useEffect(() => {
    if (!state.loading) {
      saveCustomers(state.customers);
    }
  }, [state.customers, state.loading]);

  useEffect(() => {
    if (!state.loading) {
      saveAppointments(state.appointments);
    }
  }, [state.appointments, state.loading]);

  useEffect(() => {
    if (!state.loading) {
      saveMessages(state.messages);
    }
  }, [state.messages, state.loading]);

  const addCustomer = useCallback((customer: Customer) => {
    dispatch({ type: "ADD_CUSTOMER", payload: customer });
  }, []);

  const updateCustomer = useCallback((customer: Customer) => {
    dispatch({ type: "UPDATE_CUSTOMER", payload: customer });
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    dispatch({ type: "DELETE_CUSTOMER", payload: id });
  }, []);

  const importCustomers = useCallback((customers: Customer[]) => {
    dispatch({ type: "IMPORT_CUSTOMERS", payload: customers });
  }, []);

  const addAppointment = useCallback((appointment: Appointment) => {
    dispatch({ type: "ADD_APPOINTMENT", payload: appointment });
  }, []);

  const updateAppointment = useCallback((appointment: Appointment) => {
    dispatch({ type: "UPDATE_APPOINTMENT", payload: appointment });
  }, []);

  const deleteAppointment = useCallback((id: string) => {
    dispatch({ type: "DELETE_APPOINTMENT", payload: id });
  }, []);

  const addMessages = useCallback((messages: Message[]) => {
    dispatch({ type: "ADD_MESSAGES", payload: messages });
  }, []);

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

  return (
    <DataContext.Provider
      value={{
        ...state,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        importCustomers,
        addAppointment,
        updateAppointment,
        deleteAppointment,
        addMessages,
        getCustomerById,
        getAppointmentsForCustomer,
        getMessagesForCustomer,
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
