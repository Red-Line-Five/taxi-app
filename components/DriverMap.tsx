'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export type MapDriver = {
  id: string
  name: string
  lat: number
  lng: number
  isAvailable: boolean
}

export type MapPin = {
  lat: number
  lng: number
  label: string
}

export default function DriverMap({
  drivers,
  pickup,
  height = 320
}: {
  drivers: MapDriver[]
  pickup?: MapPin | null
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const L = await import('leaflet')
      if (!mounted || !containerRef.current) return

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current).setView([33.8938, 35.5018], 12) // Beirut default
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(mapRef.current)
        layerRef.current = L.layerGroup().addTo(mapRef.current)
      }

      layerRef.current.clearLayers()
      const points: [number, number][] = []

      drivers.forEach((d) => {
        L.circleMarker([d.lat, d.lng], {
          radius: 9,
          color: d.isAvailable ? '#16a34a' : '#dc2626',
          fillColor: d.isAvailable ? '#22c55e' : '#ef4444',
          fillOpacity: 0.9,
          weight: 2
        })
          .bindPopup(`<b>${d.name}</b><br/>${d.isAvailable ? '🟢 Online' : '🔴 Offline'}`)
          .addTo(layerRef.current)
        points.push([d.lat, d.lng])
      })

      if (pickup) {
        L.marker([pickup.lat, pickup.lng])
          .bindPopup(`📍 ${pickup.label || 'Pickup'}`)
          .addTo(layerRef.current)
        points.push([pickup.lat, pickup.lng])
      }

      if (points.length > 0) {
        mapRef.current.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 })
      }
    })()

    return () => { mounted = false }
  }, [drivers, pickup])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} style={{ height, width: '100%', borderRadius: 8 }} />
}
