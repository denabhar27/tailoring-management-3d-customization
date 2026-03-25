import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import AdminHeader from './AdminHeader';
import '../adminStyle/admin.css';
import '../adminStyle/shopSchedule.css';
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
      <div className="admin-page shop-schedule-page">
        <Sidebar />
        <AdminHeader />
        <div className="content">
          <div className="ss-loading-state">
            Loading shop schedule...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page shop-schedule-page">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        <div className="ss-header-block">
          <h2>Operating Days & Available Times</h2>
          <p>
            Toggle days to open or close the shop. Click on a day to set available time slots.
          </p>
          <p className="ss-help-text">
            If no times are selected for an open day, all default time slots will be available.
          </p>
        </div>

        <div className="ss-card">
          <div className="ss-day-list">
            {schedule.map(day => {
              const isExpanded = expandedDay === day.day_of_week;
              const selectedCount = (day.available_times || []).length;
              
              return (
                <div
                  key={day.day_of_week}
                  className={`ss-day-card ${day.is_open ? 'is-open' : 'is-closed'} ${isExpanded ? 'is-expanded' : ''}`}
                >
                  <div
                    onClick={() => day.is_open && handleDayClick(day.day_of_week)}
                    className={`ss-day-header ${day.is_open ? 'is-clickable' : ''}`}
                  >
                    <div className="ss-day-main">
                      <span className={`ss-day-chevron ${isExpanded ? 'is-expanded' : ''}`}>›</span>
                      <strong className="ss-day-name">{day.day_name}</strong>
                      <span className={`ss-state-pill ${day.is_open ? 'is-open' : 'is-closed'}`}>
                          {day.is_open ? 'OPEN' : 'CLOSED'}
                      </span>
                      {day.is_open && selectedCount > 0 && (
                        <span className="ss-selected-count">{selectedCount} time{selectedCount !== 1 ? 's' : ''} selected</span>
                      )}
                      {day.is_open && selectedCount === 0 && (
                        <span className="ss-selected-hint">All times available (click to customize)</span>
                      )}
                    </div>

                    <label className="ss-switch" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={day.is_open}
                        onChange={() => handleToggle(day.day_of_week)}
                        className="ss-switch-input"
                      />
                      <span className={`ss-switch-slider ${day.is_open ? 'is-open' : ''}`}>
                        <span className="ss-switch-thumb" />
                      </span>
                    </label>
                  </div>

                  {day.is_open && isExpanded && (
                    <div className="ss-expanded-panel">
                      <div className="ss-panel-header">
                        <h4>Available Time Slots</h4>
                        <div className="ss-panel-actions">
                          <button
                            onClick={() => selectAllTimes(day.day_of_week)}
                            className="ss-panel-btn"
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => clearAllTimes(day.day_of_week)}
                            className="ss-panel-btn secondary"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="ss-time-grid">
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
                              className={`ss-time-pill ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleTimeSlot(day.day_of_week, timeStr)}
                            >
                              {timeStr.substring(0, 5)}
                            </button>
                          );
                        })}
                      </div>
                      <p className="ss-panel-note">Select specific slots, or leave all unselected to allow all times.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="ss-footer-row">
            <p>Changes take effect immediately after saving.</p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="ss-save-btn"
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

