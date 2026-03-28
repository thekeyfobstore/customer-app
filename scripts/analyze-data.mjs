// Analyze contact data quality
import { readFileSync } from 'fs';

const data = readFileSync('/dev/stdin', 'utf8');
const parsed = JSON.parse(data);
const contacts = parsed.result?.data?.json || parsed.result?.data || [];

let noVehicleField = 0;
let noAddressField = 0;
let hasCompanyWithVehicle = 0;
let hasCompanyNoVehicleField = 0;
let nameFromCompanyOnly = 0;

for (const c of contacts) {
  const vehicle = (c.vehicleYearMakeModel || '').trim();
  const address = (c.address || '').trim();
  const company = (c.company || '').trim();
  const firstName = (c.firstName || '').trim();
  
  if (vehicle.length === 0) noVehicleField++;
  if (address.length === 0) noAddressField++;
  
  // Check if company has vehicle info but vehicleYearMakeModel is empty
  if (company.length > 0 && vehicle.length === 0) {
    const yearMatch = company.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      hasCompanyWithVehicle++;
    }
    hasCompanyNoVehicleField++;
  }
}

console.log('Total contacts:', contacts.length);
console.log('vehicleYearMakeModel empty:', noVehicleField);
console.log('address empty:', noAddressField);
console.log('Company has vehicle info but vehicleYearMakeModel empty:', hasCompanyWithVehicle);
console.log('Company non-empty but vehicleYearMakeModel empty:', hasCompanyNoVehicleField);

// Show 10 examples where company has vehicle info but field is empty
console.log('\n--- Examples: Company has vehicle info, vehicleYearMakeModel empty ---');
let count = 0;
for (const c of contacts) {
  if (count >= 10) break;
  const vehicle = (c.vehicleYearMakeModel || '').trim();
  const company = (c.company || '').trim();
  if (company.length > 0 && vehicle.length === 0) {
    const yearMatch = company.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      console.log(`Company: "${company}" | Vehicle field: "${vehicle}" | Phone: ${c.phone}`);
      count++;
    }
  }
}
