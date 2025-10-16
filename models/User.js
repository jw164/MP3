import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'email is required'],
      trim: true,
      lowercase: true,
      unique: true
    },
    pendingTasks: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Task',
      default: []
    },
    dateCreated: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export default mongoose.model('User', UserSchema);
