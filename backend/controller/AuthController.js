const bcrypt = require('bcryptjs');
const User = require('../model/UserModel');
const Admin = require('../model/AdminModel');
const jwt = require('jsonwebtoken');
const axios = require('axios');

exports.register = (req, res) => {
  const { first_name, last_name, username, email, password, phone_number } = req.body;

  // Check if username exists
  User.findByUsername(username, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    if (results.length > 0) return res.status(400).json({ message: "Username already taken" });

    // Check if email exists
    User.findByEmail(email, (err, emailResults) => {
      if (err) return res.status(500).json({ message: "Database error", error: err });
      if (emailResults.length > 0) return res.status(400).json({ message: "Email already registered" });

      const hashedPassword = bcrypt.hashSync(password, 10);

      User.create(first_name, last_name, username, email, hashedPassword, phone_number, (err, result) => {
        if (err) {
          console.error('[REGISTER] Error creating user:', err);
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: "Username or email already exists" });
          }
          return res.status(500).json({ message: "Error creating user", error: err.message });
        }

        const token = jwt.sign(
          { id: result.insertId, role: 'user' },
          process.env.JWT_SECRET || "secret",
          { expiresIn: '24h' }
        );

        res.json({
          message: "Registration successful",
          token,
          role: 'user',
          user: {
            id: result.insertId,
            first_name,
            last_name,
            username,
            email,
            phone_number
          }
        });
      });
    });
  });
};

exports.login = async (req, res) => {
  const {username, password} = req.body;

  User.findByUsername(username, (err, userResults) => {
    if (err) return res.status(500).json({message: "Database error"});
    
    if (userResults.length > 0) {
    
      const user = userResults[0];

      if (!user.password) {
        return res.status(401).json({message: "This account was created with Google. Please use Google sign-in."});
      }
      
      const isMatch = bcrypt.compareSync(password, user.password);
      if (!isMatch) return res.status(401).json({message: "Invalid credentials"});
      
    const token = jwt.sign(
  { id: user.user_id, role: 'user', first_name: user.first_name, last_name: user.last_name, email: user.email, phone_number: user.phone_number },
  process.env.JWT_SECRET || "secret",
  { expiresIn: '24h' }
);
      return res.json({
  token, 
  role: 'user', 
  message: "Login successful",
  user: {
    id: user.user_id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone_number: user.phone_number,
    profile_picture: user.profile_picture
  }
});
    }

    Admin.findByUsername(username, (err, adminResults) => {
      if (err) return res.status(500).json({message: "Database error"});
      if (adminResults.length === 0) return res.status(404).json({message: "Invalid credentials"});
      
      const admin = adminResults[0];
      const isMatch = bcrypt.compareSync(password, admin.password);
      if (!isMatch) return res.status(401).json({message: "Invalid credentials"});

   const adminId = admin.admin_id || admin.id;
   const token = jwt.sign(
  { id: adminId, role: 'admin', username: admin.username },
  process.env.JWT_SECRET || "secret",
  { expiresIn: '24h' }
);
      return res.json({
  token, 
  role: 'admin', 
  message: "Admin login successful",
  admin: {
    id: adminId,
    username: admin.username
  }
});
    });
  });
};

exports.googleAuth = (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const scope = 'profile email';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    console.log('Returning Google OAuth URL:', authUrl);
    res.json({ authUrl }); 
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    res.status(500).json({ message: 'Failed to generate Google OAuth URL', error });
  }
};

const redirectWithError = (res, errorMessage) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
};

