const crypto = require('crypto');
const Meeting = require('../models/Meeting');
const { ApiError, cleanString, isHttpUrl, isValidObjectId } = require('../utils/http');
const { emitToSignedIn } = require('../realtime');
const { onUserOffline } = require('../presence');

const USER_FIELDS = 'name avatar title employeeId';
const MINUTE_MS = 60 * 1000;
// Employees can enter the room shortly before the meeting starts.
const JOIN_EARLY_MS = 10 * MINUTE_MS;
// Ended meetings stay visible in the room panel for the rest of the working day.
const RECENT_WINDOW_MS = 12 * 60 * MINUTE_MS;
const MIN_DURATION = 5;
const MAX_DURATION = 8 * 60;

const populated = (query) => query.populate('participants.user', USER_FIELDS).populate('createdBy', 'name').lean();

const findPopulated = (id) => populated(Meeting.findById(id));

async function broadcast(id) {
  const meeting = await findPopulated(id);
  if (meeting) emitToSignedIn('meeting:update', meeting);
  return meeting;
}

function defaultLink(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `https://meet.jit.si/VOffice-${slug || 'meeting'}-${crypto.randomBytes(4).toString('hex')}`;
}

function parseInput(body, { partial = false } = {}) {
  const out = {};

  if (!partial || body.title !== undefined) {
    const title = cleanString(body.title, 120);
    if (title.length < 3) throw new ApiError(400, 'Please enter a meeting title (at least 3 characters)');
    out.title = title;
  }
  if (body.description !== undefined) out.description = cleanString(body.description, 1000);

  if (!partial || body.startsAt !== undefined) {
    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new ApiError(400, 'Please choose a valid start time');
    out.startsAt = startsAt;
  }

  if (!partial || body.durationMinutes !== undefined) {
    const duration = Number.parseInt(body.durationMinutes, 10);
    if (!Number.isFinite(duration) || duration < MIN_DURATION || duration > MAX_DURATION) {
      throw new ApiError(400, `Duration must be between ${MIN_DURATION} minutes and ${MAX_DURATION / 60} hours`);
    }
    out.durationMinutes = duration;
  }

  if (body.link !== undefined) {
    const link = cleanString(body.link, 500);
    if (link && !isHttpUrl(link)) throw new ApiError(400, 'Meeting link must start with http:// or https://');
    out.link = link;
  }
  return out;
}

