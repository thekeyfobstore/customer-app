# OpenPhone PATCH Contact API

**Endpoint**: `PATCH https://api.openphone.com/v1/contacts/{id}`

**Headers**:
- Authorization: `<api-key>`
- Content-Type: `application/json`

**Body** (all fields optional):
```json
{
  "defaultFields": {
    "company": "string",
    "firstName": "string",
    "lastName": "string",
    "phoneNumbers": [{ "name": "string", "value": "+15555555555" }],
    "emails": [{ "name": "string", "value": "email@example.com" }],
    "role": "string"
  },
  "customFields": [
    { "value": ["string"], "key": "string" }
  ]
}
```

**Key**: The `id` in the path is the OpenPhone contact ID (e.g., `66d0d87e8dc1211467372303`).
Only send the fields you want to update — it's a PATCH, not PUT.
