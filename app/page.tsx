'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getMyContext } from '../lib/context'

type Mode = 'login' | 'signup-office' | 'signup-driver' | 'complete-profile'

export default function Home() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [officeName, setOfficeName] = useState('')
  const [officePhone, setOfficePhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const routeByRole = async () => {
    const ctx = await getMyContext()
    if (!ctx || !ctx.role) {
      // Logged in (auth-wise) but never finished registering as
      // an office or a driver — let them pick now.
      setMode('complete-profile')
      return false
    }
    window.location.href = ctx.role === 'office_admin' ? '/dashboard' : '/driver'
    return true
  }

  const handleLogin = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage('❌ Wrong email or password')
      setLoading(false)
      return
    }
    await routeByRole()
    setLoading(false)
  }

  const handleSignupOffice = async () => {
    setLoading(true)
    setMessage('')
    if (!email || !password || !officeName) {
      setMessage('❌ Please fill office name, email and password')
      setLoading(false)
      return
    }
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage('❌ ' + error.message)
      setLoading(false)
      return
    }
    if (!data.session) {
      setMessage('✅ Check your email to confirm your account, then log in.')
      setMode('login')
      setLoading(false)
      return
    }
    const { error: rpcError } = await supabase.rpc('register_office', {
      p_name: officeName,
      p_phone: officePhone || null
    })
    if (rpcError) {
      setMessage('❌ ' + rpcError.message)
      setLoading(false)
      return
    }
    window.location.href = '/dashboard'
  }

  const handleSignupDriver = async () => {
    setLoading(true)
    setMessage('')
    if (!email || !password || !fullName || !phone) {
      setMessage('❌ Please fill all fields')
      setLoading(false)
      return
    }
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage('❌ ' + error.message)
      setLoading(false)
      return
    }
    if (!data.session) {
      setMessage('✅ Check your email to confirm your account, then log in.')
      setMode('login')
      setLoading(false)
      return
    }
    const { error: rpcError } = await supabase.rpc('register_driver', {
      p_full_name: fullName,
      p_phone: phone
    })
    if (rpcError) {
      setMessage('❌ ' + rpcError.message)
      setLoading(false)
      return
    }
    window.location.href = '/driver'
  }

  const completeAsOffice = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.rpc('register_office', {
      p_name: officeName,
      p_phone: officePhone || null
    })
    if (error) {
      setMessage('❌ ' + error.message)
      setLoading(false)
      return
    }
    window.location.href = '/dashboard'
  }

  const completeAsDriver = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.rpc('register_driver', {
      p_full_name: fullName,
      p_phone: phone
    })
    if (error) {
      setMessage('❌ ' + error.message)
      setLoading(false)
      return
    }
    window.location.href = '/driver'
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96">
        <h1 className="text-3xl font-bold mb-2 text-center">🚖 Taxi App</h1>

        {mode === 'login' && (
          <>
            <p className="text-center text-gray-500 mb-6">Login to continue</p>
            <input
              className="w-full border p-3 rounded-lg mb-4"
              type="email" placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full border p-3 rounded-lg mb-4"
              type="password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className="w-full bg-yellow-400 text-black font-bold p-3 rounded-lg hover:bg-yellow-500 disabled:opacity-50"
              onClick={handleLogin} disabled={loading}
            >
              {loading ? 'Loading...' : 'Login'}
            </button>

            <div className="flex justify-between mt-4 text-sm">
              <button className="text-blue-600 hover:underline" onClick={() => { setMode('signup-office'); setMessage('') }}>
                🏢 New office
              </button>
              <button className="text-blue-600 hover:underline" onClick={() => { setMode('signup-driver'); setMessage('') }}>
                🚗 New driver
              </button>
            </div>
          </>
        )}

        {mode === 'signup-office' && (
          <>
            <p className="text-center text-gray-500 mb-6">Register your taxi office</p>
            <input className="w-full border p-3 rounded-lg mb-3" placeholder="Office name"
              value={officeName} onChange={(e) => setOfficeName(e.target.value)} />
            <input className="w-full border p-3 rounded-lg mb-3" placeholder="Office phone (optional)"
              value={officePhone} onChange={(e) => setOfficePhone(e.target.value)} />
            <input className="w-full border p-3 rounded-lg mb-3" type="email" placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="w-full border p-3 rounded-lg mb-4" type="password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button
              className="w-full bg-yellow-400 text-black font-bold p-3 rounded-lg hover:bg-yellow-500 disabled:opacity-50"
              onClick={handleSignupOffice} disabled={loading}
            >
              {loading ? 'Creating...' : 'Create office account'}
            </button>
            <button className="w-full mt-3 text-sm text-gray-500 hover:underline" onClick={() => { setMode('login'); setMessage('') }}>
              ← Back to login
            </button>
          </>
        )}

        {mode === 'signup-driver' && (
          <>
            <p className="text-center text-gray-500 mb-6">Register as a driver</p>
            <input className="w-full border p-3 rounded-lg mb-3" placeholder="Full name"
              value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input className="w-full border p-3 rounded-lg mb-3" placeholder="Phone"
              value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="w-full border p-3 rounded-lg mb-3" type="email" placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="w-full border p-3 rounded-lg mb-4" type="password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button
              className="w-full bg-yellow-400 text-black font-bold p-3 rounded-lg hover:bg-yellow-500 disabled:opacity-50"
              onClick={handleSignupDriver} disabled={loading}
            >
              {loading ? 'Creating...' : 'Create driver account'}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">You'll join a taxi office with an invite code after this.</p>
            <button className="w-full mt-3 text-sm text-gray-500 hover:underline" onClick={() => { setMode('login'); setMessage('') }}>
              ← Back to login
            </button>
          </>
        )}

        {mode === 'complete-profile' && (
          <>
            <p className="text-center text-gray-500 mb-6">Almost done — are you an office or a driver?</p>
            <div className="mb-4">
              <input className="w-full border p-3 rounded-lg mb-2" placeholder="Office name"
                value={officeName} onChange={(e) => setOfficeName(e.target.value)} />
              <button
                className="w-full bg-yellow-400 text-black font-bold p-2 rounded-lg hover:bg-yellow-500 disabled:opacity-50"
                onClick={completeAsOffice} disabled={loading || !officeName}
              >
                🏢 I'm a taxi office
              </button>
            </div>
            <div className="border-t pt-4">
              <input className="w-full border p-3 rounded-lg mb-2" placeholder="Full name"
                value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <input className="w-full border p-3 rounded-lg mb-2" placeholder="Phone"
                value={phone} onChange={(e) => setPhone(e.target.value)} />
              <button
                className="w-full bg-blue-500 text-white font-bold p-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                onClick={completeAsDriver} disabled={loading || !fullName || !phone}
              >
                🚗 I'm a driver
              </button>
            </div>
          </>
        )}

        {message && <p className="mt-4 text-center text-sm text-red-500">{message}</p>}
      </div>
    </div>
  )
}
