import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'name is required'], trim: true },
    description: { type: String, default: '' },
    deadline: { type: Date, required: [true, 'deadline is required'] },
    completed: { type: Boolean, default: false },
    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    assignedUserName: { type: String, default: 'unassigned' },
    dateCreated: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export default mongoose.model('Task', TaskSchema);
