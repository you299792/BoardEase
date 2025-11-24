import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/Colors'

/**
 * ListingStatsModal
 * - Compact, responsive KPI grid (no nested VirtualizedLists)
 * - Defensive: tolerates listing === null and missing arrays
 * - Export button shares a small CSV of recent bookings + inquiries
 *
 * Props:
 * - visible, onClose, listing, inquiries, reviews, bookings, messages
 */

const daysBetween = (a, b) => {
  try {
    const da = new Date(a)
    const db = new Date(b)
    const diff = Math.round(Math.abs((db - da) / (1000 * 60 * 60 * 24)))
    return diff
  } catch (e) {
    return null
  }
}

const avg = (arr) => {
  if (!arr || arr.length === 0) return null
  return arr.reduce((s, x) => s + x, 0) / arr.length
}

export default function ListingStatsModal({
  visible,
  onClose,
  listing,
  inquiries,
  reviews,
  bookings,
  messages,
}) {
  // defensive defaults
  const safeListing = listing || {}
  const safeInquiries = Array.isArray(inquiries) ? inquiries : []
  const safeReviews = Array.isArray(reviews) ? reviews : []
  const safeBookings = Array.isArray(bookings) ? bookings : []
  const safeMessages = Array.isArray(messages) ? messages : []

  const [selectedKpi, setSelectedKpi] = useState(null)

  const price = safeListing.price ?? safeListing.price_per_month ?? safeListing.pricePerMonth ?? 0
  const inquiriesCount = safeInquiries.length
  const bookingsCount = safeBookings.length
  const conversionRate = inquiriesCount > 0 ? `${((bookingsCount / inquiriesCount) * 100).toFixed(1)}%` : '—'
  const avgRating = (safeReviews && safeReviews.length > 0)
    ? (safeReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / safeReviews.length)
    : null

  let occupancyPercent = null
  let occupiedRooms = null
  if (typeof safeListing.total_rooms === 'number' && typeof safeListing.available_rooms === 'number') {
    const total = safeListing.total_rooms
    const available = safeListing.available_rooms
    const occupied = Math.max(0, total - available)
    occupiedRooms = occupied
    occupancyPercent = total > 0 ? Math.round((occupied / total) * 100) : null
  }

  const estimatedMonthlyRevenue = (price && occupiedRooms != null) ? price * occupiedRooms : null
  const daysListed = safeListing.created_at ? daysBetween(safeListing.created_at, new Date().toISOString()) : null

  const stayLengths = safeBookings
    .map(b => {
      if (!b.move_in_date || !b.move_out_date) return null
      const days = daysBetween(b.move_in_date, b.move_out_date)
      return Number.isFinite(days) ? days : null
    })
    .filter(x => x != null)
  const avgStayLength = stayLengths.length > 0 ? Math.round(avg(stayLengths)) : null

  let timeToFirstBooking = null
  if (safeListing.created_at && safeBookings.length > 0) {
    const firstBooking = safeBookings
      .map(b => ({ ...b, created_at: b.created_at || b.move_in_date }))
      .filter(b => b.created_at)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]
    if (firstBooking) {
      timeToFirstBooking = daysBetween(safeListing.created_at, firstBooking.created_at)
    }
  }

  const computeAvgResponseTimeHours = () => {
    const directResponses = safeInquiries
      .map(i => {
        if (i.created_at && i.responded_at) {
          const ms = Math.abs(new Date(i.responded_at) - new Date(i.created_at))
          return ms / (1000 * 60 * 60)
        }
        if (i.response_time_ms) return i.response_time_ms / (1000 * 60 * 60)
        return null
      })
      .filter(x => x != null && Number.isFinite(x))

    if (directResponses.length > 0) return avg(directResponses)

    if (safeMessages.length > 0) {
      const byConv = safeMessages.reduce((acc, m) => {
        const key = m.conversation_id ?? m.conv_id ?? 'no_conv'
        acc[key] = acc[key] || []
        acc[key].push(m)
        return acc
      }, {})

      const responseHours = []
      Object.values(byConv).forEach(msgs => {
        const sorted = msgs
          .filter(m => m.created_at)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        for (let i = 0; i < sorted.length; i++) {
          const m = sorted[i]
          if (m.sender_type === 'tenant' || m.sender === 'tenant') {
            const landlordReply = sorted.slice(i + 1).find(x => x.sender_type === 'landlord' || x.sender === 'landlord')
            if (landlordReply) {
              const ms = new Date(landlordReply.created_at) - new Date(m.created_at)
              if (ms > 0) responseHours.push(ms / (1000 * 60 * 60))
            }
            break
          }
        }
      })
      if (responseHours.length > 0) return avg(responseHours)
    }
    return null
  }

  const avgResponseHours = computeAvgResponseTimeHours()
  const avgResponseReadable = avgResponseHours != null ? `${Number(avgResponseHours).toFixed(1)} hrs` : '—'

  const recentBookings = safeBookings
    .filter(b => b.created_at || b.move_in_date)
    .map(b => ({ ...b, sortDate: b.created_at || b.move_in_date }))
    .sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate))
    .slice(0, 6)

  const recentInquiries = safeInquiries
    .filter(i => i.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)

  const kpis = useMemo(() => ([
    { key: 'price', label: 'Price', value: formatCurrency(price) },
    { key: 'inquiries', label: 'Inquiries', value: inquiriesCount, sub: `${inquiriesCount} total` },
    { key: 'bookings', label: 'Bookings', value: bookingsCount, sub: `${bookingsCount} total` },
    { key: 'conversion', label: 'Conversion', value: conversionRate },
    { key: 'avg_rating', label: 'Avg Rating', value: avgRating != null ? Number(avgRating).toFixed(1) : '—', sub: safeReviews?.length ? `${safeReviews.length} reviews` : '' },
    { key: 'avg_stay', label: 'Avg Stay (d)', value: avgStayLength != null ? `${avgStayLength}d` : '—' },
    { key: 'occupancy', label: 'Occupancy', value: occupancyPercent != null ? `${occupancyPercent}%` : 'N/A', sub: (occupiedRooms != null && safeListing.total_rooms != null) ? `${occupiedRooms}/${safeListing.total_rooms}` : '' },
    { key: 'est_revenue', label: 'Est. Monthly', value: estimatedMonthlyRevenue != null ? formatCurrency(estimatedMonthlyRevenue) : 'N/A', sub: 'Estimate' },
    { key: 'days_listed', label: 'Days Listed', value: daysListed != null ? `${daysListed}d` : 'N/A' },
    { key: 'avg_response', label: 'Avg Response', value: avgResponseReadable },
    { key: 'time_first', label: 'Time to 1st Booking', value: timeToFirstBooking != null ? `${timeToFirstBooking}d` : '—' },
  ]), [price, inquiriesCount, bookingsCount, avgRating, avgStayLength, occupancyPercent, occupiedRooms, safeListing.total_rooms, estimatedMonthlyRevenue, daysListed, avgResponseReadable, timeToFirstBooking, safeReviews?.length])

  function formatCurrency(v) {
    return v == null || isNaN(v) ? 'N/A' : `₱${Number(v).toLocaleString()}`
  }

  const KpiCard = ({ item }) => {
    const active = selectedKpi === item.key
    return (
      <TouchableOpacity
        onPress={() => setSelectedKpi(selectedKpi === item.key ? null : item.key)}
        style={[styles.kpiCard, active && styles.kpiCardActive]}
        activeOpacity={0.85}
      >
        <Text style={styles.kpiValue} numberOfLines={1}>{item.value}</Text>
        <Text style={styles.kpiLabel} numberOfLines={1}>{item.label}</Text>
        {item.sub ? <Text style={styles.kpiSub} numberOfLines={1}>{item.sub}</Text> : null}
      </TouchableOpacity>
    )
  }

  const onExport = async () => {
    const rows = []
    rows.push('Type,Id,Name,Email,Date,Details')
    recentBookings.forEach(b => {
      const name = b.tenant?.first_name ? `${b.tenant.first_name} ${b.tenant.last_name || ''}` : (b.tenant?.name || '')
      const date = b.created_at || b.move_in_date || ''
      const details = b.move_in_date ? `move-in:${b.move_in_date} move-out:${b.move_out_date || ''}` : ''
      rows.push(`booking,${b.id || ''},"${name}","${b.tenant?.email || ''}",${date},"${details}"`)
    })
    recentInquiries.forEach(i => {
      const name = i.tenant?.first_name ? `${i.tenant.first_name} ${i.tenant.last_name || ''}` : (i.tenant?.name || '')
      const date = i.created_at || ''
      const details = (i.last_message || i.message || '').replace(/"/g, '""')
      rows.push(`inquiry,${i.id || ''},"${name}","${i.tenant?.email || ''}",${date},"${details}"`)
    })

    const csv = rows.join('\n')

    try {
      await Share.share({
        title: `${safeListing.title || safeListing.name || 'Listing'} - Stats export`,
        message: csv,
      })
    } catch (e) {
      console.error('Export failed', e)
    }
  }

  const renderInquiryItem = (item) => (
    <View key={item.id ?? Math.random().toString()} style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name="chatbubble-ellipses-outline" size={18} color="#667eea" />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.tenant?.first_name ? `${item.tenant.first_name} ${item.tenant.last_name || ''}` : (item.tenant?.name || 'Tenant')}</Text>
        <Text style={styles.rowSub} numberOfLines={2}>{item.last_message || item.message || ''}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowTime}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
      </View>
    </View>
  )

  const renderBookingItem = (b) => (
    <View key={b.id ?? Math.random().toString()} style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name="calendar-outline" size={18} color="#10b981" />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{b.tenant?.first_name ? `${b.tenant.first_name} ${b.tenant.last_name || ''}` : (b.tenant?.name || 'Tenant')}</Text>
        <Text style={styles.rowSub} numberOfLines={2}>
          {b.move_in_date ? `${new Date(b.move_in_date).toLocaleDateString()} → ${b.move_out_date ? new Date(b.move_out_date).toLocaleDateString() : '—'}` : (b.created_at ? `Booked: ${new Date(b.created_at).toLocaleDateString()}` : '')}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowTime}>{b.created_at ? new Date(b.created_at).toLocaleDateString() : ''}</Text>
      </View>
    </View>
  )

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Stats — {safeListing.title || safeListing.name || 'Property'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* KPI grid: wraps to multiple rows, compact */}
            <View style={styles.kpiGrid}>
              {kpis.map(i => <KpiCard key={i.key} item={i} />)}
            </View>

            {occupancyPercent != null && (
              <View style={styles.occupancySection}>
                <Text style={styles.sectionTitle}>Occupancy</Text>
                <View style={styles.occupancyBarBackground}>
                  <View style={[styles.occupancyBarFilled, { width: `${occupancyPercent}%` }]} />
                </View>
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Bookings</Text>
                <TouchableOpacity onPress={onExport} style={styles.exportBtn}>
                  <Ionicons name="download-outline" size={16} color="white" />
                  <Text style={styles.exportText}>Export</Text>
                </TouchableOpacity>
              </View>

              {recentBookings.length > 0 ? (
                recentBookings.map(renderBookingItem)
              ) : <Text style={styles.emptyText}>No bookings yet.</Text>}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Inquiries</Text>
              {recentInquiries.length > 0 ? (
                recentInquiries.map(renderInquiryItem)
              ) : <Text style={styles.emptyText}>No inquiries yet.</Text>}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeAction} onPress={onClose}>
              <Text style={styles.closeActionText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  container: { maxHeight: '88%', backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header: { flexDirection: 'row', padding: 12, alignItems: 'center', justifyContent: 'center', borderBottomColor: '#eee', borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '700', color: '#111' },
  closeBtn: { position: 'absolute', right: 12, top: 12, padding: 6 },
  body: { paddingHorizontal: 12, paddingTop: 8 },
  // KPI grid: wrap and compact cards
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  kpiCard: {
    width: '31%',           // aim for 3 columns on typical phones
    minWidth: 92,          // prevent too-narrow cards on tiny devices
    marginHorizontal: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 64,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  kpiCardActive: { borderColor: Colors.primary || '#667eea', backgroundColor: '#eef2ff' },
  kpiValue: { fontSize: 14, fontWeight: '700', color: '#111' },
  kpiLabel: { fontSize: 11, color: '#666', marginTop: 4, textAlign: 'center' },
  kpiSub: { fontSize: 10, color: '#999', marginTop: 2, textAlign: 'center' },

  occupancySection: { paddingHorizontal: 4, marginVertical: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  occupancyBarBackground: { width: '100%', height: 12, backgroundColor: '#eef2ff', borderRadius: 8, overflow: 'hidden' },
  occupancyBarFilled: { height: '100%', backgroundColor: Colors.primary || '#667eea' },

  section: { marginTop: 12, marginBottom: 6 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  exportBtn: { flexDirection: 'row', backgroundColor: Colors.primary || '#667eea', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center' },
  exportText: { color: 'white', marginLeft: 6, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomColor: '#f1f1f1', borderBottomWidth: 1 },
  rowLeft: { width: 34, alignItems: 'center', marginRight: 8 },
  rowBody: { flex: 1, paddingRight: 8 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: '#333' },
  rowSub: { fontSize: 12, color: '#666', marginTop: 4 },
  rowRight: { width: 90, alignItems: 'flex-end' },
  rowTime: { fontSize: 12, color: '#999' },
  emptyText: { color: '#999', fontSize: 14, paddingVertical: 8 },

  footer: { padding: 10, borderTopColor: '#eee', borderTopWidth: 1, backgroundColor: 'white' },
  closeAction: { backgroundColor: Colors.primary || '#667eea', padding: 12, borderRadius: 12, alignItems: 'center' },
  closeActionText: { color: 'white', fontWeight: '700', fontSize: 16 },
})