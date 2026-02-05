# UROps MVP Acceptance Criteria

- [ ] **Database Connection**: Application starts without crashing and connects to the PostgreSQL database (check `.env`).
- [ ] **Client Creation**: Can create a new client with Name, Phone, and Email; client appears in the list.
- [ ] **Quote Generation**: Can create a new Quote for a client, adding at least one line item manually.
- [ ] **AI Assistance**: "Paste Scope" feature either generates items (with API Key) or returns a mock/empty result (without Key) without crashing.
- [ ] **Document Viewing**: Clicking a created Quote opens the detailed view with correct totals and client info.
- [ ] **Dashboard Stats**: Dashboard loads and displays non-zero counts for Clients and Invoices after creation.
