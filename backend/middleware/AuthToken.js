const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.error('No authorization header provided');
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    console.error('Token not found in authorization header');
    return res.status(401).json({ message: "Token format invalid" });
  }

  jwt.verify(token, process.env.JWT_SECRET || "secret", (err, decoded) => {
    if (err) {
      console.error('Token verification error:', err.message);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    // Block customer accounts issued before age verification or without a verified DOB claim
    if (decoded.role === 'user' && decoded.ageVerified !== true) {
      return res.status(403).json({
        message: 'Please sign out and sign in again. Your account must confirm you are 18 or older.',
        code: 'AGE_VERIFICATION_REQUIRED'
      });
    }
    req.user = decoded;
    console.log('Token decoded successfully:', {
      id: decoded.id,
      role: decoded.role,
      username: decoded.username
    });
    next();
  });
};
exports.requireAdmin = (req, res, next) => {
  // Allow both admin and clerk to pass admin-protected routes
  if (req.user && (req.user.role === 'admin' || req.user.role === 'clerk')) {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required' });
};

// Generic role guard; pass an array of allowed roles
exports.requireRole = (roles = []) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (roles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({ message: 'Access denied for this role' });
};