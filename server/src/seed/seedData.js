const mongoose = require('mongoose');
const config = require('../config/env');
const User = require('../models/User');
const Desk = require('../models/Desk');
const WorkSession = require('../models/WorkSession');
const Meeting = require('../models/Meeting');
const ChatMessage = require('../models/ChatMessage');
const connectDB = require('../config/db');
const { localDateKey } = require('../utils/time');

const TZ_OFFSET = new Date().getTimezoneOffset();

const DESK_CONFIGS = [
  // ZONE A — FRONT OPEN OFFICE (7 Desks: 4 in front row, 3 behind)
  { deskId: 'DESK-01', chairId: 'CHAIR-01', zone: 'ZONE_A', zoneName: 'Front Open Office', position: { x: -10, y: 0, z: 8, rotation: 0 } },
  { deskId: 'DESK-02', chairId: 'CHAIR-02', zone: 'ZONE_A', zoneName: 'Front Open Office', position: { x: -7, y: 0, z: 8, rotation: 0 } },
  { deskId: 'DESK-03', chairId: 'CHAIR-03', zone: 'ZONE_A', zoneName: 'Front Open Office', position: { x: -4, y: 0, z: 8, rotation: 0 } },
  { deskId: 'DESK-04', chairId: 'CHAIR-04', zone: 'ZONE_A', zoneName: 'Front Open Office', position: { x: -1, y: 0, z: 8, rotation: 0 } },
  { deskId: 'DESK-05', chairId: 'CHAIR-05', zone: 'ZONE_A', zoneName: 'Front Open Office', position: { x: -9, y: 0, z: 4, rotation: 0 } },
  { deskId: 'DESK-06', chairId: 'CHAIR-06', zone: 'ZONE_A', zoneName: 'Front Open Office', position: { x: -6, y: 0, z: 4, rotation: 0 } },
  { deskId: 'DESK-07', chairId: 'CHAIR-07', zone: 'ZONE_A', zoneName: 'Front Open Office', position: { x: -3, y: 0, z: 4, rotation: 0 } },

  // ZONE B — GUEST LOUNGE AREA (4 Desks: 3 in front of sofa, 1 beside)
  { deskId: 'DESK-08', chairId: 'CHAIR-08', zone: 'ZONE_B', zoneName: 'Business Team', position: { x: 2, y: 0, z: 8, rotation: 0 } },
  { deskId: 'DESK-09', chairId: 'CHAIR-09', zone: 'ZONE_B', zoneName: 'Business Team', position: { x: 5, y: 0, z: 8, rotation: 0 } },
  { deskId: 'DESK-10', chairId: 'CHAIR-10', zone: 'ZONE_B', zoneName: 'Business Team', position: { x: 8, y: 0, z: 8, rotation: 0 } },
  { deskId: 'DESK-11', chairId: 'CHAIR-11', zone: 'ZONE_B', zoneName: 'Business Team', position: { x: 11, y: 0, z: 8, rotation: 0 } },

  // ZONE C — ADDITIONAL OPEN WORKSPACE (8 Desks in 2 pods)
  { deskId: 'DESK-12', chairId: 'CHAIR-12', zone: 'ZONE_C', zoneName: 'Open Workspace Pods', position: { x: -9, y: 0, z: -2, rotation: 0 } },
  { deskId: 'DESK-13', chairId: 'CHAIR-13', zone: 'ZONE_C', zoneName: 'Open Workspace Pods', position: { x: -6, y: 0, z: -2, rotation: 0 } },
  { deskId: 'DESK-14', chairId: 'CHAIR-14', zone: 'ZONE_C', zoneName: 'Open Workspace Pods', position: { x: -9, y: 0, z: -4.5, rotation: Math.PI } },
  { deskId: 'DESK-15', chairId: 'CHAIR-15', zone: 'ZONE_C', zoneName: 'Open Workspace Pods', position: { x: -6, y: 0, z: -4.5, rotation: Math.PI } },
  { deskId: 'DESK-16', chairId: 'CHAIR-16', zone: 'ZONE_C', zoneName: 'Open Workspace Pods', position: { x: -1, y: 0, z: -2, rotation: 0 } },
  { deskId: 'DESK-17', chairId: 'CHAIR-17', zone: 'ZONE_C', zoneName: 'Open Workspace Pods', position: { x: 2, y: 0, z: -2, rotation: 0 } },
  { deskId: 'DESK-18', chairId: 'CHAIR-18', zone: 'ZONE_C', zoneName: 'Open Workspace Pods', position: { x: -1, y: 0, z: -4.5, rotation: Math.PI } },
  { deskId: 'DESK-19', chairId: 'CHAIR-19', zone: 'ZONE_C', zoneName: 'Open Workspace Pods', position: { x: 2, y: 0, z: -4.5, rotation: Math.PI } },

  // ZONE D — CEO EXECUTIVE ROOM (1 CEO Desk + Chair)
  { deskId: 'DESK-20', chairId: 'CHAIR-20', zone: 'ZONE_D', zoneName: 'CEO Executive Suite', position: { x: -17.5, y: 0, z: -14, rotation: 0 } },

  // ZONE E — SEPARATE 10-DESK WORKSPACE (10 Desks: 5 + 5 facing central aisle)
  { deskId: 'DESK-21', chairId: 'CHAIR-21', zone: 'ZONE_E', zoneName: 'Engineering Wing', position: { x: 16, y: 0, z: -12, rotation: Math.PI / 2 } },
  { deskId: 'DESK-22', chairId: 'CHAIR-22', zone: 'ZONE_E', zoneName: 'Engineering Wing', position: { x: 16, y: 0, z: -8, rotation: Math.PI / 2 } },
  { deskId: 'DESK-23', chairId: 'CHAIR-23', zone: 'ZONE_E', zoneName: 'Engineering Wing', position: { x: 16, y: 0, z: -4, rotation: Math.PI / 2 } },
  { deskId: 'DESK-24', chairId: 'CHAIR-24', zone: 'ZONE_E', zoneName: 'Engineering Wing', position: { x: 16, y: 0, z: 0, rotation: Math.PI / 2 } },
  { deskId: 'DESK-25', chairId: 'CHAIR-25', zone: 'ZONE_E', zoneName: 'Engineering Wing', position: { x: 16, y: 0, z: 4, rotation: Math.PI / 2 } },
  { deskId: 'DESK-26', chairId: 'CHAIR-26', zone: 'ZONE_E', zoneName: 'Engineering Wing', position: { x: 20, y: 0, z: -12, rotation: -Math.PI / 2 } },
  { deskId: 'DESK-27', chairId: 'CHAIR-27', zone: 'ZONE_E', zoneName: 'Engineering Wing', position: { x: 20, y: 0, z: -8, rotation: -Math.PI / 2 } },
  { deskId: 'DESK-28', chairId: 'CHAIR-28', zone: 'ZONE_E', zoneName: 'Engineering Wing', position: { x: 20, y: 0, z: -4, rotation: -Math.PI / 2 } },
  { deskId: 'DESK-29', chairId: 'CHAIR-29', zone: 'ZONE_E', zoneName: 'Engineering Wing', position: { x: 20, y: 0, z: 0, rotation: -Math.PI / 2 } },
  { deskId: 'DESK-30', chairId: 'CHAIR-30', zone: 'ZONE_E', zoneName: 'Engineering Wing', position: { x: 20, y: 0, z: 4, rotation: -Math.PI / 2 } },
];

