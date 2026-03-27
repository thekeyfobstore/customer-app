# Clover API Research Notes

## Authentication
- Bearer token: `Authorization: Bearer {api_token}`
- Required: merchantId (mId) and API token
- Production base URL: `https://api.clover.com`
- Sandbox base URL: `https://apisandbox.dev.clover.com`

## Create Order (Atomic)
- POST `/v3/merchants/{mId}/atomic_order/orders`
- Supports ad-hoc line items (non-inventory items with custom prices)
- Single API call creates complete order with line items
- Max 2500 line items per order

## Create Custom Order
- POST `/v3/merchants/{mId}/orders`
- Valid fields: taxRemoved, note, title, state, testMode, manualTransaction, groupLineItems, orderType
- Need separate calls to add line items

## Add Line Item to Order
- POST `/v3/merchants/{mId}/orders/{orderId}/line_items`
- Can add custom line items with name and price

## Get Payments
- GET `/v3/merchants/{mId}/payments`
- Filter by modifiedTime, createdTime
- Response includes: id, order.id, amount, tip, tax, result, createdTime
- 90-day limit on search results
- Amounts in cents

## Get Order Payments
- GET `/v3/merchants/{mId}/orders/{orderId}/payments`
- Gets payments for a specific order

## Get Orders
- GET `/v3/merchants/{mId}/orders`
- Can expand with line items
- Filter by various fields

## Key Notes
- All amounts in cents (e.g., $2.12 = 212)
- Timestamps in milliseconds from epoch
- JSON request/response
- HTTPS only
