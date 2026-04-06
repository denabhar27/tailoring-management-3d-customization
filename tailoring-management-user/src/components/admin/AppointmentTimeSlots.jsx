import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../api/config';

const serviceLabel = { dry_cleaning: 'Dry Cleaning', repair: 'Repair', customization: 'Customization' };

const AppointmentTimeSlots = ({ serviceType }) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [date, setDate] = useState(todayStr);
  const [appointments, setAppointments] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchAppointments = async (d) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = { date: d };
      if (serviceType) params.serviceType = serviceType;
      const res = await axios.get(`${API_URL}/appointments/admin/appointments-by-date`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      if (res.data.success) setAppointments(res.data.appointments || {});
    } catch (e) {
      console.error('Failed to fetch appointments', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAppointments(date); }, [date]);

  const timeSlots = Object.keys(appointments);
  const totalCount = Object.values(appointments).reduce((s, arr) => s + arr.length, 0);

  return (
    <div style={{ minWidth: '260px', maxWidth: '320px', border: '1px solid #e0d4c8', borderRadius: '8px', background: '#fffaf5', padding: '12px', fontSize: '13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <strong style={{ color: '#5d3a1a' }}>
          📅 Appointments {totalCount > 0 && <span style={{ background: '#ff9800', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', marginLeft: '4px' }}>{totalCount}</span>}
        </strong>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ padding: '3px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }}
        />
      </div>

      {loading ? (
        <div style={{ color: '#999', textAlign: 'center', padding: '10px 0' }}>Loading...</div>
      ) : timeSlots.length === 0 ? (
        <div style={{ color: '#aaa', textAlign: 'center', padding: '10px 0' }}>No appointments on this date</div>
      ) : (
        <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {timeSlots.map(time => (
            <div key={time} style={{ background: '#fff', border: '1px solid #f0e0d0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ fontWeight: '600', color: '#8b4513', marginBottom: '4px' }}>🕐 {time}</div>
              {appointments[time].map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', borderTop: i > 0 ? '1px solid #f5ece4' : 'none' }}>
                  <span style={{ color: '#333' }}>{a.customer_name}</span>
                  {!serviceType && (
                    <span style={{ fontSize: '10px', background: '#e3f2fd', color: '#1565c0', borderRadius: '4px', padding: '1px 5px' }}>
                      {serviceLabel[a.service_type] || a.service_type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppointmentTimeSlots;
