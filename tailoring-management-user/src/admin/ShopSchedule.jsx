import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import AdminHeader from './AdminHeader';
import '../adminStyle/admin.css';
import { getShopScheduleAdmin, updateShopSchedule } from '../api/ShopScheduleApi';
import { useAlert } from '../context/AlertContext';

const ShopSchedule = () => {
  const { alert } = useAlert();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const daysOfWeek = [
    { value: 0, name: 'Sunday' },
    { value: 1, name: 'Monday' },
    { value: 2, name: 'Tuesday' },
    { value: 3, name: 'Wednesday' },
    { value: 4, name: 'Thursday' },
    { value: 5, name: 'Friday' },
    { value: 6, name: 'Saturday' }
  ];

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const result = await getShopScheduleAdmin();
      if (result.success) {

        const scheduleMap = {};
        result.schedule.forEach(item => {
          scheduleMap[item.day_of_week] = item;
        });

        const fullSchedule = daysOfWeek.map(day => ({
          day_of_week: day.value,
          day_name: day.name,
          is_open: scheduleMap[day.value]?.is_open || false
        }));

        setSchedule(fullSchedule);
      }
    } catch (error) {
      console.error('Error fetching shop schedule:', error);
      await alert('Failed to load shop schedule', 'Error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (dayOfWeek) => {
    setSchedule(prev => prev.map(day =>
      day.day_of_week === dayOfWeek
        ? { ...day, is_open: !day.is_open }
        : day
    ));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateShopSchedule(schedule);
      if (result.success) {
        await alert('Shop schedule updated successfully!', 'Success', 'success');
      } else {
        await alert(result.message || 'Failed to update shop schedule', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error updating shop schedule:', error);
      await alert('Failed to update shop schedule', 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <Sidebar />
        <AdminHeader />
        <div className="content">
          <div style={{ textAlign: 'center', padding: '60px' }}>
            Loading shop schedule...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        <div className="dashboard-title">
          <h2>Shop Schedule</h2>
          <p>Configure which days the shop is open for appointments</p>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          maxWidth: '800px',
          margin: '20px auto'
        }}>
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>Operating Days</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Toggle days to open or close the shop. Closed days will not be available for appointment booking.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {schedule.map(day => (
              <div
                key={day.day_of_week}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '15px 20px',
                  backgroundColor: day.is_open ? '#e8f5e9' : '#ffebee',
                  borderRadius: '8px',
                  border: `2px solid ${day.is_open ? '#4caf50' : '#f44336'}`,
                  transition: 'all 0.3s ease'
                }}
              >
                <div>
                  <strong style={{ fontSize: '16px', color: '#333' }}>
                    {day.day_name}
                  </strong>
                  <span style={{
                    marginLeft: '10px',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: day.is_open ? '#4caf50' : '#f44336',
                    color: 'white'
                  }}>
                    {day.is_open ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
                <label style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '60px',
                  height: '30px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={day.is_open}
                    onChange={() => handleToggle(day.day_of_week)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: day.is_open ? '#4caf50' : '#ccc',
                    borderRadius: '30px',
                    transition: '0.3s',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '22px',
                      width: '22px',
                      left: day.is_open ? '34px' : '4px',
                      bottom: '4px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '0.3s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </span>
                </label>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '12px 30px',
                backgroundColor: '#8B4513',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                if (!saving) e.target.style.backgroundColor = '#A0522D';
              }}
              onMouseOut={(e) => {
                if (!saving) e.target.style.backgroundColor = '#8B4513';
              }}
            >
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopSchedule;

