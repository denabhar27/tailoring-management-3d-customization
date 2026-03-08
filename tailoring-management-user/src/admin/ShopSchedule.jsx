import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import AdminHeader from './AdminHeader';
import '../adminStyle/admin.css';
import '../styles/SharedModal.css';
import { getShopScheduleAdmin, updateShopSchedule } from '../api/ShopScheduleApi';
import { getAdminTimeSlots } from '../api/AppointmentSlotApi';
import { getUserRole } from '../api/AuthApi';
import { useAlert } from '../context/AlertContext';

const ShopSchedule = () => {
  const { alert } = useAlert();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [expandedDay, setExpandedDay] = useState(null);
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
    const role = getUserRole();
    if (role !== 'admin') {
      navigate('/', { replace: true });
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [scheduleResult, slotsResult] = await Promise.all([
        getShopScheduleAdmin(),
        getAdminTimeSlots()
      ]);

      if (slotsResult.success && slotsResult.slots) {
        setTimeSlots(slotsResult.slots);
      }

      if (scheduleResult.success) {
        const scheduleMap = {};
        scheduleResult.schedule.forEach(item => {
          scheduleMap[item.day_of_week] = item;
        });

        // Helper to normalize times to HH:MM:SS format
        const normalizeTime = (t) => {
          const timeStr = String(t).trim();
          // If it's HH:MM format, add :00
          if (timeStr.match(/^\d{2}:\d{2}$/)) {
            return timeStr + ':00';
          }
          // If it's HH:MM:SS format, keep as is
          if (timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
            return timeStr;
          }
          return timeStr;
        };

        const fullSchedule = daysOfWeek.map(day => {
          const existingTimes = scheduleMap[day.value]?.available_times || [];
          // Normalize all times to HH:MM:SS format and remove duplicates
          const normalizedTimes = [...new Set(existingTimes.map(normalizeTime))];
          return {
            day_of_week: day.value,
            day_name: day.name,
            is_open: scheduleMap[day.value]?.is_open || false,
            available_times: normalizedTimes
          };
        });

        setSchedule(fullSchedule);
      }
    } catch (error) {
      console.error('Error fetching shop schedule:', error);
      if (error?.response?.status === 403) {
        await alert('Admin access required. Please log in as admin.', 'Access Denied', 'error');
        navigate('/', { replace: true });
        return;
      }
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

  const handleDayClick = (dayOfWeek) => {
    setExpandedDay(prev => prev === dayOfWeek ? null : dayOfWeek);
  };

  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const toggleTimeSlot = (dayOfWeek, timeSlot) => {
    const normalizedTime = timeSlot.substring(0, 5) + ':00';
    const shortTime = timeSlot.substring(0, 5); // HH:MM format
    setSchedule(prev => prev.map(day => {
      if (day.day_of_week !== dayOfWeek) return day;
      const currentTimes = day.available_times || [];
      // Check for both formats (HH:MM and HH:MM:SS)
      const hasTime = currentTimes.some(t => t === normalizedTime || t === shortTime);
      return {
        ...day,
        // Remove both formats and add the normalized one, or just remove if toggling off
        available_times: hasTime
          ? currentTimes.filter(t => t !== normalizedTime && t !== shortTime)
          : [...currentTimes, normalizedTime]
      };
    }));
  };

  const selectAllTimes = (dayOfWeek) => {
    const allTimes = timeSlots.filter(s => s.is_active).map(s => {
      const t = typeof s.time_slot === 'string' ? s.time_slot : s.time_slot.toString();
      return t.substring(0, 5) + ':00';
    });
    setSchedule(prev => prev.map(day =>
      day.day_of_week === dayOfWeek
        ? { ...day, available_times: allTimes }
        : day
    ));
  };

  const clearAllTimes = (dayOfWeek) => {
    setSchedule(prev => prev.map(day =>
      day.day_of_week === dayOfWeek
        ? { ...day, available_times: [] }
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
          <div>
            <h2>Shop Schedule</h2>
            <p>Configure which days and times the shop is open for appointments</p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          maxWidth: '900px',
          margin: '20px auto'
        }}>
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '10px', color: '#333' }}>Operating Days & Available Times</h3>
            <p style={{ color: '#666', marginBottom: '5px' }}>
              Toggle days to open or close the shop. Click on a day to set available time slots.
            </p>
            <p style={{ color: '#999', fontSize: '13px' }}>
              If no times are selected for an open day, all default time slots will be available.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {schedule.map(day => {
              const isExpanded = expandedDay === day.day_of_week;
              const selectedCount = (day.available_times || []).length;
              
              return (
                <div key={day.day_of_week} style={{ borderRadius: '8px', overflow: 'hidden', border: `2px solid ${day.is_open ? '#4caf50' : '#f44336'}`, transition: 'all 0.3s ease' }}>
                  {/* Day Header - clickable to expand */}
                  <div
                    onClick={() => day.is_open && handleDayClick(day.day_of_week)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '15px 20px',
                      backgroundColor: day.is_open ? '#e8f5e9' : '#ffebee',
                      cursor: day.is_open ? 'pointer' : 'default',
                      transition: 'all 0.3s ease',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {day.is_open && (
                        <span style={{
                          fontSize: '18px',
                          color: '#666',
                          transition: 'transform 0.3s',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          display: 'inline-block'
                        }}>▶</span>
                      )}
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
                        {day.is_open && selectedCount > 0 && (
                          <span style={{
                            marginLeft: '8px',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            backgroundColor: '#1976d2',
                            color: 'white'
                          }}>
                            {selectedCount} time{selectedCount !== 1 ? 's' : ''} selected
                          </span>
                        )}
                        {day.is_open && selectedCount === 0 && (
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '12px',
                            color: '#999',
                            fontStyle: 'italic'
                          }}>
                            All times available (click to customize)
                          </span>
                        )}
                      </div>
                    </div>
                    <label style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '60px',
                      height: '30px',
                      cursor: 'pointer'
                    }} onClick={(e) => e.stopPropagation()}>
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

                  {/* Time Slots Grid */}
                  {day.is_open && isExpanded && (
                    <div style={{
                      padding: '20px',
                      backgroundColor: '#fafafa',
                      borderTop: '1px solid #e0e0e0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#555' }}>
                          Select available time slots for {day.day_name}:
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => selectAllTimes(day.day_of_week)}
                            style={{
                              padding: '5px 14px',
                              fontSize: '12px',
                              backgroundColor: '#1976d2',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                          >Select All</button>
                        </div>
                      </div>
                      <div className="time-slots-grid">
                        {timeSlots.filter(s => s.is_active).map(slot => {
                          const timeStr = typeof slot.time_slot === 'string' ? slot.time_slot : slot.time_slot.toString();
                          const normalizedTime = timeStr.substring(0, 5) + ':00';
                          const shortTime = timeStr.substring(0, 5);
                          // Check for both formats (HH:MM and HH:MM:SS)
                          const isSelected = (day.available_times || []).some(t => t === normalizedTime || t === shortTime);
                          
                          return (
                            <button
                              key={slot.slot_id}
                              type="button"
                              className={`time-slot-btn available ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleTimeSlot(day.day_of_week, timeStr)}
                            >
                              <span className="slot-time">{formatTime(timeStr)}</span>
                              <span className="slot-status">{isSelected ? 'Selected' : 'Available'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

