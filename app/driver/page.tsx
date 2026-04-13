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
  const [carType, setCarType] = useState('')
  const [carNumber, setCarNumber] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  const [assuranceExpiry, setAssuranceExpiry] = useState('')
  const [mecaniqueExpiry, setMecaniqueExpiry] = useState('')
  const [smoking, setSmoking] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [expiryAlerts, setExpiryAlerts] = useState<string[]>([])




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
  setCarType(profile.car_type || '')
  setCarNumber(profile.car_number || '')
  setLicenseExpiry(profile.license_expiry || '')
  setAssuranceExpiry(profile.assurance_expiry || '')
  setMecaniqueExpiry(profile.mecanique_expiry || '')
  setSmoking(profile.smoking || false)
  setRemarks(profile.remarks || '')

  // Check expiry dates
  checkExpiryAlerts(profile)
}

    if (profile) {
      setIsOnline(profile.is_online)
      setDriverName(profile.name)
    }
    fetchMyTrips(user.id)
  }

 const updateProfile = async () => {
  if (!userId) return
  await supabase
    .from('profiles')
    .update({
      car_type: carType,
      car_number: carNumber,
      license_expiry: licenseExpiry || null,
      assurance_expiry: assuranceExpiry || null,
      mecanique_expiry: mecaniqueExpiry || null,
      smoking,
      remarks
    })
    .eq('id', userId)
  alert('✅ Profile updated!')
}

const checkExpiryAlerts = (profile: any) => {
  const alerts: string[] = []
  const today = new Date()
  const twoMonths = new Date()
  twoMonths.setMonth(twoMonths.getMonth() + 2)

  const check = (date: string, label: string) => {
    if (!date) return
    const d = new Date(date)
    if (d <= twoMonths) {
      const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (days < 0) {
        alerts.push(`❌ ${label} EXPIRED!`)
      } else {
        alerts.push(`⚠️ ${label} expires in ${days} days`)
      }
    }
  }

  check(profile.license_expiry, 'License')
  check(profile.assurance_expiry, 'Assurance')
  check(profile.mecanique_expiry, 'Mecanique')
  setExpiryAlerts(alerts)
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
      {/* Expiry Alerts */}
{expiryAlerts.length > 0 && (
  <div className="bg-red-50 border border-red-300 p-4 rounded shadow mb-8">
    <h2 className="text-lg font-bold text-red-700 mb-2">🚨 Attention Required!</h2>
    {expiryAlerts.map((alert, i) => (
      <p key={i} className="text-red-600 font-bold">{alert}</p>
    ))}
  </div>
)}

{/* Driver Profile */}
{!isAdmin && (
  <div className="bg-white p-6 rounded shadow mb-8">
    <h2 className="text-xl font-bold mb-4">🚗 Car & Documents</h2>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
      <div>
        <label className="text-sm text-gray-500 mb-1 block">Car Type</label>
        <input
          className="w-full border p-2 rounded text-black"
          placeholder="ex: Toyota Corolla"
          value={carType}
          onChange={(e) => setCarType(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-gray-500 mb-1 block">Car Number</label>
        <input
          className="w-full border p-2 rounded text-black"
          placeholder="ex: 123456"
          value={carNumber}
          onChange={(e) => setCarNumber(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-gray-500 mb-1 block">🪪 License Expiry</label>
        <input
          type="date"
          className="w-full border p-2 rounded text-black"
          value={licenseExpiry}
          onChange={(e) => setLicenseExpiry(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-gray-500 mb-1 block">🛡️ Assurance Expiry</label>
        <input
          type="date"
          className="w-full border p-2 rounded text-black"
          value={assuranceExpiry}
          onChange={(e) => setAssuranceExpiry(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-gray-500 mb-1 block">🔧 Mecanique Expiry</label>
        <input
          type="date"
          className="w-full border p-2 rounded text-black"
          value={mecaniqueExpiry}
          onChange={(e) => setMecaniqueExpiry(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-gray-500 mb-1 block">Remarks</label>
        <input
          className="w-full border p-2 rounded text-black"
          placeholder="ex: No smoking, Pet friendly..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>
    </div>

    {/* Smoking */}
    <div className="flex items-center gap-3 mb-4">
      <label className="font-bold">🚬 Smoking allowed in car?</label>
      <button
        onClick={() => setSmoking(!smoking)}
        className={`px-4 py-1 rounded-full font-bold text-white ${
          smoking ? 'bg-red-500' : 'bg-green-500'
        }`}
      >
        {smoking ? 'Yes 🚬' : 'No 🚭'}
      </button>
    </div>

    <button
      onClick={updateProfile}
      className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 w-full"
    >
      💾 Save Profile
    </button>
  </div>
)}

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