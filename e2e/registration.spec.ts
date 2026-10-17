import { expect, test, type RegistrationForm } from '@camphoric/camphoric-event-import-tools/e2e';

import event from '../index.ts';

// The registration form, as a registrant fills it in. Every test shares the one
// imported event (see README.md), so a completed registration stays.
//
// Rates are early or regular depending on the day (pricing.ts), so these
// tests compare totals rather than expect fixed amounts.

// The nights a camper can attend, as the form labels them (they move with
// camp's dates each year)
const nights = (event.data.event.camper_schema as {
  properties: { attendance: { items: { enum: string[] } } },
}).properties.attendance.items.enum;

// Opens the form with one camper in this lodging for the first few nights
async function camperIn(registration: RegistrationForm, lodging: string, nightCount: number) {
  await registration.open();
  const camper = registration.camper(1);
  await camper.chooseLodging(lodging);
  for (const night of nights.slice(0, nightCount)) await camper.check(night);
  return camper;
}

// The total once the price ticker shows one
async function settledTotal(registration: RegistrationForm) {
  await expect.poll(() => registration.total()).toBeGreaterThan(0);
  return registration.total();
}

test('the form opens under the event\'s name', async ({ page, registration }) => {
  await registration.open();
  await expect(page.getByRole('heading', { name: `${event.data.event.name} Registration` })).toBeVisible();
});

test('lodging offers the kinds of lodging', async ({ registration }) => {
  await registration.open();
  const [choices] = await registration.camper(1).chooseLodging('Tent Camping');
  expect(choices).toEqual(['Cabin', 'Lodge', 'RV Camping', 'Tent Camping', 'Village 7']);
});

test('lodging is charged per night', async ({ registration }) => {
  const camper = await camperIn(registration, 'Tent Camping', 1);
  const oneNight = await settledTotal(registration);
  await camper.check(nights[1]);
  await registration.expectTotal(2 * oneNight);
});

test('a child pays less than an adult', async ({ registration }) => {
  const camper = await camperIn(registration, 'Cabin', 1);
  const adult = await settledTotal(registration);
  await camper.select('Age (at the beginning of camp)', '3-12 years old');
  await expect.poll(() => registration.total()).toBeLessThan(adult);
  expect(await registration.total()).toBeGreaterThan(0);
});

test('linens add $25', async ({ registration }) => {
  const camper = await camperIn(registration, 'Tent Camping', 1);
  const base = await settledTotal(registration);
  await camper.select('Linens rental', 'Yes, I would like to rent linens');
  await registration.expectTotal(base + 25);
});

// (Checking another night after asking shows whether the linens were charged)
test('linens are included in the Lodge', async ({ registration }) => {
  const camper = await camperIn(registration, 'Lodge', 1);
  const oneNight = await settledTotal(registration);
  await camper.select('Linens rental', 'Yes, I would like to rent linens');
  await camper.check(nights[1]);
  await registration.expectTotal(2 * oneNight);
});

test('a single room in Village 7 adds $30 a night', async ({ registration }) => {
  const camper = await camperIn(registration, 'Village 7', 2);
  const base = await settledTotal(registration);
  await camper.select('Single lodging', 'Yes, I would like a private single room');
  await registration.expectTotal(base + 2 * 30);
});

test('a single room is ignored outside Village 7', async ({ registration }) => {
  const camper = await camperIn(registration, 'Tent Camping', 1);
  const oneNight = await settledTotal(registration);
  await camper.select('Single lodging', 'Yes, I would like a private single room');
  await camper.check(nights[1]);
  await registration.expectTotal(2 * oneNight);
});

test('a campership request takes up to $65 a night off', async ({ registration }) => {
  const camper = await camperIn(registration, 'Tent Camping', 2);
  const base = await settledTotal(registration);
  await camper.fill('Campership request', '1000');
  await registration.expectTotal(base - 2 * 65);
});

test('a campership donation is added to the total', async ({ registration }) => {
  await camperIn(registration, 'Tent Camping', 1);
  const base = await settledTotal(registration);
  await registration.fill('Campership Donation', '40');
  await registration.expectTotal(base + 40);
});

test('a registration missing required answers isn\'t submitted', async ({ page, registration }) => {
  await registration.open();
  await registration.submit();
  await expect(registration.camper(1).field('First name')).toHaveJSProperty('validity.valueMissing', true);
  await expect(page).toHaveURL(/\/register\/registration$/);
});

test('a registration goes through, paying by check', async ({ page, registration }) => {
  await registration.open();
  await registration.fill('Registrant email', 'pat@example.com');
  await registration.fill('Address', '1 Example Way');
  await registration.fill('City', 'Exampleton');
  await registration.fill('State or Province', 'CA');
  await registration.fill('ZIP code or Postal Code', '94000');
  const camper = registration.camper(1);
  await camper.fill('First name', 'Pat');
  await camper.fill('Last name', 'Example');
  await camper.fill('Camper Email', 'pat@example.com');
  await camper.fill('Phone Number', '+1 555 123 5678');
  await camper.select('Do you expect you will be driving, or arriving as a passenger in someone\'s car?', 'Passenger');
  await camper.chooseLodging('Tent Camping');
  await camper.check(nights[0]);
  await registration.select('SFFMC Membership', 'Yes, I am a current member');
  await settledTotal(registration);

  await registration.submit();
  await registration.expectPaymentStep();
  await registration.payByCheck();
  await expect(page).toHaveURL(/\/register\/finished$/);
});

// Next, the behaviour particular to this camp:
test.fixme('a camper with a different address gives it', () => {});
test.fixme('a driver gives a license plate and mobile number', () => {});
test.fixme('the full camp and early-registration rates', () => {});
