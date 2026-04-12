'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function DriverPage() {
  const [trips, setTrips] = useState<any[]>([])
  const [isOnline, setIsOnline] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [driverName, setDriverName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passMessage, setPassMessage] = useState('')

  const changePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setPassMessage('❌ Please fill both fields')
      return
    }
    if (newPassword !== confirmPassword) {
      setPassMessage('❌ Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPassMessage('❌ Password must be at least 6 characters')
      return
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })
    if (error) {
      setPassMessage('❌ Error: ' + error.message)
    } else {
      setPassMessage('✅ Password updated successfully!')
      setNewPassword('')
      setConfirmPassword('')
    }
  }
  useEffect(() => {
    // Check iza fi ?id= b URL (admin fata7 el page)
    const params = new URLSearchParams(window.location.search)
    const driverId = params.get('id')

    if (driverId) {
      // Admin mode — shuf driver by id
      setTargetId(driverId)
      setIsAdmin(true)
      fetchDriverById(driverId)
      fetchTripsByDriverId(driverId)
    } else {
      // Driver mode — shuf 7alo
      getDriverInfo()
    }

    const channel = supabase
      .channel('trips')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trips'
      }, () => {
        if (driverId) {
          fetchTripsByDriverId(driverId)
        } else {
          fetchMyTrips()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchDriverById = async (id: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()
    if (data) {
      setDriverName(data.name)
      setIsOnline(data.is_online)
      setUserId(data.id)
    }
  }

  const fetchTripsByDriverId = async (id: string) => {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('assigned_driver_id', id)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
    setTrips(data || [])
  }

  const getDriverInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profile) {
      setIsOnline(profile.is_online)
      setDriverName(profile.name)
    }
    fetchMyTrips(user.id)
  }

  const fetchMyTrips = async (id?: string) => {
    const uid = id || userId
    if (!uid) return
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('assigned_driver_id', uid)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
    setTrips(data || [])
  }

  const toggleOnline = async () => {
    if (!userId) return
    if (isOnline) {
      const activeTrip = trips.find(
        (t) => t.assigned_driver_id === userId && t.status === 'active'
      )
      if (activeTrip) {
        alert('⚠️ Complete your active trip first!')
        return
      }
    }
    const newStatus = !isOnline
    setIsOnline(newStatus)
    await supabase
      .from('profiles')
      .update({ is_online: newStatus })
      .eq('id', userId)
  }

  const acceptTrip = async (id: string) => {
    await supabase.from('trips').update({ status: 'active' }).eq('id', id)
    targetId ? fetchTripsByDriverId(targetId) : fetchMyTrips()
  }

  const completeTrip = async (id: string) => {
    await supabase.from('trips').update({ status: 'done' }).eq('id', id)
    targetId ? fetchTripsByDriverId(targetId) : fetchMyTrips()
  }

  const handleLogout = async () => {
    if (userId) {
      await supabase.from('profiles').update({ is_online: false }).eq('id', userId)
    }
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">🚗 {driverName || 'Driver'}</h1>
        {isAdmin ? (
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            ← Dashboard
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Logout
          </button>
        )}
      </div>

      {/* Online/Offline Toggle */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-4">Status</h2>
        <div className="flex items-center gap-4">
          <span className={`text-lg font-bold ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
          <button
            onClick={toggleOnline}
            className={`px-6 py-2 rounded-full font-bold text-white transition-all ${
              isOnline ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </div>
{/* Change Password */}
{!isAdmin && (
  <div className="bg-white p-6 rounded shadow mb-8">
    <h2 className="text-xl font-bold mb-4">🔑 Change Password</h2>
    <input
      type="password"
      className="w-full border p-2 rounded mb-3 text-black"
      placeholder="New Password"
      value={newPassword}
      onChange={(e) => setNewPassword(e.target.value)}
    />
    <input
      type="password"
      className="w-full border p-2 rounded mb-3 text-black"
      placeholder="Confirm Password"
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
    />
    <button
      className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
      onClick={changePassword}
    >
      Update Password
    </button>
    {passMessage && (
      <p className={`mt-3 text-sm ${passMessage.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>
        {passMessage}
      </p>
    )}
  </div>
)}
      {/* Trips */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">📋 Available Trips</h2>

        {!isOnline && !isAdmin && (
          <p className="text-gray-400 italic">You are offline — go online to see trips.</p>
        )}

        {trips.length === 0 && (isOnline || isAdmin) && (
          <p className="text-gray-500">No trips available.</p>
        )}

        {(isOnline || isAdmin) && trips.map((trip: any) => (
          <div key={trip.id} className="border-b py-4">
            <p className="font-bold text-lg text-black">{trip.customer_name}</p>
            <p className="text-sm text-gray-600 mb-1">📍 Pickup: {trip.pickup_location}</p>
            <p className="text-sm text-gray-600 mb-3">🏁 Dropoff: {trip.dropoff_location}</p>
            <div className="flex gap-4 mb-2">
              {trip.price_usd > 0 && <p className="text-sm text-green-600">💵 ${trip.price_usd}</p>}
              {trip.price_lbp > 0 && <p className="text-sm text-blue-600">🇱🇧 {trip.price_lbp.toLocaleString()} LBP</p>}
            </div>
            <span className={`text-xs px-2 py-1 rounded mr-3 ${
              trip.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {trip.status}
            </span>
            <div className="flex gap-3 mt-3">
              {trip.status === 'pending' && (
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  onClick={() => acceptTrip(trip.id)}
                >
                  ✅ Accept
                </button>
              )}
              {trip.status === 'active' && (
                <button
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                  onClick={() => completeTrip(trip.id)}
                >
                  🏁 Complete
                </button>
              )}
            </div>
          </div>

          
        ))}
      </div>
    </div>
    
  )
}