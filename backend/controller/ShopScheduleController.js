const ShopSchedule = require('../model/ShopScheduleModel');

exports.getShopSchedule = (req, res) => {
  ShopSchedule.getAll((err, schedule) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching shop schedule',
        error: err
      });
    }

    const formattedSchedule = schedule.map(item => ({
      day_of_week: item.day_of_week,
      day_name: getDayName(item.day_of_week),
      is_open: item.is_open === 1,
      available_times: item.available_times || null
    }));

    res.json({
      success: true,
      schedule: formattedSchedule
    });
  });
};

exports.getShopScheduleAdmin = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  ShopSchedule.getAll((err, schedule) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching shop schedule',
        error: err
      });
    }

    const formattedSchedule = schedule.map(item => ({
      day_of_week: item.day_of_week,
      day_name: getDayName(item.day_of_week),
      is_open: item.is_open === 1,
      available_times: item.available_times || null
    }));

    res.json({
      success: true,
      schedule: formattedSchedule
    });
  });
};

exports.updateShopSchedule = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  const { schedule } = req.body;

  if (!schedule || !Array.isArray(schedule)) {
    return res.status(400).json({
      success: false,
      message: 'Schedule data is required and must be an array'
    });
  }

  const validSchedule = schedule.map(item => ({
    day_of_week: parseInt(item.day_of_week),
    is_open: item.is_open ? 1 : 0,
    available_times: item.available_times || null
  }));

  for (let i = 0; i <= 6; i++) {
    if (!validSchedule.find(s => s.day_of_week === i)) {
      validSchedule.push({ day_of_week: i, is_open: 0 });
    }
  }

  ShopSchedule.updateMultiple(validSchedule, (err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error updating shop schedule',
        error: err
      });
    }

    res.json({
      success: true,
      message: 'Shop schedule updated successfully'
    });
  });
};

exports.checkDateOpen = (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: 'Date is required'
    });
  }

  ShopSchedule.isDateOpen(date, (err, isOpen) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error checking date',
        error: err
      });
    }

    res.json({
      success: true,
      date: date,
      is_open: isOpen
    });
  });
};

function getDayName(dayOfWeek) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
}

