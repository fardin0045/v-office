const toPublicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  employeeId: user.employeeId,
  role: user.role,
  assignedDesk: user.assignedDesk,
  workMode: user.workMode,
  avatar: user.avatar,
  department: user.department,
  title: user.title,
});

const defaultAvatar = (seed) => `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;

module.exports = { toPublicUser, defaultAvatar };