const USERS = [
  {
    name: 'Admin Director',
    email: 'admin@voffice.local',
    password: 'Admin123!',
    employeeId: 'EMP-001',
    role: 'admin',
    department: 'Executive Management',
    title: 'Chief Operating Officer',
    assignedDesk: 'DESK-20',
    workMode: 'office',
  },
 
  {
    name: 'Maya Patel',
    email: 'maya.p@voffice.local',
    password: 'Employee123!',
    employeeId: 'EMP-004',
    role: 'employee',
    department: 'DevOps & Infrastructure',
    title: 'Cloud Solutions Architect',
    assignedDesk: 'DESK-03',
    workMode: 'office',
  },
  {
    name: 'Elena Rostova',
    email: 'elena.r@voffice.local',
    password: 'Employee123!',
    employeeId: 'EMP-006',
    role: 'employee',
    department: 'Data & Analytics',
    title: 'Senior Data Scientist',
    assignedDesk: 'DESK-08',
    workMode: 'office',
  },
  {
    name: 'James Wilson',
    email: 'james.w@voffice.local',
    password: 'Employee123!',
    employeeId: 'EMP-007',
    role: 'employee',
    department: 'Backend Engineering',
    title: 'Distributed Systems Engineer',
    assignedDesk: 'DESK-09',
    workMode: 'office',
  },
 
];