exports.googleCallback = async (req, res) => {
  const { code, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (error) {
    console.error('Google OAuth error:', error);
    const errorMessage = error === 'access_denied' 
      ? 'Access denied. Please grant permissions to continue.' 
      : `Authentication failed: ${error}`;
    return redirectWithError(res, errorMessage);
  }

  if (!code) {
    console.error('No authorization code provided');
    return redirectWithError(res, 'Authorization code not provided');
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('Google OAuth credentials not configured');
    return redirectWithError(res, 'Google OAuth not configured. Please contact administrator.');
  }

  try {

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', 
      new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback',
        grant_type: 'authorization_code',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const tokens = tokenResponse.data;
    
    if (!tokens.access_token) {
      console.error('No access token in response:', tokens);
      return redirectWithError(res, 'Failed to get access token from Google');
    }

    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const googleUser = userInfoResponse.data;
    
    if (!googleUser.email) {
      console.error('No email in Google user info:', googleUser);
      return redirectWithError(res, 'Failed to get email from Google account');
    }

    User.findByEmail(googleUser.email, (err, results) => {
      if (err) {
        console.error('Database error finding user:', err);
        return redirectWithError(res, 'Database error. Please try again.');
      }

      if (results.length > 0) {
    
        const user = results[0];
        try {
          const token = jwt.sign(
            {
              id: user.user_id,
              role: 'user',
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
              phone_number: user.phone_number || null
            },
            process.env.JWT_SECRET || "secret",
            { expiresIn: '24h' }
          );

          res.redirect(`${frontendUrl}/auth/callback?token=${token}&role=user`);
        } catch (jwtError) {
          console.error('JWT signing error:', jwtError);
          return redirectWithError(res, 'Failed to create authentication token');
        }
      } else {
      
        const nameParts = googleUser.name ? googleUser.name.split(' ') : ['User', ''];
        const first_name = nameParts[0] || googleUser.given_name || 'User';
        const last_name = nameParts.slice(1).join(' ') || googleUser.family_name || '';

        User.createGoogleUser(
          first_name,
          last_name,
          googleUser.email,
          googleUser.id,
          (err, result) => {
            if (err) {
              console.error('Error creating Google user:', err);
         
              if (err.code === 'ER_DUP_ENTRY') {
              
                User.findByEmail(googleUser.email, (findErr, findResults) => {
                  if (findErr || !findResults || findResults.length === 0) {
                    return redirectWithError(res, 'Failed to create account. Please try again.');
                  }
                  const user = findResults[0];
                  const token = jwt.sign(
                    {
                      id: user.user_id,
                      role: 'user',
                      first_name: user.first_name,
                      last_name: user.last_name,
                      email: user.email,
                      phone_number: user.phone_number || null
                    },
                    process.env.JWT_SECRET || "secret",
                    { expiresIn: '24h' }
                  );
                  res.redirect(`${frontendUrl}/auth/callback?token=${token}&role=user`);
                });
              } else {
                return redirectWithError(res, 'Failed to create account. Please try again.');
              }
              return;
            }

            try {
              const token = jwt.sign(
                {
                  id: result.insertId,
                  role: 'user',
                  first_name,
                  last_name,
                  email: googleUser.email,
                  phone_number: null
                },
                process.env.JWT_SECRET || "secret",
                { expiresIn: '24h' }
              );

              res.redirect(`${frontendUrl}/auth/callback?token=${token}&role=user`);
            } catch (jwtError) {
              console.error('JWT signing error:', jwtError);
              return redirectWithError(res, 'Failed to create authentication token');
            }
          }
        );
      }
    });
  } catch (error) {
    console.error('Google OAuth error:', error);

    if (error.response) {

      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      const errorMessage = error.response.data?.error || error.response.data?.error_description || 'Unknown error';
      return redirectWithError(res, `Authentication failed: ${errorMessage}`);
    } else if (error.request) {
      console.error('No response received:', error.request);
      return redirectWithError(res, 'No response from Google. Please check your internet connection.');
    } else {
    
      console.error('Error setting up request:', error.message);
      return redirectWithError(res, `Authentication failed: ${error.message || 'Unknown error'}`);
    }
  }
};

exports.updateProfilePicture = (req, res) => {
  const user_id = req.user.id;
  
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const profile_picture_path = `/uploads/profile-pictures/${req.file.filename}`;

  User.updateProfilePicture(user_id, profile_picture_path, (err, result) => {
    if (err) {
      console.error("Profile picture update error:", err);
      return res.status(500).json({ message: "Error updating profile picture", error: err });
    }

    User.findById(user_id, (findErr, userResults) => {
      if (findErr || !userResults || userResults.length === 0) {
        return res.status(500).json({ message: "Error fetching updated profile" });
      }

      const updatedUser = userResults[0];
      const userData = {
        id: updatedUser.user_id,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        email: updatedUser.email,
        phone_number: updatedUser.phone_number,
        username: updatedUser.username,
        profile_picture: updatedUser.profile_picture || null
      };
      
      res.status(200).json({
        success: true,
        message: "Profile picture updated successfully",
        user: userData
      });
    });
  });
};

exports.updateProfile = (req, res) => {
  const user_id = req.user.id;
  const { first_name, last_name, email, phone_number, profile_picture } = req.body;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ message: "First name, last name, and email are required" });
  }

  User.findByEmail(email, (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database error", error: err });
    }
    
    const emailTaken = results.length > 0 && results[0].user_id !== user_id;
    if (emailTaken) {
      return res.status(400).json({ message: "Email is already taken by another user" });
    }

    User.update(user_id, first_name, last_name, email, phone_number || null, profile_picture || null, (err, result) => {
      if (err) {
        console.error("Profile update error:", err);
        return res.status(500).json({ message: "Error updating profile", error: err });
      }

      User.findById(user_id, (findErr, userResults) => {
        if (findErr || !userResults || userResults.length === 0) {
          return res.status(500).json({ message: "Error fetching updated profile" });
        }

        const updatedUser = userResults[0];
        const userData = {
          id: updatedUser.user_id,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          email: updatedUser.email,
          phone_number: updatedUser.phone_number,
          username: updatedUser.username,
          profile_picture: updatedUser.profile_picture || null
        };
        
        res.status(200).json({
          success: true,
          message: "Profile updated successfully",
          user: userData
        });
      });
    });
  });
};