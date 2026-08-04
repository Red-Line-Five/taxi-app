// Parses a location the office pastes in after a client shares it via
// WhatsApp. WhatsApp "Send location" shares a Google Maps link — this
// covers the common link shapes plus plain "lat,lng" text.
//
// Supported:
//   https://maps.google.com/?q=33.8938,35.5018
//   https://www.google.com/maps?q=33.8938,35.5018
//   https://www.google.com/maps/@33.8938,35.5018,17z
//   geo:33.8938,35.5018
//   33.8938, 35.5018   (plain text)
//
// NOT supported (no coordinates in the URL itself, can't resolve
// client-side): shortened links like https://maps.app.goo.gl/xxxx.
// If the office gets one of those, ask the client to long-press the
// pin in the WhatsApp message and choose "Copy" instead, or share
// location again as a plain address.
export function parseLocationInput(input: string): { lat: number; lng: number } | null {
  if (!input) return null
  const text = input.trim()

  let m = text.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }

  m = text.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }

  m = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }

  m = text.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }

  return null
}

export function googleMapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