async function seed() {
  // Seeding wipes every collection, so it must be explicitly forced against a production database.
  if (config.isProduction && !process.argv.includes('--force')) {
    console.error('[Seed] Refusing to wipe a production database. Re-run with --force if you really mean it.');
    process.exit(1);
  }

  try {
    await connectDB();
    console.log('[Seed] Connected to database. Clearing collections...');

    await User.deleteMany({});
    await Desk.deleteMany({});
    await WorkSession.deleteMany({});
    await Meeting.deleteMany({});
    await ChatMessage.deleteMany({});

    console.log('[Seed] Creating users...');
    const createdUsers = [];
    for (const userData of USERS) {
      const user = await User.create({
        ...userData,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userData.name)}`,
      });
      createdUsers.push(user);
    }
    console.log(`[Seed] Created ${createdUsers.length} users.`);

    // Map user assignedDesk to user doc
    const deskToUserMap = new Map();
    createdUsers.forEach((u) => {
      if (u.assignedDesk) {
        deskToUserMap.set(u.assignedDesk, u);
      }
    });

    console.log('[Seed] Creating 30 desks...');
    const createdDesks = [];
    for (const d of DESK_CONFIGS) {
      const assignedUser = deskToUserMap.get(d.deskId);
      const isLocked = d.deskId === 'DESK-30'; // Example locked desk

      const deskDoc = await Desk.create({
        ...d,
        employeeId: assignedUser ? assignedUser._id : null,
        assignedEmployeeName: assignedUser ? assignedUser.name : '',
        status: isLocked ? 'locked' : 'available',
        locked: isLocked,
      });
      createdDesks.push(deskDoc);
    }
    console.log(`[Seed] Created ${createdDesks.length} desks.`);

    // Generate historical work sessions for the past 14 days
    console.log('[Seed] Generating historical work sessions...');
    const sessions = [];
    const now = new Date();

    for (let dayOffset = 13; dayOffset >= 1; dayOffset--) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() - dayOffset);
      const dateStr = localDateKey(targetDate, TZ_OFFSET);

      // Skip Sundays for realistic attendance
      if (targetDate.getDay() === 0) continue;

      for (const user of createdUsers) {
        // 85% probability employee worked on a given weekday
        if (Math.random() > 0.15) {
          const isRemote = user.workMode === 'remote' || Math.random() < 0.25;
          const checkInHour = 8 + Math.floor(Math.random() * 2); // 8 AM or 9 AM
          const checkInMin = Math.floor(Math.random() * 60);
          const workHours = 7 + Math.random() * 2; // 7 to 9 hours
          const durationSec = Math.round(workHours * 3600);

          const checkIn = new Date(targetDate);
          checkIn.setHours(checkInHour, checkInMin, 0, 0);

          const checkOut = new Date(checkIn.getTime() + durationSec * 1000);

          sessions.push({
            employeeId: user._id,
            deskId: isRemote ? null : user.assignedDesk,
            mode: isRemote ? 'remote' : 'office',
            checkIn,
            checkOut,
            duration: durationSec,
            date: dateStr,
            status: 'completed',
          });
        }
      }
    }

    // Today's active sessions: Set Maya Patel (DESK-03) and Alex Chen (DESK-02) as currently working
    const todayStr = localDateKey(now, TZ_OFFSET);
    const workingUsers = createdUsers.filter(
      (u) => u.assignedDesk === 'DESK-02' || u.assignedDesk === 'DESK-03'
    );

    for (const u of workingUsers) {
      const checkInTime = new Date();
      checkInTime.setHours(now.getHours() - 2, 15, 0, 0); // 2 hours 15 mins ago

      const activeSession = await WorkSession.create({
        employeeId: u._id,
        deskId: u.assignedDesk,
        mode: 'office',
        checkIn: checkInTime,
        lastSeenAt: new Date(),
        date: todayStr,
        status: 'working',
      });

      // Update the desk to status: 'working'
      await Desk.findOneAndUpdate(
        { deskId: u.assignedDesk },
        { status: 'working', currentSessionId: activeSession._id }
      );
    }

    if (sessions.length > 0) {
      await WorkSession.insertMany(sessions);
    }
    console.log(`[Seed] Created ${sessions.length + workingUsers.length} total work sessions.`);

    console.log('\n===============================================');
    console.log('   V-OFFICE DATABASE SEEDING COMPLETED!');
    console.log('===============================================');
    console.log('Demo Credentials:');
    console.log('  Admin:    admin@voffice.local     / Admin123!');
    console.log('  Employee: maya.p@voffice.local    / Employee123! (Assigned to DESK-03)');
    console.log('===============================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
}

seed();
