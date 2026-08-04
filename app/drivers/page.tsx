'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getMyContext, MyContext } from '../../lib/context'

export default function DriversManagement() {
  const [ctx, setCtx] = useState<MyContext | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [docAlerts, setDocAlerts] = useState<Record<string, string[]>>({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    (async () => {
      const c = await getMyContext()
      if (!c) { window.location.href = '/'; return }
      if (c.role !== 'office_admin') { window.location.href = '/driver'; return }
      setCtx(c)
      fetchDrivers()
    })()
  }, [])

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from('office_drivers')
      .select('id, status, commission_percent, joined_at, drivers(id, full_name, phone)')
      .neq('status', 'removed')
      .order('joined_at', { ascending: false })
    setRows(data || [])

    const driverIds = (data || []).map((r: any) => r.drivers?.id).filter(Boolean)
    if (driverIds.length) {
      const { data: docs } = await supabase
        .from('driver_documents')
        .select('driver_id, doc_type, expiry_date')
        .in('driver_id', driverIds)
      const today = new Date()
      const twoMonths = new Date(); twoMonths.setMonth(twoMonths.getMonth() + 2)
      const alerts: Record<string, string[]> = {}
      ;(docs || []).forEach((d: any) => {
        if (!d.expiry_date) return
        const date = new Date(d.expiry_date)
        if (date > twoMonths) return
        const days = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const label = d.doc_type.replace('_', ' ')
        const msg = days < 0 ? `❌ ${label} expired` : `⚠️ ${label} in ${days}d`
        alerts[d.driver_id] = [...(alerts[d.driver_id] || []), msg]
      })
      setDocAlerts(alerts)
    }
  }

  const approve = async (id: string) => {
    await supabase.from('office_drivers').update({ status: 'active' }).eq('id', id)
    fetchDrivers()
  }

  const suspend = async (id: string) => {
    await supabase.from('office_drivers').update({ status: 'suspended' }).eq('id', id)
    fetchDrivers()
  }

  const reactivate = async (id: string) => {
    await supabase.from('office_drivers').update({ status: 'active' }).eq('id', id)
    fetchDrivers()
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your office?`)) return
    await supabase.from('office_drivers').update({ status: 'removed' }).eq('id', id)
    setMessage('✅ Driver removed from your office')
    fetchDrivers()
  }

  const updateCommission = async (id: string, percent: number) => {
    await supabase.from('office_drivers').update({ commission_percent: percent }).eq('id', id)
    fetchDrivers()
  }

  const openWhatsApp = (phone: string) => {
    const cleaned = (phone || '').replace(/\D/g, '')
    window.open(`https://wa.me/${cleaned}`, '_blank')
  }

  const statusBadge: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-gray-200 text-gray-600'
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-yellow-500">👥 Drivers Management</h1>
        <button onClick={() => window.location.href = '/dashboard'} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">← Dashboard</button>
      </div>

      {message && <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded mb-6">{message}</div>}

      {/* Invite code */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-2">📨 Invite drivers</h2>
        <p className="text-gray-500 mb-2">Share this code — drivers enter it in their app to request joining your office:</p>
        <p className="font-mono font-bold text-2xl bg-gray-100 inline-block px-4 py-2 rounded">{ctx?.office_invite_code}</p>
      </div>

      {/* Drivers list */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">🚗 Drivers ({rows.length})</h2>
        {rows.length === 0 && <p className="text-gray-400">No drivers yet. Share your invite code above.</p>}
        {rows.map((row) => (
          <div key={row.id} className="border-b py-4">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-bold text-lg">
                  {row.drivers?.full_name}{' '}
                  <span className={`text-xs px-2 py-0.5 rounded ${statusBadge[row.status]}`}>{row.status}</span>
                </p>
                <button onClick={() => openWhatsApp(row.drivers?.phone)} className="text-sm text-green-600 hover:underline">📱 {row.drivers?.phone}</button>
                {docAlerts[row.drivers?.id]?.map((a, i) => (
                  <p key={i} className="text-xs text-red-600 font-bold">{a}</p>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {row.status === 'active' && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">Commission:</label>
                    <input type="number" className="border p-1 rounded w-16 text-center"
                      value={row.commission_percent}
                      onChange={(e) => updateCommission(row.id, parseFloat(e.target.value))} />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                )}
                {row.status === 'pending' && (
                  <button onClick={() => approve(row.id)} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-sm">✅ Approve</button>
                )}
                {row.status === 'active' && (
                  <button onClick={() => suspend(row.id)} className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm">⏸ Suspend</button>
                )}
                {row.status === 'suspended' && (
                  <button onClick={() => reactivate(row.id)} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-sm">▶ Reactivate</button>
                )}
                <button onClick={() => remove(row.id, row.drivers?.full_name)} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm">🗑️ Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
