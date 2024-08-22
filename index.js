const express = require('express');
const fileUpload = require('express-fileupload');
const ffmpeg = require('fluent-ffmpeg');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(fileUpload());
app.use(express.json());

// Secret key for JWT (for simplicity, hard-coded here)
const JWT_SECRET = 'your_jwt_secret_key';

// Mock user database
const users = {
  user1: 'password1',
  user2: 'password2'
};

// Authentication middleware
const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization;
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username] === password) {
    // Generate a JWT token
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Upload video endpoint
app.post('/upload', authenticateJWT, (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  let video = req.files.video;
  const uploadPath = path.join(__dirname, 'uploads', video.name);

  // Save the uploaded video
  video.mv(uploadPath, (err) => {
    if (err) {
      return res.status(500).send(err);
    }

    res.json({ message: 'File uploaded successfully', filename: video.name });
  });
});

// Transcode video endpoint
app.post('/transcode', authenticateJWT, (req, res) => {
  const { filename, format } = req.body;

  const inputPath = path.join(__dirname, 'uploads', filename);
  const outputFilename = `${path.parse(filename).name}.${format}`;
  const outputPath = path.join(__dirname, 'uploads', outputFilename);

  if (!fs.existsSync(inputPath)) {
    return res.status(404).send('File not found.');
  }

  // Transcoding the video using fluent-ffmpeg
  ffmpeg(inputPath)
    .toFormat(format)
    .on('end', () => {
      res.json({ message: 'Transcoding complete', outputFile: outputFilename });
    })
    .on('error', (err) => {
      res.status(500).json({ message: 'Error during transcoding', error: err.message });
    })
    .save(outputPath);
});

// Download video endpoint
app.get('/download/:filename', authenticateJWT, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found.');
  }

  res.download(filePath, filename);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
