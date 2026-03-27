# Customer CRM & Appointments — Design Document

## Overview

A mobile-first CRM app that lets users build a customer database from their OpenPhone messages and contacts, and track appointments booked with those customers. The app follows Apple Human Interface Guidelines for a native iOS feel, optimized for one-handed portrait usage.

---

## Screen List

| Screen | Tab | Description |
|--------|-----|-------------|
| Customers List | Customers | Scrollable list of all customers with search/filter |
| Customer Detail | Customers | Full profile, message history, and linked appointments |
| Add/Edit Customer | Customers | Form to manually add or edit a customer |
| OpenPhone Import | Customers | Flow to connect OpenPhone API key and import contacts/messages |
| Appointments List | Appointments | Calendar-style view of upcoming and past appointments |
| Appointment Detail | Appointments | View/edit a single appointment with linked customer |
| Add/Edit Appointment | Appointments | Form to create or modify an appointment |
| Settings | Settings | App configuration, OpenPhone API key management, data export |

---

## Tab Bar Structure

| Tab | Icon | Primary Screen |
|-----|------|----------------|
| Customers | person.2.fill | Customers List |
| Appointments | calendar | Appointments List |
| Settings | gearshape.fill | Settings |

---

## Primary Content and Functionality

### Customers Tab

**Customers List Screen**
- Search bar at top for filtering by name, phone, or company
- FlatList of customer cards showing: name, phone number, company, last contact date
- Floating action button (FAB) to add new customer or import from OpenPhone
- Pull-to-refresh gesture
- Empty state with prompt to import from OpenPhone

**Customer Detail Screen**
- Header with customer name, avatar placeholder (initials), phone, email
- Info section: company, notes, tags
- Message history section: recent OpenPhone messages (imported)
- Appointments section: linked upcoming/past appointments
- Edit button in top-right
- Quick actions: call, text, schedule appointment

**Add/Edit Customer Screen**
- Form fields: First Name, Last Name, Phone, Email, Company, Notes, Tags
- Save/Cancel buttons
- Validation on phone number format

**OpenPhone Import Screen**
- API key input field (stored securely)
- "Fetch Contacts" button to pull contacts from OpenPhone
- Preview list of importable contacts with checkboxes
- "Import Selected" button
- Progress indicator during import
- Also imports recent message snippets per contact

### Appointments Tab

**Appointments List Screen**
- Segmented control: Upcoming / Past
- Date section headers grouping appointments by day
- Each appointment card: customer name, date/time, duration, service type, status
- FAB to add new appointment
- Empty state encouraging first booking

**Appointment Detail Screen**
- Full appointment info: date, time, duration, service, status, notes
- Linked customer card (tappable to navigate to customer detail)
- Status badge (Scheduled, Completed, Cancelled, No-Show)
- Edit and Delete actions
- Mark as Complete / Cancel buttons

**Add/Edit Appointment Screen**
- Customer picker (search existing customers)
- Date picker (native)
- Time picker (native)
- Duration picker (15min, 30min, 45min, 1hr, 1.5hr, 2hr)
- Service type text field
- Status selector
- Notes field
- Save/Cancel buttons

### Settings Tab

**Settings Screen**
- OpenPhone API Key management (add/update/remove)
- Re-import contacts from OpenPhone
- Export data (customers, appointments) as JSON
- App version info
- Dark/light mode toggle (follows system by default)

---

## Key User Flows

### Flow 1: Import Customers from OpenPhone
1. User opens app → Customers tab (empty state)
2. Taps "Import from OpenPhone" button
3. Enters OpenPhone API key (if not already saved)
4. App fetches contacts from OpenPhone API
5. User sees preview list, selects contacts to import
6. Taps "Import Selected" → customers appear in list
7. Message history is also imported per contact

### Flow 2: Manually Add a Customer
1. User taps "+" FAB on Customers List
2. Selects "Add Manually"
3. Fills in customer form
4. Taps "Save" → returns to Customers List with new entry

### Flow 3: Book an Appointment
1. User navigates to Appointments tab
2. Taps "+" FAB
3. Searches and selects a customer
4. Picks date, time, duration, and service
5. Adds optional notes
6. Taps "Save" → appointment appears in list

### Flow 4: View Customer with Appointments
1. User taps a customer in Customers List
2. Sees customer profile with contact info
3. Scrolls to see message history from OpenPhone
4. Scrolls to see linked appointments
5. Taps an appointment to view details

### Flow 5: Manage Appointment Status
1. User taps an appointment in Appointments List
2. Views appointment details
3. Taps "Mark Complete" or "Cancel"
4. Status updates and reflects in the list

---

## Color Choices

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| primary | #2563EB | #3B82F6 | Blue — main accent, buttons, links |
| background | #FFFFFF | #0F172A | Screen backgrounds |
| surface | #F1F5F9 | #1E293B | Cards, elevated surfaces |
| foreground | #0F172A | #F1F5F9 | Primary text |
| muted | #64748B | #94A3B8 | Secondary text, placeholders |
| border | #E2E8F0 | #334155 | Dividers, card borders |
| success | #16A34A | #4ADE80 | Completed appointments |
| warning | #D97706 | #FBBF24 | Pending/upcoming states |
| error | #DC2626 | #F87171 | Cancelled, errors |

The blue primary color conveys trust and professionalism, appropriate for a CRM/business tool.

---

## Typography

- Headers: System font, bold, 28-34pt
- Section titles: System font, semibold, 20pt
- Body text: System font, regular, 16pt
- Caption/metadata: System font, regular, 13pt
- All text uses foreground/muted tokens for automatic dark mode

---

## Layout Principles

- All screens use `ScreenContainer` for safe area handling
- Cards use `surface` background with `border` and 12-16px border radius
- Consistent 16px horizontal padding on all screens
- Touch targets minimum 44pt as per HIG
- Bottom tab bar with 3 tabs
- FAB positioned bottom-right, 56px diameter, primary color
- Forms use grouped style with section headers
