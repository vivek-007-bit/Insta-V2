import mongoose from 'mongoose';

let connectionPromise = null;

const connectDB = async () => {
  // Reuse active connection if already connected
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Share in-flight connection promise (prevents duplicate connects on cold start)
  if (connectionPromise) {
    return connectionPromise;
  }

  // Read and sanitize MONGO_URI (trim whitespace and accidental surrounding quotes)
  const rawUri = process.env.MONGO_URI;
  const mongoUri = rawUri ? rawUri.trim().replace(/^['"]|['"]$/g, '') : '';

  if (!mongoUri) {
    const err = new Error('MONGO_URI is not defined in environment variables');
    console.error('[MongoDB] Configuration error:', err.message);
    process.exit(1);
  }

  if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
    const err = new Error('MONGO_URI must start with "mongodb://" or "mongodb+srv://"');
    console.error('[MongoDB] Configuration error:', err.message);
    process.exit(1);
  }

  const options = {
    serverSelectionTimeoutMS: 10000
  };

  if (process.env.MONGODB_DATABASE) {
    options.dbName = process.env.MONGODB_DATABASE.trim();
  }

  connectionPromise = (async () => {
    try {
      const conn = await mongoose.connect(mongoUri, options);
      console.log(
        `[MongoDB] Connected successfully to MongoDB Atlas (${conn.connection.host} / ${conn.connection.name})`
      );

      mongoose.connection.on('error', (err) => {
        console.error(`[MongoDB] Runtime connection error: ${err.message}`);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('[MongoDB] Connection lost. Waiting for reconnection...');
      });

      return conn;
    } catch (error) {
      const msg = error.message || 'Unknown error';
      console.error(`[MongoDB] Connection error: ${msg}`);

      if (msg.toLowerCase().includes('bad auth') || msg.toLowerCase().includes('authentication failed')) {
        console.error(
          '[MongoDB] Authentication troubleshooting: Check that your Atlas Database Access username/password in server/.env are correct, special characters in the password are URL-encoded, and the user has readWrite permissions on the target database.'
        );
      } else if (msg.toLowerCase().includes('querysrv') || msg.toLowerCase().includes('enotfound')) {
        console.error(
          '[MongoDB] Network/DNS troubleshooting: Verify the MongoDB Atlas cluster hostname and check your Network Access IP allowlist.'
        );
      }

      process.exit(1);
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

export default connectDB;