// The meeting room is a single physical space: bookings may not overlap.
async function assertRoomFree(startsAt, endsAt, excludeId) {
  const clash = await Meeting.findOne({
    cancelled: false,
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select('title startsAt endsAt')
    .lean();
  if (clash) {
    const fmt = (d) => d.toISOString();
    throw new ApiError(409, `The meeting room is already booked for “${clash.title}” during that time.`, {
      clash: { title: clash.title, startsAt: fmt(clash.startsAt), endsAt: fmt(clash.endsAt) },
    });
  }
}

async function requireMeeting(id) {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Invalid meeting ID');
  const meeting = await Meeting.findById(id);
  if (!meeting) throw new ApiError(404, 'Meeting not found');
  return meeting;
}

async function listMeetings() {
  const now = Date.now();
  return populated(
    Meeting.find({ cancelled: false, endsAt: { $gte: new Date(now - RECENT_WINDOW_MS) } })
      .sort({ startsAt: 1 })
      .limit(50)
  );
}

async function createMeeting(body, admin) {
  const input = parseInput(body);
  if (input.startsAt.getTime() < Date.now() - 5 * MINUTE_MS) {
    throw new ApiError(400, 'The start time is in the past');
  }
  const endsAt = new Date(input.startsAt.getTime() + input.durationMinutes * MINUTE_MS);
  await assertRoomFree(input.startsAt, endsAt);

  const meeting = await Meeting.create({
    title: input.title,
    description: input.description || '',
    startsAt: input.startsAt,
    endsAt,
    link: input.link || defaultLink(input.title),
    createdBy: admin._id,
  });

  const full = await broadcast(meeting._id);
  emitToSignedIn('meeting:scheduled', {
    meetingId: meeting._id,
    title: meeting.title,
    startsAt: meeting.startsAt,
    createdBy: admin.name,
    time: meeting.createdAt,
  });
  return full;
}

async function updateMeeting(id, body) {
  const meeting = await requireMeeting(id);
  if (meeting.cancelled) throw new ApiError(400, 'This meeting was cancelled');
  if (meeting.endsAt.getTime() <= Date.now()) throw new ApiError(400, 'This meeting has already ended');

  const input = parseInput(body, { partial: true });
  const startsAt = input.startsAt || meeting.startsAt;
  const duration = input.durationMinutes ?? Math.round((meeting.endsAt - meeting.startsAt) / MINUTE_MS);
  const endsAt = new Date(startsAt.getTime() + duration * MINUTE_MS);
  if (input.startsAt && startsAt.getTime() !== meeting.startsAt.getTime() && startsAt.getTime() < Date.now() - 5 * MINUTE_MS) {
    throw new ApiError(400, 'The start time is in the past');
  }
  await assertRoomFree(startsAt, endsAt, meeting._id);

  if (input.title) meeting.title = input.title;
  if (input.description !== undefined) meeting.description = input.description;
  if (input.link !== undefined) meeting.link = input.link || defaultLink(meeting.title);
  meeting.startsAt = startsAt;
  meeting.endsAt = endsAt;
  await meeting.save();
  return broadcast(meeting._id);
}

async function cancelMeeting(id) {
  const meeting = await requireMeeting(id);
  meeting.cancelled = true;
  await meeting.save();
  emitToSignedIn('meeting:removed', { meetingId: meeting._id });
  return { message: 'Meeting cancelled' };
}

async function endMeeting(id) {
  const meeting = await requireMeeting(id);
  const now = new Date();
  if (meeting.cancelled || meeting.endsAt <= now) throw new ApiError(400, 'This meeting is not running');
  if (meeting.startsAt > now) throw new ApiError(400, 'This meeting has not started yet; cancel it instead');
  meeting.endsAt = now;
  meeting.participants.forEach((p) => {
    if (!p.leftAt) p.leftAt = now;
  });
  await meeting.save();
  return broadcast(meeting._id);
}

async function joinMeeting(id, user) {
  const meeting = await requireMeeting(id);
  const now = Date.now();
  if (meeting.cancelled) throw new ApiError(400, 'This meeting was cancelled');
  if (meeting.endsAt.getTime() <= now) throw new ApiError(400, 'This meeting has already ended');
  if (meeting.startsAt.getTime() - JOIN_EARLY_MS > now) {
    throw new ApiError(400, 'This meeting has not started yet. You can join 10 minutes before the start time.');
  }

  const rejoined = await Meeting.updateOne(
    { _id: meeting._id, 'participants.user': user._id },
    { $set: { 'participants.$.leftAt': null } }
  );
  if (rejoined.matchedCount === 0) {
    await Meeting.updateOne(
      { _id: meeting._id, 'participants.user': { $ne: user._id } },
      { $push: { participants: { user: user._id, joinedAt: new Date() } } }
    );
  }
  return broadcast(meeting._id);
}

async function leaveMeeting(id, user) {
  const meeting = await requireMeeting(id);
  await Meeting.updateOne(
    { _id: meeting._id, participants: { $elemMatch: { user: user._id, leftAt: null } } },
    { $set: { 'participants.$.leftAt': new Date() } }
  );
  return broadcast(meeting._id);
}

// People who close V-Office are removed from the meetings they were attending.
async function leaveAllMeetings(userId, leftAt = new Date()) {
  const meetings = await Meeting.find({ participants: { $elemMatch: { user: userId, leftAt: null } } })
    .select('_id')
    .lean();
  for (const { _id } of meetings) {
    await Meeting.updateOne(
      { _id, participants: { $elemMatch: { user: userId, leftAt: null } } },
      { $set: { 'participants.$.leftAt': leftAt } }
    );
    await broadcast(_id);
  }
}

onUserOffline(leaveAllMeetings);

module.exports = {
  listMeetings,
  createMeeting,
  updateMeeting,
  cancelMeeting,
  endMeeting,
  joinMeeting,
  leaveMeeting,
  leaveAllMeetings,
};
