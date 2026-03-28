# OpenPhone Deep Link Schemes

From Reddit thread and official docs:

## Mobile (iOS/Android)
- `openphone://` - Opens the app (no params confirmed working on mobile)
- `tel:<number>` - If OpenPhone is set as default phone app, opens OpenPhone dialer
- `sms:<number>` - If OpenPhone is set as default, opens conversation

## Desktop/Web
- `openphone://dial?number=<number>` - Opens dialer with number prefilled
- `openphone://message?number=<number>` - Opens conversation with that number
- `tel:<number>` and `sms:<number>` work if OpenPhone is set as default handler

## Web App (app.openphone.com)
- `https://app.openphone.com/contacts/<contactId>` - Opens contact profile
- `https://app.openphone.com/inbox/<phoneNumberId>/<conversationId>` - Opens conversation

## Strategy for our app
Since the user has OpenPhone as their default phone app on iOS:
- Use `tel:<number>` to open OpenPhone dialer (simplest, works if OpenPhone is default)
- For messaging: `sms:<number>` should open OpenPhone conversation
- The user wants to MESSAGE (not call), so `sms:<number>` is the right choice
- BUT: the user said tapping opens their phone service, not OpenPhone
  - This means tel: is going to native Phone app, not OpenPhone
  - We should try `openphone://message?number=<number>` for direct OpenPhone
  - Fallback: `sms:<number>` which may route to OpenPhone if set as default SMS
